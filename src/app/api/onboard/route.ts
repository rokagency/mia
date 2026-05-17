import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Onboarding endpoint.
 *
 * Creates a Business + a KnowledgeSource pointing at the site's root,
 * plus an initial IngestJob in `pending` state. The worker picks it up
 * within a few seconds and indexes the site. Caller can poll
 * /api/jobs/:id for progress.
 *
 * Auth: none in dev. When this leaves Santiago's machine, gate behind
 * an admin token.
 */

// Slugs that clash with our own static routes / API namespaces. These
// would silently be shadowed by Next's static-route precedence, so we
// reject them up front rather than create unreachable businesses.
const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "widget.js",
  "_next",
  "favicon.ico",
]);

const onboardSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "slug must be kebab-case lowercase alphanumeric")
    .refine((s) => !RESERVED_SLUGS.has(s), "slug is reserved"),
  name: z.string().min(2).max(120),
  websiteUrl: z.string().url(),
  industry: z.string().max(40).optional(),
  language: z.enum(["es", "en"]).default("es"),
  bookingMode: z
    .enum(["whatsapp_handoff", "data_collection", "calendar_integration"])
    .default("data_collection"),
  config: z.record(z.unknown()).default({}),
  ingest: z
    .object({
      maxPages: z.number().int().positive().max(500).default(100),
      maxDepth: z.number().int().positive().max(5).default(2),
    })
    .default({ maxPages: 100, maxDepth: 2 }),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = onboardSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const input = parsed.data;

  // Reject duplicate slug up front for a friendlier error than the DB
  // unique constraint would give.
  const existing = await prisma.business.findUnique({
    where: { slug: input.slug },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: `Business with slug "${input.slug}" already exists` },
      { status: 409 }
    );
  }

  // Create business + first source + first job atomically so we never
  // end up with a half-onboarded client on a transient failure.
  const result = await prisma.$transaction(async (tx) => {
    const business = await tx.business.create({
      data: {
        slug: input.slug,
        name: input.name,
        websiteUrl: input.websiteUrl,
        industry: input.industry,
        language: input.language,
        bookingMode: input.bookingMode,
        config: input.config as object,
      },
    });

    const source = await tx.knowledgeSource.create({
      data: {
        businessId: business.id,
        kind: "sitemap", // discovery falls back if no sitemap exists
        url: input.websiteUrl,
        maxPages: input.ingest.maxPages,
        maxDepth: input.ingest.maxDepth,
      },
    });

    const job = await tx.ingestJob.create({
      data: { sourceId: source.id, driver: "ts-fetch" },
    });

    return { business, source, job };
  });

  return NextResponse.json(
    {
      businessId: result.business.id,
      sourceId: result.source.id,
      jobId: result.job.id,
      message:
        "Business created and ingest job queued. Poll /api/jobs/:jobId for progress.",
    },
    { status: 201 }
  );
}
