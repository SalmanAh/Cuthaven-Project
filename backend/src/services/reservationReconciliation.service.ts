import { getStripeInstance } from "../config/stripe.js";
import { supabaseAdmin } from "../config/supabase.js";
import {
  dispatchCheckoutOutbox,
  finalizePaidOrder,
  releaseCheckoutReservation,
} from "./checkoutFinalization.service.js";

export interface ExpiredStripeReservation {
  id: string;
  payment_transaction_id: string;
}

export interface ReservationReconciliationDependencies {
  getPaymentStatus(paymentIntentId: string): Promise<string>;
  cancelPayment(paymentIntentId: string): Promise<void>;
  finalize(order: ExpiredStripeReservation): Promise<void>;
  release(order: ExpiredStripeReservation): Promise<void>;
}

export async function reconcileReservations(
  orders: ExpiredStripeReservation[],
  dependencies: ReservationReconciliationDependencies,
): Promise<void> {
  for (const order of orders) {
    const status = await dependencies.getPaymentStatus(order.payment_transaction_id);

    if (status === "succeeded") {
      await dependencies.finalize(order);
      continue;
    }

    if (status === "canceled") {
      await dependencies.release(order);
      continue;
    }

    // Never release inventory while the provider can still capture payment.
    await dependencies.cancelPayment(order.payment_transaction_id);
    await dependencies.release(order);
  }
}

let reconciliationInProgress = false;

export async function reconcileExpiredStripeReservations(limit = 50): Promise<void> {
  if (reconciliationInProgress) return;
  reconciliationInProgress = true;

  try {
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("id, payment_transaction_id")
      .eq("payment_processor", "stripe")
      .eq("payment_status", "pending")
      .eq("reservation_status", "reserved")
      .lt("reservation_expires_at", new Date().toISOString())
      .not("payment_transaction_id", "is", null)
      .order("reservation_expires_at", { ascending: true })
      .limit(limit);
    if (error) throw error;

    const orders = (data ?? []) as ExpiredStripeReservation[];
    if (!orders.length) return;

    const stripe = await getStripeInstance();
    await reconcileReservations(orders, {
      getPaymentStatus: async (paymentIntentId) => {
        const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
        return intent.status;
      },
      cancelPayment: async (paymentIntentId) => {
        await stripe.paymentIntents.cancel(paymentIntentId);
      },
      finalize: async (order) => {
        const outcome = await finalizePaidOrder({
          orderId: order.id,
          provider: "stripe",
          transactionId: order.payment_transaction_id,
          providerEventId: `reconcile:${order.payment_transaction_id}`,
        });
        if (!new Set(["finalized", "already_finalized"]).has(outcome)) {
          throw new Error(`Expired paid order finalization rejected: ${outcome}`);
        }
        void dispatchCheckoutOutbox();
      },
      release: async (order) => {
        const outcome = await releaseCheckoutReservation(order.id, "Checkout reservation expired", {
          provider: "stripe",
          transactionId: order.payment_transaction_id,
        });
        if (!new Set(["released", "already_released"]).has(outcome)) {
          throw new Error(`Expired reservation release rejected: ${outcome}`);
        }
      },
    });
  } finally {
    reconciliationInProgress = false;
  }
}

export function startReservationReconciliationWorker(intervalMs = 60_000): () => void {
  const run = () => {
    void reconcileExpiredStripeReservations().catch((error) =>
      console.error("[RESERVATION]", {
        result: "reconciliation_failed",
        reason: error instanceof Error ? error.message : "unknown_error",
      }),
    );
  };

  run();
  const timer = setInterval(run, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
