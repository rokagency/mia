/**
 * Shared types for any client's knowledge files.
 *
 * Every business folder under `src/businesses/<client>/` must export a
 * `business` that satisfies `Business` and a `faqs` that satisfies
 * `readonly FAQ[]`. This is the contract that lets the agent code stay
 * client-agnostic — only the *content* differs per client.
 *
 * Most fields are optional because real clients rarely publish all of
 * them. When a field is absent, the prompt builder simply omits its
 * section and Mia is instructed to take a message instead of inventing.
 */

export type DayHours = string; // e.g. "8:00 AM – 6:00 PM" or "Cerrado"

export type WeeklyHours = {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
};

/** Lowercase weekday key used everywhere date/hour code touches a day. */
export type DayKey =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

/** A single time window like 10:00–20:00. Always 24h HH:mm strings. */
export type TimeRange = {
  /** Opening time, "HH:mm" 24h. */
  open: string;
  /** Closing time, "HH:mm" 24h. Must be > open. */
  close: string;
};

/**
 * Structured opening hours, one entry per day. An empty array means the
 * business is closed that day. Multiple ranges per day support split
 * shifts (e.g. siesta closure 13:00–16:00).
 *
 * When a business has BOTH legacy `hours` (free-form strings) and this
 * structured `openingHours`, the structured version wins — the prompt
 * builder uses it to render the hours block AND injects a trusted date
 * context block so the AI can reason about today/tomorrow reliably.
 */
export type OpeningHours = Record<DayKey, readonly TimeRange[]>;

export type Service = {
  name: string;
  /** Approximate visit length in minutes, if known. */
  durationMin?: number;
  /** Optional one-liner about what's included. */
  description?: string;
  /** Optional grouping label, e.g. "Dermatología", "Estética facial". */
  category?: string;
};

export type BookingPolicy = {
  leadTime?: string;
  sameDay?: string;
  cancellation?: string;
  newPatients?: string;
};

/**
 * A way the visitor can actually reach the business. We model these as
 * a list (instead of a flat phone/email/whatsapp) because real clients
 * mix and match channels, and the assistant should hand back the right
 * one for the question being asked.
 */
export type ContactChannel = {
  type:
    | "phone"
    | "whatsapp"
    | "email"
    | "instagram"
    | "tiktok"
    | "facebook"
    | "website"
    | "googleMaps";
  value: string;
  /** Optional human label, e.g. "Recepción" or "Urgencias". */
  label?: string;
};

/**
 * Snapshot of a Google Business Profile, sourced from the public Google
 * Maps page. We don't auto-sync this yet (would need Places API + billing);
 * for now it's updated manually when the listing changes meaningfully.
 */
export type GoogleMapsProfile = {
  /** Google Place ID — stable identifier for the listing. */
  placeId: string;
  /** Star rating, e.g. 4.9. */
  rating?: number;
  /** Total number of reviews, e.g. 544. */
  reviewCount?: number;
  /** Canonical Google Maps URL the visitor can open to read reviews. */
  mapsUrl?: string;
  /** Plus Code, e.g. "CJ65+WR Buenos Aires". */
  plusCode?: string;
  /** ISO date of last manual sync, e.g. "2026-05-16". */
  lastSyncedAt?: string;
};

/**
 * How the business actually takes bookings — drives Mia's behavior in the
 * chat. Today only the first two are implemented.
 *
 *   • whatsapp_handoff   The business takes turns via WhatsApp. Mia's job
 *                        is to deliver the visitor to WhatsApp with a
 *                        prefilled, context-rich message. We do NOT
 *                        recollect contact details (the office will do
 *                        that on WhatsApp). A Lead is only created if
 *                        the visitor explicitly prefers another channel.
 *   • data_collection    Mia gathers full appointment details (name,
 *                        contact, motivo, preferred times), confirms,
 *                        and saves a Lead. The office reaches out from
 *                        there. Useful for businesses without a real
 *                        appointment system yet.
 *   • calendar_integration  Future. Mia checks real availability and
 *                        books directly (Cal.com / Google Calendar).
 */
export type BookingMode =
  | "whatsapp_handoff"
  | "data_collection"
  | "calendar_integration"
  | "cta_url";

/** Required when bookingMode is "whatsapp_handoff". */
export type WhatsAppHandoff = {
  /** Number in international format without "+", spaces, or dashes — used in wa.me links. */
  number: string;
};

/**
 * Optional brand palette. Hex strings only (e.g. "#D7A67B"). Wired into
 * the chat UI via CSS custom properties:
 *   --brand-primary       header bg, send button, accents
 *   --brand-primary-soft  hover/tint state derived from primary
 *   --brand-bg            chat body background
 *   --brand-text          dark text + user-bubble background
 * If `branding` is absent the UI falls back to neutral/emerald defaults.
 */
export type BusinessBranding = {
  background?: string;
  primary?: string;
  text?: string;
};

/**
 * Conversation-starter chip shown above the input before the visitor sends
 * their first message. Per-business and per-language. Two flavors:
 *
 *   • send_message  → behaves exactly like the visitor typed `message` and
 *                     hit send. Goes through /api/chat, retrieval, logging.
 *   • open_url      → opens the URL in a new tab. No /api/chat call.
 *
 * Discriminated by `type` so the renderer can type-narrow safely.
 */
export type QuickAction =
  | {
      id: string;
      label: string;
      type: "send_message";
      message: string;
    }
  | {
      id: string;
      label: string;
      type: "open_url";
      url: string;
    };

export type Business = {
  /** Display name of the business (used in greetings and UI). */
  name: string;

  /** BCP-47-ish primary language Mia replies in by default. */
  language: "es" | "en" | "de";

  /** How the business takes bookings; defaults to `data_collection` if absent. */
  bookingMode?: BookingMode;

  /** Required when bookingMode is "whatsapp_handoff". */
  whatsappHandoff?: WhatsAppHandoff;

  /** Required when bookingMode is "cta_url". URL of the booking/contact page. */
  ctaUrl?: string;

  /** Short tagline, one sentence. */
  tagline?: string;

  /** 1–3 sentence "about" used as background context for Mia. */
  about?: string;

  /** Custom opening message. If absent, a default is generated from `name` + `language`. */
  greeting?: string;

  /**
   * URL to the business's privacy policy. Rendered as a footer link in
   * the chat ("By chatting with us, you agree to our Privacy Policy").
   * Should point to the business's own domain, e.g.
   * "https://drasofiavazquez.com.ar/politica-privacidad". If absent, the
   * privacy notice is not shown.
   */
  privacyPolicyUrl?: string;

  address?: string;
  hours?: WeeklyHours;

  /**
   * IANA timezone identifier, e.g. "America/Argentina/Buenos_Aires" or
   * "America/New_York". Required for `openingHours` to compute today/
   * tomorrow correctly. Without it the chat falls back to legacy `hours`.
   */
  timezone?: string;

  /**
   * Structured opening hours. When present, the prompt builder:
   *   1. Replaces the legacy `hours` display with this.
   *   2. Computes the current date+weekday in `timezone` and injects it
   *      as a trusted, NO-CONTRADICT block so the AI can answer
   *      "is it open now?", "are you open tomorrow?", etc. reliably
   *      without believing user corrections about the calendar.
   */
  openingHours?: OpeningHours;

  services?: readonly Service[];
  insurance?: readonly string[];
  paymentMethods?: readonly string[];

  bookingPolicy?: BookingPolicy;

  /** Channels visitors should use to actually book an appointment. */
  bookingChannels?: readonly ContactChannel[];
  /** Other ways to reach the business (general contact, social, etc.). */
  contactChannels?: readonly ContactChannel[];

  /** Snapshot of the Google Business Profile, if linked. */
  googleMaps?: GoogleMapsProfile;

  /** Free-form attributes worth surfacing, e.g. "Amigable con la comunidad LGBTQ+". */
  attributes?: readonly string[];

  /**
   * Conversation-starter chips shown above the input before the first
   * user message. Rendered max 5; defined per-business so each client
   * gets the questions THEIR visitors actually ask.
   */
  quickActions?: readonly QuickAction[];

  /** Brand palette. Omit to use defaults. */
  branding?: BusinessBranding;

  /**
   * Logo shown at the top of the chat header. PNG/SVG with transparent
   * background recommended, square or near-square. If absent, the chat
   * falls back to a circular avatar with the business's first letter.
   */
  logoUrl?: string;
};

/**
 * A single approved Q→A pair.
 *
 * - `intents` are short tags the future intent router uses to match a
 *   visitor's message against this FAQ. Today they are unused at runtime;
 *   they're authored now so the router in Iteration 4 has the data it
 *   needs. Include keywords AND short paraphrases.
 * - `answer` is the verbatim text we want the visitor to see. Keep it
 *   short, in the business's voice, and factually grounded in
 *   `business.ts` or the source content. No invented info.
 */
export type FAQ = {
  id: string;
  intents: readonly string[];
  question: string;
  answer: string;
};
