import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { toPaymentGatewayResponse } from "../dist/services/paymentGateway.service.js";

test("gateway admin responses contain masked credentials only", () => {
  const secret = "sk_live_full_secret_value";
  const response = toPaymentGatewayResponse({
    id: "gateway-id",
    gateway_type: "stripe",
    account_name: "Primary",
    is_active: true,
    stripe_secret_key: secret,
    stripe_publishable_key: "pk_live_publishable_value",
    stripe_webhook_secret: "whsec_full_secret_value",
    paypal_client_id: null,
    paypal_client_secret: null,
    paypal_mode: null,
    created_at: "2026-09-29T00:00:00Z",
    updated_at: "2026-09-29T00:00:00Z",
    created_by: null,
  });
  assert.notEqual(response.stripeSecretKey, secret);
  assert.match(response.stripeSecretKey, /\.\.\./);
});

test("Stripe configuration does not retain a credential cache", async () => {
  const source = await readFile(new URL("../src/config/stripe.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /cachedStripeInstance|cachedGatewayId/);
});

test("migration enforces and serializes one active gateway per provider", async () => {
  const source = await readFile(
    new URL("../../supabase/migrations/202609290004_ch007_gateway_invariants.sql", import.meta.url),
    "utf8",
  );
  assert.match(source, /create unique index[\s\S]*where is_active = true/i);
  assert.match(source, /pg_advisory_xact_lock/i);
  assert.match(source, /payment_gateway_audit/i);
});
