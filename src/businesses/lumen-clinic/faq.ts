import type { FAQ } from "../types";

/**
 * Approved Q→A pairs for Lumen Family Clinic.
 *
 * Add entries here for any question visitors repeatedly ask whose answer
 * is short, factual, and doesn't change often. These get injected into
 * the agent's system prompt today, and will be served directly (no AI
 * call) by the intent router landing in Iteration 4.
 *
 * Guidance for writing entries:
 *   • Keep `answer` to 1–3 short sentences in the business's voice.
 *   • Ground every answer in `business.ts` — never invent.
 *   • Add 3–8 `intents` per FAQ: keywords and short paraphrases visitors
 *     might use ("cancel", "reschedule", "miss appointment", "fee").
 *   • Stable `id` slugs (kebab-case) so analytics can track hits per FAQ.
 *
 * Example skeleton (delete or replace):
 *
 *   {
 *     id: "cancellation-policy",
 *     intents: ["cancel", "reschedule", "miss appointment", "late fee"],
 *     question: "What's your cancellation policy?",
 *     answer:
 *       "We ask for at least 24 hours notice to cancel or reschedule. " +
 *       "Less than that, there's a $35 late cancellation fee.",
 *   },
 *   {
 *     id: "parking",
 *     intents: ["parking", "park", "garage", "where do I park"],
 *     question: "Is there parking?",
 *     answer:
 *       "Yes — free 90-minute street parking on Maple Avenue, and a paid " +
 *       "garage on the corner of Maple and 3rd if you'd prefer covered parking.",
 *   },
 */
export const faqs: readonly FAQ[] = [
  // Add FAQs here. Empty for now — the agent falls back to its general
  // knowledge of business.ts until this grows.
];
