import { openai } from "@ai-sdk/openai";
import { streamText, tool, type CoreMessage } from "ai";
import { NextResponse } from "next/server";
import { findBusinessBySlug, getActiveBusiness } from "@/lib/active-business";
import { matchAllowedOrigin } from "@/lib/origin-check";
import {
  appendAssistantMessage,
  appendToolMessage,
  appendUserMessage,
  ensureConversation,
} from "@/lib/conversations";
import { createFixedTextStreamResponse } from "@/lib/data-stream";
import { leadFieldsSchema, saveLead } from "@/lib/leads";
import { systemPrompt } from "@/lib/prompt";
import { formatChunksForPrompt, searchChunks } from "@/lib/retrieval";
import { evaluateFastSafetyGuard } from "@/lib/safety-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

// Hard limits enforced regardless of caller. These are deliberately
// generous for normal use and tight enough to bound abuse cost.
const MAX_USER_MESSAGE_CHARS = 800;
const MAX_OUTPUT_TOKENS = 500;
const DEV = process.env.NODE_ENV !== "production";

/**
 * Single entry point for a conversation turn.
 *
 * Sprint 2 changes (RAG): Business + FAQs from DB, retrieval over
 * Chunks, conversation logging with businessId.
 * Sprint safety changes: a Fast Safety Guard runs first and short-
 * circuits known-bad inputs without touching retrieval or OpenAI.
 */
async function handleTurn(
  messages: CoreMessage[],
  ctx: { businessId: string; systemText: string; conversationId: string }
) {
  return streamText({
    model: openai(MODEL),
    system: ctx.systemText,
    messages,
    temperature: 0.6,
    maxTokens: MAX_OUTPUT_TOKENS,
    tools: {
      saveLead: tool({
        description:
          "Record a visitor's contact details so the office can follow up. " +
          "Call this ONLY after explicit visitor confirmation. At least one " +
          "of email or phone must be included. For businesses in WhatsApp " +
          "handoff mode, ONLY use this when the visitor explicitly does not " +
          "want to use WhatsApp.",
        parameters: leadFieldsSchema,
        execute: async (input) => {
          try {
            const lead = await saveLead(input, ctx.conversationId);
            await appendToolMessage({
              conversationId: ctx.conversationId,
              toolName: "saveLead",
              toolInput: input,
              toolOutput: { ok: true, leadId: lead.id },
            }).catch((err) => console.error("Log tool msg failed:", err));
            return {
              ok: true,
              leadId: lead.id,
              message:
                "Saved. The office will follow up at the contact provided.",
            };
          } catch (err) {
            const message =
              err instanceof Error ? err.message : "Unknown error";
            await appendToolMessage({
              conversationId: ctx.conversationId,
              toolName: "saveLead",
              toolInput: input,
              toolOutput: { ok: false, error: message },
            }).catch((logErr) =>
              console.error("Log tool error msg failed:", logErr)
            );
            return { ok: false, error: message };
          }
        },
      }),
    },
    maxSteps: 3,
    onFinish: async ({ text, usage }) => {
      if (!text) return;
      await appendAssistantMessage({
        conversationId: ctx.conversationId,
        content: text,
        model: MODEL,
        promptTokens: usage?.promptTokens,
        completionTokens: usage?.completionTokens,
      }).catch((err) => console.error("Log assistant msg failed:", err));
    },
  });
}

type ChatRequestBody = {
  id?: string;
  messages: CoreMessage[];
  slug?: string;
};

export async function POST(req: Request) {
  const body = (await req.json()) as ChatRequestBody;
  const { messages, slug } = body;

  // Resolve the business. Old single-tenant callers (no slug) fall back to
  // ACTIVE_BUSINESS_SLUG inside getActiveBusiness(); new embedded clients
  // send a slug and we look it up explicitly.
  const active = slug
    ? await findBusinessBySlug(slug)
    : await getActiveBusiness();

  if (!active) {
    return NextResponse.json(
      { error: `Unknown business slug "${slug}"` },
      { status: 404 }
    );
  }

  // Origin check: cross-origin POSTs from a browser always carry an
  // Origin header. Same-origin browsers may omit it on POST; fall back
  // to Referer in that case. We compare against the business's
  // allowedOrigins list. A miss returns 403 — that's the gate that
  // protects the chat from being called from an unauthorized site.
  const origin = req.headers.get("origin") ?? req.headers.get("referer");
  const matchedOrigin = matchAllowedOrigin(origin, active.allowedOrigins);
  if (!matchedOrigin) {
    return NextResponse.json(
      { error: "Origin not allowed for this business" },
      { status: 403 }
    );
  }

  const conversationId = body.id ?? crypto.randomUUID();
  const userAgent = req.headers.get("user-agent") ?? undefined;
  const locale = req.headers.get("accept-language")?.split(",")[0];

  await ensureConversation(conversationId, {
    businessId: active.id,
    userAgent,
    locale,
  });

  // Extract + clamp the visitor's latest message.
  const lastUserMessage = [...messages]
    .reverse()
    .find((m) => m.role === "user");
  let userText =
    lastUserMessage && typeof lastUserMessage.content === "string"
      ? lastUserMessage.content
      : "";
  if (userText.length > MAX_USER_MESSAGE_CHARS) {
    userText = userText.slice(0, MAX_USER_MESSAGE_CHARS);
  }

  // ── Fast Safety Guard ────────────────────────────────────────────
  // Sub-millisecond regex check. If blocked, log + stream a fixed
  // response without touching retrieval or OpenAI.
  const guard = evaluateFastSafetyGuard(userText, active.business);

  if (guard.blocked) {
    if (DEV) {
      console.log(
        `[guard] BLOCKED conversationId=${conversationId} reason=${guard.reason}`
      );
      console.log(`[guard] skipped retrieval: true`);
      console.log(`[guard] skipped LLM: true`);
      console.log(`[guard] user message: ${JSON.stringify(userText)}`);
    }

    // Log the visitor's message + the canned response. Marking the
    // assistant turn with model="fast-safety-guard" is the audit trail
    // showing no OpenAI tokens were spent on this turn.
    if (userText) {
      await appendUserMessage({
        conversationId,
        content: userText,
      }).catch((err) => console.error("Failed to log user message:", err));
    }
    await appendAssistantMessage({
      conversationId,
      content: guard.response,
      model: `fast-safety-guard:${guard.reason}`,
      promptTokens: 0,
      completionTokens: 0,
    }).catch((err) => console.error("Failed to log guard response:", err));

    return createFixedTextStreamResponse(guard.response);
  }

  // ── Normal flow: log user msg, retrieve, prompt, stream ──────────
  if (userText) {
    await appendUserMessage({
      conversationId,
      content: userText,
    }).catch((err) => console.error("Failed to log user message:", err));
  }

  const retrieved = userText
    ? await searchChunks(active.id, userText, {
        language: active.business.language,
        // limit defaults to 3 in retrieval.ts; explicit here for visibility.
        limit: 3,
      }).catch((err) => {
        console.error("Retrieval failed:", err);
        return [];
      })
    : [];
  const retrievedContext = formatChunksForPrompt(retrieved);

  const systemText = systemPrompt({
    business: active.business,
    faqs: active.faqs,
    retrievedContext,
  });

  const result = await handleTurn(messages, {
    businessId: active.id,
    systemText,
    conversationId,
  });

  const response = result.toDataStreamResponse();
  // Mirror the request's Origin in the CORS response so the browser
  // accepts the streamed reply. Allow credentials = false (we don't
  // need cookies). matchedOrigin is the normalized exact origin.
  response.headers.set("Access-Control-Allow-Origin", matchedOrigin);
  response.headers.set("Vary", "Origin");
  return response;
}

/**
 * Preflight for cross-origin POSTs. Browsers send OPTIONS before the
 * actual POST when there's a non-simple header (Content-Type:
 * application/json counts). We validate the slug + origin the same way
 * the POST handler does, and return permissive CORS headers if OK.
 */
export async function OPTIONS(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  const reqOrigin = req.headers.get("origin");

  // No slug in preflight (we send it in the body, not the URL). So we
  // can't validate the business here — we just check Origin against
  // ANY business's allowlist isn't practical. For simplicity, echo the
  // Origin back if present. The POST handler is the real gate.
  const response = new NextResponse(null, { status: 204 });
  if (reqOrigin) {
    response.headers.set("Access-Control-Allow-Origin", reqOrigin);
    response.headers.set("Vary", "Origin");
  }
  response.headers.set(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS"
  );
  response.headers.set(
    "Access-Control-Allow-Headers",
    "content-type"
  );
  response.headers.set("Access-Control-Max-Age", "86400");
  void slug; // unused in preflight, validated in POST
  return response;
}
