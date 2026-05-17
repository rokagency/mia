"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { BusinessBranding, QuickAction } from "@/businesses/types";
import { ChatInput } from "./chat-input";
import { MessageBubble } from "./message-bubble";
import { QuickActions } from "./quick-actions";
import { TypingIndicator } from "./typing-indicator";

/**
 * Just the props the chat UI needs from the business — keeps this client
 * component decoupled from the full business shape and the DB layer.
 * Page.tsx (server) does the lookup and hands these in.
 */
type Props = {
  /** Business slug — sent with every /api/chat call so the backend
   *  resolves the right tenant. */
  slug: string;
  name: string;
  language: "es" | "en";
  greeting?: string;
  quickActions?: readonly QuickAction[];
  branding?: BusinessBranding;
  logoUrl?: string;
  /** Optional URL to the business's privacy policy. If set, an
   *  Intercom-style "By chatting with us, you agree to our Privacy
   *  Policy" notice is rendered in the footer linking to this URL. */
  privacyPolicyUrl?: string;
};

const PRIVACY_COPY = {
  es: {
    prefix: "Al chatear con nosotros, aceptás nuestra ",
    link: "Política de Privacidad",
  },
  en: {
    prefix: "By chatting with us, you agree to our ",
    link: "Privacy Policy",
  },
};

const DEFAULT_GREETINGS = {
  es: (name: string) =>
    `Hola, gracias por escribirnos a ${name}. Soy Mia, la asistente virtual. ¿En qué te puedo ayudar?`,
  en: (name: string) =>
    `Hi, thanks for reaching out to ${name} — I'm Mia, the virtual receptionist. How can I help you today?`,
};

const GREETING_EMOJI = " 👋";

/**
 * Append a friendly wave emoji to the greeting if it doesn't already end with
 * an emoji. Keeps the welcome message consistent with the Intercom-style look
 * regardless of whether the greeting comes from the DB or the default.
 */
function withGreetingEmoji(greeting: string): string {
  // Quick check: if the trimmed greeting already ends with any non-ASCII char
  // (likely an emoji the operator added), don't double up.
  const trimmed = greeting.trimEnd();
  const lastChar = trimmed.slice(-2); // 2 chars covers most emoji surrogates
  // eslint-disable-next-line no-control-regex
  if (/[^\x00-\x7F]/.test(lastChar)) return trimmed;
  return `${trimmed}${GREETING_EMOJI}`;
}

const STATUS_LINE = {
  es: "Asistente virtual · responde enseguida",
  en: "Virtual assistant · replies instantly",
};

const PLACEHOLDER = {
  es: "Escribí tu pregunta…",
  en: "Type your question…",
};

const CONV_STORAGE_KEY = "deskia.conversationId";
const CONV_TIMESTAMP_KEY = "deskia.conversationId.ts";
const CONV_TTL_MS = 24 * 60 * 60 * 1000;

// Fallback palette mirrors a generic emerald look so businesses without
// branding still get a coherent UI. Background is intentionally NOT in
// here — the chat surface is always white. The `background` field in
// BusinessBranding is reserved for future use (widget container, email).
const DEFAULT_PRIMARY = "#059669";
const DEFAULT_TEXT = "#171717";

function getOrCreateConversationId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(CONV_STORAGE_KEY);
    const tsRaw = window.localStorage.getItem(CONV_TIMESTAMP_KEY);
    const ts = tsRaw ? Number.parseInt(tsRaw, 10) : 0;
    const fresh = existing && ts && Date.now() - ts < CONV_TTL_MS;
    if (fresh) return existing!;
  } catch {
    /* localStorage blocked (private mode, etc.) */
  }
  const id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
  try {
    window.localStorage.setItem(CONV_STORAGE_KEY, id);
    window.localStorage.setItem(CONV_TIMESTAMP_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
  return id;
}

export function ChatWindow({
  slug,
  name,
  language,
  greeting,
  quickActions,
  branding,
  logoUrl,
  privacyPolicyUrl,
}: Props) {
  const baseGreeting = greeting ?? DEFAULT_GREETINGS[language](name);
  const finalGreeting = withGreetingEmoji(baseGreeting);
  const status = STATUS_LINE[language];
  const placeholder = PLACEHOLDER[language];
  const initial = name.trim().charAt(0).toUpperCase();

  const primary = branding?.primary ?? DEFAULT_PRIMARY;
  const text = branding?.text ?? DEFAULT_TEXT;

  // CSS custom properties consumed by every child (bubbles, chips, input,
  // links). Background is hardcoded white per design — branding.primary
  // and branding.text drive the visual identity.
  const themeStyle = {
    ["--brand-primary" as string]: primary,
    ["--brand-text" as string]: text,
  } as CSSProperties;

  // Gate the real UI until after mount.
  //
  // Why: aggressive browser extensions (Bitdefender, Honey, etc.) inject
  // attributes like `bis_skin_checked` into every <div> after the page
  // loads, causing React hydration mismatches. Render an empty white
  // shell on the server, swap in the chat after mount.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const conversationId = useMemo(() => getOrCreateConversationId(), []);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    append,
    status: chatStatus,
  } = useChat({
    api: "/api/chat",
    id: conversationId || undefined,
    body: { slug },
    initialMessages: [
      { id: "welcome", role: "assistant", content: finalGreeting },
    ],
  });

  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatStatus]);

  const isBusy = chatStatus === "submitted" || chatStatus === "streaming";

  // Show quick actions only before the visitor has sent their first
  // message. Hide them mid-conversation — they become visual noise.
  const hasUserMessage = messages.some((m) => m.role === "user");
  const showQuickActions =
    !!quickActions && quickActions.length > 0 && !hasUserMessage;

  const handleQuickSend = (message: string) => {
    if (isBusy) return;
    append({ role: "user", content: message });
  };

  if (!hydrated) {
    // suppressHydrationWarning silences the mismatch warning when browser
    // extensions (Bitdefender, Honey, ColorZilla) inject attributes like
    // `bis_skin_checked` into the shell BEFORE React hydrates. Safe here
    // because the shell has no children — `suppressHydrationWarning`
    // doesn't cascade, but there's nothing inside to cascade to.
    return (
      <div className="h-[100dvh] bg-white" suppressHydrationWarning />
    );
  }

  return (
    <div
      className="flex h-[100dvh] flex-col bg-white"
      style={themeStyle}
    >
      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="relative border-b border-neutral-200/70 bg-white px-5 py-3">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          {/* Logo, or branded initial fallback */}
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={`${name} logo`}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
              style={{ background: "var(--brand-primary)" }}
            >
              {initial}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-base font-semibold"
              style={{ color: "var(--brand-text)" }}
            >
              {name}
            </p>
            <p
              className="flex items-center gap-1.5 text-xs"
              style={{ color: "color-mix(in srgb, var(--brand-text) 60%, transparent)" }}
            >
              <span className="relative inline-flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              {status}
            </p>
          </div>
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto bg-white px-4 py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {messages.map((m) => (
            <MessageBubble key={m.id} role={m.role} content={m.content} />
          ))}
          {chatStatus === "submitted" && <TypingIndicator />}
          {showQuickActions && (
            <QuickActions
              actions={quickActions!}
              disabled={isBusy}
              onSendMessage={handleQuickSend}
            />
          )}
          <div ref={endRef} />
        </div>
      </main>

      {/* ── Composer ────────────────────────────────────────────── */}
      <footer className="bg-white px-4 py-3">
        <div className="mx-auto max-w-2xl">
          <ChatInput
            value={input}
            onChange={handleInputChange}
            onSubmit={handleSubmit}
            disabled={isBusy}
            placeholder={placeholder}
          />
          {privacyPolicyUrl ? (
            <p
              className="mt-2 text-center text-[10px]"
              style={{ color: "color-mix(in srgb, var(--brand-text) 50%, transparent)" }}
            >
              {PRIVACY_COPY[language].prefix}
              <a
                href={privacyPolicyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:opacity-80"
              >
                {PRIVACY_COPY[language].link}
              </a>
            </p>
          ) : (
            <p
              className="mt-2 text-center text-[10px] uppercase tracking-wide"
              style={{ color: "color-mix(in srgb, var(--brand-text) 40%, transparent)" }}
            >
              Powered by Deskia
            </p>
          )}
        </div>
      </footer>
    </div>
  );
}
