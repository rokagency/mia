import { NextResponse, type NextRequest } from "next/server";

const ADMIN_COOKIE = "mia_admin";

/**
 * Edge-safe HMAC-SHA256 using Web Crypto. Mirrors the Node `createHmac`
 * used by src/lib/admin-auth.ts so tokens issued by the server actions
 * (Node runtime) verify here (Edge runtime).
 */
async function hmacHex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeStrEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyAdminToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return false;
  const dot = token.indexOf(".");
  if (dot < 1) return false;
  const payload = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = await hmacHex(secret, payload);
  if (!timingSafeStrEq(mac, expected)) return false;
  const expSec = Number.parseInt(payload, 10);
  if (!Number.isFinite(expSec)) return false;
  return Date.now() / 1000 < expSec;
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // ── /admin gate ─────────────────────────────────────────────────
  if (path.startsWith("/admin")) {
    // The login page itself must be reachable without a session.
    const isLogin = path === "/admin/login" || path.startsWith("/admin/login/");
    if (!isLogin) {
      const token = req.cookies.get(ADMIN_COOKIE)?.value;
      const ok = await verifyAdminToken(token);
      if (!ok) {
        const url = req.nextUrl.clone();
        url.pathname = "/admin/login";
        url.search = "";
        return NextResponse.redirect(url);
      }
    }
  }

  // ── Default response with CSP for /[slug] pages ─────────────────
  const res = NextResponse.next();
  const isApi = path.startsWith("/api/") || path.startsWith("/_next/");
  if (!isApi && path !== "/" && !path.startsWith("/admin")) {
    // Permissive frame-ancestors — the page-level Referer check in
    // src/app/[slug]/page.tsx is the real gate for embed access.
    res.headers.set("Content-Security-Policy", "frame-ancestors *");
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
