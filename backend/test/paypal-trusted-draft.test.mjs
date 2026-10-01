import assert from "node:assert/strict";
import test from "node:test";

const {
  capturePayPalRequestSchema,
  createPendingPayPalCheckout,
  verifyPayPalCapture,
} = await import("../dist/services/paypalCheckout.service.js");
const { reconcilePayPalReservations } = await import("../dist/services/reservationReconciliation.service.js");

const pendingOrder = {
  orderNumber: "CUT-PAYPAL-TEST",
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

const validCapture = {
  id: "PAYPAL-ORDER-1",
  status: "COMPLETED",
  purchase_units: [{
    reference_id: "CUT-PAYPAL-TEST",
    payments: {
      captures: [{
        id: "CAPTURE-1",
        status: "COMPLETED",
        amount: { currency_code: "USD", value: "19.99" },
      }],
    },
  }],
};

test("trusted database draft exists before a PayPal order is created", async () => {
  const calls = [];
  const result = await createPendingPayPalCheckout(pendingOrder, {
    createPendingOrder: async () => {
      calls.push("database:create-draft");
      return { id: "internal-order-id" };
    },
    createProviderOrder: async (input) => {
      calls.push(["paypal:create-order", input]);
      return { id: "PAYPAL-ORDER-1" };
    },
    linkProviderOrder: async (orderId, providerOrderId) => {
      calls.push(["database:link-order", orderId, providerOrderId]);
    },
    releasePendingOrder: async () => assert.fail("successful draft must not be released"),
  });

  assert.deepEqual(calls, [
    "database:create-draft",
    ["paypal:create-order", {
      orderId: "internal-order-id",
      orderNumber: "CUT-PAYPAL-TEST",
      amountCents: 1999,
      customerEmail: "guest@example.com",
    }],
    ["database:link-order", "internal-order-id", "PAYPAL-ORDER-1"],
  ]);
  assert.deepEqual(result, { orderId: "internal-order-id", providerOrderId: "PAYPAL-ORDER-1" });
});

test("provider creation failure releases the unexposed reservation", async () => {
  const calls = [];
  await assert.rejects(
    createPendingPayPalCheckout(pendingOrder, {
      createPendingOrder: async () => ({ id: "internal-order-id" }),
      createProviderOrder: async () => { throw new Error("PayPal unavailable"); },
      linkProviderOrder: async () => assert.fail("failed provider order must not be linked"),
      releasePendingOrder: async (orderId) => { calls.push(["database:release", orderId]); },
    }),
    /PayPal unavailable/,
  );
  assert.deepEqual(calls, [["database:release", "internal-order-id"]]);
});

test("database link failure releases the unexposed reservation", async () => {
  const calls = [];
  await assert.rejects(
    createPendingPayPalCheckout(pendingOrder, {
      createPendingOrder: async () => ({ id: "internal-order-id" }),
      createProviderOrder: async () => ({ id: "PAYPAL-UNEXPOSED" }),
      linkProviderOrder: async () => { throw new Error("database link failed"); },
      releasePendingOrder: async (orderId) => { calls.push(["database:release", orderId]); },
    }),
    /database link failed/,
  );
  assert.deepEqual(calls, [["database:release", "internal-order-id"]]);
});

test("capture contract rejects browser-owned checkout data", () => {
  const result = capturePayPalRequestSchema.safeParse({
    orderId: "00000000-0000-4000-8000-000000000001",
    paypalOrderId: "PAYPAL-ORDER-1",
    confirmationToken: "x".repeat(43),
    checkoutData: { totalCents: 1, items: [] },
  });
  assert.equal(result.success, false);
});

test("verified capture must match identity, reference, amount, currency, and status", () => {
  assert.deepEqual(
    verifyPayPalCapture(validCapture, {
      paypalOrderId: "PAYPAL-ORDER-1",
      orderNumber: "CUT-PAYPAL-TEST",
      amountCents: 1999,
      currency: "USD",
    }),
    { captureId: "CAPTURE-1", amountCents: 1999, currency: "USD" },
  );

  const mismatches = [
    { ...validCapture, id: "OTHER" },
    { ...validCapture, purchase_units: [{ ...validCapture.purchase_units[0], reference_id: "OTHER" }] },
    { ...validCapture, purchase_units: [{ ...validCapture.purchase_units[0], payments: { captures: [{ ...validCapture.purchase_units[0].payments.captures[0], amount: { currency_code: "USD", value: "1.99" } }] } }] },
    { ...validCapture, purchase_units: [{ ...validCapture.purchase_units[0], payments: { captures: [{ ...validCapture.purchase_units[0].payments.captures[0], amount: { currency_code: "EUR", value: "19.99" } }] } }] },
    { ...validCapture, status: "APPROVED" },
  ];
  for (const response of mismatches) {
    assert.throws(() => verifyPayPalCapture(response, {
      paypalOrderId: "PAYPAL-ORDER-1",
      orderNumber: "CUT-PAYPAL-TEST",
      amountCents: 1999,
      currency: "USD",
    }));
  }
});

test("PayPal reconciliation finalizes completed, releases voided, and retains approved orders", async () => {
  const completed = {
    id: "paid-order",
    order_number: "CUT-PAID",
    total: 10,
    payment_provider_order_id: "PAYPAL-PAID",
    payment_gateway_id: "gateway-1",
  };
  const approved = {
    id: "approved-order",
    order_number: "CUT-APPROVED",
    total: 10,
    payment_provider_order_id: "PAYPAL-APPROVED",
    payment_gateway_id: "gateway-1",
  };
  const voided = {
    id: "voided-order",
    order_number: "CUT-VOIDED",
    total: 10,
    payment_provider_order_id: "PAYPAL-VOIDED",
    payment_gateway_id: "gateway-1",
  };
  const calls = [];

  await reconcilePayPalReservations([completed, approved, voided], {
    getProviderOrder: async (order) => ({
      id: order.payment_provider_order_id,
      status: order.id === "paid-order" ? "COMPLETED" : order.id === "voided-order" ? "VOIDED" : "APPROVED",
    }),
    finalize: async (order) => { calls.push(["finalize", order.id]); },
    release: async (order) => { calls.push(["release", order.id]); },
  });

  assert.deepEqual(calls, [["finalize", "paid-order"], ["release", "voided-order"]]);
});
