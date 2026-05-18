import { createHash, randomBytes } from "crypto";
import { mkdir, writeFile, unlink } from "fs/promises";
import { join } from "path";

/**
 * File-upload helpers.
 *
 * On-disk layout (mounted at /app/uploads via the mia_uploads docker
 * volume — see docker-compose.prod.yml):
 *
 *   /app/uploads/<slug>/logo-<hash>.<ext>
 *
 * Cache-busting: <hash> is 8 random hex chars regenerated on every
 * upload, so a new logo for the same business gets a brand-new URL.
 * That lets us send long Cache-Control headers from the serve route
 * without worrying about stale browser copies.
 *
 * Why named volume + serve from Next, not S3/Spaces:
 *   Lowest friction at low scale. When we hit ~100 clients or want
 *   image CDN behavior, migrate to Spaces/R2 — the on-disk layout is
 *   intentionally flat (`<slug>/...`) so migration is rsync-easy.
 */

export const UPLOAD_ROOT = process.env.UPLOAD_ROOT ?? "/app/uploads";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

export type UploadResult = { ok: true; url: string } | { ok: false; error: string };

export async function saveLogoUpload(
  slug: string,
  file: File
): Promise<UploadResult> {
  // 1. Validate type
  const ext = MIME_EXT[file.type];
  if (!ext) {
    return {
      ok: false,
      error: `Unsupported file type "${file.type}". Use PNG, JPEG, WebP, or SVG.`,
    };
  }

  // 2. Validate size
  if (file.size === 0) return { ok: false, error: "File is empty." };
  if (file.size > MAX_BYTES) {
    return {
      ok: false,
      error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 2 MB.`,
    };
  }

  // 3. Validate slug shape so it can't escape the uploads directory.
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { ok: false, error: "Invalid business slug." };
  }

  // 4. Read into memory + sniff magic bytes (extra defense vs spoofed Content-Type)
  const buf = Buffer.from(await file.arrayBuffer());
  if (!sniffMatchesType(buf, file.type)) {
    return { ok: false, error: "File contents don't match the declared image type." };
  }

  // 5. Write to disk
  const hash = randomBytes(4).toString("hex");
  const dir = join(UPLOAD_ROOT, slug);
  const filename = `logo-${hash}.${ext}`;
  const fullPath = join(dir, filename);

  await mkdir(dir, { recursive: true });
  await writeFile(fullPath, buf);

  // 6. Return the public URL the browser will use
  return { ok: true, url: `/uploads/${slug}/${filename}` };
}

/**
 * Best-effort delete of a previous logo so the volume doesn't grow
 * unbounded with every upload. Called from the action AFTER the new
 * logo is saved + the DB pointer is updated, so a delete failure can
 * never leave the business with a missing image.
 */
export async function deleteUploadByUrl(url: string): Promise<void> {
  // Only delete inside /uploads/<slug>/<filename>. Reject anything else.
  const m = url.match(/^\/uploads\/([a-z0-9-]+)\/([a-z0-9.\-_]+)$/);
  if (!m) return;
  const fullPath = join(UPLOAD_ROOT, m[1], m[2]);
  try {
    await unlink(fullPath);
  } catch {
    /* missing file — fine */
  }
}

/**
 * Magic-byte sniffing. Just enough to catch the common "I renamed an
 * exe to .png" case. Not bulletproof, but layered with MIME + size
 * limit it's good enough for an admin-only upload route.
 */
function sniffMatchesType(buf: Buffer, mime: string): boolean {
  if (buf.length < 8) return false;
  switch (mime) {
    case "image/png":
      return (
        buf[0] === 0x89 &&
        buf[1] === 0x50 &&
        buf[2] === 0x4e &&
        buf[3] === 0x47
      );
    case "image/jpeg":
      return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    case "image/webp":
      // "RIFF" .... "WEBP"
      return (
        buf[0] === 0x52 &&
        buf[1] === 0x49 &&
        buf[2] === 0x46 &&
        buf[3] === 0x46 &&
        buf[8] === 0x57 &&
        buf[9] === 0x45 &&
        buf[10] === 0x42 &&
        buf[11] === 0x50
      );
    case "image/svg+xml": {
      // Loose check: must look like XML/SVG. SVG is text so we can read it.
      const head = buf.slice(0, 256).toString("utf8").trim().toLowerCase();
      return head.startsWith("<?xml") || head.startsWith("<svg");
    }
    default:
      return false;
  }
}

/** Stable identifier hash for a slug (used in the action to dedup). */
export function hashSlug(slug: string): string {
  return createHash("sha1").update(slug).digest("hex").slice(0, 8);
}
