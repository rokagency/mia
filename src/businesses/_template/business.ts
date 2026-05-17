import type { Business } from "../types";

/**
 * Onboarding a new client?
 *
 *   1. Copy this folder:
 *        Copy-Item -Recurse src\businesses\_template src\businesses\<new-client-slug>
 *   2. Fill in every TODO below with values from the client.
 *      It is OK to leave optional fields out entirely — Mia will
 *      handle missing data by offering to take a message.
 *   3. Open src/businesses/<new-client-slug>/faq.ts and add FAQs.
 *   4. Point src/config/active-business.ts at the new folder.
 */
export const business = {
  name: "TODO: Business name",
  language: "en", // "es" or "en"

  // How does this business take bookings?
  //   "whatsapp_handoff"  — they receive turns via WhatsApp (most common
  //                         for LATAM small businesses). Set
  //                         `whatsappHandoff.number` below.
  //   "data_collection"   — they don't have a system yet; Mia gathers
  //                         appointment details and saves a Lead row.
  bookingMode: "data_collection",
  // whatsappHandoff: { number: "5491127279593" },  // sin "+", sin guiones

  tagline: "TODO: One short sentence about what they do.",
  // about: "TODO: 1–3 sentence description used as background context.",

  address: "TODO: Street, suite, city",

  // hours: {
  //   monday: "TODO",
  //   tuesday: "TODO",
  //   wednesday: "TODO",
  //   thursday: "TODO",
  //   friday: "TODO",
  //   saturday: "TODO",
  //   sunday: "Closed",
  // },

  // services: [
  //   { name: "TODO: Service name", durationMin: 30 },
  // ],

  // insurance: [
  //   // "TODO: Insurance provider",
  // ],

  // bookingPolicy: {
  //   leadTime: "TODO",
  //   sameDay: "TODO",
  //   cancellation: "TODO",
  //   newPatients: "TODO",
  // },

  // paymentMethods: [
  //   // "TODO",
  // ],

  contactChannels: [
    // { type: "phone", value: "TODO" },
    // { type: "whatsapp", value: "TODO" },
    // { type: "email", value: "TODO" },
  ],

  // bookingChannels: [
  //   { type: "whatsapp", value: "TODO", label: "Sacá turno por WhatsApp" },
  // ],
} as const satisfies Business;
