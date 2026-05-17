/**
 * Seeds the Business + FAQ tables from the TypeScript modules under
 * src/businesses/<slug>/.
 *
 * Idempotent: re-runnable. Upserts the Business by slug, replaces FAQs
 * for that business on each run (cleanest semantics — FAQs are a
 * source-of-truth refresh, not an append).
 *
 * Run with:
 *   docker compose exec web npm run db:seed
 *
 * Once we have an admin UI for editing businesses + FAQs, this script
 * becomes the "import client from TS template" tool, not the everyday
 * source of truth.
 */

import { prisma } from "@/lib/db";

import {
  business as sofiaBusiness,
  faqs as sofiaFaqs,
} from "@/businesses/dra-sofia-vazquez";
import {
  business as lumenBusiness,
  faqs as lumenFaqs,
} from "@/businesses/lumen-clinic";
import type { Business as BusinessShape, FAQ as FaqShape } from "@/businesses/types";

type SeedEntry = {
  slug: string;
  industry?: string;
  websiteUrl?: string;
  business: BusinessShape;
  faqs: readonly FaqShape[];
};

const ENTRIES: SeedEntry[] = [
  {
    slug: "dra-sofia-vazquez",
    industry: "medical",
    websiteUrl: "https://drasofiavazquez.com.ar",
    business: sofiaBusiness,
    faqs: sofiaFaqs,
  },
  {
    slug: "lumen-clinic",
    industry: "medical",
    business: lumenBusiness,
    faqs: lumenFaqs,
  },
];

/**
 * Splits the TS Business shape into:
 *   - the columns lifted out for SQL filtering (name, language, bookingMode)
 *   - everything else, stuffed into `config` JSON
 */
function splitForDb(b: BusinessShape) {
  const { name, language, bookingMode, ...config } = b;
  return { name, language, bookingMode: bookingMode ?? "data_collection", config };
}

async function seedOne(entry: SeedEntry): Promise<void> {
  const { name, language, bookingMode, config } = splitForDb(entry.business);

  const business = await prisma.business.upsert({
    where: { slug: entry.slug },
    create: {
      slug: entry.slug,
      name,
      language,
      bookingMode,
      industry: entry.industry,
      websiteUrl: entry.websiteUrl,
      config,
    },
    update: {
      name,
      language,
      bookingMode,
      industry: entry.industry,
      websiteUrl: entry.websiteUrl,
      config,
    },
  });

  // Replace FAQs wholesale — simplest semantics for a seed source.
  await prisma.$transaction([
    prisma.fAQ.deleteMany({ where: { businessId: business.id, source: "manual" } }),
    prisma.fAQ.createMany({
      data: entry.faqs.map((f) => ({
        businessId: business.id,
        question: f.question,
        answer: f.answer,
        intents: [...f.intents],
        source: "manual",
        approved: true,
      })),
    }),
  ]);

  console.log(
    `[seed] ${entry.slug}: business id=${business.id}, ${entry.faqs.length} FAQs`
  );
}

async function main() {
  console.log(`[seed] Seeding ${ENTRIES.length} business(es) from TS modules…`);
  for (const entry of ENTRIES) {
    await seedOne(entry);
  }
  console.log(`[seed] Done.`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("[seed] failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
