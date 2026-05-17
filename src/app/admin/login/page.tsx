import { loginAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Mia · admin login",
  robots: { index: false, follow: false },
};

/**
 * Plain HTML password form. No client JS — the action is a server
 * action that sets the cookie and redirects.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const hasError = sp?.error === "1";

  return (
    <main className="min-h-[100dvh] grid place-items-center bg-neutral-50 px-4">
      <form
        action={loginAction}
        className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
      >
        <h1 className="text-lg font-semibold text-neutral-900">Mia admin</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Sign in to manage clients.
        </p>

        <label
          htmlFor="password"
          className="mt-6 block text-xs font-medium uppercase tracking-wide text-neutral-600"
        >
          Password
        </label>
        <input
          type="password"
          id="password"
          name="password"
          autoComplete="current-password"
          autoFocus
          required
          className="mt-2 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500"
        />

        {hasError ? (
          <p className="mt-3 text-xs text-red-600">Wrong password.</p>
        ) : null}

        <button
          type="submit"
          className="mt-5 w-full rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}
