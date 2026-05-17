/**
 * Shared types for the ingest pipeline.
 *
 * Keeping these in one place makes the pluggable-driver pattern obvious:
 * any extractor (TS-fetch today, Crawl4AI tomorrow) just returns
 * `ExtractionResult`. Nothing else in the pipeline needs to know which
 * motor produced the markdown.
 */

export type PageType =
  | "service"
  | "faq"
  | "about"
  | "contact"
  | "team"
  | "pricing"
  | "policy"
  | "blog"
  | "location"
  | "other";

export type ExtractionResult = {
  /** Final URL after redirects. */
  url: string;
  /** Page title — used in retrieval ranking and admin listings. */
  title: string | null;
  /** Cleaned markdown — the canonical representation of the page content. */
  contentMd: string;
  /** Optional raw HTML, persisted only when debugging extraction quality. */
  rawHtml?: string;
  /** ETag from the HTTP response, if any — used for cheap change detection on the next sync. */
  httpEtag?: string;
  /** Last-Modified from the HTTP response, if any. */
  httpLastModified?: Date;
  /** sitemap <lastmod> if discovered via sitemap. */
  sitemapLastmod?: Date;
};

/**
 * The single extension point of the ingest pipeline.
 *
 * A driver fetches a single URL and returns clean markdown. It MUST NOT
 * throw on common failures (4xx, empty content); return `null` instead
 * so the runner can mark the URL as an error and move on.
 */
export interface ExtractorDriver {
  readonly name: string;
  fetch(url: string): Promise<ExtractionResult | null>;
}
