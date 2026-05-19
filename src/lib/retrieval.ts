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

export async function searchChunks(
  businessId: string,
  query: string,
  options: { language?: string; limit?: number } = {}
): Promise<RetrievedChunk[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const dict = dictFor(options.language ?? "es");
  const limit = options.limit ?? DEFAULT_LIMIT;

  // websearch_to_tsquery handles real user input (quoted phrases, OR
  // operators, free-form words) without throwing on bad syntax.
  // ts_rank scores results so the most lexically relevant chunks float
  // to the top.
  const rows = await prisma.$queryRawUnsafe<RetrievedChunk[]>(
    `
    SELECT
      c.text                                                    AS text,
      c."pageType"                                              AS "pageType",
      d.url                                                     AS url,
      d.title                                                   AS title,
      ts_rank(
        to_tsvector('${dict}', c.text),
        websearch_to_tsquery('${dict}', $1)
      )                                                         AS score
    FROM "Chunk" c
    JOIN "Document" d ON c."documentId" = d.id
    WHERE
      c."businessId" = $2
      AND d.excluded = false
      AND to_tsvector('${dict}', c.text) @@ websearch_to_tsquery('${dict}', $1)
    ORDER BY score DESC
    LIMIT ${limit};
    `,
    trimmed,
    businessId
  );

  return rows.map((r) => ({
    text: r.text,
    pageType: r.pageType,
    url: r.url,
    title: r.title,
    score: Number(r.score), // pg returns numeric — cast to plain number
  }));
}

/**
 * Format retrieved chunks for inclusion in the system prompt.
 * Each block carries source URL + page type so the AI can cite or skip
 * irrelevant snippets, and so the operator can audit what the AI saw.
 *
 * The final string is hard-capped at MAX_CONTEXT_CHARS. We drop trailing
 * blocks (lower-ranked) before truncating mid-block — keeping the top
 * snippet intact matters more than including every retrieved one.
 */
export function formatChunksForPrompt(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "";
  const separator = "\n\n---\n\n";

  const blocks = chunks.map((c, i) => {
    const header =
      `[${i + 1}] ${c.pageType ?? "page"} — ${c.title ?? "(sin título)"}\n` +
      `Fuente: ${c.url}`;
    return `${header}\n\n${c.text.trim()}`;
  });

  let out = "";
  for (let i = 0; i < blocks.length; i++) {
    const next = i === 0 ? blocks[i] : out + separator + blocks[i];
    if (next.length > MAX_CONTEXT_CHARS) {
      // If even the first block alone overflows, hard-truncate it so
      // the model still gets the top hit — better than empty context.
      if (i === 0) {
        out = blocks[i].slice(0, MAX_CONTEXT_CHARS - 20) + "\n…[truncado]";
      }
      break;
    }
    out = next;
  }
  return out;
}
