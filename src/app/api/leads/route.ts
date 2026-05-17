import { NextResponse } from "next/server";
import { listLeads } from "@/lib/leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Dev-only listing endpoint. No auth — do NOT ship beyond local dev as-is.
 * When this leaves Santiago's machine, gate behind admin auth or move
 * behind a private dashboard route.
 */
export async function GET() {
  const leads = await listLeads();
  return NextResponse.json({ count: leads.length, leads });
}
