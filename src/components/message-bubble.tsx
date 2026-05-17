import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";
import { WhatsAppButton } from "./whatsapp-button";

type Props = {
  role: "user" | "assistant" | "system" | "data";
  content: string;
};

function isWhatsAppLink(href?: string): boolean {
  if (!href) return false;
  try {
    const url = new URL(href);
    return url.hostname === "wa.me" || url.hostname === "api.whatsapp.com";
  } catch {
    return false;
  }
}

/**
 * Custom <a> renderer for the markdown in assistant replies.
 *
 *  • wa.me / api.whatsapp.com links → branded WhatsAppButton wrapped in a
 *    block-level <span> so the button always lands on its OWN line, never
 *    inline at the end of the surrounding paragraph. `<span class="block">`
 *    keeps the markup HTML-valid inside <p> (span is inline-by-default,
 *    `display: block` is the CSS override).
 *  • All other links → inline link in the brand primary color, new tab.
 */
function LinkRenderer({
  href,
  children,
}: ComponentPropsWithoutRef<"a">) {
  if (isWhatsAppLink(href)) {
    const label = typeof children === "string" ? children : "Abrir WhatsApp";
    return (
      <span className="mt-3 block">
        <WhatsAppButton href={href!} label={label} />
      </span>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium underline underline-offset-2 hover:opacity-80"
      style={{ color: "var(--brand-primary, #047857)" }}
    >
      {children}
    </a>
  );
}

/**
 * Intercom-style message bubble.
 *
 *   • Assistant: gray (#f5f5f5) bubble, dark text, soft pillow shape.
 *     Always the same color regardless of business branding — the brand
 *     comes through in chips, links, send button, NOT in bubbles.
 *   • User: filled in `--brand-text` (typically near-black) with white
 *     text — high contrast, clear visual hierarchy.
 *   • Both use rounded-2xl with a smaller-radius "tail" corner pointing
 *     to the speaker, matching the Intercom pattern.
 */
export function MessageBubble({ role, content }: Props) {
  const isUser = role === "user";

  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] px-4 py-2.5 text-xs leading-relaxed",
          isUser
            ? "rounded-2xl rounded-br-md text-white"
            : "rounded-2xl rounded-bl-md bg-[#f5f5f5]"
        )}
        style={
          isUser
            ? { background: "#000" }
            : { color: "var(--brand-text, #171717)" }
        }
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="prose-message">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: LinkRenderer,
                p: ({ children }) => (
                  <p className="mb-2 whitespace-pre-wrap last:mb-0">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">
                    {children}
                  </ol>
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold">{children}</strong>
                ),
                em: ({ children }) => <em className="italic">{children}</em>,
                code: ({ children }) => (
                  <code className="rounded bg-black/5 px-1 py-0.5 font-mono text-[0.85em]">
                    {children}
                  </code>
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
