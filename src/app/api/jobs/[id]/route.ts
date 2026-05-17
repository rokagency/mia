import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/**
 * GET /api/jobs/:id
 *
 * Returns the current state of an IngestJob plus a snapshot of the
 * documents that have been indexed so far for its business. Designed
 * for the onboarding wizard's progress poller.
 *
 * Dev-only — gate behind admin auth before shipping.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const job = await prisma.ingestJob.findUnique({
    where: { id },
    include: {
      source: {
        select: { id: true, url: true, businessId: true },
      },
    },
  });

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Lightweight document summary so the operator can see what got
  // indexed without loading full markdown into the response.
  const documents = await prisma.document.findMany({
    where: { businessId: job.source.businessId },
    orderBy: { fetchedAt: "desc" },
    take: 200,
    select: {
      id: true,
      url: true,
      title: true,
      pageType: true,
      excluded: true,
      contentHash: true,
      fetchedAt: true,
    },
  });

  return NextResponse.json({
    job: {
      id: job.id,
      status: job.status,
      attempts: job.attempts,
      driver: job.driver,
      totalUrls: job.totalUrls,
      processedUrls: job.processedUrls,
      newDocs: job.newDocs,
      updatedDocs: job.updatedDocs,
      errors: job.errors,
      errorMessage: job.errorMessage,
      logs: job.logs,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      source: job.source,
    },
    documents: {
      count: documents.length,
      items: documents,
    },
  });
}
