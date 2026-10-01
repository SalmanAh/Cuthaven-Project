import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("retryable Stripe failures retain the checkout reservation", async () => {
  const controller = await source("../src/controllers/checkout.controller.ts");
  const handler = controller.match(/if \(event\.type === "payment_intent\.payment_failed"\)[\s\S]*?\n    }/);
  assert.ok(handler, "Stripe failure handler is missing");
  assert.match(handler[0], /retryable_failure_retained/);
  assert.doesNotMatch(handler[0], /releaseCheckoutReservation/);
});

test("checkout creation counts successful anonymous requests", async () => {
  const [limiter, routes] = await Promise.all([
    source("../src/middleware/rateLimiter.ts"),
    source("../src/routes/checkout.routes.ts"),
  ]);
  const generalLimiter = limiter.match(/export const apiLimiter[\s\S]*?\n}\);/);
  assert.ok(generalLimiter);
  assert.doesNotMatch(generalLimiter[0], /skipSuccessfulRequests:\s*true/);
  assert.match(routes, /payment-intent",\s*checkoutCreateLimiter/);
  assert.match(routes, /paypal\/create-order",\s*checkoutCreateLimiter/);
});

test("follow-up migration binds gateways and serializes coupon identity use", async () => {
  const migration = await source("../../supabase/migrations/202610010001_followup_checkout_integrity.sql");
  assert.match(migration, /payment_gateway_id uuid/);
  assert.match(migration, /foreign key \(payment_gateway_id\)/i);
  assert.match(migration, /having count\(\*\) = 1/);
  assert.match(migration, /for update/);
  assert.match(migration, /coupon_already_used/);
  assert.match(migration, /lower\(btrim\(existing\.shipping_address->>'email'\)\)/);
});

test("CI enforces backend lint and frontend typechecking", async () => {
  const workflow = await source("../../.github/workflows/ci.yml");
  assert.match(workflow, /npm audit --omit=dev --audit-level=high/);
  assert.match(workflow, /working-directory: backend[\s\S]*?npm run lint[\s\S]*?npm test/);
  assert.match(workflow, /working-directory: frontend[\s\S]*?npm run typecheck[\s\S]*?npm run lint/);
});
