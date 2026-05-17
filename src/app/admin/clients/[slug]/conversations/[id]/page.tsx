import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ConversationView({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const business = await prisma.business.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });
  if (!business) notFound();

  const conv = await prisma.conversation.findFirst({
    where: { id, businessId: business.id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      leads: true,
    },
  });
  if (!conv) notFound();

  return (
    <div>
      <header className="mb-6">
        <Link
          href={`/admin/clients/${slug}/conversations`}
          className="text-xs text-neutral-500 hover:underline"
        >
          ← Conversations
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">
          Conversation <code className="text-base">{conv.id.slice(0, 14)}…</code>
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          {conv.createdAt.toISOString()} · {conv.messageCount} messages
          {conv.whatsappHandoff ? " · WhatsApp handoff" : ""}
        </p>
      </header>

      {conv.leads.length > 0 ? (
        <section className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
          <h2 className="text-sm font-semibold text-emerald-900">
            Leads captured in this conversation
          </h2>
          <ul className="mt-2 space-y-1 text-xs text-emerald-900">
            {conv.leads.map((l) => (
              <li key={l.id}>
                <strong>{l.name ?? "—"}</strong> · {l.email ?? ""}{" "}
                {l.phone ?? ""} · {l.reason ?? ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="space-y-3">
        {conv.messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${
              m.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === "user"
                  ? "rounded-br-md bg-neutral-900 text-white"
                  : m.role === "assistant"
                  ? "rounded-bl-md bg-neutral-100 text-neutral-900"
                  : "border border-amber-200 bg-amber-50 text-amber-900"
              }`}
            >
              <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-wide opacity-60">
                <span>{m.role}</span>
                <span>{m.createdAt.toISOString().slice(11, 19)}</span>
                {m.model ? <span>· {m.model}</span> : null}
                {m.toolName ? <span>· tool: {m.toolName}</span> : null}
              </div>
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.toolOutput ? (
                <pre className="mt-2 overflow-x-auto rounded bg-black/10 p-2 text-[10px]">
                  {JSON.stringify(m.toolOutput, null, 2)}
                </pre>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
