import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAuthenticated } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!(await isAuthenticated())) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { slug } = await params;
  const business = await prisma.business.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });
  if (!business) return new NextResponse("Not found", { status: 404 });

  const conversations = await prisma.conversation.findMany({
    where: { businessId: business.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          role: true,
          content: true,
          model: true,
          createdAt: true,
        },
      },
    },
  });

  const rows: string[] = [
    ["conversation_id", "timestamp", "role", "model", "message"].join("\t"),
  ];

  for (const conv of conversations) {
    for (const msg of conv.messages) {
      rows.push(
        [
          conv.id,
          msg.createdAt.toISOString(),
          msg.role,
          msg.model ?? "",
          // Escape tabs and newlines so the TSV stays valid
          (msg.content ?? "").replace(/\t/g, " ").replace(/\n/g, " ↵ "),
        ].join("\t")
      );
    }
  }

  const tsv = rows.join("\n");
  const filename = `${slug}-conversations-${new Date().toISOString().slice(0, 10)}.tsv`;

  return new NextResponse(tsv, {
    headers: {
      "Content-Type": "text/tab-separated-values; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
