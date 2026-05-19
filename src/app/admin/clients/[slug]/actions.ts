"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";

/**
 * Save action for the per-client edit form. Each field in the form
 * maps to either a Business column or a key under Business.config.
 *
 * Strategy:
 *   • Build a partial update of the columns.
 *   • Build a partial update of config by spreading existing config
 *     over the new values, so we only overwrite the fields the form
 *     submitted and preserve anything else (e.g. fields not yet in the
 *     UI but present from the seed).
 */

const dayKeys = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const channelTypes = [
  "phone",
  "whatsapp",
  "email",
  "instagram",
  "tiktok",
  "facebook",
  "website",
  "googleMaps",
] as const;

const hhmm = z.string().regex(/^\d{2}:\d{2}$/, "HH:mm");

const timeRange = z.object({
  open: hhmm,
  close: hhmm,
});

const openingHoursSchema = z.object({
  monday: z.array(timeRange).default([]),
  tuesday: z.array(timeRange).default([]),
  wednesday: z.array(timeRange).default([]),
  thursday: z.array(timeRange).default([]),
  friday: z.array(timeRange).default([]),
  saturday: z.array(timeRange).default([]),
  sunday: z.array(timeRange).default([]),
});

const channelSchema = z.object({
  type: z.enum(channelTypes),
  value: z.string().min(1),
  label: z.string().optional(),
});

const saveSchema = z.object({
  // Business columns
  name: z.string().min(1).max(120),
  language: z.enum(["es", "en", "de"]),
  bookingMode: z.enum([
    "whatsapp_handoff",
    "data_collection",
    "calendar_integration",
  ]),
  websiteUrl: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  allowedOrigins: z.array(z.string()).default([]),
  // Config JSON
  greeting: z.string().optional(),
  address: z.string().optional(),
  timezone: z.string().optional(),
  privacyPolicyUrl: z
    .string()
    .url()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  openingHours: openingHoursSchema.optional(),
  contactChannels: z.array(channelSchema).default([]),
  bookingChannels: z.array(channelSchema).default([]),
  whatsappHandoffNumber: z.string().optional(),
  branding: z
    .object({
      primary: z.string().optional(),
      text: z.string().optional(),
      background: z.string().optional(),
    })
    .optional(),
  // logoUrl accepts either an absolute URL (image hosted elsewhere)
  // or a relative path starting with /uploads/... (file we wrote
  // ourselves via the upload route).
  logoUrl: z
    .string()
    .refine(
      (v) => v === "" || /^https?:\/\//.test(v) || v.startsWith("/uploads/"),
      "Must be an absolute URL or a /uploads/... path"
    )
    .optional()
    .or(z.literal("").transform(() => undefined)),
  attributes: z.array(z.string()).default([]),
  googleMaps: z
    .object({
      placeId: z.string().optional(),
      rating: z.number().optional(),
      reviewCount: z.number().optional(),
      mapsUrl: z.string().optional(),
    })
    .optional(),
});

type SaveInput = z.infer<typeof saveSchema>;

/**
 * Parse a flat FormData into the nested shape Zod expects. The form
 * sends openingHours[monday][0][open] etc. — we walk the entries.
 */
function parseForm(fd: FormData): unknown {
  const obj: Record<string, unknown> = {};

  // Plain scalar fields
  for (const k of [
    "name",
    "language",
    "bookingMode",
    "websiteUrl",
    "greeting",
    "address",
    "timezone",
    "privacyPolicyUrl",
    "whatsappHandoffNumber",
    "logoUrl",
  ]) {
    const v = fd.get(k);
    if (v !== null) obj[k] = String(v);
  }

  // allowedOrigins: one per line
  const ao = String(fd.get("allowedOrigins") ?? "");
  obj.allowedOrigins = ao
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  // attributes: one per line
  const attrs = String(fd.get("attributes") ?? "");
  obj.attributes = attrs
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  // openingHours: openingHours[<day>][<idx>][open|close]
  const oh: Record<string, { open: string; close: string }[]> = {};
  for (const day of dayKeys) oh[day] = [];
  for (const [key, val] of fd.entries()) {
    const m = key.match(/^openingHours\[(\w+)\]\[(\d+)\]\[(open|close)\]$/);
    if (!m) continue;
    const [, day, idxRaw, field] = m;
    if (!(day in oh)) continue;
    const idx = Number(idxRaw);
    while (oh[day].length <= idx) oh[day].push({ open: "", close: "" });
    oh[day][idx][field as "open" | "close"] = String(val);
  }
  // Drop empty entries (rows the user added but left blank)
  for (const day of dayKeys) {
    oh[day] = oh[day].filter((r) => r.open && r.close);
  }
  obj.openingHours = oh;

  // contactChannels / bookingChannels: <kind>[<idx>][type|value|label]
  for (const kind of ["contactChannels", "bookingChannels"] as const) {
    const rows: Record<string, string>[] = [];
    for (const [key, val] of fd.entries()) {
      const m = key.match(
        new RegExp(`^${kind}\\[(\\d+)\\]\\[(type|value|label)\\]$`)
      );
      if (!m) continue;
      const idx = Number(m[1]);
      while (rows.length <= idx) rows.push({} as Record<string, string>);
      rows[idx][m[2]] = String(val);
    }
    obj[kind] = rows
      .filter((r) => r.type && r.value)
      .map((r) => ({ type: r.type, value: r.value, label: r.label || undefined }));
  }

  // branding
  obj.branding = {
    primary: String(fd.get("branding.primary") ?? "") || undefined,
    text: String(fd.get("branding.text") ?? "") || undefined,
    background: String(fd.get("branding.background") ?? "") || undefined,
  };

  // googleMaps
  const gmPlace = String(fd.get("googleMaps.placeId") ?? "");
  const gmRating = String(fd.get("googleMaps.rating") ?? "");
  const gmReviews = String(fd.get("googleMaps.reviewCount") ?? "");
  const gmUrl = String(fd.get("googleMaps.mapsUrl") ?? "");
  if (gmPlace || gmRating || gmReviews || gmUrl) {
    obj.googleMaps = {
      placeId: gmPlace || undefined,
      rating: gmRating ? Number(gmRating) : undefined,
      reviewCount: gmReviews ? Number(gmReviews) : undefined,
      mapsUrl: gmUrl || undefined,
    };
  }

  return obj;
}

export async function saveClientAction(slug: string, fd: FormData) {
  const raw = parseForm(fd);
  const parsed = saveSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[admin save] validation failed", parsed.error.flatten());
    throw new Error(
      "Validation failed: " +
        parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")
    );
  }

  const v: SaveInput = parsed.data;

  const existing = await prisma.business.findUnique({
    where: { slug },
    select: { config: true },
  });
  if (!existing) throw new Error(`Business ${slug} not found`);

  // Preserve unknown keys in config; overwrite only what the form manages.
  const oldConfig = (existing.config as Record<string, unknown>) ?? {};

  // Only include defined keys in the merge so an empty form field
  // doesn't blank out a value that wasn't actually rendered.
  const configUpdates: Record<string, unknown> = {};
  if (v.greeting !== undefined) configUpdates.greeting = v.greeting || undefined;
  if (v.address !== undefined) configUpdates.address = v.address || undefined;
  if (v.timezone !== undefined) configUpdates.timezone = v.timezone || undefined;
  if (v.privacyPolicyUrl !== undefined)
    configUpdates.privacyPolicyUrl = v.privacyPolicyUrl;
  if (v.logoUrl !== undefined) configUpdates.logoUrl = v.logoUrl;
  if (v.openingHours) configUpdates.openingHours = v.openingHours;
  configUpdates.contactChannels = v.contactChannels;
  configUpdates.bookingChannels = v.bookingChannels;
  if (v.whatsappHandoffNumber)
    configUpdates.whatsappHandoff = { number: v.whatsappHandoffNumber };
  if (v.branding) {
    const cleaned: Record<string, string> = {};
    if (v.branding.primary) cleaned.primary = v.branding.primary;
    if (v.branding.text) cleaned.text = v.branding.text;
    if (v.branding.background) cleaned.background = v.branding.background;
    configUpdates.branding = Object.keys(cleaned).length ? cleaned : undefined;
  }
  configUpdates.attributes = v.attributes;
  if (v.googleMaps) configUpdates.googleMaps = v.googleMaps;

  const newConfig = { ...oldConfig, ...configUpdates };

  await prisma.business.update({
    where: { slug },
    data: {
      name: v.name,
      language: v.language,
      bookingMode: v.bookingMode,
      websiteUrl: v.websiteUrl ?? null,
      allowedOrigins: v.allowedOrigins,
      config: newConfig as object,
    },
  });

  revalidatePath(`/admin/clients/${slug}`);
  revalidatePath(`/${slug}`); // chat page picks up the new config
}
