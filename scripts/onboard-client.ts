/**
 * scripts/onboard-client.ts
 *
 * AI-assisted onboarding script. Crawls a client's website, uses the same
 * OpenAI model as the app to extract the business config, then creates the
 * business in production via the API and saves the config + FAQs.
 *
 * Usage:
 *   npx tsx scripts/onboard-client.ts \
 *     --url https://example.com \
 *     --slug example \
 *     --whatsapp 5491134567890 \
 *     --language es
 *
 * Required env vars (same as the app):
 *   OPENAI_API_KEY
 *
 * Required flags:
 *   --url      Client's website URL
 *   --slug     URL slug for the client (kebab-case, e.g. clinica-rodriguez)
 *
 * Optional flags:
 *   --prod-url   Base URL of your production server (default: https://mia.agenciarok.es)
 *   --whatsapp   WhatsApp handoff number (international digits, no +)
 *   --language   es | en (default: es)
 *   --max-pages  Max pages to crawl (default: 20)
 *   --dry-run    Print the extracted config without posting to the API
 */

import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { TsFetchExtractor } from "@/lib/ingest/extractor";
import { discoverUrls } from "@/lib/ingest/url-discovery";

// ── CLI args ────────────────────────────────────────────────────────────────

function arg(name: string): string | undefined {
  const flag = `--${name}`;
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  // --name=value form
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

const websiteUrl = arg("url");
const slug = arg("slug");
const prodUrl = arg("prod-url") ?? "https://mia.agenciarok.es";
const whatsapp = arg("whatsapp");
const language = (arg("language") ?? "es") as "es" | "en" | "de";
const maxPages = Number(arg("max-pages") ?? "20");
const dryRun = process.argv.includes("--dry-run");

if (!websiteUrl || !slug) {
  console.error("Usage: npx tsx scripts/onboard-client.ts --url <url> --slug <slug>");
  process.exit(1);
}

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

// ── Extraction schema ───────────────────────────────────────────────────────

const channelSchema = z.object({
  type: z.enum(["phone", "whatsapp", "email", "instagram", "tiktok", "facebook", "website", "googleMaps"]),
  value: z.string(),
  label: z.string().optional(),
});

const extractionSchema = z.object({
  name: z.string().describe("Full business name"),
  tagline: z.string().optional().describe("Short slogan or tagline if present"),
  about: z.string().optional().describe("2–3 sentence description of the business"),
  address: z.string().optional().describe("Full street address if found"),
  timezone: z.string().optional().describe("IANA timezone, e.g. America/Argentina/Buenos_Aires"),
  greeting: z.string().describe("A warm first message for the chat assistant, in the business language, ending with 👋"),
  contactChannels: z.array(channelSchema).describe("Phone numbers, emails, social handles, etc."),
  bookingChannels: z.array(channelSchema).describe("Links or numbers used specifically for booking appointments"),
  openingHours: z.object({
    monday: z.object({ open: z.string(), close: z.string() }).optional(),
    tuesday: z.object({ open: z.string(), close: z.string() }).optional(),
    wednesday: z.object({ open: z.string(), close: z.string() }).optional(),
    thursday: z.object({ open: z.string(), close: z.string() }).optional(),
    friday: z.object({ open: z.string(), close: z.string() }).optional(),
    saturday: z.object({ open: z.string(), close: z.string() }).optional(),
    sunday: z.object({ open: z.string(), close: z.string() }).optional(),
  }).describe("Opening hours per day in HH:mm format. Omit closed days."),
  attributes: z.array(z.string()).describe("Key differentiators worth mentioning, one per item"),
  faqs: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })).describe("5–10 frequently asked questions extracted or inferred from the website content"),
});

type Extracted = z.infer<typeof extractionSchema>;

// ── Crawl ───────────────────────────────────────────────────────────────────

async function crawl(url: string, max: number): Promise<string> {
  console.log(`\n[crawl] Discovering URLs from ${url}…`);
  const { urls, via } = await discoverUrls(url, { maxPages: max, maxDepth: 3 });
  console.log(`[crawl] Found ${urls.length} URLs via ${via}`);

  const extractor = new TsFetchExtractor();
  const parts: string[] = [];
  let fetched = 0;

  for (const pageUrl of urls) {
    const result = await extractor.fetch(pageUrl);
    if (!result) continue;
    parts.push(`## ${result.title ?? pageUrl}\n\n${result.contentMd}`);
    fetched++;
    process.stdout.write(`\r[crawl] Fetched ${fetched}/${urls.length} pages`);
  }
  console.log();
  return parts.join("\n\n---\n\n");
}

// ── Extract with OpenAI ─────────────────────────────────────────────────────

async function extract(content: string, url: string): Promise<Extracted> {
  console.log(`\n[ai] Extracting business info with ${MODEL}…`);

  // Keep context within token limits — gpt-4o-mini has 128k but we want fast + cheap
  const trimmed = content.slice(0, 80_000);

  const { object } = await generateObject({
    model: openai(MODEL),
    schema: extractionSchema,
    prompt: `You are extracting structured business information from website content.

Website URL: ${url}
Language: ${language}

Website content:
${trimmed}

Instructions:
- Extract the business name, about, address, contact channels, opening hours, and booking channels from the content.
- For greeting: write a warm, natural first message the chat assistant will send, in ${language === "es" ? "Spanish (Argentine voseo)" : "English"}, ending with 👋.
- For opening hours: use HH:mm format (e.g. "09:00", "18:30"). Only include days that appear to be open.
- For timezone: infer from the country/city if found. Default to America/Argentina/Buenos_Aires if Argentine.
- For contactChannels: include phone numbers, emails, WhatsApp, Instagram, etc. found on the site.
- For bookingChannels: only include links/numbers specifically for booking appointments (calendar links, WhatsApp booking, etc.).
- For attributes: 3–6 key differentiators (e.g. "Más de 10 años de experiencia", "Turno online disponible").
- For faqs: write 5–10 Q&A pairs covering what visitors typically ask: services, prices, location, booking, hours, etc. Use content from the site; don't invent prices if not shown.
- Be concise and factual. Do not invent information not present in the content.`,
  });

  return object;
}

// ── Post to production API ──────────────────────────────────────────────────

async function post(path: string, body: unknown): Promise<unknown> {
  const url = `${prodUrl}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`POST ${path} → ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

// ── Build config from extracted data ───────────────────────────────────────

function buildConfig(extracted: Extracted): Record<string, unknown> {
  const oh: Record<string, { open: string; close: string }[]> = {};
  for (const [day, range] of Object.entries(extracted.openingHours)) {
    if (range) oh[day] = [{ open: range.open, close: range.close }];
  }

  return {
    greeting: extracted.greeting,
    address: extracted.address,
    timezone: extracted.timezone,
    tagline: extracted.tagline,
    about: extracted.about,
    openingHours: oh,
    contactChannels: extracted.contactChannels,
    bookingChannels: extracted.bookingChannels,
    attributes: extracted.attributes,
    ...(whatsapp ? { whatsappHandoff: { number: whatsapp } } : {}),
  };
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== Mia Client Onboarding ===`);
  console.log(`Slug:     ${slug}`);
  console.log(`Website:  ${websiteUrl}`);
  console.log(`Server:   ${prodUrl}`);
  console.log(`Dry run:  ${dryRun}`);

  // 1. Crawl the website
  const content = await crawl(websiteUrl!, maxPages);
  if (!content.trim()) {
    console.error("[error] Could not fetch any content from the website.");
    process.exit(1);
  }

  // 2. Extract structured data
  const extracted = await extract(content, websiteUrl!);

  console.log("\n[extracted]");
  console.log(JSON.stringify(extracted, null, 2));

  if (dryRun) {
    console.log("\n[dry-run] Skipping API calls. Done.");
    return;
  }

  const config = buildConfig(extracted);

  // 3. Create the business
  console.log(`\n[api] Creating business "${extracted.name}" (${slug})…`);
  const created = await post("/api/onboard", {
    slug,
    name: extracted.name,
    websiteUrl,
    language,
    bookingMode: whatsapp ? "whatsapp_handoff" : "data_collection",
    config,
  }) as { businessId: string; jobId: string };
  console.log(`[api] Created: businessId=${created.businessId} jobId=${created.jobId}`);

  // 4. Save FAQs
  if (extracted.faqs.length > 0) {
    console.log(`\n[api] Saving ${extracted.faqs.length} FAQs…`);
    for (const faq of extracted.faqs) {
      await post(`/api/admin/faqs`, {
        slug,
        question: faq.question,
        answer: faq.answer,
      });
    }
    console.log(`[api] FAQs saved.`);
  }

  // 5. Done
  console.log(`\n✓ Done! Review and adjust at:`);
  console.log(`  ${prodUrl}/admin/clients/${slug}`);
  console.log(`\n  Remember to:`);
  console.log(`  • Set allowed origins (client's domain)`);
  console.log(`  • Upload the logo`);
  console.log(`  • Add the embed snippet to their site`);
}

main().catch((err) => {
  console.error("\n[error]", err instanceof Error ? err.message : err);
  process.exit(1);
});
