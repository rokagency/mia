import Link from "next/link";
import { headers } from "next/headers";
import { isAuthenticated } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Mia · admin",
  robots: { index: false, follow: false },
};

/**
 * Admin shell. Middleware already gates this tree, but we re-check
 * here so a misconfigured matcher can never leak the layout to an
 * unauthed visitor. On the /admin/login route we render bare.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const h = await headers();
  const path = h.get("x-invoke-path") ?? h.get("next-url") ?? "";
  // Cheap heuristic: the login page renders its own background; we don't
  // need the shell there. We can also recognize it by the absence of a
  // session.
  const authed = await isAuthenticated();
  if (!authed) {
    return <>{children}</>;
  }
  void path;

  return (
    <div className="flex min-h-[100dvh] bg-neutral-50 text-neutral-900">
      <aside className="w-56 shrink-0 border-r border-neutral-200 bg-white">
        <div className="px-5 py-4 border-b border-neutral-200">
          <p className="text-sm font-semibold">Mia admin</p>
          <p className="text-xs text-neutral-500 mt-0.5">
            {process.env.NEXT_PUBLIC_DEPLOY_TAG ?? "production"}
          </p>
        </div>

        <nav className="px-3 py-3 text-sm">
          <NavLink href="/admin">Clients</NavLink>
        </nav>

        <form action="/admin/logout" method="post" className="px-3 mt-4">
          <button
            type="submit"
            className="w-full rounded-md px-3 py-2 text-left text-sm text-neutral-600 hover:bg-neutral-100"
          >
            Sign out
          </button>
        </form>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="block rounded-md px-3 py-2 text-neutral-700 hover:bg-neutral-100"
    >
      {children}
    </Link>
  );
}
