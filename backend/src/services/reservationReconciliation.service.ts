import { getStripeInstance } from "../config/stripe.js";
import { getPayPalAccessToken, getPayPalBaseURL } from "../config/paypal.js";
import { supabaseAdmin } from "../config/supabase.js";
import { getGatewayConfig } from "../controllers/payment-gateways.controller.js";
import {
  dispatchCheckoutOutbox,
  finalizePaidOrder,
  releaseCheckoutReservation,
} from "./checkoutFinalization.service.js";
import { verifyPayPalCapture, type PayPalCaptureResponse } from "./paypalCheckout.service.js";

export interface ExpiredStripeReservation {
  id: string;
  payment_transaction_id: string;
  payment_gateway_id: string;
}

export interface ExpiredPayPalReservation {
  id: string;
  order_number: string;
  total: number;
  payment_provider_order_id: string;
  payment_gateway_id: string;
}

export interface ReservationReconciliationDependencies {
  getPaymentStatus(order: ExpiredStripeReservation): Promise<string>;
  cancelPayment(order: ExpiredStripeReservation): Promise<void>;
  finalize(order: ExpiredStripeReservation): Promise<void>;
  release(order: ExpiredStripeReservation): Promise<void>;
}

export async function reconcileReservations(
  orders: ExpiredStripeReservation[],
  dependencies: ReservationReconciliationDependencies,
): Promise<void> {
  for (const order of orders) {
    const status = await dependencies.getPaymentStatus(order);

    if (status === "succeeded") {
      await dependencies.finalize(order);
      continue;
    }

    if (status === "canceled") {
      await dependencies.release(order);
      continue;
    }

    // Never release inventory while the provider can still capture payment.
    await dependencies.cancelPayment(order);
    await dependencies.release(order);
  }
}

export async function reconcilePayPalReservations(
  orders: ExpiredPayPalReservation[],
  dependencies: {
    getProviderOrder(order: ExpiredPayPalReservation): Promise<PayPalCaptureResponse>;
    finalize(order: ExpiredPayPalReservation, capture: PayPalCaptureResponse): Promise<void>;
    release(order: ExpiredPayPalReservation): Promise<void>;
  },
): Promise<void> {
  for (const order of orders) {
    const providerOrder = await dependencies.getProviderOrder(order);
    if (providerOrder.status === "COMPLETED") {
      await dependencies.finalize(order, providerOrder);
    } else if (providerOrder.status === "VOIDED") {
      await dependencies.release(order);
    }
  }
}

let reconciliationInProgress = false;

export async function reconcileExpiredStripeReservations(limit = 50): Promise<void> {
  if (reconciliationInProgress) return;
  reconciliationInProgress = true;

  try {
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("id, payment_transaction_id, payment_gateway_id")
      .eq("payment_processor", "stripe")
      .eq("payment_status", "pending")
      .eq("reservation_status", "reserved")
      .lt("reservation_expires_at", new Date().toISOString())
      .not("payment_transaction_id", "is", null)
      .order("reservation_expires_at", { ascending: true })
      .not("payment_gateway_id", "is", null)
      .limit(limit);
    if (error) throw error;

    const orders = (data ?? []) as ExpiredStripeReservation[];
    if (!orders.length) return;

    const stripeClients = new Map<string, ReturnType<typeof getStripeInstance>>();
    const stripeFor = (gatewayId: string) => {
      let client = stripeClients.get(gatewayId);
      if (!client) {
        client = getStripeInstance(gatewayId);
        stripeClients.set(gatewayId, client);
      }
      return client;
    };

    await reconcileReservations(orders, {
      getPaymentStatus: async (order) => {
        const stripe = await stripeFor(order.payment_gateway_id);
        const intent = await stripe.paymentIntents.retrieve(order.payment_transaction_id);
        return intent.status;
      },
      cancelPayment: async (order) => {
        const stripe = await stripeFor(order.payment_gateway_id);
        await stripe.paymentIntents.cancel(order.payment_transaction_id);
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

export async function reconcileExpiredPayPalReservations(limit = 50): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, total, payment_provider_order_id, payment_gateway_id")
    .eq("payment_processor", "paypal")
    .eq("payment_status", "pending")
    .eq("reservation_status", "reserved")
    .lt("reservation_expires_at", new Date().toISOString())
    .not("payment_provider_order_id", "is", null)
    .not("payment_gateway_id", "is", null)
    .order("reservation_expires_at", { ascending: true })
    .limit(limit);
  if (error) throw error;

  const orders = (data ?? []) as ExpiredPayPalReservation[];
  if (!orders.length) return;

  const paypalClients = new Map<string, Promise<{ accessToken: string; mode: "sandbox" | "live" }>>();
  const clientFor = (gatewayId: string) => {
    let client = paypalClients.get(gatewayId);
    if (!client) {
      client = (async () => {
        const config = await getGatewayConfig("paypal", gatewayId);
        if (!config || config.type !== "paypal") {
          throw new Error(`PayPal gateway ${gatewayId} is unavailable for reconciliation`);
        }
        const accessToken = await getPayPalAccessToken(config.clientId, config.clientSecret, config.mode);
        if (!accessToken) throw new Error("Could not authenticate PayPal reconciliation");
        return { accessToken, mode: config.mode };
      })();
      paypalClients.set(gatewayId, client);
    }
    return client;
  };

  await reconcilePayPalReservations(orders, {
    getProviderOrder: async (order) => {
      const { accessToken, mode } = await clientFor(order.payment_gateway_id);
      const response = await fetch(
        `${getPayPalBaseURL(mode)}/v2/checkout/orders/${encodeURIComponent(order.payment_provider_order_id)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!response.ok) throw new Error(`PayPal reconciliation lookup failed: ${response.status}`);
      return response.json() as Promise<PayPalCaptureResponse>;
    },
    finalize: async (order, providerOrder) => {
      const verified = verifyPayPalCapture(providerOrder, {
        paypalOrderId: order.payment_provider_order_id,
        orderNumber: order.order_number,
        amountCents: Math.round(order.total * 100),
        currency: "USD",
      });
      const { data: rows, error: finalizationError } = await supabaseAdmin.rpc("finalize_paypal_capture", {
        p_order_id: order.id,
        p_paypal_order_id: order.payment_provider_order_id,
        p_capture_id: verified.captureId,
        p_currency: verified.currency,
        p_amount_cents: verified.amountCents,
        p_reference_id: order.order_number,
        p_provider_event_id: `paypal-reconcile:${verified.captureId}`,
      });
      if (finalizationError) throw finalizationError;
      const outcome = (rows as Array<{ outcome: string }> | null)?.[0]?.outcome;
      if (!new Set(["finalized", "already_finalized"]).has(outcome ?? "")) {
        throw new Error(`PayPal reconciliation finalization rejected: ${outcome ?? "missing_outcome"}`);
      }
      void dispatchCheckoutOutbox();
    },
    release: async (order) => {
      const outcome = await releaseCheckoutReservation(order.id, "PayPal checkout reservation expired", {
        provider: "paypal",
      });
      if (!new Set(["released", "already_released"]).has(outcome)) {
        throw new Error(`PayPal reservation release rejected: ${outcome}`);
      }
    },
  });
}

export function startReservationReconciliationWorker(intervalMs = 60_000): () => void {
  let workerInProgress = false;
  const run = () => {
    if (workerInProgress) return;
    workerInProgress = true;
    void Promise.all([
      reconcileExpiredStripeReservations(),
      reconcileExpiredPayPalReservations(),
    ])
      .catch((error) =>
        console.error("[RESERVATION]", {
          result: "reconciliation_failed",
          reason: error instanceof Error ? error.message : "unknown_error",
        }),
      )
      .finally(() => { workerInProgress = false; });
  };

  run();
  const timer = setInterval(run, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
