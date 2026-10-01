import assert from "node:assert/strict";
import test from "node:test";
import {
  canAccessOrder,
  hashConfirmationToken,
  tokenMatches,
  toConfirmationOrder,
} from "../dist/services/orderConfirmation.service.js";

test("account order access is derived from verified ownership", async () => {
  const input = {
    authId: "auth-a",
    customerId: "customer-a",
    confirmationTokenHash: null,
  };
  assert.equal(await canAccessOrder(input, async (authId, customerId) =>
    authId === "auth-a" && customerId === "customer-a"), true);
  assert.equal(await canAccessOrder(
    { ...input, authId: "auth-b" },
    async (authId, customerId) => authId === "auth-a" && customerId === "customer-a",
  ), false);
});

test("guest confirmation requires the exact opaque token", () => {
  const token = "guest-confirmation-token-with-sufficient-entropy";
  const hash = hashConfirmationToken(token);
  assert.equal(tokenMatches(token, hash), true);
  assert.equal(tokenMatches(undefined, hash), false);
  assert.equal(tokenMatches("wrong-token", hash), false);
});

test("guest order UUID without its token grants no access", async () => {
  assert.equal(await canAccessOrder({
    customerId: null,
    confirmationTokenHash: hashConfirmationToken("secret-token"),
  }, async () => false), false);
});

test("confirmation response explicitly omits ownership, token, and address fields", () => {
  const result = toConfirmationOrder({
    id: "order-id",
    order_number: "CUT-1",
    status: "confirmed",
    payment_status: "paid",
    subtotal: 10,
    shipping_cost: 2,
    tax_amount: 1,
    total: 13,
    customer_id: "customer-id",
    confirmation_token_hash: "secret-hash",
    shipping_address: { email: "private@example.com" },
    customer_notes: "private",
  });

  assert.deepEqual(Object.keys(result), [
    "id",
    "order_number",
    "status",
    "payment_status",
    "subtotal",
    "shipping_cost",
    "tax_amount",
    "total",
  ]);
});
