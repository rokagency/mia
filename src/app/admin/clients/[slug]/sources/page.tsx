import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { createSourceAction, reindexAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function SourcesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const business = await prisma.business.findUnique({
    where: { slug },
    select: { id: true, name: true, websiteUrl: true },
  });
  if (!business) notFound();

  const sources = await prisma.knowledgeSource.findMany({
    where: { businessId: business.id },
    orderBy: { createdAt: "asc" },
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
        <h1 className="mt-1 text-2xl font-semibold">Knowledge sources</h1>
        <p className="mt-1 text-sm text-neutral-500">
          URLs the worker crawls and indexes for retrieval.
        </p>
      </header>

      <div className="space-y-3">
        {sources.map((s) => (
          <div
            key={s.id}
            className="flex items-start justify-between rounded-xl border border-neutral-200 bg-white p-4"
          >
            <div className="min-w-0">
              <p className="break-all text-sm font-medium">{s.url}</p>
              <p className="mt-1 text-xs text-neutral-500">
                {s.kind} · maxPages={s.maxPages} · maxDepth={s.maxDepth} ·{" "}
                {s.status}
              </p>
              {s.lastReindexedAt ? (
                <p className="mt-0.5 text-xs text-neutral-400">
                  last indexed {s.lastReindexedAt.toISOString().slice(0, 16)}Z
                </p>
              ) : null}
              {s.errorMessage ? (
                <p className="mt-1 text-xs text-red-600">{s.errorMessage}</p>
              ) : null}
            </div>
            <form
              action={async () => {
                "use server";
                await reindexAction(slug, s.id);
              }}
            >
              <button
                type="submit"
                className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800"
              >
                Reindex now
              </button>
            </form>
          </div>
        ))}
        {sources.length === 0 ? (
          <p className="text-sm text-neutral-500">No sources yet.</p>
        ) : null}
      </div>

      <section className="mt-8 rounded-xl border border-dashed border-neutral-300 bg-white p-5">
        <h2 className="text-base font-semibold">Add a new source</h2>
        <form
          action={async (fd) => {
            "use server";
            await createSourceAction(slug, fd);
          }}
          className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2"
        >
          <input
            name="url"
            placeholder={business.websiteUrl ?? "https://..."}
            required
            className={inputCls}
          />
          <select name="kind" defaultValue="sitemap" className={inputCls}>
            <option value="sitemap">sitemap</option>
            <option value="page">page</option>
            <option value="rss">rss</option>
            <option value="manual">manual</option>
          </select>
          <input
            type="number"
            name="maxPages"
            defaultValue={100}
            min={1}
            max={500}
            className={inputCls}
          />
          <input
            type="number"
            name="maxDepth"
            defaultValue={2}
            min={1}
            max={5}
            className={inputCls}
          />
          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
            >
              Add + queue
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500";
