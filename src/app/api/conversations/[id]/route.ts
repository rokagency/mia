import { NextResponse } from "next/server";
import { getConversation } from "@/lib/conversations";

export const runtime = "nodejs";

/**
 * Dev-only single-conversation endpoint. Returns the full transcript
 * including every message, plus any leads linked to the conversation.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const conversation = await getConversation(id);
  if (!conversation) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 }
    );
  }
  return NextResponse.json({ conversation });
}
