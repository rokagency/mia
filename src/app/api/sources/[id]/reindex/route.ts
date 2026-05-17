import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/**
 * POST /api/sources/:id/reindex
 *
 * Queue a new IngestJob for an existing KnowledgeSource. Used after a
 * pipeline change (better filters, classifier tweaks, new extractor)
 * to re-process a site without going through full onboarding again.
 *
 * Body (optional):
 *   { "driver": "ts-fetch" | "crawl4ai" | "jina" }   // defaults to ts-fetch
 */
type Body = { driver?: string };

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const source = await prisma.knowledgeSource.findUnique({ where: { id } });
  if (!source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    // Empty body is fine.
  }

  const job = await prisma.ingestJob.create({
    data: {
      sourceId: source.id,
      driver: body.driver ?? "ts-fetch",
    },
  });

  return NextResponse.json(
    {
      jobId: job.id,
      sourceId: source.id,
      message: "Re-index job queued. Poll /api/jobs/:jobId for progress.",
    },
    { status: 202 }
  );
}
