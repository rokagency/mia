"use client";

import { useRef, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";

type Props = {
  value: string;
  onChange: (
    e: ChangeEvent<HTMLInputElement> | ChangeEvent<HTMLTextAreaElement>
  ) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  disabled?: boolean;
  placeholder?: string;
};

/**
 * Intercom-style composer: pill-shaped input with a circular send button
 * inset on the right. Send button picks up the brand primary color via
 * CSS custom property; falls back to emerald when no branding is set.
 */
export function ChatInput({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder,
}: Props) {
  const formRef = useRef<HTMLFormElement>(null);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  const canSend = !disabled && value.trim().length > 0;

  return (
    <form ref={formRef} onSubmit={onSubmit} className="relative">
      <div className="flex items-end gap-2 rounded-2xl bg-white px-2 py-1.5 border border-neutral-200 focus-within:border-neutral-300 transition-colors">
        <textarea
          value={value}
          onChange={onChange}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder={placeholder ?? "Type a message…"}
          disabled={disabled}
          className="min-h-[36px] flex-1 resize-none border-0 bg-transparent px-2 py-1.5 text-xs placeholder:text-neutral-400 focus:outline-none disabled:opacity-50"
          style={{ color: "var(--brand-text, #171717)" }}
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label="Enviar"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white shadow-sm transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: "var(--brand-primary, #059669)" }}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="12" y1="19" x2="12" y2="5" />
            <polyline points="5 12 12 5 19 12" />
          </svg>
        </button>
      </div>
    </form>
  );
}
