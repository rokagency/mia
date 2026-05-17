import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";
import type { ExtractionResult, ExtractorDriver } from "./types";

/**
 * TS-fetch extractor.
 *
 * Pipeline per URL:
 *   HEAD (optional, for change detection) → GET → JSDOM → Readability
 *   → Turndown → cleaned markdown.
 *
 * Covers the typical local-business site: WordPress, plain HTML,
 * Squarespace, Wix static. For JS-heavy SPAs the content will be empty
 * and the runner will mark the URL as failed; later we'll route those
 * through a headless-browser driver (Crawl4AI / Playwright).
 *
 * Returns `null` on common failures (4xx, empty content) so the runner
 * can move on without throwing.
 */

const UA = "DeskiaBot/0.1 (+https://deskia.example)";
const TIMEOUT_MS = 20_000;
const MIN_CONTENT_LENGTH = 80; // skip pages with essentially nothing

// Selectors removed from the DOM before Readability runs. Readability is
// generally good but small businesses' WordPress themes are noisy — being
// explicit about chrome here improves output meaningfully.
const STRIP_SELECTORS = [
  "header",
  "footer",
  "nav",
  "aside",
  ".cookie",
  "#cookie",
  ".popup",
  ".modal",
  ".toolbar",
  ".breadcrumb",
  ".breadcrumbs",
  "[role='navigation']",
  "[role='banner']",
  "[role='contentinfo']",
  "script",
  "style",
  "noscript",
  "iframe",
];

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
});

// Strip empty links / images — Readability sometimes leaves them
turndown.addRule("strip-empty-links", {
  filter: (node) =>
    node.nodeName === "A" && (node.textContent ?? "").trim().length === 0,
  replacement: () => "",
});

async function fetchHtml(
  url: string
): Promise<{ html: string; finalUrl: string; etag?: string; lastModified?: Date } | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "text/html,*/*" },
      signal: ctl.signal,
      redirect: "follow",
    });
    if (res.status >= 400) return null;

    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("html")) return null;

    const html = await res.text();
    const lm = res.headers.get("last-modified");
    return {
      html,
      finalUrl: res.url,
      etag: res.headers.get("etag") ?? undefined,
      lastModified: lm ? new Date(lm) : undefined,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function htmlToMarkdown(html: string, url: string): { title: string | null; md: string } {
  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;

  // Strip chrome and known noise
  for (const sel of STRIP_SELECTORS) {
    doc.querySelectorAll(sel).forEach((el) => el.remove());
  }

  const titleFromDom = doc.querySelector("title")?.textContent?.trim() ?? null;

  let articleHtml = doc.body.innerHTML;
  let articleTitle = titleFromDom;

  // Readability mutates the DOM; clone first so the title fallback still
  // sees the original.
  try {
    const clone = dom.window.document.cloneNode(true) as Document;
    const reader = new Readability(clone);
    const parsed = reader.parse();
    if (parsed && parsed.content && parsed.content.length > 200) {
      articleHtml = parsed.content;
      articleTitle = parsed.title || titleFromDom;
    }
  } catch {
    // Readability throws on some pages — fall through to body HTML.
  }

  const md = turndown
    .turndown(articleHtml)
    // Collapse 3+ blank lines that Turndown sometimes emits
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { title: articleTitle, md };
}

export class TsFetchExtractor implements ExtractorDriver {
  readonly name = "ts-fetch";

  async fetch(url: string): Promise<ExtractionResult | null> {
    const fetched = await fetchHtml(url);
    if (!fetched) return null;

    const { title, md } = htmlToMarkdown(fetched.html, fetched.finalUrl);
    if (md.length < MIN_CONTENT_LENGTH) return null;

    return {
      url: fetched.finalUrl,
      title,
      contentMd: md,
      httpEtag: fetched.etag,
      httpLastModified: fetched.lastModified,
    };
  }
}
