import type { PageType } from "./types";

/**
 * Page type classification for ingest.
 *
 * Today: URL-pattern + title heuristics. Multilingual (es + en) because
 * we target LATAM small businesses. Falls back to "other" rather than
 * inventing a label; later we may add a cheap LLM call for ambiguous
 * pages, but most local-business sites have predictable URL schemas.
 */

type Match = { pageType: PageType; patterns: RegExp[] };

const MATCHERS: Match[] = [
  {
    pageType: "about",
    patterns: [
      /\/about\b/i,
      /\/about-?us\b/i,
      /\/nosotros\b/i,
      /\/quienes-somos\b/i,
      /\/conoce(nos)?\b/i,
      /\/our-story\b/i,
      /\/historia\b/i,
    ],
  },
  {
    pageType: "contact",
    patterns: [/\/contact\b/i, /\/contacto\b/i, /\/get-in-touch\b/i],
  },
  {
    pageType: "team",
    patterns: [
      /\/team\b/i,
      /\/equipo\b/i,
      /\/staff\b/i,
      /\/providers?\b/i,
      /\/doctors?\b/i,
      /\/medicos?\b/i,
      /\/profesionales\b/i,
    ],
  },
  {
    pageType: "service",
    patterns: [
      /\/services?\b/i,
      /\/servicios?\b/i,
      /\/treatments?\b/i,
      /\/tratamientos?\b/i,
      /\/procedures?\b/i,
      /\/procedimientos?\b/i,
      /\/specialties\b/i,
      /\/especialidades\b/i,
    ],
  },
  {
    pageType: "pricing",
    patterns: [
      /\/pricing\b/i,
      /\/precios\b/i,
      /\/tarifas\b/i,
      /\/aranceles\b/i,
      /\/plans?\b/i,
      /\/planes\b/i,
    ],
  },
  {
    pageType: "faq",
    patterns: [
      /\/faqs?\b/i,
      /\/f-?a-?q\b/i,
      /\/preguntas-?frecuentes\b/i,
      /\/help\b/i,
      /\/ayuda\b/i,
    ],
  },
  {
    pageType: "blog",
    patterns: [
      /\/blog\b/i,
      /\/news\b/i,
      /\/articles?\b/i,
      /\/noticias\b/i,
      /\/articulos\b/i,
      /\/post\//i,
    ],
  },
  {
    pageType: "location",
    patterns: [
      /\/locations?\b/i,
      /\/ubicacion(es)?\b/i,
      /\/sucursales?\b/i,
      /\/consultorios?\b/i,
      /\/sedes?\b/i,
    ],
  },
  {
    pageType: "policy",
    patterns: [
      /\/policies\b/i,
      /\/policy\b/i,
      /\/cancellation\b/i,
      /\/cancelacion\b/i,
      /\/preparation\b/i,
      /\/aftercare\b/i,
      /\/post-?op\b/i,
      /\/pre-?op\b/i,
    ],
  },
];

/**
 * Classify a page from its URL and (optionally) its title.
 *
 * Returns "other" if no rule matches — never throws. The runner stores
 * whatever this returns; retrieval can filter by type to bias relevance.
 */
export function classifyPage(url: string, title?: string | null): PageType {
  const haystack = `${url}\n${title ?? ""}`;
  for (const m of MATCHERS) {
    if (m.patterns.some((re) => re.test(haystack))) return m.pageType;
  }
  return "other";
}
