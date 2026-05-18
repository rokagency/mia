"use client";

import { useRef, useState, useTransition, type DragEvent } from "react";

type Props = {
  slug: string;
  /** Current logoUrl value persisted in the DB. */
  initialUrl: string;
};

/**
 * Logo uploader for the per-client edit page.
 *
 * Two ways to set the logo:
 *   • Upload a file (drag-and-drop or click) → POST to
 *     /api/admin/upload-logo, which writes to the mia_uploads volume
 *     AND updates Business.config.logoUrl in the DB. We then mirror
 *     the new URL into our hidden input so the main save action
 *     doesn't overwrite it with an old value.
 *   • Paste an external URL (any HTTPS image hosted elsewhere). This
 *     does NOT touch the upload route — it's just a normal field that
 *     the main edit form saves like any other.
 *
 * The hidden <input name="logoUrl"> is what the parent <form> reads
 * on submit. We keep it in sync with both flows.
 */
export function LogoUploader({ slug, initialUrl }: Props) {
  const [url, setUrl] = useState(initialUrl);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    setError(null);
    const fd = new FormData();
    fd.set("slug", slug);
    fd.set("file", file);

    const res = await fetch("/api/admin/upload-logo", {
      method: "POST",
      body: fd,
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? `Upload failed (${res.status})`);
      return;
    }
    const data = (await res.json()) as { url: string };
    setUrl(data.url);
  }

  function onPick() {
    fileInputRef.current?.click();
  }

  function onChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    startTransition(() => {
      void uploadFile(f);
    });
    // Reset so the same file can be picked again later.
    e.target.value = "";
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    startTransition(() => {
      void uploadFile(f);
    });
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(true);
  }
  function onDragLeave() {
    setDragOver(false);
  }

  function onClear() {
    setUrl("");
    setError(null);
  }

  return (
    <div className="md:col-span-2 space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[120px_1fr]">
        {/* Preview */}
        <div className="flex h-[120px] w-[120px] items-center justify-center overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt="Logo preview"
              className="max-h-full max-w-full object-contain"
              onError={() => setError("Couldn't load that image URL.")}
            />
          ) : (
            <span className="text-xs text-neutral-400">no logo</span>
          )}
        </div>

        {/* Drop zone + URL field */}
        <div className="space-y-2">
          <div
            onClick={onPick}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            className={
              "cursor-pointer rounded-xl border-2 border-dashed px-4 py-5 text-center transition " +
              (dragOver
                ? "border-neutral-500 bg-neutral-50"
                : "border-neutral-300 hover:bg-neutral-50") +
              (isPending ? " opacity-60" : "")
            }
          >
            <p className="text-sm font-medium text-neutral-700">
              {isPending ? "Uploading…" : "Drag an image here or click to upload"}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              PNG, JPEG, WebP, or SVG · max 2 MB
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={onChosen}
            className="hidden"
          />

          <div className="text-xs text-neutral-500">
            …or paste a URL hosted elsewhere:
          </div>
          <input
            type="text"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError(null);
            }}
            placeholder="https://example.com/logo.png"
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500"
          />

          <div className="flex items-center justify-between">
            {error ? (
              <p className="text-xs text-red-600">{error}</p>
            ) : (
              <span />
            )}
            {url ? (
              <button
                type="button"
                onClick={onClear}
                className="text-xs text-neutral-500 hover:underline"
              >
                Remove logo
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* The hidden field the parent <form> reads on save. Updating
          `url` via either flow keeps this synced. */}
      <input type="hidden" name="logoUrl" value={url} />
    </div>
  );
}
