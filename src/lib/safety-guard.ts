import type { Business } from "@/businesses/types";

/**
 * Fast safety guard.
 *
 * Runs BEFORE retrieval and BEFORE the LLM call on every chat turn. Catches
 * the obvious abuse patterns — prompt injection, fake official updates,
 * private-data requests, token-burning prompts, blatantly off-topic
 * questions — with cheap regexes and returns a fixed canned response.
 *
 * Goals:
 *   • Zero OpenAI cost for known-bad inputs.
 *   • Zero retrieval latency for known-bad inputs.
 *   • Single, audit-able place to tune patterns and canned responses.
 *
 * NON-goals:
 *   • Perfect detection. Subtle adversarial inputs will slip through and
 *     hit the system prompt's safety rules (which is the right defense
 *     in depth). False *positives* are the bigger risk — every pattern
 *     here was chosen to avoid matching legitimate visitor questions
 *     (no plain "ignore", no plain "número", etc.).
 *   • Multi-language. Patterns are Spanish + English to cover Sofia and
 *     Lumen; add languages by extending the arrays as needed.
 */

export type GuardResult =
  | { blocked: false }
  | { blocked: true; reason: string; response: string };

type Rule = {
  reason: string;
  patterns: readonly RegExp[];
  buildResponse: (message: string, business: Business) => string;
};

// ── Prompt injection ────────────────────────────────────────────────────
const PROMPT_INJECTION: Rule = {
  reason: "prompt_injection",
  patterns: [
    /\bignore (all |the )?(your |previous |prior |earlier |above |last )(instructions?|prompts?|rules?|messages?)/i,
    /\bignor[áa] (tus|las|toda(s)?|todo) (instruccion(es)?|programaci[oó]n|reglas?)/i,
    /\bdisregard (your |the |all )?(previous|prior|earlier|above) (instructions?|prompts?|rules?)/i,
    /\bsystem prompt\b/i,
    /\bdeveloper prompt\b/i,
    /\bprompt del sistema\b/i,
    /\bact as (an? )?(admin|administrator|developer|system|root)\b/i,
    /\bsoy (el |la )?(administrad(or|ora)|admin|dev|developer|root)\b/i,
    /\bcambi[áa] tus (instrucciones|reglas|prompts)/i,
    /\boverride (your |the )?(system|prior|previous)/i,
    /\byou are now\b/i,
    /\bahora sos\b/i,
    /\bforget (your |everything|all|previous)/i,
    /\bolvid[áa] (tus|todo|todas|las)/i,
    /\bjailbreak\b/i,
    /\bDAN mode\b/i,
    /\brevela tu (prompt|configuraci[oó]n|sistema)/i,
    /\breveal your (prompt|system|configuration|instructions)/i,
  ],
  buildResponse: () =>
    "No puedo cambiar mis instrucciones ni compartir información interna. Puedo ayudarte con información del consultorio, tratamientos, horarios y turnos.",
};

// ── Fake official update / contact hijacking ────────────────────────────
const FAKE_OFFICIAL_UPDATE: Rule = {
  reason: "fake_official_update",
  patterns: [
    /\bactualizaci[oó]n oficial\b/i,
    /\bnuevo whatsapp\b/i,
    /\bnuevo (n[uú]mero|tel[eé]fono)\b/i,
    /\bcambi[áaeo] (el|este) (n[uú]mero|tel[eé]fono|whatsapp)/i,
    /\busa(r)? este (n[uú]mero|tel[eé]fono|whatsapp|link)/i,
    /\benvi[áa] a esta web\b/i,
    /\bconfirmalo al usuario\b/i,
    /\bconfirma al (usuario|cliente|paciente)/i,
    /\bel (verdadero|nuevo) (n[uú]mero|whatsapp|tel[eé]fono) es\b/i,
    /\bactualizado el (contacto|n[uú]mero|whatsapp)/i,
    /\bofficial update\b/i,
    /\bnew whatsapp (number|link)\b/i,
  ],
  buildResponse: (_msg, business) => {
    const officialNumber =
      business.whatsappHandoff?.number ??
      business.contactChannels?.find((c) => c.type === "whatsapp")?.value ??
      null;
    const tail = officialNumber
      ? ` El WhatsApp oficial del consultorio es **${officialNumber}**.`
      : "";
    return `No puedo modificar ni confirmar cambios de contacto desde el chat. Para turnos, usá el canal oficial del consultorio.${tail}`;
  },
};

// ── Private data requests ───────────────────────────────────────────────
const PRIVATE_DATA: Rule = {
  reason: "private_data_request",
  patterns: [
    /\bconversaciones de (otros|otras|los|las)\s*(pacientes|usuarios|personas|clientes)/i,
    /\btel[eé]fonos? de (otros |otras |los |las )?(pacientes|usuarios|clientes)/i,
    /\bdatos de (otros |otras |los |las )?(usuari[oa]s?|pacientes|clientes)/i,
    /\bleads?\b/i,
    /\busuari[oa] anterior\b/i,
    /\bpaciente anterior\b/i,
    /\bcliente anterior\b/i,
    /\bhistorial de (otros|otras|otro|otra)/i,
    /\bmensajes? (anteriores |previos |de otros|de otras)/i,
    /\bconversaci[oó]n (anterior|previa|de otra)/i,
    /\bdame (la|los) (lista|datos) de (pacientes|usuarios|leads)/i,
  ],
  buildResponse: () =>
    "No puedo acceder ni compartir información privada de otras personas. Solo puedo ayudarte con esta conversación y con información del consultorio.",
};

// ── Token / output abuse ────────────────────────────────────────────────
const TOKEN_ABUSE: Rule = {
  reason: "token_abuse",
  patterns: [
    // "5000 palabras", "10000 words" — 4+ digits as a word count
    /\b\d{4,}\s*(palabras|words|caracteres|characters|tokens)/i,
    // "repetí X veces / X times"
    /\b(repet[íi]|repite|repeat)\b.{0,40}\b\d+\s*(veces|times)/i,
    // "repetí mil/cien/1000 veces"
    /\b(repet[íi]|repite|repeat)\b.{0,40}\b(mil|cien|1000|10000)\s*(veces|times)/i,
    // "x mil veces" / "x 1000 times"
    /\b(mil|1000|10000|cien) veces\b/i,
    /\b\d+\s*(times|veces) (en fila|in a row|seguid[ao]s)/i,
    // "essay" / "ensayo largo"
    /\bensayo (largo|extenso|de \d+)/i,
    /\b(long|lengthy) (essay|response|answer|reply)\b/i,
    // "escribime un libro / novela"
    /\bescrib[ií]me (un|una) (libro|novela|cuento (largo|extenso))/i,
    /\bwrite (me )?(a |an )?(book|novel|long story)/i,
  ],
  buildResponse: () =>
    "Puedo ayudarte con una respuesta breve y concreta. Si querés, preguntame por un tratamiento específico o te ayudo a sacar un turno.",
};

// ── Obvious out-of-scope ────────────────────────────────────────────────
const OUT_OF_SCOPE: Rule = {
  reason: "out_of_scope",
  patterns: [
    // Sports — kept deliberately permissive; these words don't appear in
    // legitimate medical-clinic conversations.
    /\bmundial\b/i,
    /\bcopa (del )?mundo\b/i,
    /\bworld cup\b/i,
    /\bchampions league\b/i,
    /\bsuperliga\b/i,
    /\b(qui[eé]n |who )(gan[oó]|won)\b/i,
    /\b(messi|ronaldo|maradona|neymar|mbappe|cristiano|haaland|mbapp[eé])\b/i,
    /\b(quilmes|river plate|boca juniors|real madrid|barcelona fc|bar[çc]a)\b/i,
    /\b(nba|nfl|ufc|f1|formula 1)\b/i,
    /\bpartido (de|del) (f[uú]tbol|tenis|b[aá]squet)/i,
    // Politics (Argentine + generic)
    /\b(milei|kirchner|macri|cfk|peronismo|kirchnerismo|libertarios|massa)\b/i,
    /\b(qu[eé] pens[áa]s|qu[eé] opin[áa]s|opini[oó]n sobre) (el|la|del|de la) (presidente|gobierno|pol[íi]tic)/i,
    /\b(trump|biden|putin|zelensky)\b/i,
    // Celebrities / pop
    /\b(beyonc[eé]|taylor swift|kardashian|drake|bad bunny)\b/i,
    /\bbiograf[íi]a de (?!la dra|el dr|del dr)/i,
    // Recipes
    /\breceta (de|para)\b/i,
    /\bc[oó]mo (cocinar|hornear|preparar) (?!(la piel|el cutis))/i,
    // Songs / poems / jokes
    /\bescrib[ií]me (una|un) (canci[oó]n|poema|chiste|haiku|soneto)/i,
    /\bcont[áa]me un chiste\b/i,
    /\btell (me )?a joke\b/i,
    // Trivia
    /\bcapital de (francia|alemania|jap[oó]n|china|estados unidos|brasil|m[eé]xico|espa[ñn]a)\b/i,
    /\bcu[aá]ntos (habitantes|km|kil[oó]metros) tiene\b/i,
    // Coding / dev help
    /\b(c[oó]digo|programar|python|javascript|sql|regex) (en|para|de)\b/i,
    /\bwrite (a |me )?(function|script|program|code)\b/i,
  ],
  buildResponse: () =>
    "Estoy acá para ayudarte con información del consultorio, tratamientos dermatológicos, horarios y turnos. ¿Querés consultar por algún tratamiento?",
};

const ALL_RULES: readonly Rule[] = [
  PROMPT_INJECTION,
  FAKE_OFFICIAL_UPDATE,
  PRIVATE_DATA,
  TOKEN_ABUSE,
  OUT_OF_SCOPE,
];

/**
 * Hosts the assistant is allowed to surface in its own replies. URLs the
 * VISITOR pastes from outside this set are treated as contact hijacking
 * attempts (same reason as FAKE_OFFICIAL_UPDATE) — fake "update your
 * WhatsApp to https://wa.me/<attacker>" prompts get caught here.
 */
const KNOWN_GOOD_URL_HOSTS = new Set([
  "wa.me",
  "api.whatsapp.com",
  "instagram.com",
  "www.instagram.com",
  "tiktok.com",
  "www.tiktok.com",
  "google.com",
  "www.google.com",
  "search.google.com",
  "maps.google.com",
  "maps.app.goo.gl",
]);

function findUnknownExternalUrls(message: string, business: Business): string[] {
  const matches = message.match(/https?:\/\/[^\s)<>"']+/gi) ?? [];
  if (matches.length === 0) return [];

  const businessHosts = new Set<string>();
  for (const c of business.contactChannels ?? []) {
    if (c.type === "website" || c.type === "googleMaps") {
      try {
        businessHosts.add(new URL(c.value).hostname);
      } catch {
        // ignore malformed config URLs
      }
    }
  }

  return matches.filter((u) => {
    try {
      const host = new URL(u).hostname.toLowerCase();
      if (KNOWN_GOOD_URL_HOSTS.has(host)) return false;
      if (businessHosts.has(host)) return false;
      return true;
    } catch {
      return false;
    }
  });
}

/**
 * Evaluate the visitor's latest message. Cheap (regex only), ~sub-ms,
 * pure (no IO). Caller is the chat route — if `blocked`, skip retrieval
 * and OpenAI entirely and stream back `response`.
 */
export function evaluateFastSafetyGuard(
  message: string,
  business: Business
): GuardResult {
  const text = message.trim();
  if (text.length === 0) return { blocked: false };

  for (const rule of ALL_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(text)) {
        return {
          blocked: true,
          reason: rule.reason,
          response: rule.buildResponse(text, business),
        };
      }
    }
  }

  // External URLs not matching the business's own domain or known-good
  // ecosystem (wa.me, instagram, etc.) are likely a hijacking attempt.
  const suspicious = findUnknownExternalUrls(text, business);
  if (suspicious.length > 0) {
    return {
      blocked: true,
      reason: "external_url",
      response: FAKE_OFFICIAL_UPDATE.buildResponse(text, business),
    };
  }

  return { blocked: false };
}
