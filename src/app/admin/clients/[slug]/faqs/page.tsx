import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  createFaqAction,
  deleteFaqAction,
  updateFaqAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function FaqsPage({
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

  const faqs = await prisma.fAQ.findMany({
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
        <h1 className="mt-1 text-2xl font-semibold">FAQs</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Approved answers Mia uses verbatim when they match a visitor's
          question.
        </p>
      </header>

      <div className="space-y-3">
        {faqs.map((f) => (
          <FaqRow key={f.id} slug={slug} f={f} />
        ))}
        {faqs.length === 0 ? (
          <p className="text-sm text-neutral-500">No FAQs yet.</p>
        ) : null}
      </div>

      <section className="mt-8 rounded-xl border border-dashed border-neutral-300 bg-white p-5">
        <h2 className="text-base font-semibold">Add a new FAQ</h2>
        <form
          action={async (fd) => {
            "use server";
            await createFaqAction(slug, fd);
          }}
          className="mt-3 space-y-3"
        >
          <input
            name="question"
            placeholder="Question"
            required
            className={inputCls}
          />
          <textarea
            name="answer"
            placeholder="Answer (markdown OK)"
            rows={4}
            required
            className={textareaCls}
          />
          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
            >
              Add FAQ
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function FaqRow({
  slug,
  f,
}: {
  slug: string;
  f: {
    id: string;
    question: string;
    answer: string;
    approved: boolean;
    source: string;
  };
}) {
  return (
    <details
      className="group rounded-xl border border-neutral-200 bg-white"
      open={false}
    >
      <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm">
        <span className="flex items-center gap-2">
          {f.approved ? (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
              approved
            </span>
          ) : (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
              hidden
            </span>
          )}
          <span className="font-medium">{f.question}</span>
        </span>
        <span className="text-xs text-neutral-400 group-open:hidden">
          {f.answer.slice(0, 60)}…
        </span>
      </summary>

      <div className="border-t border-neutral-100 p-4">
        <form
          action={async (fd) => {
            "use server";
            await updateFaqAction(slug, f.id, fd);
          }}
          className="space-y-3"
        >
          <input name="question" defaultValue={f.question} className={inputCls} />
          <textarea
            name="answer"
            defaultValue={f.answer}
            rows={6}
            className={textareaCls}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="approved"
              defaultChecked={f.approved}
            />
            Approved (visible to Mia)
          </label>
          <div className="flex items-center justify-between">
            <p className="text-xs text-neutral-400">
              source: {f.source} · id: <code>{f.id}</code>
            </p>
            <div className="flex gap-2">
              <button
                type="submit"
                className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800"
              >
                Save
              </button>
            </div>
          </div>
        </form>

        <form
          action={async () => {
            "use server";
            await deleteFaqAction(slug, f.id);
          }}
          className="mt-3 border-t border-neutral-100 pt-3"
        >
          <button
            type="submit"
            className="text-xs text-red-600 hover:underline"
          >
            Delete this FAQ
          </button>
        </form>
      </div>
    </details>
  );
}

const inputCls =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500";
const textareaCls =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 font-mono";
