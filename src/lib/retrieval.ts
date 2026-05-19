import { prisma } from "./db";

/**
 * Retrieval over indexed Chunks.
 *
 * Today: Postgres full-text search with the `spanish` dictionary. Cheap,
 * good enough for keyword-style questions like "rosácea" or "horarios
 * sábado". Will be augmented in Sprint 3 with pgvector semantic search
 * for paraphrased / vague queries.
 *
 * Returns a small list of high-signal snippets that the chat route
 * stuffs into the system prompt as "RETRIEVED CONTEXT". The AI is
 * instructed to answer strictly from those snippets (and from FAQs +
 * structured business data) — never to invent.
 */

export type RetrievedChunk = {
  text: string;
  pageType: string | null;
  url: string;
  title: string | null;
  /** Postgres ts_rank score, 0–1ish. */
  score: number;
};

// Tightened from 6 → 3 as part of the fast-safety / cost-control pass.
// More than 3 rarely improves answer quality on a single-business site
// and bloats the prompt token bill linearly.
const DEFAULT_LIMIT = 3;

// Hard ceiling on the concatenated retrieved-context string length
// stuffed into the system prompt. Prevents one pathologically long
// chunk (or 3 medium chunks) from blowing past our budget.
const MAX_CONTEXT_CHARS = 2_500;

/**
 * Detect the language to use for the FTS dictionary. We index in 'spanish'
 * for Sofía and 'english' for Lumen; if a business adds another, we'd
 * extend this map.
 */
function dictFor(language: string): string {
  if (language === "en") return "english";
  if (language === "de") return "german";
  return "spanish";
}

/**
 * Convert a free-form user question into a tsquery OR-expression of its
 * significant words. websearch_to_tsquery defaults to AND between terms,
 * which kills recall on long questions ("Wie wird die Goldschicht bei
 * der Galvanotechnik aufgetragen" → 0 results because no single chunk
 * contains every word).
 *
 * We strip punctuation, drop very short tokens (≤2 chars — common stop
 * words like "el", "de", "es", "is", "an"), and OR-join what remains.
 * ts_rank still scores chunks by how many query words match, so the most
 * relevant chunks float to the top.
 */
function buildOrQuery(input: string): string {
  const words = input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ") // strip punctuation
    .split(/\s+/)
    .filter((w) => w.length >= 3); // drop stop-word-ish tokens
  if (words.length === 0) return "";
  // Dedupe and join with OR
  const unique = Array.from(new Set(words));
  return unique.join(" | ");
}

export async function searchChunks(
  businessId: string,
  query: string,
  options: { language?: string; limit?: number } = {}
): Promise<RetrievedChunk[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const dict = dictFor(options.language ?? "es");
  const limit = options.limit ?? DEFAULT_LIMIT;

  const orQuery = buildOrQuery(trimmed);
  if (!orQuery) return [];

  // to_tsquery with explicit OR — every significant query word
  // contributes to ts_rank. Chunks matching more words score higher.
  const rows = await prisma.$queryRawUnsafe<RetrievedChunk[]>(
    `
    SELECT
      c.text                                                    AS text,
      c."pageType"                                              AS "pageType",
      d.url                                                     AS url,
      d.title                                                   AS title,
      ts_rank(
        to_tsvector('${dict}', c.text),
        to_tsquery('${dict}', $1)
      )                                                         AS score
    FROM "Chunk" c
    JOIN "Document" d ON c."documentId" = d.id
    WHERE
      c."businessId" = $2
      AND d.excluded = false
      AND to_tsvector('${dict}', c.text) @@ to_tsquery('${dict}', $1)
    ORDER BY score DESC
    LIMIT ${limit};
    `,
    orQuery,
    businessId
  );

  return rows.map((r) => ({
    text: r.text,
    pageType: r.pageType,
    url: r.url,
    title: r.title,
    score: Number(r.score),
  }));
}

/**
 * Format retrieved chunks for inclusion in the grounded user turn.
 *
 * Format: each chunk wrapped in a numbered <excerpt> tag with source as
 * an attribute. Reads as "source metadata + literal text" rather than
 * a narrative header — discourages the model from treating chunks as
 * "background to summarize" and pushes it toward "literal text to quote".
 *
 * The final string is hard-capped at MAX_CONTEXT_CHARS. We drop trailing
 * blocks (lower-ranked) before truncating mid-block — keeping the top
 * snippet intact matters more than including every retrieved one.
 */
export function formatChunksForPrompt(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "";
  const separator = "\n";

  const blocks = chunks.map((c, i) => {
    const url = (c.url ?? "").replace(/"/g, "");
    return `<excerpt id="${i + 1}" source="${url}">\n${c.text.trim()}\n</excerpt>`;
  });

  let out = "";
  for (let i = 0; i < blocks.length; i++) {
    const next = i === 0 ? blocks[i] : out + separator + blocks[i];
    if (next.length > MAX_CONTEXT_CHARS) {
      if (i === 0) {
        out = blocks[i].slice(0, MAX_CONTEXT_CHARS - 20) + "\n…[truncated]";
      }
      break;
    }
    out = next;
  }
  return out;
}
