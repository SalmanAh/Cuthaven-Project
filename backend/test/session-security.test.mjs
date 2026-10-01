import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("refresh tokens are cookie-only and access tokens are memory-only", () => {
  const controller = read("../src/controllers/auth.controller.ts");
  const authContext = read("../../frontend/src/context/AuthContext.tsx");
  const session = read("../../frontend/src/lib/auth-session.ts");

  assert.match(controller, /httpOnly:\s*true/);
  assert.match(controller, /sameSite:\s*"lax"/);
  assert.match(controller, /secure:\s*process\.env\.NODE_ENV === "production"/);
  assert.doesNotMatch(controller, /refreshToken:\s*data\.session\.refresh_token/);
  assert.doesNotMatch(authContext, /localStorage\.setItem\([^)]*(?:access|refresh)/i);
  assert.match(authContext, /credentials:\s*"include"/);
  assert.match(session, /let accessToken:\s*string \| null = null/);
});

test("credentialed CORS remains exact-origin and frontend has a restrictive CSP", () => {
  const app = read("../src/app.ts");
  const headers = read("../../frontend/public/_headers");

  assert.match(app, /allowedOrigins\.includes\(origin\)/);
  assert.match(app, /credentials:\s*true/);
  assert.match(headers, /content-security-policy-report-only:/i);
  assert.match(headers, /https:\/\/js\.stripe\.com/);
  assert.match(headers, /https:\/\/www\.paypal\.com/);
  assert.match(headers, /object-src 'none'/);
  assert.match(headers, /frame-ancestors 'none'/);
});
