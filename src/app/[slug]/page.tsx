import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ChatWindow } from "@/components/chat-window";
import { findBusinessBySlug } from "@/lib/active-business";
import { matchAllowedOrigin } from "@/lib/origin-check";

export const dynamic = "force-dynamic";

/**
 * The chat page for a given business.
 *
 * Two gates before we render the chat:
 *   1. Slug exists in DB → otherwise notFound() (404).
 *   2. Request was framed by an allowlisted origin (Referer header
 *      matches business.allowedOrigins). Direct browser visits have
 *      a Referer of "" or the same-origin URL — both fail the check
 *      and we render a "blocked" message instead of the chat.
 *
 * The CSP frame-ancestors header (set in middleware.ts) is the
 * browser-side defense; this Referer check is the server-side one.
 */
export default async function ChatPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const found = await findBusinessBySlug(slug);
  if (!found) notFound();

  const h = await headers();
  const referer = h.get("referer");
  const matched = matchAllowedOrigin(referer, found.allowedOrigins);

  if (!matched) {
    return <Blocked language={found.business.language ?? "en"} />;
  }

  return (
    <ChatWindow
      slug={found.slug}
      name={found.business.name}
      language={found.business.language}
      greeting={found.business.greeting}
      quickActions={found.business.quickActions}
      branding={found.business.branding}
      logoUrl={found.business.logoUrl}
      privacyPolicyUrl={found.business.privacyPolicyUrl}
    />
  );
}

const BLOCKED_COPY: Record<string, { title: string; body: string }> = {
  es: {
    title: "Acceso restringido",
    body: "Este chat solo está disponible cuando se carga desde el sitio web autorizado del negocio.",
  },
  en: {
    title: "Access restricted",
    body: "This chat is only available when embedded on the business's approved website.",
  },
  de: {
    title: "Zugang eingeschränkt",
    body: "Dieser Chat ist nur verfügbar, wenn er auf der autorisierten Website des Unternehmens eingebettet ist.",
  },
};

function Blocked({ language }: { language: string }) {
  const copy = BLOCKED_COPY[language] ?? BLOCKED_COPY.en;
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "2rem",
        fontFamily: "system-ui, sans-serif",
        background: "#fafafa",
        color: "#1f2937",
      }}
    >
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <h1 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>
          {copy.title}
        </h1>
        <p style={{ color: "#4b5563" }}>{copy.body}</p>
      </div>
    </main>
  );
}
