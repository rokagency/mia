import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const b = await prisma.business.findUnique({
    where: { slug },
    select: { name: true },
  });
  if (!b) notFound();

  return (
    <div className="flex h-screen flex-col">
      <div className="flex items-center gap-3 border-b border-neutral-200 bg-white px-4 py-2 text-sm text-neutral-600">
        <span className="font-medium">{b.name}</span>
        <span className="text-neutral-400">— chat preview</span>
        <a
          href={`/admin/clients/${slug}`}
          className="ml-auto text-xs text-neutral-500 hover:underline"
        >
          ← Back to settings
        </a>
      </div>
      <div className="flex flex-1 items-center justify-center bg-neutral-100 p-6">
        <iframe
          src={`/${slug}`}
          title={`${b.name} chat preview`}
          className="h-full max-h-[700px] w-full max-w-[420px] rounded-2xl border border-neutral-300 shadow-xl"
        />
      </div>
    </div>
  );
}
