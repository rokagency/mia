import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function LeadsPage({
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

  const leads = await prisma.lead.findMany({
    where: { businessId: business.id },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = leads.length > PAGE_SIZE;
  const visible = hasMore ? leads.slice(0, PAGE_SIZE) : leads;
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
        <h1 className="mt-1 text-2xl font-semibold">Leads</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Contact requests captured by Mia, newest first.
        </p>
      </header>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <Th>When</Th>
              <Th>Name</Th>
              <Th>Contact</Th>
              <Th>Reason</Th>
              <Th>Times</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {visible.map((l) => (
              <tr key={l.id} className="border-t border-neutral-100 align-top">
                <Td>
                  <div className="text-xs">
                    {l.createdAt.toISOString().slice(0, 16)}
                  </div>
                </Td>
                <Td>{l.name ?? "—"}</Td>
                <Td>
                  {l.email ? (
                    <div className="text-xs">{l.email}</div>
                  ) : null}
                  {l.phone ? (
                    <div className="text-xs text-neutral-600">{l.phone}</div>
                  ) : null}
                </Td>
                <Td>
                  <div className="text-xs">{l.reason ?? "—"}</div>
                  {l.appointmentType ? (
                    <div className="mt-0.5 text-xs text-neutral-500">
                      {l.appointmentType}
                    </div>
                  ) : null}
                </Td>
                <Td>
                  <div className="text-xs text-neutral-600">
                    {l.preferredTimes ?? "—"}
                  </div>
                </Td>
                <Td>
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs">
                    {l.status}
                  </span>
                </Td>
              </tr>
            ))}
            {visible.length === 0 ? (
              <tr>
                <Td>
                  <span className="text-neutral-500">No leads yet.</span>
                </Td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-end gap-3">
        {cursor ? (
          <Link
            href={`/admin/clients/${slug}/leads`}
            className="text-xs text-neutral-600 hover:underline"
          >
            ← First page
          </Link>
        ) : null}
        {nextCursor ? (
          <Link
            href={`/admin/clients/${slug}/leads?cursor=${nextCursor}`}
            className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs hover:bg-neutral-50"
          >
            Older →
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2 text-left font-medium">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3">{children}</td>;
}
