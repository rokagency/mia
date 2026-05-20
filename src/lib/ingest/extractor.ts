import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";
import type { ExtractionResult, ExtractorDriver } from "./types";

/**
 * TS-fetch extractor.
 *
 * Pipeline per URL:
 *   HEAD (optional, for change detection) → GET → JSDOM
 *   → pre-process (unwrap hidden widgets, strip noise)
 *   → Readability → Turndown → cleaned markdown.
 *
 * Covers the typical local-business site: WordPress, plain HTML,
 * Squarespace, Wix static. For JS-heavy SPAs the content will be empty
 * and the runner will mark the URL as failed.
 *
 * Returns `null` on common failures (4xx, empty content) so the runner
 * can move on without throwing.
 */

const UA = "DeskiaBot/0.1 (+https://deskia.example)";
const TIMEOUT_MS = 20_000;
const MIN_CONTENT_LENGTH = 80;

// Chrome and noise stripped before Readability runs.
const STRIP_SELECTORS = [
  "script",
  "style",
  "noscript",
  "iframe",
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
  // Ads and social widgets
  ".ad",
  ".ads",
  ".advertisement",
  '[class*="ad-unit"]',
  ".social-widget",
  ".fb-like",
  ".instagram-media",
  // Comment sections — not useful for grounding
  ".comments",
  ".comment-section",
  "#comments",
  // WordPress shortcode artifacts rendered as empty wrappers
  ".vc_empty_space",
  ".wpb_single_image",
  // Related posts / suggested content
  ".related-posts",
  ".related",
  '[class*="related"]',
  // Print/share bars
  ".print-button",
  '[class*="share-bar"]',
  // AMP elements that leak through
  "amp-ad",
  "amp-social-share",
];

// Elements whose content is useful but which are hidden/collapsed by
// CSS or JS (accordions, tabs, toggles). We replace them with plain
// divs so Readability keeps the text instead of discarding it.
//
// Order matters: more specific selectors first so we don't double-unwrap.
const HIDDEN_CONTENT_SELECTORS = [
  // Nectar / Salient (Weck Dental uses this)
  ".inner-toggle-wrap",
  ".toggle-title",
  // Generic accordion / tab patterns
  ".accordion-title",
  ".accordion-content",
  ".accordion-body",
  ".accordion-header",
  ".faq-question",
  ".faq-answer",
  ".faq-item",
  // Bootstrap collapse / tabs
  ".collapse",
  ".tab-content",
  ".tab-pane",
  '[role="tabpanel"]',
  // jQuery UI
  ".ui-accordion-content",
  ".ui-tabs-panel",
  // Elementor
  ".elementor-tab-content",
  ".elementor-accordion-item",
  ".elementor-toggle-item",
  // WPBakery
  ".vc_tta-panel-body",
  ".vc_tta-section-inner",
  // Divi
  ".et_pb_toggle_content",
  ".et_pb_tab_content",
  // Wildcard class patterns (last — most expensive)
  '[class*="accordion"]',
  '[class*="toggle-content"]',
  '[class*="collapse-content"]',
  '[class*="tab-panel"]',
];

// WordPress content containers — help Readability find the article on
// themes that don't use semantic <article>/<main> tags.
const WP_CONTENT_SELECTORS = [
  ".entry-content",
  ".post-content",
  ".page-content",
  ".site-content",
  ".wpb_wrapper",
  ".vc_column-inner",
  ".elementor-widget-container",
];

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
});

turndown.addRule("strip-empty-links", {
  filter: (node) =>
    node.nodeName === "A" && (node.textContent ?? "").trim().length === 0,
  replacement: () => "",
});

// Convert definition lists to readable text — common for specs/features
turndown.addRule("definition-list", {
  filter: "dl",
  replacement: (_content, node) => {
    const el = node as Element;
    const lines: string[] = [];
    el.querySelectorAll("dt, dd").forEach((child) => {
      if (child.nodeName === "DT") {
        lines.push(`**${child.textContent?.trim()}**`);
      } else {
        lines.push(`  ${child.textContent?.trim()}`);
      }
    });
    return "\n\n" + lines.join("\n") + "\n\n";
  },
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

  // 1. Strip chrome and known noise first — before anything else so
  //    accordion unwrapping doesn't accidentally keep nav/footer content.
  for (const sel of STRIP_SELECTORS) {
    doc.querySelectorAll(sel).forEach((el) => el.remove());
  }

  const titleFromDom = doc.querySelector("title")?.textContent?.trim() ?? null;

  // 2. Unwrap hidden/collapsed widgets (accordions, tabs, toggles).
  //    Replace with plain <div> so Readability sees the text as body content.
  //    Also strip any inline display:none so content isn't still hidden.
  for (const sel of HIDDEN_CONTENT_SELECTORS) {
    doc.querySelectorAll(sel).forEach((el) => {
      const div = doc.createElement("div");
      div.innerHTML = (el as HTMLElement).innerHTML;
      // Remove inline styles that would hide the content
      div.querySelectorAll<HTMLElement>("[style]").forEach((child) => {
        child.style.removeProperty("display");
        child.style.removeProperty("visibility");
        child.style.removeProperty("height");
        child.style.removeProperty("max-height");
        child.style.removeProperty("overflow");
        child.style.removeProperty("opacity");
      });
      el.replaceWith(div);
    });
  }

  // 3. On WordPress themes without <article>/<main>, wrap the first
  //    recognizable content container so Readability has a target.
  const hasSemanticContainer =
    doc.querySelector("article, main, [role='main']") !== null;
  if (!hasSemanticContainer) {
    for (const sel of WP_CONTENT_SELECTORS) {
      const container = doc.querySelector(sel);
      if (container) {
        const main = doc.createElement("main");
        container.replaceWith(main);
        main.appendChild(container);
        break;
      }
    }
  }

  let articleHtml = doc.body.innerHTML;
  let articleTitle = titleFromDom;

  // 4. Readability pass — mutates the DOM so clone first.
  try {
    const clone = dom.window.document.cloneNode(true) as Document;
    const reader = new Readability(clone);
    const parsed = reader.parse();
    if (parsed?.content && parsed.content.length > 200) {
      articleHtml = parsed.content;
      articleTitle = parsed.title || titleFromDom;
    }
  } catch {
    // Readability throws on some pages — fall through to pre-processed body HTML.
  }

  const md = turndown
    .turndown(articleHtml)
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
