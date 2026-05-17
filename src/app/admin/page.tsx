import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Admin home: a table of every Business with aggregate counts so you
 * can spot at a glance which clients are active.
 */
export default async function AdminHome() {
  const businesses = await prisma.business.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      language: true,
      bookingMode: true,
      websiteUrl: true,
      allowedOrigins: true,
      _count: {
        select: {
          documents: true,
          leads: true,
          conversations: true,
          faqs: true,
          knowledgeSources: true,
        },
      },
    },
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Clients</h1>
        <p className="mt-1 text-sm text-neutral-500">
          All businesses registered in this Mia instance.
        </p>
      </header>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <Th>Business</Th>
              <Th>Slug</Th>
              <Th>Lang</Th>
              <Th>Mode</Th>
              <Th>Docs</Th>
              <Th>FAQs</Th>
              <Th>Convs</Th>
              <Th>Leads</Th>
              <Th>Embed</Th>
            </tr>
          </thead>
          <tbody>
            {businesses.map((b) => (
              <tr key={b.id} className="border-t border-neutral-100">
                <Td>
                  <Link
                    href={`/admin/clients/${b.slug}`}
                    className="font-medium text-neutral-900 hover:underline"
                  >
                    {b.name}
                  </Link>
                  {b.websiteUrl ? (
                    <div className="mt-0.5 text-xs text-neutral-500">
                      {b.websiteUrl.replace(/^https?:\/\//, "")}
                    </div>
                  ) : null}
                </Td>
                <Td>
                  <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs">
                    {b.slug}
                  </code>
                </Td>
                <Td>{b.language}</Td>
                <Td>
                  <span className="text-xs text-neutral-600">{b.bookingMode}</span>
                </Td>
                <Td>{b._count.documents}</Td>
                <Td>{b._count.faqs}</Td>
                <Td>{b._count.conversations}</Td>
                <Td>{b._count.leads}</Td>
                <Td>
                  {b.allowedOrigins.length === 0 ? (
                    <span className="text-xs text-red-600">none</span>
                  ) : (
                    <span className="text-xs text-emerald-700">
                      {b.allowedOrigins.length} set
                    </span>
                  )}
                </Td>
              </tr>
            ))}
            {businesses.length === 0 ? (
              <tr>
                <Td>
                  <span className="text-neutral-500">No businesses yet.</span>
                </Td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2 text-left font-medium">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-top">{children}</td>;
}
