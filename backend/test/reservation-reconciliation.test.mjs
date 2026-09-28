import assert from "node:assert/strict";
import test from "node:test";

const { reconcileReservations } = await import("../dist/services/reservationReconciliation.service.js");

const order = { id: "order-1", payment_transaction_id: "pi_1" };

function dependencies(status, calls) {
  return {
    getPaymentStatus: async () => status,
    cancelPayment: async () => { calls.push("cancel"); },
    finalize: async () => { calls.push("finalize"); },
    release: async () => { calls.push("release"); },
  };
}

test("expired reservation with successful payment finalizes and is never released", async () => {
  const calls = [];
  await reconcileReservations([order], dependencies("succeeded", calls));
  assert.deepEqual(calls, ["finalize"]);
});

test("expired reservation releases only after an unpaid intent is cancelled", async () => {
  const calls = [];
  await reconcileReservations([order], dependencies("requires_payment_method", calls));
  assert.deepEqual(calls, ["cancel", "release"]);
});

test("provider cancellation failure never releases reserved inventory", async () => {
  const calls = [];
  const deps = dependencies("processing", calls);
  deps.cancelPayment = async () => {
    calls.push("cancel_failed");
    throw new Error("provider refused cancellation");
  };

  await assert.rejects(reconcileReservations([order], deps), /provider refused cancellation/);
  assert.deepEqual(calls, ["cancel_failed"]);
});
