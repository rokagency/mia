"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { onboardAiAction } from "./actions";

type State =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "done"; slug: string };

const initial: State = { status: "idle" };

export default function NewClientPage() {
  const router = useRouter();
  const [state, dispatch, isPending] = useActionState<State, FormData>(
    onboardAiAction,
    initial
  );
  const urlRef = useRef<HTMLInputElement>(null);

  // Auto-fill slug from URL as the user types
  function onUrlChange(e: React.ChangeEvent<HTMLInputElement>) {
    const slugInput = document.getElementById("slug") as HTMLInputElement;
    if (!slugInput || slugInput.dataset.edited === "true") return;
    try {
      const host = new URL(e.target.value).hostname.replace(/^www\./, "");
      slugInput.value = host.replace(/\./g, "-").replace(/[^a-z0-9-]/g, "");
    } catch {
      // invalid URL while typing — ignore
    }
  }

  // Redirect to the new client page once done
  useEffect(() => {
    if (state.status === "done") {
      router.push(`/admin/clients/${state.slug}`);
    }
  }, [state, router]);

  return (
    <div className="mx-auto max-w-xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">New client</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Paste the website URL and Mia will crawl it, extract the business
          info with AI, and set everything up automatically.
        </p>
      </header>

      <form action={dispatch} className="space-y-5">
        <Field label="Website URL" hint="The client's main public website.">
          <input
            ref={urlRef}
            name="websiteUrl"
            type="url"
            required
            placeholder="https://example.com"
            onChange={onUrlChange}
            className={inputCls}
          />
        </Field>

        <Field
          label="Slug"
          hint="URL-safe identifier — letters, numbers and hyphens only. Used as mia.agenciarok.es/<slug>."
        >
          <input
            id="slug"
            name="slug"
            required
            placeholder="example-com"
            pattern="[a-z0-9-]+"
            onInput={() => {
              const el = document.getElementById("slug") as HTMLInputElement;
              if (el) el.dataset.edited = "true";
            }}
            className={inputCls}
          />
        </Field>

        <Field label="Language">
          <select name="language" defaultValue="es" className={inputCls}>
            <option value="es">Español</option>
            <option value="en">English</option>
            <option value="de">Deutsch</option>
          </select>
        </Field>

        <Field
          label="Booking mode"
        >
          <select name="bookingMode" defaultValue="whatsapp_handoff" className={inputCls}>
            <option value="whatsapp_handoff">WhatsApp handoff</option>
            <option value="data_collection">Data collection</option>
            <option value="cta_url">CTA URL (contact/booking page)</option>
          </select>
        </Field>

        <Field
          label="WhatsApp number (optional)"
          hint="International digits only, no + or spaces. e.g. 5491134567890"
        >
          <input
            name="whatsapp"
            placeholder="5491134567890"
            className={inputCls}
          />
        </Field>

        <Field
          label="Max pages to crawl"
          hint="How many pages to crawl from the website. More pages = better knowledge but slower onboarding (5–200)."
        >
          <input
            name="maxPages"
            type="number"
            min={5}
            max={200}
            defaultValue={50}
            className={inputCls}
          />
        </Field>

        {state.status === "error" && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {state.message}
          </p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="flex items-center gap-2 rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
          >
            {isPending && <Spinner />}
            {isPending ? "Analysing website…" : "Create & analyse"}
          </button>
          <a
            href="/admin"
            className="text-sm text-neutral-500 hover:underline"
          >
            Cancel
          </a>
        </div>

        {isPending && (
          <p className="text-xs text-neutral-500">
            Crawling the website and extracting business info with AI.
            This can take 30–90 seconds depending on the number of pages…
          </p>
        )}
      </form>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium uppercase tracking-wide text-neutral-600">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
    </label>
  );
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v8H4z"
      />
    </svg>
  );
}
