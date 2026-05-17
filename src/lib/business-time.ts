import type {
  DayKey,
  OpeningHours,
  TimeRange,
} from "@/businesses/types";

/**
 * Trusted date/hours utility.
 *
 * Everything here treats the *server clock + the business timezone* as
 * the authoritative source. Used by the prompt builder to inject a
 * "FECHA Y HORA ACTUAL (NO CONTRADECIR)" block so the AI can answer
 * questions about today, tomorrow, weekday, and current open/closed
 * state without trusting whatever the visitor claims about the
 * calendar.
 *
 * No external date library — `Intl.DateTimeFormat` with the `timeZone`
 * option handles tz + DST correctly cross-platform.
 */

const ORDERED_DAYS: readonly DayKey[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const DAY_LABELS_ES: Record<DayKey, string> = {
  monday: "lunes",
  tuesday: "martes",
  wednesday: "miércoles",
  thursday: "jueves",
  friday: "viernes",
  saturday: "sábado",
  sunday: "domingo",
};

const DAY_LABELS_EN: Record<DayKey, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

export type DayContext = {
  /** Date in ISO YYYY-MM-DD form, in the business timezone. */
  dateISO: string;
  /** Lowercase weekday key, e.g. "saturday". */
  dayKey: DayKey;
  /** Localized weekday name, e.g. "sábado" or "Saturday". */
  dayLabel: string;
  /** Localized full date, e.g. "sábado, 17 de mayo de 2026". */
  longLabel: string;
  /** Opening hours for this day. Empty = closed. */
  hours: readonly TimeRange[];
  /** True iff `hours.length === 0`. */
  isClosed: boolean;
};

export type BusinessTimeContext = {
  timezone: string;
  /** HH:mm in 24h, in the business timezone, when this snapshot was taken. */
  currentHHmm: string;
  /** True iff `currentHHmm` falls inside one of today's ranges. */
  isOpenNow: boolean;
  today: DayContext;
  tomorrow: DayContext;
};

/** Extract zoned year/month/day/hour/minute/weekday from a UTC instant. */
function getZonedParts(instant: Date, timezone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(instant);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";
  // Intl can emit "24" for midnight in 24h mode — normalize to "00".
  const rawHour = get("hour");
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    weekday: get("weekday").toLowerCase(),
    hour: rawHour === "24" ? "00" : rawHour,
    minute: get("minute"),
  };
}

/** Add one calendar day to a YYYY-MM-DD string via UTC math (DST-safe). */
function addOneDayISO(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d);
  const next = new Date(utc + 86_400_000);
  return [
    next.getUTCFullYear(),
    String(next.getUTCMonth() + 1).padStart(2, "0"),
    String(next.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

/** Weekday of an ISO date, computed in UTC at noon to avoid edge rolls. */
function dayKeyFromISO(iso: string): DayKey {
  const [y, m, d] = iso.split("-").map(Number);
  const noonUTC = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  // Date.getUTCDay(): 0 = Sunday … 6 = Saturday
  const idx = noonUTC.getUTCDay();
  const map: DayKey[] = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  return map[idx];
}

/** Long human label for a date, localized + tz-aware. */
function longDateLabel(
  iso: string,
  language: "es" | "en",
  timezone: string
): string {
  const [y, m, d] = iso.split("-").map(Number);
  const noonUTC = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat(language === "es" ? "es-AR" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: timezone,
  }).format(noonUTC);
}

function isOpenAt(timeHHmm: string, ranges: readonly TimeRange[]): boolean {
  return ranges.some((r) => timeHHmm >= r.open && timeHHmm < r.close);
}

export function computeBusinessTimeContext(
  openingHours: OpeningHours,
  timezone: string,
  language: "es" | "en",
  instant: Date = new Date()
): BusinessTimeContext {
  const parts = getZonedParts(instant, timezone);
  const todayISO = `${parts.year}-${parts.month}-${parts.day}`;
  const tomorrowISO = addOneDayISO(todayISO);
  const todayKey = dayKeyFromISO(todayISO);
  const tomorrowKey = dayKeyFromISO(tomorrowISO);
  const labels = language === "es" ? DAY_LABELS_ES : DAY_LABELS_EN;
  const currentHHmm = `${parts.hour}:${parts.minute}`;

  const todayHours = openingHours[todayKey] ?? [];
  const tomorrowHours = openingHours[tomorrowKey] ?? [];

  return {
    timezone,
    currentHHmm,
    isOpenNow: isOpenAt(currentHHmm, todayHours),
    today: {
      dateISO: todayISO,
      dayKey: todayKey,
      dayLabel: labels[todayKey],
      longLabel: longDateLabel(todayISO, language, timezone),
      hours: todayHours,
      isClosed: todayHours.length === 0,
    },
    tomorrow: {
      dateISO: tomorrowISO,
      dayKey: tomorrowKey,
      dayLabel: labels[tomorrowKey],
      longLabel: longDateLabel(tomorrowISO, language, timezone),
      hours: tomorrowHours,
      isClosed: tomorrowHours.length === 0,
    },
  };
}

function formatRanges(
  ranges: readonly TimeRange[],
  language: "es" | "en"
): string {
  if (ranges.length === 0) return language === "es" ? "Cerrado" : "Closed";
  return ranges.map((r) => `${r.open}–${r.close}`).join(", ");
}

/**
 * Renders the full time/date block injected into the system prompt:
 *
 *   • "Hoy" line with date + hours + open/closed flag
 *   • "Mañana" line with date + hours
 *   • Current local time
 *   • Full week schedule (Monday → Sunday)
 *
 * The prompt builder wraps this with explicit "NO CONTRADECIR" rules.
 */
export function formatBusinessTimeForPrompt(
  ctx: BusinessTimeContext,
  openingHours: OpeningHours,
  language: "es" | "en"
): string {
  const isEs = language === "es";
  const labels = isEs ? DAY_LABELS_ES : DAY_LABELS_EN;

  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const openMark = ctx.isOpenNow
    ? isEs
      ? " (ABIERTO ahora)"
      : " (OPEN now)"
    : isEs
      ? " (cerrado ahora)"
      : " (closed now)";

  const todayLine = isEs
    ? `Hoy:     ${cap(ctx.today.longLabel)} — ${formatRanges(ctx.today.hours, language)}${openMark}`
    : `Today:    ${cap(ctx.today.longLabel)} — ${formatRanges(ctx.today.hours, language)}${openMark}`;

  const tomorrowLine = isEs
    ? `Mañana:  ${cap(ctx.tomorrow.longLabel)} — ${formatRanges(ctx.tomorrow.hours, language)}`
    : `Tomorrow: ${cap(ctx.tomorrow.longLabel)} — ${formatRanges(ctx.tomorrow.hours, language)}`;

  const nowLine = isEs
    ? `Hora actual (${ctx.timezone}): ${ctx.currentHHmm}`
    : `Current time (${ctx.timezone}): ${ctx.currentHHmm}`;

  const weekLines = ORDERED_DAYS.map((d) => {
    return `  • ${cap(labels[d])}: ${formatRanges(openingHours[d] ?? [], language)}`;
  });

  return [
    todayLine,
    tomorrowLine,
    nowLine,
    "",
    isEs
      ? "HORARIOS REGULARES (semana completa)"
      : "REGULAR HOURS (full week)",
    ...weekLines,
  ].join("\n");
}
