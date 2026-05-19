"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { prisma } from "@/lib/db";
import { isAuthenticated } from "@/lib/admin-auth";
import { TsFetchExtractor } from "@/lib/ingest/extractor";
import { discoverUrls } from "@/lib/ingest/url-discovery";

const RESERVED_SLUGS = new Set([
  "admin", "api", "widget.js", "_next", "favicon.ico", "new", "uploads",
]);

const formSchema = z.object({
  websiteUrl: z.string().url("Must be a valid URL"),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers and hyphens")
    .refine((s) => !RESERVED_SLUGS.has(s), "That slug is reserved"),
  language: z.enum(["es", "en", "de"]).default("es"),
  bookingMode: z.enum(["whatsapp_handoff", "data_collection", "cta_url"]).default("whatsapp_handoff"),
  whatsapp: z.string().optional(),
  maxPages: z.coerce.number().int().min(5).max(200).default(50),
});

// ── Extraction schema (same as the local script) ─────────────────────────────

const channelSchema = z.object({
  type: z.enum(["phone", "whatsapp", "email", "instagram", "tiktok", "facebook", "website", "googleMaps"]),
  value: z.string(),
  label: z.string().optional(),
});

const extractionSchema = z.object({
  name: z.string(),
  tagline: z.string().optional(),
  about: z.string().optional(),
  address: z.string().optional(),
  timezone: z.string().optional(),
  greeting: z.string(),
  contactChannels: z.array(channelSchema),
  bookingChannels: z.array(channelSchema),
  openingHours: z.object({
    monday: z.object({ open: z.string(), close: z.string() }).optional(),
    tuesday: z.object({ open: z.string(), close: z.string() }).optional(),
    wednesday: z.object({ open: z.string(), close: z.string() }).optional(),
    thursday: z.object({ open: z.string(), close: z.string() }).optional(),
    friday: z.object({ open: z.string(), close: z.string() }).optional(),
    saturday: z.object({ open: z.string(), close: z.string() }).optional(),
    sunday: z.object({ open: z.string(), close: z.string() }).optional(),
  }),
  attributes: z.array(z.string()),
  faqs: z.array(z.object({ question: z.string(), answer: z.string() })),
  links: z.array(z.object({ title: z.string(), url: z.string(), description: z.string() })).default([]),
});

type State =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "done"; slug: string };

// ── Crawl ─────────────────────────────────────────────────────────────────────

async function crawlSite(url: string, maxPages: number): Promise<string> {
  const { urls } = await discoverUrls(url, { maxPages, maxDepth: 3 });
  const extractor = new TsFetchExtractor();
  const parts: string[] = [];
  for (const pageUrl of urls) {
    const result = await extractor.fetch(pageUrl);
    if (result) parts.push(`## ${result.title ?? pageUrl}\n\n${result.contentMd}`);
  }
  return parts.join("\n\n---\n\n");
}

// ── AI extraction ─────────────────────────────────────────────────────────────

async function extractWithAI(content: string, url: string, language: string) {
  const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const { object } = await generateObject({
    model: openai(MODEL),
    schema: extractionSchema,
    prompt: `You are extracting structured business information from website content.

Website URL: ${url}
Language: ${language}

Website content:
${content.slice(0, 80_000)}

Instructions:
- Extract name, about, address, contact channels, opening hours, booking channels.
- For greeting: write a warm first message in ${language === "es" ? "Spanish (Argentine voseo)" : language === "de" ? "German (formal Sie)" : "English"}, ending with 👋.
- For opening hours: use HH:mm format. Only include open days.
- For timezone: infer from country/city. Default to America/Argentina/Buenos_Aires if Argentine, Europe/Berlin if German.
- For contactChannels: phone, email, WhatsApp, Instagram, etc. found on the site.
- For bookingChannels: only links/numbers specifically for booking appointments.
- For attributes: 3–6 key differentiators worth mentioning.
- For faqs: 5–10 Q&A pairs from the site content. Don't invent prices.
- For links: extract important forms, resources, or actions the business offers online (e.g. patient referral forms, appointment request forms, contact forms, patient portal, online booking). For each link include: title (human-readable name), url (the full URL), and description (1 sentence explaining what the form/link is for). Only include links that are clearly useful to a potential customer. Leave empty if none found.
- Be factual. Do not add information not present in the content.`,
  });
  return object;
}

// ── Server action ─────────────────────────────────────────────────────────────

export async function onboardAiAction(
  _prev: State,
  fd: FormData
): Promise<State> {
  if (!(await isAuthenticated())) {
    return { status: "error", message: "Not authenticated." };
  }

  const raw = {
    websiteUrl: fd.get("websiteUrl"),
    slug: String(fd.get("slug") ?? "").toLowerCase().trim(),
    language: fd.get("language"),
    bookingMode: fd.get("bookingMode"),
    whatsapp: fd.get("whatsapp") || undefined,
  };

  const parsed = formSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join(". ");
    return { status: "error", message: msg };
  }
  const input = parsed.data;

  // Reject duplicate slug
  const existing = await prisma.business.findUnique({
    where: { slug: input.slug },
    select: { id: true },
  });
  if (existing) {
    return { status: "error", message: `A client with slug "${input.slug}" already exists.` };
  }

  // Crawl
  let content: string;
  try {
    content = await crawlSite(input.websiteUrl, input.maxPages);
  } catch (err) {
    return { status: "error", message: `Failed to crawl website: ${err instanceof Error ? err.message : "unknown error"}` };
  }
  if (!content.trim()) {
    return { status: "error", message: "Could not fetch any content from that website. Check the URL and try again." };
  }

  // AI extraction
  let extracted: Awaited<ReturnType<typeof extractWithAI>>;
  try {
    extracted = await extractWithAI(content, input.websiteUrl, input.language);
  } catch (err) {
    return { status: "error", message: `AI extraction failed: ${err instanceof Error ? err.message : "unknown error"}` };
  }

  // Build config
  const oh: Record<string, { open: string; close: string }[]> = {};
  for (const [day, range] of Object.entries(extracted.openingHours)) {
    if (range) oh[day] = [{ open: range.open, close: range.close }];
  }

  const config: Record<string, unknown> = {
    greeting: extracted.greeting,
    address: extracted.address,
    timezone: extracted.timezone,
    tagline: extracted.tagline,
    about: extracted.about,
    openingHours: oh,
    contactChannels: extracted.contactChannels,
    bookingChannels: extracted.bookingChannels,
    attributes: extracted.attributes,
    ...(input.whatsapp ? { whatsappHandoff: { number: input.whatsapp } } : {}),
  };

  // Write to DB atomically
  await prisma.$transaction(async (tx) => {
    const business = await tx.business.create({
      data: {
        slug: input.slug,
        name: extracted.name,
        websiteUrl: input.websiteUrl,
        language: input.language,
        bookingMode: input.bookingMode,
        config: config as object,
      },
    });

    const source = await tx.knowledgeSource.create({
      data: {
        businessId: business.id,
        kind: "sitemap",
        url: input.websiteUrl,
        maxPages: 100,
        maxDepth: 2,
      },
    });

    await tx.ingestJob.create({
      data: { sourceId: source.id, driver: "ts-fetch" },
    });

    const faqRows = [
      ...extracted.faqs.map((f) => ({
        businessId: business.id,
        question: f.question,
        answer: f.answer,
        intents: [],
        approved: true,
        source: "manual",
      })),
      ...extracted.links.map((l) => ({
        businessId: business.id,
        question: l.title,
        answer: `${l.description} ${l.url}`,
        intents: [],
        approved: true,
        source: "manual",
      })),
    ];
    if (faqRows.length > 0) {
      await tx.fAQ.createMany({ data: faqRows });
    }
  });

  redirect(`/admin/clients/${input.slug}`);
}
