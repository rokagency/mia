/**
 * Deskia ingest worker.
 *
 * A long-running Node process that polls Postgres for pending IngestJob
 * rows and runs them through the pipeline (URL discovery → extraction
 * → classification → chunking → upsert). One job at a time.
 *
 * Lifecycle:
 *   • Boots, prints banner, enters poll loop.
 *   • Each cycle: SELECT one pending job (FIFO). If none, sleep
 *     POLL_INTERVAL_MS and loop. If one, run it to completion.
 *   • On SIGINT/SIGTERM (compose down): finish the current job, exit.
 *
 * Concurrency = 1 by design for MVP. The polling SELECT uses a
 * row-level update so adding a second worker later is a one-line
 * change (FOR UPDATE SKIP LOCKED), no schema migration.
 *
 * Why poll and not BullMQ/Redis: avoids a second piece of
 * infrastructure for the MVP. When we hit ~100 active clients we'll
 * switch — IngestJob already has the shape a queue would need.
 */

import { prisma } from "@/lib/db";
import { runIngestJob } from "@/lib/ingest/runner";

const POLL_INTERVAL_MS = 5_000;

let shuttingDown = false;
process.on("SIGINT", () => {
  console.log("[worker] SIGINT received — will exit after current job.");
  shuttingDown = true;
});
process.on("SIGTERM", () => {
  console.log("[worker] SIGTERM received — will exit after current job.");
  shuttingDown = true;
});

async function claimNextJob(): Promise<string | null> {
  // Atomic claim: only mark `pending` → `running` rows we still see as
  // pending. updateMany returns a count; if 0, someone else (future)
  // claimed it. We pick by oldest createdAt for FIFO fairness.
  const next = await prisma.ingestJob.findFirst({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!next) return null;

  const claimed = await prisma.ingestJob.updateMany({
    where: { id: next.id, status: "pending" },
    data: { status: "running" },
  });
  return claimed.count === 1 ? next.id : null;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  console.log("[worker] Deskia ingest worker online.");
  while (!shuttingDown) {
    const jobId = await claimNextJob().catch((err) => {
      console.error("[worker] claim failed:", err);
      return null;
    });

    if (!jobId) {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    console.log(`[worker] running job ${jobId}`);
    const startedAt = Date.now();
    try {
      await runIngestJob(jobId);
      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
      console.log(`[worker] job ${jobId} done in ${elapsed}s`);
    } catch (err) {
      console.error(`[worker] job ${jobId} crashed:`, err);
      // runIngestJob handles its own status updates, but if it threw
      // before any handler ran, mark the job failed so it doesn't
      // remain stuck on "running" forever.
      await prisma.ingestJob
        .updateMany({
          where: { id: jobId, status: "running" },
          data: {
            status: "failed",
            completedAt: new Date(),
            errorMessage: err instanceof Error ? err.message : String(err),
          },
        })
        .catch(() => {});
    }
  }
  console.log("[worker] graceful shutdown complete.");
  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("[worker] fatal:", err);
  await prisma.$disconnect();
  process.exit(1);
});
