import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

/**
 * Single-operator admin auth. One shared password lives in the
 * ADMIN_PASSWORD env var. On successful login we issue a signed
 * session token stored in an HTTP-only cookie.
 *
 * The token format is `<expSeconds>.<hexHmac>` — a tiny JWT-like
 * payload. We don't ship a JWT lib because we only need to assert
 * "this cookie was issued by us and hasn't expired yet."
 */

const SESSION_COOKIE = "mia_admin";
const SESSION_DAYS = 7;

function secret(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      "ADMIN_SESSION_SECRET env var must be set (≥ 16 chars). Generate one with: openssl rand -hex 32"
    );
  }
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

/**
 * Constant-time string comparison so attackers can't time-leak the
 * password. Both must be UTF-8 of the same length OR we fall back to
 * a slower compare that still uses timingSafeEqual on padded buffers.
 */
function constantTimeEqual(a: string, b: string): boolean {
  // Pad to equal length so timingSafeEqual doesn't throw, but mismatch
  // the original lengths makes the result fail anyway.
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) {
    // Still call timingSafeEqual to keep timing similar; result discarded.
    const filler = Buffer.alloc(Math.max(aBuf.length, bBuf.length));
    timingSafeEqual(filler, filler);
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}

export function passwordMatches(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    throw new Error(
      "ADMIN_PASSWORD env var must be set in .env.production before admin login works."
    );
  }
  return constantTimeEqual(input, expected);
}

export function makeSessionToken(): string {
  const expSec = Math.floor(Date.now() / 1000) + SESSION_DAYS * 24 * 3600;
  const payload = String(expSec);
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot < 1) return false;
  const payload = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = sign(payload);
  if (!constantTimeEqual(mac, expected)) return false;
  const expSec = Number.parseInt(payload, 10);
  if (!Number.isFinite(expSec)) return false;
  return Date.now() / 1000 < expSec;
}

/** Read the session cookie from server context and verify it. */
export async function isAuthenticated(): Promise<boolean> {
  const c = await cookies();
  return verifySessionToken(c.get(SESSION_COOKIE)?.value);
}

export const ADMIN_COOKIE_NAME = SESSION_COOKIE;
export const ADMIN_COOKIE_MAX_AGE = SESSION_DAYS * 24 * 3600;
