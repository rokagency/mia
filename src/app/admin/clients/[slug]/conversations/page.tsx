import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function ConversationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const cursor = sp.cursor ?? null;

  const business = await prisma.business.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });
  if (!business) notFound();

  const convs = await prisma.conversation.findMany({
    where: { businessId: business.id },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      createdAt: true,
      messageCount: true,
      whatsappHandoff: true,
      _count: { select: { leads: true } },
    },
  });

  const hasMore = convs.length > PAGE_SIZE;
  const visible = hasMore ? convs.slice(0, PAGE_SIZE) : convs;
  const nextCursor = hasMore ? visible[visible.length - 1].id : null;

  return (
    <div>
      <header className="mb-6">
        <Link
          href={`/admin/clients/${slug}`}
          className="text-xs text-neutral-500 hover:underline"
        >
          ← {business.name}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Conversations</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Visitor chat sessions, newest first.
        </p>
      </header>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <Th>When</Th>
              <Th>Conversation ID</Th>
              <Th>Messages</Th>
              <Th>WA handoff</Th>
              <Th>Leads</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {visible.map((c) => (
              <tr key={c.id} className="border-t border-neutral-100">
                <Td>
                  <div className="text-xs">
                    {c.createdAt.toISOString().slice(0, 16)}
                  </div>
                </Td>
                <Td>
                  <code className="text-xs">{c.id.slice(0, 14)}…</code>
                </Td>
                <Td>{c.messageCount}</Td>
                <Td>{c.whatsappHandoff ? "yes" : "—"}</Td>
                <Td>{c._count.leads}</Td>
                <Td>
                  <Link
                    href={`/admin/clients/${slug}/conversations/${c.id}`}
                    className="text-xs text-neutral-600 hover:underline"
                  >
                    Open →
                  </Link>
                </Td>
              </tr>
            ))}
            {visible.length === 0 ? (
              <tr>
                <Td>
                  <span className="text-neutral-500">No conversations yet.</span>
                </Td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-end gap-3">
        {cursor ? (
          <Link
            href={`/admin/clients/${slug}/conversations`}
            className="text-xs text-neutral-600 hover:underline"
          >
            ← First page
          </Link>
        ) : null}
        {nextCursor ? (
          <Link
            href={`/admin/clients/${slug}/conversations?cursor=${nextCursor}`}
            className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs hover:bg-neutral-50"
          >
            Older →
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-4 py-2 text-left font-medium">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3">{children}</td>;
}
