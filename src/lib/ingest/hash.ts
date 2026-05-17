import { createHash } from "node:crypto";

/**
 * Normalize markdown for hashing so insignificant whitespace changes
 * don't trigger a re-embed. Collapses runs of whitespace and strips
 * trailing/leading whitespace on each line.
 */
export function normalizeForHash(md: string): string {
  return md
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
    .join("\n")
    .trim();
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function contentHash(md: string): string {
  return sha256(normalizeForHash(md));
}
