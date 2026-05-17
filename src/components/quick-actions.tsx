"use client";

import type { QuickAction } from "@/businesses/types";

type Props = {
  actions: readonly QuickAction[];
  disabled?: boolean;
  /** Sends the prefilled message through the chat exactly as if the user typed it. */
  onSendMessage: (message: string) => void;
};

/**
 * Intercom-style conversation starters: right-aligned, vertically
 * stacked, styled as "suggested user replies" so visually they read
 * as something the visitor is about to send.
 *
 * Each chip is a pill with the brand primary color as border + text
 * (white background). Hover fills with a soft tint. Max 5 actions,
 * mobile-friendly wrap on long labels.
 */
export function QuickActions({ actions, disabled, onSendMessage }: Props) {
  const visible = actions.slice(0, 5);
  if (visible.length === 0) return null;

  const baseClasses =
    "group inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-medium transition border hover:-translate-y-px hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none";

  // Border + text both pick up the brand primary via CSS vars, with
  // alpha-mixed border by default so chips don't shout louder than the
  // chat content itself. Hover bumps border to full primary.
  const brandStyle: React.CSSProperties = {
    color: "var(--brand-primary, #059669)",
    borderColor: "color-mix(in srgb, var(--brand-primary, #059669) 40%, transparent)",
  };

  return (
    <div
      className="flex flex-col items-end gap-2 pt-2"
      role="group"
      aria-label="Sugerencias"
    >
      {visible.map((action) => {
        if (action.type === "send_message") {
          return (
            <button
              key={action.id}
              type="button"
              disabled={disabled}
              onClick={() => onSendMessage(action.message)}
              className={baseClasses}
              style={brandStyle}
            >
              {action.label}
            </button>
          );
        }
        return (
          <a
            key={action.id}
            href={action.url}
            target="_blank"
            rel="noopener noreferrer"
            className={
              baseClasses + (disabled ? " pointer-events-none opacity-50" : "")
            }
            style={brandStyle}
          >
            {action.label}
            <svg
              viewBox="0 0 20 20"
              className="h-3.5 w-3.5 opacity-70 transition-opacity group-hover:opacity-100"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7 13L13 7M13 7H8M13 7V12"
              />
            </svg>
          </a>
        );
      })}
    </div>
  );
}
