import { readFile, stat } from "fs/promises";
import { extname, join } from "path";
import { NextResponse } from "next/server";
import { UPLOAD_ROOT } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /uploads/<slug>/<filename>
 *
 * Serves files written by the upload route. Each saved filename ends
 * with an 8-char random hash so URLs are effectively immutable —
 * we send a 1-year Cache-Control to take advantage of that.
 *
 * Public by design: anyone with the URL can read the file. We don't
 * gate on the admin cookie because the chat embed is anonymous; the
 * logo has to load without auth.
 */

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

const SLUG_RE = /^[a-z0-9-]+$/;
const FILE_RE = /^[a-z0-9.\-_]+$/;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; filename: string }> }
) {
  const { slug, filename } = await params;

  // Strict path validation — no traversal, no surprises.
  if (!SLUG_RE.test(slug) || !FILE_RE.test(filename)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const ext = extname(filename).toLowerCase();
  const mime = MIME_BY_EXT[ext];
  if (!mime) {
    return new NextResponse("Not found", { status: 404 });
  }

  const fullPath = join(UPLOAD_ROOT, slug, filename);

  let buf: Buffer;
  try {
    const st = await stat(fullPath);
    if (!st.isFile()) return new NextResponse("Not found", { status: 404 });
    buf = await readFile(fullPath);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  // We need a copy whose underlying buffer is exactly the data we
  // read, with no ArrayBufferLike type-mismatch when constructing
  // the Response body. Slicing the Buffer's underlying ArrayBuffer
  // produces a Uint8Array which Response accepts unambiguously.
  const body = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Length": String(buf.byteLength),
      // Filename has a random hash → safe to cache aggressively.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
