import type { Business } from "../types";

/**
 * Datos extraídos de:
 *  • https://drasofiavazquez.com.ar/ (homepage, /quienes-somos, /contacto,
 *    /tratamientos, /dermatologia, /estetica-facial, /estetica-corporal,
 *    /estetica-intima, /laser) — sync 2026-05-16
 *  • Perfil público de Google Maps (Place ID ChIJ4aT7oofLvJURPv1Q0F6mx-4)
 *    — sync manual 2026-05-16
 *
 * Sigue faltando confirmación de la doctora para: obras sociales aceptadas,
 * formas de pago, política de cancelación, indicaciones para pacientes nuevos
 * y si ofrece telemedicina. Mientras tanto, Mia ofrece tomar el contacto en
 * lugar de inventar datos.
 */
export const business = {
  name: "Vazquez Dermatología",
  language: "es",
  bookingMode: "whatsapp_handoff",
  whatsappHandoff: {
    // Mismo número que figura en contactChannels, pero acá en formato
    // internacional puro (sin "+" ni guiones) porque así lo requiere wa.me.
    number: "5491127279593",
  },
  tagline: "Tu piel radiante cuidando tu salud.",
  about:
    "La Dra. Sofía Vazquez es médica especialista en dermatología " +
    "(Universidad de Buenos Aires, residencia en el Hospital Argerich) " +
    "con más de 10 años de trayectoria en medicina estética y " +
    "dermatología. Se perfeccionó en el Hospital Saint Louis de París, " +
    "en técnicas avanzadas de Toxina, Fillers y Bioestimuladores en un " +
    "Cadaver Lab en Verona, Italia, y en láser en el Hospital Italiano " +
    "de Buenos Aires. El consultorio queda en Palermo, CABA, y tiene " +
    "4.9 estrellas con más de 540 reseñas en Google.",

  greeting:
    "¡Hola! Soy Mia, la asistente virtual del consultorio de la Dra. Sofía " +
    "Vazquez. ¿En qué te puedo ayudar?",

  address:
    "Av. Pres. Manuel Quintana 585, 7° A, C1112 CABA (Palermo, Buenos Aires)",

  hours: {
    monday: "10:00–20:00",
    tuesday: "10:00–20:00",
    wednesday: "10:00–20:00",
    thursday: "10:00–20:00",
    friday: "10:00–20:00",
    saturday: "12:00–16:30",
    sunday: "Cerrado",
  },

  // Structured version of the above — used by the chat to compute
  // today/tomorrow correctly and to refuse incorrect user assertions
  // about the calendar. Empty array = closed.
  timezone: "America/Argentina/Buenos_Aires",
  openingHours: {
    monday:    [{ open: "10:00", close: "20:00" }],
    tuesday:   [{ open: "10:00", close: "20:00" }],
    wednesday: [{ open: "10:00", close: "20:00" }],
    thursday:  [{ open: "10:00", close: "20:00" }],
    friday:    [{ open: "10:00", close: "20:00" }],
    saturday:  [{ open: "12:00", close: "16:30" }],
    sunday:    [],
  },

  services: [
    // ── Dermatología clínica ───────────────────────────────────────────
    { name: "Tratamiento de rosácea", category: "Dermatología" },
    { name: "Tratamiento de acné", category: "Dermatología" },
    { name: "Alopecia (medicina estética masculina y femenina)", category: "Dermatología" },
    { name: "Alopecia areata", category: "Dermatología" },
    { name: "Vitíligo", category: "Dermatología" },
    { name: "Plasma rico en plaquetas (PRP)", category: "Dermatología" },
    { name: "Mesoterapia francesa", category: "Dermatología" },

    // ── Estética facial ────────────────────────────────────────────────
    { name: "Toxina botulínica (Botox)", category: "Estética facial" },
    { name: "Arrugas peribucales", category: "Estética facial" },
    { name: "Diseño de labios", category: "Estética facial" },
    { name: "Rinomodelación", category: "Estética facial" },
    { name: "Contorno facial", category: "Estética facial" },
    { name: "Pómulos", category: "Estética facial" },
    { name: "Mentón", category: "Estética facial" },
    { name: "Jaw line", category: "Estética facial" },
    { name: "Fosa temporal", category: "Estética facial" },
    { name: "Surco nasogeniano", category: "Estética facial" },
    { name: "Ojeras / valle lagrimal", category: "Estética facial" },
    { name: "PDRN de salmón", category: "Estética facial" },
    { name: "Profhilo", category: "Estética facial" },
    { name: "Radiesse", category: "Estética facial" },
    { name: "Harmonyca", category: "Estética facial" },
    { name: "Peelings", category: "Estética facial" },
    { name: "Limpieza facial", category: "Estética facial" },

    // ── Estética corporal ──────────────────────────────────────────────
    { name: "Cellutrix", category: "Estética corporal" },

    // ── Estética íntima ────────────────────────────────────────────────
    { name: "Armonización vulvar con ácido hialurónico", category: "Estética íntima" },
    { name: "Bioestimulación vulvar con hilos tensores", category: "Estética íntima" },
    { name: "Aumento del punto G", category: "Estética íntima" },
    { name: "Plasma rico en plaquetas vulvovaginal", category: "Estética íntima" },
    { name: "PRP en zonas erógenas", category: "Estética íntima" },
    { name: "Despigmentación vulvovaginal", category: "Estética íntima" },
    { name: "Chip hormonal (pellet de testosterona)", category: "Estética íntima" },

    // ── Láser ──────────────────────────────────────────────────────────
    { name: "Láser CO₂ fraccionado", category: "Láser" },
    { name: "CoolPeel", category: "Láser" },
    { name: "Luz pulsada", category: "Láser" },
  ],

  // insurance: [...]       ← TODO: confirmar obras sociales / prepagas
  // paymentMethods: [...]  ← TODO: confirmar formas de pago

  bookingPolicy: {
    // leadTime / sameDay / cancellation / newPatients no están publicados —
    // se completarán cuando los confirme la doctora.
  },

  bookingChannels: [
    {
      type: "whatsapp",
      value: "11 2727-9593",
      label: "Sacá turno por WhatsApp",
    },
  ],

  contactChannels: [
    // El consultorio tiene un único número, usado tanto para llamadas
    // como para WhatsApp. Lo listamos en dos formatos porque los
    // visitantes preguntan por "teléfono" y por "WhatsApp" indistintamente.
    { type: "whatsapp", value: "11 2727-9593" },
    { type: "phone", value: "+54 9 11 2727-9593" },
    { type: "email", value: "doctorasofiavazquez@gmail.com" },
    { type: "instagram", value: "@vazquez.dermatologia" },
    { type: "tiktok", value: "@drasofiavazquez" },
    { type: "website", value: "https://drasofiavazquez.com.ar/" },
    {
      type: "googleMaps",
      value: "https://www.google.com/maps/place/?q=place_id:ChIJ4aT7oofLvJURPv1Q0F6mx-4",
      label: "Perfil en Google Maps",
    },
  ],

  googleMaps: {
    placeId: "ChIJ4aT7oofLvJURPv1Q0F6mx-4",
    rating: 4.9,
    reviewCount: 544,
    mapsUrl:
      "https://www.google.com/maps/place/?q=place_id:ChIJ4aT7oofLvJURPv1Q0F6mx-4",
    plusCode: "CJ65+WR Buenos Aires",
    lastSyncedAt: "2026-05-16",
  },

  attributes: ["Consultorio amigable con la comunidad LGBTQ+"],

  /** Paleta de marca de la doctora. */
  branding: {
    background: "#F6F2E9", // crema — reservado para usos futuros (widget bg, email branding)
    primary: "#D7A67B",    // caramel — borde de chips, send button, accents
    text: "#303030",       // grafito — texto y user bubble bg
  },

  // logoUrl: "https://drasofiavazquez.com.ar/path-to-logo.png",
  // ↑ TODO: cuando Sofía nos pase la URL del logo (PNG/SVG transparente,
  //   idealmente cuadrado), descomentalo y volvé a correr `npm run db:seed`.
  //   Mientras tanto se muestra un círculo caramel con la letra "V".

  /**
   * Conversation-starter chips shown above the first message. Pensados
   * para los 4 caminos más comunes que pisa el visitante al entrar.
   * Si querés cambiar el orden, los textos o la URL de reseñas:
   * editá acá y volvé a correr `npm run db:seed`.
   */
  quickActions: [
    {
      id: "hours",
      label: "Horarios",
      type: "send_message",
      message: "¿Cuáles son los horarios?",
    },
    {
      id: "booking",
      label: "Solicitar un turno",
      type: "send_message",
      message: "Quiero solicitar un turno",
    },
    {
      id: "treatments",
      label: "Consultar tratamientos",
      type: "send_message",
      message: "¿Qué tratamientos ofrecen?",
    },
    {
      id: "google_reviews",
      label: "Ver reseñas en Google",
      type: "open_url",
      // Link directo al panel de reseñas del Place ID de la doctora.
      // Si Sofía prefiere mandarlos al perfil completo (no solo reseñas),
      // reemplazá por: https://www.google.com/maps/place/?q=place_id:ChIJ4aT7oofLvJURPv1Q0F6mx-4
      url: "https://search.google.com/local/reviews?placeid=ChIJ4aT7oofLvJURPv1Q0F6mx-4",
    },
  ],
} as const satisfies Business;
