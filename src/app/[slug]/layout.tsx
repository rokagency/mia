import type { Metadata } from "next";
import { findBusinessBySlug } from "@/lib/active-business";

export const dynamic = "force-dynamic";

const TITLES: Record<string, (name: string) => string> = {
  es: (name: string) => `${name} — Mesa de entrada`,
  en: (name: string) => `${name} — Front Desk`,
  de: (name: string) => `${name} — Empfang`,
};

const DESCRIPTIONS: Record<string, (name: string) => string> = {
  es: (name: string) =>
    `Hablá con Mia, la asistente virtual de ${name}, sobre turnos, tratamientos y consultas.`,
  en: (name: string) =>
    `Talk to Mia, the virtual receptionist for ${name}, about hours, services, and booking.`,
  de: (name: string) =>
    `Sprechen Sie mit Mia, der virtuellen Assistentin von ${name}, über Öffnungszeiten, Leistungen und Termine.`,
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const found = await findBusinessBySlug(slug);
  if (!found) {
    return { title: "Not found", robots: { index: false, follow: false } };
  }
  return {
    title: TITLES[found.business.language](found.business.name),
    description: DESCRIPTIONS[found.business.language](found.business.name),
    robots: { index: false, follow: false },
  };
}

/**
 * Per-business layout. Just a pass-through; the root layout owns <html>
 * and <body>. The page.tsx beneath this enforces the embed-origin check
 * and renders either the chat or a "blocked" message. The CSP
 * frame-ancestors header is set by middleware.ts based on the slug.
 */
export default function SlugLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
