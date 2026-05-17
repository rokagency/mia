-- Embed-origin allowlist per business.
--
-- Each entry is an exact origin (scheme://host[:port]). The literal
-- string "http://localhost:*" matches any localhost port; everything
-- else is matched exactly. See src/lib/origin-check.ts.

ALTER TABLE "Business" ADD COLUMN "allowedOrigins" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
