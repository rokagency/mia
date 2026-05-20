/**
 * URL filtering for the ingest pipeline.
 *
 * Two goals:
 *   1. Drop URLs that won't produce useful chat-grounding content
 *      (carts, login, search, pagination, etc.) — see USELESS_PATTERNS.
 *   2. Normalize URLs so we don't index the same page twice under
 *      different tracking parameters or trailing slashes — see normalizeUrl.
 */

const USELESS_PATTERNS: RegExp[] = [
  // WordPress admin / system
  /\/wp-admin\//i,
  /\/wp-login/i,
  /\/wp-content\/uploads\//i,
  /\/wp-json/i,
  /\/xmlrpc\.php/i,

  // E-commerce / account
  /\/cart\/?$/i,
  /\/checkout\/?/i,
  /\/my-account\/?/i,
  /\/account\/?$/i,
  /\/orders\/?/i,
  /\/wishlist\/?/i,

  // Auth
  /\/login\/?$/i,
  /\/signin\/?$/i,
  /\/register\/?$/i,
  /\/signup\/?$/i,
  /\/password(-reset)?/i,
  /\/logout/i,

  // Search & taxonomies
  /\/search\/?/i,
  /\?s=/i,
  /\/tag\//i,
  /\/category\//i,
  /\/author\//i,

  // WordPress custom taxonomies (service_category, product-category,
  // portfolio_category, etc.). These are archive/listing pages that
  // typically have no original content — just thumbnails + permalinks.
  /\/[a-z0-9_-]+_category\//i,
  /\/[a-z0-9_-]+-category\//i,
  /\/portfolio[_-]?(category|tag)\//i,
  /\/product[_-]?(category|tag)\//i,

  // Feeds
  /\/feed\/?$/i,
  /\/rss\/?$/i,
  /\/comments\/feed/i,

  // Legal boilerplate (often duplicated, rarely useful for chat grounding)
  /\/privacy(-policy)?/i,
  /\/terms(-(of-service|of-use|and-conditions))?/i,
  /\/cookies?(-policy)?/i,
  /\/aviso-?legal/i,
  /\/politica-?privacidad/i,
  /\/politica-?cookies/i,

  // Pagination
  /\/page\/\d+/i,
  /[?&]page=\d+/i,
  /[?&]p=\d+/i,

  // WordPress preview / draft / revision URLs
  /[?&]preview=true/i,
  /[?&]preview_id=/i,
  /[?&]status=draft/i,
  /[?&]revision=/i,

  // AMP / print variants (duplicate content)
  /\/amp\/?$/i,
  /[?&]amp=1/i,
  /[?&]print=/i,

  // Static assets
  /\.(pdf|jpg|jpeg|png|gif|webp|svg|ico|css|js|mjs|map|xml|zip|tar|gz|mp3|mp4|mov|woff2?|ttf|eot)(\?|$)/i,
];

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "msclkid",
  "yclid",
  "mc_cid",
  "mc_eid",
  "_ga",
  "_gl",
  "ref",
  "ref_src",
]);

export function normalizeUrl(input: string): string | null {
  let u: URL;
  try {
    u = new URL(input);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;

  // Drop fragment — same content
  u.hash = "";

  // Drop tracking params; keep meaningful query
  for (const key of [...u.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(key.toLowerCase())) {
      u.searchParams.delete(key);
    }
  }

  // Trailing slash on path (except root) — collapse so /about and /about/ are one
  if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
    u.pathname = u.pathname.replace(/\/+$/, "");
  }

  // Lowercase host (case-insensitive)
  u.hostname = u.hostname.toLowerCase();

  return u.toString();
}

export function isUseless(url: string): boolean {
  return USELESS_PATTERNS.some((re) => re.test(url));
}

type FilterOpts = {
  /** Only keep URLs on this origin (host + protocol). Optional. */
  sameOrigin?: string;
};

/**
 * Normalize, dedupe, filter. Returns a deterministic, sorted list.
 */
export function filterUrls(urls: string[], opts: FilterOpts = {}): string[] {
  const seen = new Set<string>();
  for (const raw of urls) {
    const norm = normalizeUrl(raw);
    if (!norm) continue;
    if (isUseless(norm)) continue;
    if (opts.sameOrigin && new URL(norm).origin !== opts.sameOrigin) continue;
    seen.add(norm);
  }
  return [...seen].sort();
}
