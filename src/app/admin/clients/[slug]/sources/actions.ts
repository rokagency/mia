"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

/**
 * Queue a new IngestJob for an existing KnowledgeSource. The worker
 * polls every few seconds and will pick it up.
 */
export async function reindexAction(slug: string, sourceId: string) {
  // Sanity check: the source must belong to this business.
  const source = await prisma.knowledgeSource.findFirst({
    where: { id: sourceId, business: { slug } },
    select: { id: true },
  });
  if (!source) throw new Error("Source not found for this business");

  await prisma.ingestJob.create({
    data: {
      sourceId: source.id,
      status: "pending",
      driver: "ts-fetch",
    },
  });
  revalidatePath(`/admin/clients/${slug}/sources`);
  revalidatePath(`/admin/clients/${slug}/jobs`);
}

export async function createSourceAction(slug: string, fd: FormData) {
  const url = String(fd.get("url") ?? "").trim();
  const kind = String(fd.get("kind") ?? "sitemap").trim();
  const maxPages = Number(fd.get("maxPages") ?? 100);
  const maxDepth = Number(fd.get("maxDepth") ?? 2);
  if (!url) return;
  const business = await prisma.business.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!business) throw new Error("Business not found");
  const source = await prisma.knowledgeSource.create({
    data: {
      businessId: business.id,
      url,
      kind,
      maxPages,
      maxDepth,
      status: "active",
    },
  });
  await prisma.ingestJob.create({
    data: { sourceId: source.id, status: "pending", driver: "ts-fetch" },
  });
  revalidatePath(`/admin/clients/${slug}/sources`);
  revalidatePath(`/admin/clients/${slug}/jobs`);
}
