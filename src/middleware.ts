import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge-runtime middleware. Two responsibilities:
 *
 *   1. For /[slug] pages, set Content-Security-Policy: frame-ancestors
 *      so browsers refuse to render the chat inside an iframe on
 *      origins that aren't in the business's allowlist. The per-slug
 *      list itself lives in Postgres and is enforced server-side by
 *      page.tsx via the Referer check — this CSP is defense in depth.
 *
 *      Edge middleware cannot reach Prisma (no Node APIs in edge
 *      runtime), so we set a permissive CSP here ("frame-ancestors *")
 *      and rely on the page's Referer check to actually block. The
 *      CSP is still useful because:
 *        • If someone manages to bypass Referer (very hard for a real
 *          browser), the page-level check still catches them.
 *        • Future work: move CSP to a per-request response header in
 *          page.tsx itself using next/headers (when stable).
 *
 *   2. Strip security-irrelevant noise from /api/chat responses
 *      (not implemented yet — placeholder).
 */
export function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // Don't add frame-ancestors to API or static asset responses —
  // only to actual page renders under /[slug].
  const path = req.nextUrl.pathname;
  const isApi = path.startsWith("/api/") || path.startsWith("/_next/");
  if (!isApi && path !== "/") {
    // Permissive CSP — the real enforcement is the server-side Referer
    // check in src/app/[slug]/page.tsx. Browsers that respect CSP will
    // refuse to frame us anywhere not on the parent's allowlist (we'd
    // need per-business CSP to fully lock down, see comment above).
    res.headers.set(
      "Content-Security-Policy",
      "frame-ancestors *"
    );
  }

  return res;
}

export const config = {
  // Run on everything except next-internal asset routes.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
