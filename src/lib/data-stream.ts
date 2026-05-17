/**
 * Emits a fixed text response in the AI SDK 4 data-stream protocol.
 *
 * Used by the chat route's fast safety guard to return a canned reply
 * without ever calling OpenAI. The output format matches what
 * `streamText().toDataStreamResponse()` produces, so the client-side
 * `useChat` hook consumes it transparently — same UI rendering, same
 * onFinish callbacks fire, no special casing in the React layer.
 *
 * Protocol (one line per chunk, `\n` terminated):
 *   f:{"messageId":"..."}                       — start of message
 *   0:"text fragment"                            — text delta (JSON-encoded string)
 *   e:{"finishReason":"stop","usage":{...}}     — stream "event" finish
 *   d:{"finishReason":"stop","usage":{...}}     — final done event
 *
 * We emit the whole text as a single delta — chunk granularity buys us
 * nothing for a sub-second canned response.
 */

export function createFixedTextStreamResponse(text: string): Response {
  const encoder = new TextEncoder();
  const messageId = `guard-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const usage = { promptTokens: 0, completionTokens: 0 };
  const finishPayload = { finishReason: "stop", usage, isContinued: false };
  const donePayload = { finishReason: "stop", usage };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`f:${JSON.stringify({ messageId })}\n`));
      controller.enqueue(encoder.encode(`0:${JSON.stringify(text)}\n`));
      controller.enqueue(encoder.encode(`e:${JSON.stringify(finishPayload)}\n`));
      controller.enqueue(encoder.encode(`d:${JSON.stringify(donePayload)}\n`));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Vercel-AI-Data-Stream": "v1",
    },
  });
}
