import type { FAQ as DbFaq, Business as DbBusiness } from "@prisma/client";
import { prisma } from "./db";
import type { Business as BusinessShape, FAQ as FaqShape } from "@/businesses/types";

/**
 * Server-side helper to fetch the active business + its FAQs from the DB.
 *
 * Single-tenant for now: the slug comes from ACTIVE_BUSINESS_SLUG env var
 * (default `dra-sofia-vazquez`). When we go multi-tenant, this resolves
 * by subdomain or route param — consumers (layout, page, chat route) keep
 * the same call signature.
 *
 * Returns the business in the SAME shape consumers used to import from
 * the TS files (`{ name, language, hours, services, ... }`), so the prompt
 * builder and ChatWindow need no shape change — they just receive props
 * instead of importing.
 */

const ACTIVE_SLUG = process.env.ACTIVE_BUSINESS_SLUG ?? "dra-sofia-vazquez";

export type ActiveBusiness = {
  /** DB id — needed for retrieval / logging. */
  id: string;
  /** URL-safe slug. */
  slug: string;
  /** The full business shape as the prompt/UI expect. */
  business: BusinessShape;
  /** Approved FAQs for this business. */
  faqs: readonly FaqShape[];
  /** Origins allowed to embed this business's chat. */
  allowedOrigins: readonly string[];
};

function dbToBusinessShape(b: DbBusiness): BusinessShape {
  const config = (b.config ?? {}) as Partial<BusinessShape>;
  return {
    ...config,
    name: b.name,
    language: (b.language as "es" | "en" | "de") ?? "es",
    bookingMode: (b.bookingMode as BusinessShape["bookingMode"]) ?? "data_collection",
  } as BusinessShape;
}

function dbToFaqShape(f: DbFaq): FaqShape {
  return {
    id: f.id,
    question: f.question,
    answer: f.answer,
    intents: f.intents,
  };
}

export async function getActiveBusiness(slug?: string): Promise<ActiveBusiness> {
  const targetSlug = slug ?? ACTIVE_SLUG;
  const row = await prisma.business.findUnique({
    where: { slug: targetSlug },
    include: {
      faqs: {
        where: { approved: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!row) {
    throw new Error(
      `Business "${targetSlug}" not found in DB. Run \`npm run db:seed\` or check the slug.`
    );
  }

  return {
    id: row.id,
    slug: row.slug,
    business: dbToBusinessShape(row),
    faqs: row.faqs.map(dbToFaqShape),
    allowedOrigins: row.allowedOrigins,
  };
}

/**
 * Like getActiveBusiness but returns null if not found, instead of throwing.
 * Use this from request handlers that need to render a 404 page on a bad slug.
 */
export async function findBusinessBySlug(
  slug: string
): Promise<ActiveBusiness | null> {
  try {
    return await getActiveBusiness(slug);
  } catch {
    return null;
  }
}
