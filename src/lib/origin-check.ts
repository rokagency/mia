/**
 * Match a request's Origin (or Referer) against a business's
 * allowedOrigins list.
 *
 * Rules:
 *   • Exact origin match (scheme + host + port).
 *   • The literal allowlist entry "http://localhost:*" matches any
 *     http://localhost:PORT, for dev convenience.
 *
 * Pass either the value of the `Origin` header (preferred — sent by
 * browsers on cross-origin requests, including framed POSTs) or the
 * `Referer` (used for top-level navigations where there's no Origin).
 *
 * Returns the normalized origin on match, or null on miss.
 */

export function matchAllowedOrigin(
  candidate: string | null | undefined,
  allowed: readonly string[]
): string | null {
  if (!candidate) return null;
  if (allowed.length === 0) return null;

  let origin: string;
  try {
    // Accepts either a full URL (Referer is a full URL) or a bare origin
    // (Origin header is just scheme + host + port).
    origin = new URL(candidate).origin;
  } catch {
    return null;
  }

  for (const entry of allowed) {
    if (entry === origin) return origin;
    if (entry === "http://localhost:*" && /^http:\/\/localhost(:\d+)?$/.test(origin)) {
      return origin;
    }
  }
  return null;
}

/**
 * Build the `Content-Security-Policy: frame-ancestors ...` value for
 * a given allowedOrigins list. Used to tell browsers which parent
 * pages can iframe a chat page. "http://localhost:*" expands to
 * "http://localhost:*" which is valid CSP syntax.
 *
 * Empty list → "'none'" (page can't be framed anywhere).
 */
export function frameAncestorsCsp(allowed: readonly string[]): string {
  if (allowed.length === 0) return "frame-ancestors 'none'";
  return `frame-ancestors ${allowed.join(" ")}`;
}
