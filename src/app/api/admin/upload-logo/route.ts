import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { deleteUploadByUrl, saveLogoUpload } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/upload-logo
 *
 * multipart/form-data with fields:
 *   slug  — business slug to attach the logo to
 *   file  — the image (PNG/JPEG/WebP/SVG, ≤ 2 MB)
 *
 * Auth: same admin cookie as the rest of /admin. Verified server-side
 * here in addition to the middleware gate, so direct POSTs without a
 * session also fail.
 *
 * On success: saves the file to the mia_uploads volume, updates
 * Business.config.logoUrl to the new public URL, deletes the old
 * file if there was one. Returns the new URL as JSON.
 */
export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const slug = String(form.get("slug") ?? "");
  const file = form.get("file");

  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const business = await prisma.business.findUnique({
    where: { slug },
    select: { id: true, config: true },
  });
  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const result = await saveLogoUpload(slug, file);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // Update the pointer first, THEN best-effort delete the old file.
  // If the delete fails, the new URL is already in the DB so the UI
  // doesn't break — we just leak one orphan file.
  const oldConfig = (business.config as Record<string, unknown>) ?? {};
  const oldUrl = typeof oldConfig.logoUrl === "string" ? oldConfig.logoUrl : null;
  const newConfig = { ...oldConfig, logoUrl: result.url };

  await prisma.business.update({
    where: { id: business.id },
    data: { config: newConfig as object },
  });

  if (oldUrl && oldUrl !== result.url && oldUrl.startsWith("/uploads/")) {
    await deleteUploadByUrl(oldUrl).catch(() => {});
  }

  return NextResponse.json({ url: result.url });
}
