import { prisma } from "@/lib/db";
import { chunkMarkdown } from "./chunker";
import { classifyPage } from "./classifier";
import { contentHash } from "./hash";
import { discoverUrls } from "./url-discovery";
import { TsFetchExtractor } from "./extractor";
import type { ExtractorDriver } from "./types";

/**
 * Orchestrates a single IngestJob end-to-end.
 *
 *   load job → discover URLs → for each URL: extract, classify, dedupe by
 *   hash, upsert Document + Chunks → update job progress → mark completed.
 *
 * Errors on individual URLs increment the job's error counter but do not
 * fail the whole job — large sites WILL have a few broken pages.
 *
 * Called by the worker (src/worker/index.ts) and (optionally) by API
 * routes when the operator wants to retry a single job synchronously.
 */

const EXTRACTORS: Record<string, () => ExtractorDriver> = {
  "ts-fetch": () => new TsFetchExtractor(),
  // future:
  //   "crawl4ai": () => new Crawl4AiClient(process.env.CRAWL4AI_URL!),
  //   "jina":     () => new JinaReader(),
};

export async function runIngestJob(jobId: string): Promise<void> {
  const job = await prisma.ingestJob.update({
    where: { id: jobId },
    data: { status: "running", startedAt: new Date(), attempts: { increment: 1 } },
    include: { source: true },
  });

  const make = EXTRACTORS[job.driver];
  if (!make) {
    await prisma.ingestJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        completedAt: new Date(),
        errorMessage: `Unknown driver: ${job.driver}`,
      },
    });
    return;
  }
  const extractor = make();

  try {
    // ── 1. Discover URLs ─────────────────────────────────────────────
    const { urls, via } = await discoverUrls(job.source.url, {
      maxPages: job.source.maxPages,
      maxDepth: job.source.maxDepth,
    });

    await prisma.ingestJob.update({
      where: { id: jobId },
      data: {
        totalUrls: urls.length,
        logs: { discovery: { count: urls.length, via } },
      },
    });

    if (urls.length === 0) {
      await prisma.ingestJob.update({
        where: { id: jobId },
        data: {
          status: "completed",
          completedAt: new Date(),
          errorMessage: "No URLs discovered (no sitemap, robots, or reachable pages).",
        },
      });
      return;
    }

    // ── 2. Process each URL ──────────────────────────────────────────
    for (const url of urls) {
      try {
        const result = await extractor.fetch(url);
        if (!result) {
          await bumpJob(jobId, { errors: 1, processedUrls: 1 });
          continue;
        }

        const hash = contentHash(result.contentMd);
        const pageType = classifyPage(url, result.title);

        // Look up existing doc by (businessId, url). If hash matches we
        // skip the chunk rewrite — cheap path on re-indexing.
        const existing = await prisma.document.findUnique({
          where: { businessId_url: { businessId: job.source.businessId, url } },
          select: { id: true, contentHash: true },
        });

        if (existing && existing.contentHash === hash) {
          await bumpJob(jobId, { processedUrls: 1 });
          continue;
        }

        const doc = await prisma.document.upsert({
          where: { businessId_url: { businessId: job.source.businessId, url } },
          create: {
            businessId: job.source.businessId,
            url,
            title: result.title,
            pageType,
            contentMd: result.contentMd,
            contentHash: hash,
            httpEtag: result.httpEtag,
            httpLastModified: result.httpLastModified,
            sitemapLastmod: result.sitemapLastmod,
            fetchedAt: new Date(),
            indexedAt: new Date(),
          },
          update: {
            title: result.title,
            pageType,
            contentMd: result.contentMd,
            contentHash: hash,
            httpEtag: result.httpEtag,
            httpLastModified: result.httpLastModified,
            sitemapLastmod: result.sitemapLastmod,
            fetchedAt: new Date(),
            indexedAt: new Date(),
          },
        });

        // Rewrite chunks (deleteMany + createMany inside a transaction
        // so the doc is never in a state where stale + new chunks coexist).
        const chunks = chunkMarkdown(result.contentMd);
        await prisma.$transaction([
          prisma.chunk.deleteMany({ where: { documentId: doc.id } }),
          prisma.chunk.createMany({
            data: chunks.map((text, position) => ({
              documentId: doc.id,
              businessId: job.source.businessId,
              text,
              position,
              pageType,
            })),
          }),
        ]);

        await bumpJob(jobId, {
          processedUrls: 1,
          ...(existing ? { updatedDocs: 1 } : { newDocs: 1 }),
        });
      } catch (err) {
        console.error(`[ingest] ${jobId} failed on ${url}:`, err);
        await bumpJob(jobId, { errors: 1, processedUrls: 1 });
      }
    }

    // ── 3. Post-process: auto-exclude duplicate-content docs ─────────
    // Real WordPress themes often repeat a generic CTA / hero block
    // across many "index" pages. After Readability strips chrome those
    // pages reduce to the same blob, polluting retrieval with the same
    // sentence over and over. Mark them excluded so they're persisted
    // for inspection but don't contaminate chat answers.
    const duplicates = await prisma.document.groupBy({
      by: ["contentHash"],
      where: { businessId: job.source.businessId },
      _count: { _all: true },
      having: { contentHash: { _count: { gt: 1 } } },
    });
    if (duplicates.length > 0) {
      const dupHashes = duplicates.map((d) => d.contentHash);
      await prisma.document.updateMany({
        where: {
          businessId: job.source.businessId,
          contentHash: { in: dupHashes },
        },
        data: { excluded: true, excludedReason: "duplicate_content" },
      });
    }

    // ── 4. Wrap up ───────────────────────────────────────────────────
    await prisma.$transaction([
      prisma.ingestJob.update({
        where: { id: jobId },
        data: { status: "completed", completedAt: new Date() },
      }),
      prisma.knowledgeSource.update({
        where: { id: job.source.id },
        data: { lastReindexedAt: new Date() },
      }),
    ]);
  } catch (err) {
    await prisma.ingestJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        completedAt: new Date(),
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    });
  }
}

type Counters = Partial<
  Record<"processedUrls" | "newDocs" | "updatedDocs" | "errors", number>
>;

async function bumpJob(jobId: string, counters: Counters): Promise<void> {
  await prisma.ingestJob.update({
    where: { id: jobId },
    data: Object.fromEntries(
      Object.entries(counters).map(([k, v]) => [k, { increment: v }])
    ),
  });
}
