import type { Business } from "../types";

export const business = {
  name: "Lumen Family Clinic",
  language: "en",
  bookingMode: "data_collection",
  tagline: "Compassionate primary care in the heart of downtown.",
  about:
    "Lumen Family Clinic provides primary care for patients of all ages " +
    "in downtown Springfield, with same-day urgent slots and telehealth.",

  address: "221 Maple Avenue, Suite 4, Springfield",

  hours: {
    monday: "8:00 AM – 6:00 PM",
    tuesday: "8:00 AM – 6:00 PM",
    wednesday: "8:00 AM – 6:00 PM",
    thursday: "8:00 AM – 8:00 PM",
    friday: "8:00 AM – 5:00 PM",
    saturday: "9:00 AM – 1:00 PM",
    sunday: "Closed",
  },

  services: [
    { name: "Annual physicals & wellness exams", durationMin: 45 },
    { name: "Pediatric visits (ages 0–17)", durationMin: 30 },
    { name: "Vaccinations & immunizations", durationMin: 15 },
    {
      name: "Chronic condition management (diabetes, hypertension, asthma)",
      durationMin: 30,
    },
    { name: "Women's health & gynecology", durationMin: 45 },
    { name: "Lab work & blood draws", durationMin: 20 },
    { name: "Telehealth consultations", durationMin: 20 },
  ],

  insurance: [
    "Aetna",
    "Blue Cross Blue Shield",
    "Cigna",
    "UnitedHealthcare",
    "Humana",
    "Medicare",
    "Medicaid (state plans)",
  ],

  bookingPolicy: {
    leadTime: "Non-urgent visits typically book 2–10 business days out.",
    sameDay:
      "Same-day urgent slots open at 7:30 AM each morning, first come first served.",
    cancellation:
      "Please cancel or reschedule at least 24 hours in advance to avoid a $35 fee.",
    newPatients:
      "New patients should arrive 15 minutes early with photo ID and insurance card.",
  },

  paymentMethods: ["Cash", "Credit/debit", "HSA/FSA cards"],

  contactChannels: [
    { type: "phone", value: "+1 (555) 482-1100" },
    { type: "email", value: "hello@lumenclinic.example" },
  ],
} as const satisfies Business;
