import assert from "node:assert/strict";
import test from "node:test";

const { createPendingStripeCheckout } = await import("../dist/services/stripeCheckout.service.js");

const orderInput = {
  orderNumber: "CUT-TEST",
  customerId: null,
  confirmationTokenHash: "token-hash",
  subtotal: 10,
  shippingCost: 9.99,
  taxAmount: 0,
  discountAmount: 0,
  total: 19.99,
  shippingAddress: { email: "guest@example.com" },
  customerNotes: null,
  couponId: null,
  customerEmail: "guest@example.com",
  items: [],
};

test("pending order exists before Stripe intent and only internal order ID is sent", async () => {
  const calls = [];
  const result = await createPendingStripeCheckout(orderInput, {
    createPendingOrder: async () => {
      calls.push("database:create-order-and-items");
      return { id: "internal-order-id" };
    },
    createPaymentIntent: async (input) => {
      calls.push(["stripe:create-intent", input]);
      return { id: "pi_test", clientSecret: "pi_test_secret" };
    },
    linkPaymentIntent: async (orderId, paymentIntentId) => {
      calls.push(["database:link-intent", orderId, paymentIntentId]);
    },
    cancelPaymentIntent: async () => assert.fail("must not cancel successful intent"),
    markOrderFailed: async () => assert.fail("must not fail successful order"),
  });

  assert.deepEqual(calls, [
    "database:create-order-and-items",
    ["stripe:create-intent", {
      orderId: "internal-order-id",
      orderNumber: "CUT-TEST",
      amountCents: 1999,
      customerEmail: "guest@example.com",
    }],
    ["database:link-intent", "internal-order-id", "pi_test"],
  ]);
  assert.equal(result.orderId, "internal-order-id");
});

test("database failure prevents Stripe intent creation", async () => {
  let stripeCalled = false;

  await assert.rejects(
    createPendingStripeCheckout(orderInput, {
      createPendingOrder: async () => { throw new Error("database unavailable"); },
      createPaymentIntent: async () => {
        stripeCalled = true;
        return { id: "pi_should_not_exist", clientSecret: "secret" };
      },
      linkPaymentIntent: async () => undefined,
      cancelPaymentIntent: async () => undefined,
      markOrderFailed: async () => undefined,
    }),
    /database unavailable/,
  );

  assert.equal(stripeCalled, false);
});

test("link failure cancels the unexposed intent and marks the draft failed", async () => {
  const calls = [];

  await assert.rejects(
    createPendingStripeCheckout(orderInput, {
      createPendingOrder: async () => ({ id: "internal-order-id" }),
      createPaymentIntent: async () => ({ id: "pi_unlinked", clientSecret: "secret" }),
      linkPaymentIntent: async () => { throw new Error("link failed"); },
      cancelPaymentIntent: async (id) => { calls.push(["stripe:cancel", id]); },
      markOrderFailed: async (id) => { calls.push(["database:fail-order", id]); },
    }),
    /link failed/,
  );

  assert.deepEqual(calls, [
    ["stripe:cancel", "pi_unlinked"],
    ["database:fail-order", "internal-order-id"],
  ]);
});
