import type { FAQ } from "../types";

/**
 * FAQs basadas en lo publicado en drasofiavazquez.com.ar (homepage +
 * /dermatologia + /estetica-facial + /estetica-corporal + /estetica-intima
 * + /laser) y en el perfil de Google Maps. Cuando la doctora nos confirme
 * obras sociales, formas de pago y política de cancelación, agregamos
 * las FAQ correspondientes.
 */

// Link de WhatsApp con mensaje prellenado.
// Cuando una FAQ termina ofreciendo sacar turno, incluimos este link
// para que la UI lo renderice como botón verde de WhatsApp.
const WA = "https://wa.me/5491127279593";
const waFor = (msg: string) =>
  `${WA}?text=${encodeURIComponent(msg)}`;

export const faqs: readonly FAQ[] = [
  // ── Ubicación y contacto ─────────────────────────────────────────────
  {
    id: "ubicacion",
    intents: [
      "dirección",
      "ubicación",
      "donde están",
      "donde queda",
      "consultorio",
      "barrio",
      "palermo",
    ],
    question: "¿Dónde están ubicados?",
    answer:
      "El consultorio queda en Av. Pres. Manuel Quintana 585, 7° A, C1112 " +
      "CABA (Palermo, Buenos Aires).",
  },
  {
    id: "como-agendar",
    intents: [
      "turno",
      "agendar",
      "reservar",
      "cita",
      "sacar un turno",
      "como reservo",
      "como saco turno",
    ],
    question: "¿Cómo agendo un turno?",
    answer:
      "Podés sacar turno por WhatsApp — contanos qué tratamiento te " +
      `interesa y te respondemos con disponibilidad. [Sacá turno por WhatsApp](${waFor("Hola, quería sacar un turno.")})`,
  },
  {
    id: "whatsapp",
    intents: ["whatsapp", "wpp", "mensaje", "número de whatsapp"],
    question: "¿Cuál es el WhatsApp?",
    answer:
      `El WhatsApp del consultorio es +54 9 11 2727-9593. [Escribinos por WhatsApp](${WA})`,
  },
  {
    id: "telefono",
    intents: ["teléfono", "tel", "número", "llamar"],
    question: "¿Cuál es el teléfono?",
    answer:
      "Podés llamar o escribirnos por WhatsApp al +54 9 11 2727-9593. " +
      `Es el mismo número para las dos cosas. [Escribinos por WhatsApp](${WA})`,
  },
  {
    id: "email",
    intents: ["mail", "email", "correo", "e-mail"],
    question: "¿Cuál es el email?",
    answer: "Nuestro email es doctorasofiavazquez@gmail.com.",
  },

  // ── Horarios ─────────────────────────────────────────────────────────
  {
    id: "horarios",
    intents: [
      "horario",
      "horarios",
      "a qué hora",
      "cuándo atienden",
      "abren",
      "cierran",
    ],
    question: "¿Cuáles son los horarios de atención?",
    answer:
      "Atendemos de lunes a viernes de 10:00 a 20:00, los sábados de " +
      "12:00 a 16:30, y los domingos cerramos.",
  },
  {
    id: "horario-sabado",
    intents: ["sábado", "fines de semana", "weekend"],
    question: "¿Atienden los sábados?",
    answer: "Sí, los sábados atendemos de 12:00 a 16:30.",
  },
  {
    id: "horario-domingo",
    intents: ["domingo", "domingos", "atienden domingo"],
    question: "¿Atienden los domingos?",
    answer:
      "Los domingos el consultorio está cerrado. De lunes a viernes " +
      "atendemos de 10:00 a 20:00 y los sábados de 12:00 a 16:30.",
  },

  // ── Reseñas y reputación ─────────────────────────────────────────────
  {
    id: "resenas",
    intents: [
      "reseñas",
      "reseña",
      "opiniones",
      "comentarios",
      "qué dicen",
      "rating",
      "puntaje",
      "estrellas",
      "google",
    ],
    question: "¿Tienen reseñas de pacientes?",
    answer:
      "Sí — tenemos 4.9 estrellas con más de 540 reseñas en Google. " +
      "[Leé las reseñas en Google Maps](https://www.google.com/maps/place/?q=place_id:ChIJ4aT7oofLvJURPv1Q0F6mx-4)",
  },

  // ── Redes sociales ───────────────────────────────────────────────────
  {
    id: "instagram",
    intents: ["instagram", "ig", "redes", "redes sociales"],
    question: "¿Tienen Instagram?",
    answer:
      "Sí, podés seguirnos en [@vazquez.dermatologia](https://instagram.com/vazquez.dermatologia) " +
      "para ver casos, consejos y novedades.",
  },
  {
    id: "tiktok",
    intents: ["tiktok", "tik tok"],
    question: "¿Tienen TikTok?",
    answer:
      "Sí, en TikTok somos [@drasofiavazquez](https://tiktok.com/@drasofiavazquez).",
  },
  {
    id: "google-maps",
    intents: ["maps", "google maps", "google", "ubicación maps"],
    question: "¿Están en Google Maps?",
    answer:
      "Sí — podés encontrarnos buscando 'Vazquez Dermatología' o por la " +
      "dirección Av. Pres. Manuel Quintana 585. " +
      "[Abrir en Google Maps](https://www.google.com/maps/place/?q=place_id:ChIJ4aT7oofLvJURPv1Q0F6mx-4)",
  },

  // ── Equipo y credenciales ────────────────────────────────────────────
  {
    id: "credenciales",
    intents: [
      "título",
      "estudios",
      "credenciales",
      "es médica",
      "dermatóloga",
      "matriculada",
      "estudió",
      "formación",
    ],
    question: "¿Qué credenciales tiene la Dra. Sofía Vazquez?",
    answer:
      "La Dra. Sofía Vazquez es médica especialista en dermatología por " +
      "la Universidad de Buenos Aires y realizó su residencia en el " +
      "Hospital Argerich. Se perfeccionó en dermatología en el Hospital " +
      "Saint Louis de París, en técnicas avanzadas de Toxina, Fillers y " +
      "Bioestimuladores en un Cadaver Lab en Verona, Italia, y en láser " +
      "en el Hospital Italiano de Buenos Aires.",
  },
  {
    id: "experiencia",
    intents: ["experiencia", "cuántos años", "trayectoria", "hace mucho"],
    question: "¿Cuántos años de experiencia tiene?",
    answer:
      "La Dra. Sofía Vazquez tiene más de 10 años de trayectoria " +
      "dedicada a la medicina estética y la dermatología.",
  },

  // ── Tratamientos generales ───────────────────────────────────────────
  {
    id: "servicios-overview",
    intents: ["qué hacen", "qué tratamientos", "servicios", "qué ofrecen"],
    question: "¿Qué tratamientos ofrecen?",
    answer:
      "Trabajamos en cinco áreas:\n\n" +
      "• **Dermatología clínica** (rosácea, acné, alopecia, vitíligo, PRP)\n" +
      "• **Estética facial** (Botox, diseño de labios, rinomodelación, " +
      "contorno facial, ojeras, Profhilo, Radiesse, Harmonyca, peelings)\n" +
      "• **Estética corporal** (Cellutrix)\n" +
      "• **Estética íntima** (armonización vulvar, PRP vulvovaginal, " +
      "despigmentación, aumento del punto G)\n" +
      "• **Láser** (CO₂ fraccionado, CoolPeel, luz pulsada)\n\n" +
      "¿Hay algún tratamiento puntual que te interese?",
  },

  // ── Dermatología clínica: condiciones puntuales ──────────────────────
  {
    id: "rosacea",
    intents: ["rosácea", "rosacea", "tengo rosácea", "manchas rojas", "enrojecimiento"],
    question: "¿Tratan rosácea?",
    answer:
      "Sí, la rosácea es una de las condiciones que tratamos dentro de " +
      "dermatología clínica. Lo mejor es agendar una consulta para que la " +
      "doctora pueda evaluarte y armar un plan a medida. " +
      `[Sacá turno por WhatsApp](${waFor("Hola, quería consultar por un tratamiento para rosácea.")})`,
  },
  {
    id: "acne",
    intents: ["acné", "acne", "granos", "espinillas", "barros"],
    question: "¿Tratan acné?",
    answer:
      "Sí, tratamos acné en sus distintas etapas dentro de dermatología " +
      "clínica. Para definir el plan más adecuado, lo mejor es una consulta. " +
      `[Sacá turno por WhatsApp](${waFor("Hola, quería consultar por un tratamiento para acné.")})`,
  },
  {
    id: "alopecia-areata",
    intents: ["alopecia areata", "calva", "pelada", "caída pelo localizada"],
    question: "¿Tratan alopecia areata?",
    answer:
      "Sí, alopecia areata es una de las condiciones que abordamos. " +
      "Una consulta nos permite evaluar el caso y plantearte opciones de " +
      "tratamiento. " +
      `[Sacá turno por WhatsApp](${waFor("Hola, quería consultar por alopecia areata.")})`,
  },
  {
    id: "vitiligo",
    intents: ["vitíligo", "vitiligo", "manchas blancas"],
    question: "¿Tratan vitíligo?",
    answer:
      "Sí, el vitíligo es una de las condiciones dermatológicas que " +
      "tratamos. " +
      `[Sacá turno por WhatsApp](${waFor("Hola, quería consultar por vitíligo.")})`,
  },
  {
    id: "alopecia-general",
    intents: ["alopecia", "caída del pelo", "calvicie", "se me cae el pelo"],
    question: "¿Tratan la caída del pelo / alopecia?",
    answer:
      "Sí — abordamos alopecia tanto en hombres como en mujeres, " +
      "incluyendo alopecia areata. Para evaluar el caso y armar el plan, " +
      `lo ideal es una consulta. [Sacá turno por WhatsApp](${waFor("Hola, quería consultar por caída del pelo.")})`,
  },

  // ── Estética facial: tratamientos puntuales ──────────────────────────
  {
    id: "botox",
    intents: ["botox", "toxina", "toxina botulínica", "arrugas frente", "patas de gallo"],
    question: "¿Hacen Botox?",
    answer:
      "Sí, aplicamos toxina botulínica (Botox) para arrugas de expresión " +
      "(frente, entrecejo, patas de gallo, peribucales). " +
      `[Sacá turno por WhatsApp](${waFor("Hola, quería sacar turno para una consulta de Botox.")})`,
  },
  {
    id: "labios",
    intents: ["labios", "diseño de labios", "rellenar labios"],
    question: "¿Hacen diseño de labios?",
    answer:
      "Sí, el diseño de labios es uno de nuestros tratamientos faciales. " +
      "Buscamos siempre resultados naturales y armónicos. " +
      `[Sacá turno por WhatsApp](${waFor("Hola, quería consultar por diseño de labios.")})`,
  },
  {
    id: "rinomodelacion",
    intents: ["rinomodelación", "rino", "nariz", "modelar nariz"],
    question: "¿Hacen rinomodelación?",
    answer:
      "Sí, la rinomodelación es uno de los tratamientos faciales que " +
      "realizamos. " +
      `[Sacá turno por WhatsApp](${waFor("Hola, quería consultar por una rinomodelación.")})`,
  },
  {
    id: "ojeras",
    intents: ["ojeras", "valle lagrimal", "bolsas debajo de los ojos"],
    question: "¿Tratan las ojeras?",
    answer:
      "Sí, hacemos tratamientos para ojeras y valle lagrimal. " +
      `[Sacá turno por WhatsApp](${waFor("Hola, quería consultar por un tratamiento de ojeras.")})`,
  },
  {
    id: "profhilo",
    intents: ["profhilo", "hidratación profunda", "bio-remodelación"],
    question: "¿Hacen Profhilo?",
    answer:
      "Sí, Profhilo es uno de los tratamientos faciales que ofrecemos. " +
      "Es un bioremodelador que mejora la calidad y firmeza de la piel. " +
      `[Sacá turno por WhatsApp](${waFor("Hola, quería consultar por Profhilo.")})`,
  },
  {
    id: "radiesse",
    intents: ["radiesse", "calcio", "bioestimulador"],
    question: "¿Hacen Radiesse?",
    answer:
      "Sí, aplicamos Radiesse — un bioestimulador de colágeno que se usa " +
      "para mejorar firmeza y contornos. " +
      `[Sacá turno por WhatsApp](${waFor("Hola, quería consultar por Radiesse.")})`,
  },
  {
    id: "harmonyca",
    intents: ["harmonyca", "armonyca"],
    question: "¿Qué es Harmonyca?",
    answer:
      "Harmonyca es uno de los tratamientos faciales que ofrecemos. " +
      "Si te interesa, podés agendar una consulta y la doctora te explica " +
      `si es indicado para tu caso. [Sacá turno por WhatsApp](${waFor("Hola, quería consultar por Harmonyca.")})`,
  },
  {
    id: "pdrn-salmon",
    intents: ["pdrn", "salmón", "salmon", "regeneración piel"],
    question: "¿Hacen PDRN de salmón?",
    answer:
      "Sí, el PDRN de salmón es uno de nuestros tratamientos de estética " +
      "facial. " +
      `[Sacá turno por WhatsApp](${waFor("Hola, quería consultar por PDRN de salmón.")})`,
  },
  {
    id: "peeling",
    intents: ["peeling", "peelings", "exfoliación", "renovar piel"],
    question: "¿Hacen peelings?",
    answer:
      "Sí, hacemos peelings dentro de estética facial. Para definir el " +
      "tipo más adecuado para tu piel, lo mejor es una consulta. " +
      `[Sacá turno por WhatsApp](${waFor("Hola, quería consultar por un peeling.")})`,
  },
  {
    id: "limpieza-facial",
    intents: ["limpieza facial", "limpieza de cutis"],
    question: "¿Hacen limpieza facial?",
    answer:
      "Sí, la limpieza facial es uno de los servicios que ofrecemos. " +
      `[Sacá turno por WhatsApp](${waFor("Hola, quería sacar turno para una limpieza facial.")})`,
  },

  // ── Estética corporal ────────────────────────────────────────────────
  {
    id: "celulitis-cellutrix",
    intents: ["celulitis", "cellutrix", "piel naranja"],
    question: "¿Hacen tratamientos para celulitis?",
    answer:
      "Sí, ofrecemos Cellutrix dentro de estética corporal. " +
      `[Sacá turno por WhatsApp](${waFor("Hola, quería consultar por Cellutrix / celulitis.")})`,
  },

  // ── Estética íntima ──────────────────────────────────────────────────
  {
    id: "estetica-intima-overview",
    intents: [
      "estética íntima",
      "intima",
      "vulvar",
      "vagina",
      "tratamientos íntimos",
    ],
    question: "¿Qué tratamientos de estética íntima ofrecen?",
    answer:
      "Ofrecemos varios: armonización vulvar con ácido hialurónico, " +
      "bioestimulación vulvar con hilos tensores, PRP vulvovaginal, " +
      "PRP en zonas erógenas, despigmentación vulvovaginal, aumento del " +
      "punto G y chip hormonal (pellet de testosterona). Para evaluar " +
      "cuál es el indicado en tu caso, lo mejor es una consulta. " +
      `[Sacá turno por WhatsApp](${waFor("Hola, quería consultar por tratamientos de estética íntima.")})`,
  },

  // ── Láser ────────────────────────────────────────────────────────────
  {
    id: "laser-overview",
    intents: ["láser", "laser", "luz pulsada", "ipl", "co2", "coolpeel"],
    question: "¿Qué tratamientos con láser hacen?",
    answer:
      "Trabajamos con láser CO₂ fraccionado, CoolPeel y luz pulsada. " +
      "El indicado depende de lo que quieras tratar — lo mejor es una " +
      "consulta para evaluarlo en persona. " +
      `[Sacá turno por WhatsApp](${waFor("Hola, quería consultar por tratamientos con láser.")})`,
  },

  // ── Filosofía e inclusión ───────────────────────────────────────────
  {
    id: "filosofia",
    intents: ["resultados naturales", "filosofía", "estilo", "natural", "transparencia"],
    question: "¿Cuál es el enfoque del consultorio?",
    answer:
      "Trabajamos con tres pilares: resultados naturales, transparencia " +
      "total con cada paciente y la salud ante todo.",
  },
  {
    id: "lgbtq-friendly",
    intents: ["lgbt", "lgbtq", "lgbtq+", "gay friendly", "trans", "inclusivo", "diversidad"],
    question: "¿El consultorio es amigable con la comunidad LGBTQ+?",
    answer:
      "Sí — el consultorio está reconocido como amigable con la comunidad " +
      "LGBTQ+. Atendemos a todas las personas con el mismo cuidado y " +
      "respeto.",
  },
];
