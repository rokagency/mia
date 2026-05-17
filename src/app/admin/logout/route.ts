import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const c = await cookies();
  c.delete(ADMIN_COOKIE_NAME);
  const url = new URL("/admin/login", req.url);
  return NextResponse.redirect(url, { status: 303 });
}
