"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

async function businessIdBySlug(slug: string): Promise<string> {
  const b = await prisma.business.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!b) throw new Error(`Business ${slug} not found`);
  return b.id;
}

export async function updateFaqAction(
  slug: string,
  id: string,
  fd: FormData
) {
  const question = String(fd.get("question") ?? "").trim();
  const answer = String(fd.get("answer") ?? "").trim();
  const approved = String(fd.get("approved") ?? "") === "on";
  if (!question || !answer) throw new Error("question + answer required");

  await prisma.fAQ.update({
    where: { id },
    data: { question, answer, approved },
  });
  revalidatePath(`/admin/clients/${slug}/faqs`);
  revalidatePath(`/${slug}`);
}

export async function createFaqAction(slug: string, fd: FormData) {
  const question = String(fd.get("question") ?? "").trim();
  const answer = String(fd.get("answer") ?? "").trim();
  if (!question || !answer) return; // silently ignore empty submit
  const businessId = await businessIdBySlug(slug);
  await prisma.fAQ.create({
    data: {
      businessId,
      question,
      answer,
      intents: [],
      approved: true,
      source: "manual",
    },
  });
  revalidatePath(`/admin/clients/${slug}/faqs`);
  revalidatePath(`/${slug}`);
}

export async function deleteFaqAction(slug: string, id: string) {
  await prisma.fAQ.delete({ where: { id } });
  revalidatePath(`/admin/clients/${slug}/faqs`);
  revalidatePath(`/${slug}`);
}
