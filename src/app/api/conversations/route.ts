import { NextResponse } from "next/server";
import { listConversations } from "@/lib/conversations";

export const runtime = "nodejs";

/**
 * Dev-only listing endpoint for conversations. No auth — do NOT ship
 * beyond local dev as-is.
 *
 * For a single conversation transcript, hit /api/conversations/:id (TODO)
 * or use Prisma Studio.
 */
export async function GET() {
  const conversations = await listConversations();
  return NextResponse.json({
    count: conversations.length,
    conversations: conversations.map((c) => ({
      id: c.id,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      messageCount: c.messageCount,
      whatsappHandoff: c.whatsappHandoff,
      leadCount: c._count.leads,
      locale: c.locale,
    })),
  });
}
