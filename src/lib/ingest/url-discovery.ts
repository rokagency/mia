import { XMLParser } from "fast-xml-parser";
import { filterUrls, normalizeUrl } from "./url-filter";

/**
 * URL discovery — finds the candidate URLs for a site in a way that
 * scales across thousands of sites without manual configuration.
 *
 * Strategy (in order of preference):
 *   1. /sitemap.xml (and any sitemap_index → sitemaps)
 *   2. /robots.txt → Sitemap: lines
 *   3. BFS from the seed URL, limited by maxDepth + maxPages
 *
 * Everything goes through the URL filter so useless paths never make it
 * out. The same-origin enforcement keeps us from accidentally crawling
 * a partner site linked in the navigation.
 */

type DiscoverOptions = {
  /** Max URLs returned. Hard cap. */
  maxPages: number;
  /** Max link-following depth for the BFS fallback. */
  maxDepth: number;
  /** Per-request timeout (ms). */
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT = 15_000;
const UA = "DeskiaBot/0.1 (+https://deskia.example)";

const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  parseTagValue: true,
});

async function fetchText(
  url: string,
  timeoutMs = DEFAULT_TIMEOUT
): Promise<{ body: string; status: number } | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "text/html,application/xml,*/*" },
      signal: ctl.signal,
      redirect: "follow",
    });
    const body = await res.text();
    return { body, status: res.status };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Walk a sitemap or sitemap-index XML and collect <loc> URLs. */
async function readSitemap(url: string): Promise<string[]> {
  const resp = await fetchText(url);
  if (!resp || resp.status >= 400) return [];

  let parsed: unknown;
  try {
    parsed = xml.parse(resp.body);
  } catch {
    return [];
  }

  // Type-narrow the parsed XML. fast-xml-parser turns a single <url> into
  // an object instead of an array — handle both.
  const asArray = <T,>(v: T | T[] | undefined): T[] =>
    v === undefined ? [] : Array.isArray(v) ? v : [v];

  const out: string[] = [];

  // Sitemap index → recurse into each child sitemap
  const sitemapIndex = (parsed as { sitemapindex?: { sitemap?: unknown } })
    .sitemapindex?.sitemap;
  if (sitemapIndex) {
    const children = asArray(sitemapIndex) as { loc?: string }[];
    const childUrls = children.map((c) => c.loc).filter(Boolean) as string[];
    for (const child of childUrls) {
      out.push(...(await readSitemap(child)));
    }
    return out;
  }

  // Regular sitemap
  const urlset = (parsed as { urlset?: { url?: unknown } }).urlset?.url;
  if (urlset) {
    const entries = asArray(urlset) as { loc?: string }[];
    for (const entry of entries) {
      if (entry.loc) out.push(entry.loc);
    }
  }

  return out;
}

/** Parse robots.txt looking for `Sitemap:` directives. */
async function discoverSitemapsFromRobots(origin: string): Promise<string[]> {
  const resp = await fetchText(`${origin}/robots.txt`);
  if (!resp || resp.status >= 400) return [];
  return resp.body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^sitemap:/i.test(line))
    .map((line) => line.replace(/^sitemap:\s*/i, "").trim())
    .filter(Boolean);
}

/**
 * Cheap BFS fallback for sites without a usable sitemap. Stays within
 * the seed origin and respects maxDepth / maxPages. Not a full crawler
 * — just enough to find the public-facing pages for a small business.
 */
async function bfsFromSeed(
  seed: string,
  maxDepth: number,
  maxPages: number
): Promise<string[]> {
  const origin = new URL(seed).origin;
  const seen = new Set<string>([seed]);
  const queue: Array<{ url: string; depth: number }> = [
    { url: seed, depth: 0 },
  ];

  while (queue.length && seen.size < maxPages) {
    const { url, depth } = queue.shift()!;
    if (depth >= maxDepth) continue;

    const resp = await fetchText(url);
    if (!resp || resp.status >= 400) continue;

    // Extract anchors with a permissive regex — we just need URL candidates.
    // The dedicated extractor will pull clean content; here we're only
    // scouting links.
    const hrefRe = /<a\b[^>]*\bhref=["']([^"'#]+)["']/gi;
    let m: RegExpExecArray | null;
    while ((m = hrefRe.exec(resp.body))) {
      const raw = m[1];
      let absolute: string;
      try {
        absolute = new URL(raw, url).toString();
      } catch {
        continue;
      }
      const norm = normalizeUrl(absolute);
      if (!norm) continue;
      if (new URL(norm).origin !== origin) continue;
      if (seen.has(norm)) continue;
      seen.add(norm);
      queue.push({ url: norm, depth: depth + 1 });
      if (seen.size >= maxPages) break;
    }
  }

  return [...seen];
}

export async function discoverUrls(
  seed: string,
  opts: DiscoverOptions
): Promise<{ urls: string[]; via: "sitemap" | "robots" | "bfs" }> {
  const origin = new URL(seed).origin;

  // 1) /sitemap.xml at the origin root
  const direct = await readSitemap(`${origin}/sitemap.xml`);
  if (direct.length > 0) {
    return {
      urls: filterUrls(direct, { sameOrigin: origin }).slice(0, opts.maxPages),
      via: "sitemap",
    };
  }

  // 2) robots.txt
  const fromRobots = await discoverSitemapsFromRobots(origin);
  if (fromRobots.length > 0) {
    const all: string[] = [];
    for (const sm of fromRobots) all.push(...(await readSitemap(sm)));
    if (all.length > 0) {
      return {
        urls: filterUrls(all, { sameOrigin: origin }).slice(0, opts.maxPages),
        via: "robots",
      };
    }
  }

  // 3) BFS fallback
  const crawled = await bfsFromSeed(seed, opts.maxDepth, opts.maxPages * 2);
  return {
    urls: filterUrls(crawled, { sameOrigin: origin }).slice(0, opts.maxPages),
    via: "bfs",
  };
}
