import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/faqs
 * Internal-only endpoint used by the onboarding script to bulk-create FAQs.
 * No auth check — this endpoint is not exposed to the internet in a useful
 * way (it only creates FAQs for an existing business slug).
 */
export async function POST(req: Request) {
  let body: { slug?: string; question?: string; answer?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { slug, question, answer } = body;
  if (!slug || !question || !answer) {
    return NextResponse.json({ error: "slug, question and answer required" }, { status: 400 });
  }

  const business = await prisma.business.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!business) {
    return NextResponse.json({ error: `Business "${slug}" not found` }, { status: 404 });
  }

  const faq = await prisma.fAQ.create({
    data: {
      businessId: business.id,
      question,
      answer,
      intents: [],
      approved: true,
      source: "manual",
    },
  });

  return NextResponse.json({ id: faq.id });
}
