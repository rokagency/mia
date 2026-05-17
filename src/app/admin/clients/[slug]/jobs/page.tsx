import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function JobsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const business = await prisma.business.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });
  if (!business) notFound();

  const jobs = await prisma.ingestJob.findMany({
    where: { source: { businessId: business.id } },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { source: { select: { url: true } } },
  });

  return (
    <div>
      <header className="mb-6">
        <Link
          href={`/admin/clients/${slug}`}
          className="text-xs text-neutral-500 hover:underline"
        >
          ← {business.name}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Ingest jobs</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Last 50 crawl runs, newest first.
        </p>
      </header>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <Th>Status</Th>
              <Th>URL</Th>
              <Th>Processed</Th>
              <Th>New</Th>
              <Th>Errors</Th>
              <Th>Started</Th>
              <Th>Completed</Th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id} className="border-t border-neutral-100 align-top">
                <Td>
                  <StatusBadge status={j.status} />
                </Td>
                <Td>
                  <span className="break-all text-xs text-neutral-700">
                    {j.source.url}
                  </span>
                </Td>
                <Td>{j.processedUrls}</Td>
                <Td>{j.newDocs}</Td>
                <Td>{j.errors}</Td>
                <Td className="text-xs">
                  {j.startedAt ? j.startedAt.toISOString().slice(0, 16) : "—"}
                </Td>
                <Td className="text-xs">
                  {j.completedAt
                    ? j.completedAt.toISOString().slice(0, 16)
                    : "—"}
                </Td>
              </tr>
            ))}
            {jobs.length === 0 ? (
              <tr>
                <Td>
                  <span className="text-neutral-500">No jobs yet.</span>
                </Td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: "bg-emerald-50 text-emerald-700",
    failed: "bg-red-50 text-red-700",
    running: "bg-amber-50 text-amber-700",
    pending: "bg-neutral-100 text-neutral-700",
  };
  const cls = map[status] ?? "bg-neutral-100 text-neutral-700";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${cls}`}>{status}</span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2 text-left font-medium">{children}</th>;
}
function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 ${className ?? ""}`}>{children}</td>;
}
