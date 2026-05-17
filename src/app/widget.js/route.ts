import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-static";

/**
 * GET /widget.js
 *
 * Floating-bubble embed snippet. Clients paste a single <script> tag
 * on their site:
 *
 *   <script src="https://mia.agenciarok.es/widget.js"
 *           data-slug="dra-sofia-vazquez"
 *           async></script>
 *
 * The script injects a chat-bubble button bottom-right. Clicking it
 * opens an iframe pointed at https://mia.agenciarok.es/<slug>. The
 * iframe is what the user actually chats in — this script is just
 * the launcher.
 */

const WIDGET = `(function () {
  var s = document.currentScript;
  if (!s) return;
  var slug = s.getAttribute("data-slug");
  if (!slug) {
    console.warn("[mia-widget] missing data-slug attribute");
    return;
  }
  var origin = new URL(s.src).origin;
  var chatUrl = origin + "/" + encodeURIComponent(slug);

  // ── Bubble button ────────────────────────────────────────────────
  var btn = document.createElement("button");
  btn.setAttribute("aria-label", "Abrir chat");
  btn.style.cssText = [
    "position:fixed",
    "right:20px",
    "bottom:20px",
    "z-index:2147483646",
    "width:56px",
    "height:56px",
    "border-radius:50%",
    "border:none",
    "background:#111",
    "color:#fff",
    "cursor:pointer",
    "box-shadow:0 6px 24px rgba(0,0,0,.25)",
    "font:600 14px/1 system-ui,sans-serif"
  ].join(";");
  btn.textContent = "Chat";

  // ── Panel + iframe (lazy: insert iframe only on first open) ──────
  var panel = document.createElement("div");
  panel.style.cssText = [
    "position:fixed",
    "right:20px",
    "bottom:86px",
    "z-index:2147483647",
    "width:380px",
    "height:560px",
    "max-width:calc(100vw - 40px)",
    "max-height:calc(100vh - 110px)",
    "border-radius:16px",
    "overflow:hidden",
    "box-shadow:0 12px 40px rgba(0,0,0,.25)",
    "background:#fff",
    "display:none"
  ].join(";");

  var iframe = null;
  function ensureIframe() {
    if (iframe) return;
    iframe = document.createElement("iframe");
    iframe.src = chatUrl;
    iframe.title = "Chat";
    iframe.style.cssText = "width:100%;height:100%;border:0;display:block";
    iframe.allow = "clipboard-write";
    panel.appendChild(iframe);
  }

  var open = false;
  function toggle() {
    open = !open;
    if (open) {
      ensureIframe();
      panel.style.display = "block";
    } else {
      panel.style.display = "none";
    }
  }
  btn.addEventListener("click", toggle);

  document.body.appendChild(panel);
  document.body.appendChild(btn);
})();`;

export async function GET() {
  return new NextResponse(WIDGET, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      // Aggressive cache — the script is tiny and rarely changes.
      // When you ship a new version, bump the URL or invalidate at CDN.
      "Cache-Control": "public, max-age=300, s-maxage=300",
      // Anyone can load it (it's a public embed).
      "Access-Control-Allow-Origin": "*",
    },
  });
}
