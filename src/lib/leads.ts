import { z } from "zod";
import { prisma } from "./db";

// Plain object schema — used both for AI tool parameters (must be a plain
// ZodObject so the AI SDK can serialize it to JSON Schema) and as the input
// type for the deterministic write path.
export const leadFieldsSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(120)
    .optional()
    .describe("Visitor's full name, if provided."),
  email: z
    .string()
    .email()
    .max(200)
    .optional()
    .describe("Email address for follow-up."),
  phone: z
    .string()
    .min(5)
    .max(40)
    .optional()
    .describe("Phone number for follow-up."),
  reason: z
    .string()
    .max(1000)
    .optional()
    .describe("Why the visitor is reaching out. One or two sentences."),
  appointmentType: z
    .string()
    .max(200)
    .optional()
    .describe(
      "If this is an appointment request, the service requested (e.g. 'Annual physical')."
    ),
  patientType: z
    .enum(["new", "existing"])
    .optional()
    .describe("Whether the visitor is a new or existing patient."),
  preferredTimes: z
    .string()
    .max(500)
    .optional()
    .describe(
      "Free-form preferred day/time windows, exactly as the visitor stated them."
    ),
  notes: z
    .string()
    .max(1000)
    .optional()
    .describe("Anything else worth recording for the office."),
});

export type LeadInput = z.infer<typeof leadFieldsSchema>;

const hasContact = (d: LeadInput) => Boolean(d.email || d.phone);

/**
 * Canonical write path for leads.
 *
 * Called via AI tool calling from the chat route — but only for the
 * narrow case where the visitor explicitly wants the office to reach
 * out instead of going to WhatsApp themselves. For the common case
 * (WhatsApp handoff) no Lead row is created; the conversation log
 * carries the signal via `whatsappHandoff: true`.
 *
 * `conversationId` is taken from the chat route context, not from the
 * AI (so the model can't fake it).
 */
export async function saveLead(input: LeadInput, conversationId?: string) {
  const parsed = leadFieldsSchema.parse(input);
  if (!hasContact(parsed)) {
    throw new Error(
      "Cannot save a lead without at least one of email or phone."
    );
  }
  return prisma.lead.create({
    data: { ...parsed, conversationId },
  });
}

export async function listLeads(limit = 50) {
  return prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
