import { encode } from "gpt-tokenizer";

/**
 * Markdown chunker.
 *
 * Goals:
 *   • Chunks roughly fit within `targetTokens` so retrieval payloads
 *     stay predictable and embedding costs stay flat.
 *   • Splits at heading boundaries (## then ###) when possible so each
 *     chunk reads as a coherent unit.
 *   • Falls back to paragraph + sentence splits for long heading-less
 *     blocks (e.g. blog posts with one big H1 and walls of text).
 *   • Includes a small `overlap` so a chunk boundary doesn't sever a
 *     point that retrieval would need both sides of.
 */

type ChunkOptions = {
  targetTokens?: number;
  overlap?: number;
};

const DEFAULT_TARGET = 600;
const DEFAULT_OVERLAP = 100;

function tokenLen(text: string): number {
  return encode(text).length;
}

function splitByHeadings(md: string): string[] {
  // Split at ## or ### but keep the heading attached to its section.
  const parts = md.split(/(?=^##+\s)/m);
  return parts.map((p) => p.trim()).filter(Boolean);
}

function splitByParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function splitBySentences(text: string): string[] {
  // Naïve sentence splitter — good enough for chunking, not for NLP.
  return text
    .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function packToTarget(
  units: string[],
  targetTokens: number,
  overlap: number
): string[] {
  const out: string[] = [];
  let buf: string[] = [];
  let bufTokens = 0;

  for (const unit of units) {
    const u = unit.trim();
    if (!u) continue;
    const t = tokenLen(u);

    // A unit by itself larger than target — break it further by sentence.
    if (t > targetTokens) {
      if (buf.length) {
        out.push(buf.join("\n\n"));
        buf = [];
        bufTokens = 0;
      }
      const sentences = splitBySentences(u);
      out.push(...packToTarget(sentences, targetTokens, overlap));
      continue;
    }

    if (bufTokens + t > targetTokens) {
      out.push(buf.join("\n\n"));
      // Carry overlap: tail of previous chunk seeds the next one
      if (overlap > 0 && out.length > 0) {
        const tail = takeTailTokens(out[out.length - 1], overlap);
        buf = tail ? [tail] : [];
        bufTokens = tail ? tokenLen(tail) : 0;
      } else {
        buf = [];
        bufTokens = 0;
      }
    }

    buf.push(u);
    bufTokens += t;
  }

  if (buf.length) out.push(buf.join("\n\n"));
  return out;
}

function takeTailTokens(text: string, n: number): string {
  const tokens = encode(text);
  if (tokens.length <= n) return text;
  // gpt-tokenizer doesn't expose a decode-from-tokens-array helper in a
  // stable way across versions, so approximate by characters: take the
  // last ~ (n / tokens.length) of the text.
  const ratio = n / tokens.length;
  const startIdx = Math.max(0, Math.floor(text.length * (1 - ratio)));
  return text.slice(startIdx);
}

export function chunkMarkdown(md: string, opts: ChunkOptions = {}): string[] {
  const targetTokens = opts.targetTokens ?? DEFAULT_TARGET;
  const overlap = opts.overlap ?? DEFAULT_OVERLAP;

  if (!md.trim()) return [];

  // Prefer heading-based units; if the doc has no headings, fall back to paragraphs.
  const headingChunks = splitByHeadings(md);
  const units =
    headingChunks.length > 1
      ? headingChunks
      : splitByParagraphs(md);

  return packToTarget(units, targetTokens, overlap);
}
