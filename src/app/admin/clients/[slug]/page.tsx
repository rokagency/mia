import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { saveClientAction } from "./actions";

export const dynamic = "force-dynamic";

type Channel = { type: string; value: string; label?: string };
type TimeRange = { open: string; close: string };
type OpeningHours = Record<string, TimeRange[]>;

const DAYS = [
  ["monday", "Lunes"],
  ["tuesday", "Martes"],
  ["wednesday", "Miércoles"],
  ["thursday", "Jueves"],
  ["friday", "Viernes"],
  ["saturday", "Sábado"],
  ["sunday", "Domingo"],
] as const;

const CHANNEL_TYPES = [
  "whatsapp",
  "phone",
  "email",
  "instagram",
  "tiktok",
  "facebook",
  "website",
  "googleMaps",
] as const;

const COMMON_TIMEZONES = [
  "America/Argentina/Buenos_Aires",
  "America/Mexico_City",
  "America/Bogota",
  "America/Lima",
  "America/Santiago",
  "America/Montevideo",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/Madrid",
  "Europe/London",
  "UTC",
];

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const b = await prisma.business.findUnique({ where: { slug } });
  if (!b) notFound();

  const cfg = (b.config as Record<string, unknown>) ?? {};
  const greeting = (cfg.greeting as string) ?? "";
  const address = (cfg.address as string) ?? "";
  const timezone = (cfg.timezone as string) ?? "";
  const privacyPolicyUrl = (cfg.privacyPolicyUrl as string) ?? "";
  const logoUrl = (cfg.logoUrl as string) ?? "";
  const openingHours = ((cfg.openingHours as OpeningHours) ?? {}) as OpeningHours;
  const contactChannels = (cfg.contactChannels as Channel[]) ?? [];
  const bookingChannels = (cfg.bookingChannels as Channel[]) ?? [];
  const branding = (cfg.branding as Record<string, string>) ?? {};
  const attributes = (cfg.attributes as string[]) ?? [];
  const googleMaps = (cfg.googleMaps as Record<string, unknown>) ?? {};
  const whatsappHandoff = (cfg.whatsappHandoff as { number?: string }) ?? {};

  // Bind slug into the action.
  const saveAction = async (formData: FormData) => {
    "use server";
    await saveClientAction(slug, formData);
  };

  return (
    <div>
      <header className="mb-6 flex items-start justify-between">
        <div>
          <Link
            href="/admin"
            className="text-xs text-neutral-500 hover:underline"
          >
            ← Clients
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">{b.name}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            <code className="rounded bg-neutral-100 px-1.5 py-0.5">
              {b.slug}
            </code>
          </p>
        </div>
        <nav className="flex gap-2 text-sm">
          <SubNav href={`/admin/clients/${slug}/faqs`}>FAQs</SubNav>
          <SubNav href={`/admin/clients/${slug}/sources`}>Sources</SubNav>
          <SubNav href={`/admin/clients/${slug}/jobs`}>Jobs</SubNav>
          <SubNav href={`/admin/clients/${slug}/leads`}>Leads</SubNav>
          <SubNav href={`/admin/clients/${slug}/conversations`}>
            Conversations
          </SubNav>
        </nav>
      </header>

      <form action={saveAction} className="space-y-8">
        {/* ── Identity ──────────────────────────────────────────── */}
        <Section
          title="Identity"
          subtitle="What this business is called and how it operates."
        >
          <Field label="Name">
            <input
              name="name"
              defaultValue={b.name}
              required
              className={inputCls}
            />
          </Field>
          <Field label="Website URL">
            <input
              name="websiteUrl"
              defaultValue={b.websiteUrl ?? ""}
              placeholder="https://..."
              className={inputCls}
            />
          </Field>
          <Field label="Language">
            <select
              name="language"
              defaultValue={b.language}
              className={inputCls}
            >
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </Field>
          <Field label="Booking mode">
            <select
              name="bookingMode"
              defaultValue={b.bookingMode}
              className={inputCls}
            >
              <option value="whatsapp_handoff">WhatsApp handoff</option>
              <option value="data_collection">Data collection</option>
              <option value="calendar_integration">
                Calendar integration (not implemented)
              </option>
            </select>
          </Field>
          <Field
            label="WhatsApp handoff number"
            hint="International digits only, no '+' or spaces. e.g. 5491134567890. Used for wa.me deep links."
          >
            <input
              name="whatsappHandoffNumber"
              defaultValue={whatsappHandoff.number ?? ""}
              placeholder="5491134567890"
              className={inputCls}
            />
          </Field>
        </Section>

        {/* ── Embed ────────────────────────────────────────────── */}
        <Section
          title="Embed"
          subtitle="Which websites can iframe this chat. One origin per line. Use http://localhost:* for dev."
        >
          <Field label="Allowed origins">
            <textarea
              name="allowedOrigins"
              defaultValue={b.allowedOrigins.join("\n")}
              rows={4}
              className={textareaCls}
              placeholder={"https://example.com\nhttp://localhost:*"}
            />
          </Field>
          <Field label="Privacy policy URL" hint="Linked from the chat footer.">
            <input
              name="privacyPolicyUrl"
              defaultValue={privacyPolicyUrl}
              placeholder="https://example.com/privacy"
              className={inputCls}
            />
          </Field>
        </Section>

        {/* ── Welcome ──────────────────────────────────────────── */}
        <Section
          title="Welcome"
          subtitle="The first thing Mia says when someone opens the chat."
        >
          <Field label="Greeting">
            <textarea
              name="greeting"
              defaultValue={greeting}
              rows={3}
              className={textareaCls}
              placeholder="¡Hola! Soy Mia, la asistente virtual de…"
            />
          </Field>
        </Section>

        {/* ── Location & Hours ─────────────────────────────────── */}
        <Section
          title="Location & hours"
          subtitle="Address, timezone, and weekly schedule."
        >
          <Field label="Address">
            <input
              name="address"
              defaultValue={address}
              placeholder="Av. Pres. Manuel Quintana 585 7°A — CABA"
              className={inputCls}
            />
          </Field>
          <Field label="Timezone">
            <select
              name="timezone"
              defaultValue={timezone || "America/Argentina/Buenos_Aires"}
              className={inputCls}
            >
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </Field>

          <div className="md:col-span-2">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-600">
              Opening hours
            </p>
            <div className="space-y-2 rounded-lg border border-neutral-200 bg-neutral-50/40 p-3">
              {DAYS.map(([key, label]) => {
                const ranges = openingHours[key] ?? [];
                // Always render exactly one row per day (no add/remove UI for
                // multi-range — most clients only need one slot per day).
                const first = ranges[0] ?? { open: "", close: "" };
                return (
                  <div
                    key={key}
                    className="grid grid-cols-[100px_1fr_1fr] items-center gap-2"
                  >
                    <span className="text-sm text-neutral-600">{label}</span>
                    <input
                      type="time"
                      name={`openingHours[${key}][0][open]`}
                      defaultValue={first.open}
                      className={inputCls}
                    />
                    <input
                      type="time"
                      name={`openingHours[${key}][0][close]`}
                      defaultValue={first.close}
                      className={inputCls}
                    />
                  </div>
                );
              })}
              <p className="mt-2 text-xs text-neutral-500">
                Leave both fields blank for closed days.
              </p>
            </div>
          </div>
        </Section>

        {/* ── Contact channels ─────────────────────────────────── */}
        <Section
          title="Contact channels"
          subtitle="How visitors reach the business in general."
        >
          <ChannelEditor name="contactChannels" rows={contactChannels} />
        </Section>

        {/* ── Booking channels ─────────────────────────────────── */}
        <Section
          title="Booking channels"
          subtitle="CTA links for appointments — what Mia hands out when asked to book."
        >
          <ChannelEditor name="bookingChannels" rows={bookingChannels} />
        </Section>

        {/* ── Branding ─────────────────────────────────────────── */}
        <Section
          title="Branding"
          subtitle="Colors and logo that drive the chat's look."
        >
          <Field label="Primary color">
            <input
              type="color"
              name="branding.primary"
              defaultValue={branding.primary ?? "#059669"}
              className="h-10 w-full rounded-lg border border-neutral-300"
            />
          </Field>
          <Field label="Text color">
            <input
              type="color"
              name="branding.text"
              defaultValue={branding.text ?? "#171717"}
              className="h-10 w-full rounded-lg border border-neutral-300"
            />
          </Field>
          <Field label="Background color (optional)">
            <input
              type="color"
              name="branding.background"
              defaultValue={branding.background ?? "#ffffff"}
              className="h-10 w-full rounded-lg border border-neutral-300"
            />
          </Field>
          <Field label="Logo URL">
            <input
              name="logoUrl"
              defaultValue={logoUrl}
              placeholder="https://..."
              className={inputCls}
            />
          </Field>
        </Section>

        {/* ── Highlighted attributes ───────────────────────────── */}
        <Section
          title="Highlighted attributes"
          subtitle="One per line. Surfaced to Mia as 'things worth mentioning'."
        >
          <Field label="Attributes">
            <textarea
              name="attributes"
              defaultValue={attributes.join("\n")}
              rows={4}
              className={textareaCls}
              placeholder={"Atención personalizada\nAcceso para sillas de ruedas"}
            />
          </Field>
        </Section>

        {/* ── Google Maps profile ──────────────────────────────── */}
        <Section
          title="Google Maps profile"
          subtitle="Optional. Mia mentions the rating and reviews when relevant."
        >
          <Field label="Place ID">
            <input
              name="googleMaps.placeId"
              defaultValue={(googleMaps.placeId as string) ?? ""}
              className={inputCls}
            />
          </Field>
          <Field label="Rating">
            <input
              type="number"
              step="0.1"
              min="0"
              max="5"
              name="googleMaps.rating"
              defaultValue={(googleMaps.rating as number) ?? ""}
              className={inputCls}
            />
          </Field>
          <Field label="Review count">
            <input
              type="number"
              min="0"
              name="googleMaps.reviewCount"
              defaultValue={(googleMaps.reviewCount as number) ?? ""}
              className={inputCls}
            />
          </Field>
          <Field label="Maps URL">
            <input
              name="googleMaps.mapsUrl"
              defaultValue={(googleMaps.mapsUrl as string) ?? ""}
              className={inputCls}
            />
          </Field>
        </Section>

        {/* ── Save bar ─────────────────────────────────────────── */}
        <div className="sticky bottom-0 -mx-6 border-t border-neutral-200 bg-white/90 px-6 py-3 backdrop-blur">
          <div className="flex items-center justify-end gap-3">
            <Link
              href="/admin"
              className="rounded-lg px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
            >
              Save changes
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500";
const textareaCls =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 font-mono";

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      {subtitle ? (
        <p className="mt-0.5 text-xs text-neutral-500">{subtitle}</p>
      ) : null}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        {children}
      </div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium uppercase tracking-wide text-neutral-600">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
      {hint ? <p className="mt-1 text-xs text-neutral-500">{hint}</p> : null}
    </label>
  );
}

function SubNav({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
    >
      {children}
    </Link>
  );
}

/**
 * Channels editor. Renders existing rows + a fixed 3 blank rows so the
 * operator can add new entries without needing JS for "add row". On
 * submit, the action drops blanks (any row missing type or value).
 */
function ChannelEditor({
  name,
  rows,
}: {
  name: string;
  rows: Channel[];
}) {
  const padded: Channel[] = [...rows];
  while (padded.length < rows.length + 3) {
    padded.push({ type: "", value: "" });
  }

  return (
    <div className="md:col-span-2 space-y-2">
      {padded.map((row, i) => (
        <div
          key={i}
          className="grid grid-cols-[140px_1fr_1fr] items-center gap-2"
        >
          <select
            name={`${name}[${i}][type]`}
            defaultValue={row.type}
            className={inputCls}
          >
            <option value="">— select —</option>
            {CHANNEL_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            name={`${name}[${i}][value]`}
            defaultValue={row.value}
            placeholder="value (number, handle, URL…)"
            className={inputCls}
          />
          <input
            name={`${name}[${i}][label]`}
            defaultValue={row.label ?? ""}
            placeholder="label (optional)"
            className={inputCls}
          />
        </div>
      ))}
    </div>
  );
}
