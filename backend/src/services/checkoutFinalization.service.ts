import { supabaseAdmin } from "../config/supabase.js";
import { sendOrderConfirmationEmail, type EmailOrderItem } from "../emails/orderConfirmation.js";

export type FinalizationOutcome =
  | "finalized"
  | "already_finalized"
  | "order_not_found"
  | "payment_mismatch"
  | "invalid_transition";

export type ReleaseOutcome =
  | "released"
  | "already_released"
  | "order_not_found"
  | "payment_mismatch"
  | "invalid_transition";

interface RpcOutcome<T extends string> {
  outcome: T;
  order_id: string;
}

interface CheckoutOutboxRow {
  id: string;
  event_key: string;
  event_type: string;
  aggregate_id: string;
  attempt_count: number;
}

export async function finalizePaidOrder(input: {
  orderId: string;
  provider: "stripe" | "paypal";
  transactionId: string;
  providerEventId: string;
}): Promise<FinalizationOutcome> {
  const { data, error } = await supabaseAdmin.rpc("finalize_paid_order", {
    p_order_id: input.orderId,
    p_provider: input.provider,
    p_transaction_id: input.transactionId,
    p_provider_event_id: input.providerEventId,
  });
  if (error) throw error;

  const result = (data as RpcOutcome<FinalizationOutcome>[] | null)?.[0];
  if (!result) throw new Error("finalize_paid_order returned no outcome");
  return result.outcome;
}

export async function releaseCheckoutReservation(
  orderId: string,
  reason: string,
  payment?: { provider: "stripe" | "paypal"; transactionId: string },
): Promise<ReleaseOutcome> {
  const { data, error } = await supabaseAdmin.rpc("release_checkout_reservation", {
    p_order_id: orderId,
    p_reason: reason,
    p_provider: payment?.provider ?? null,
    p_transaction_id: payment?.transactionId ?? null,
  });
  if (error) throw error;

  const result = (data as RpcOutcome<ReleaseOutcome>[] | null)?.[0];
  if (!result) throw new Error("release_checkout_reservation returned no outcome");
  return result.outcome;
}

export async function createAndFinalizePaidOrder(input: {
  order: Record<string, unknown>;
  items: Array<Record<string, unknown>>;
  provider: "stripe" | "paypal";
  transactionId: string;
  providerEventId: string;
}): Promise<{ outcome: "finalized" | "already_finalized"; orderId: string }> {
  const { data, error } = await supabaseAdmin.rpc("create_and_finalize_paid_order", {
    p_order: input.order,
    p_items: input.items,
    p_provider: input.provider,
    p_transaction_id: input.transactionId,
    p_provider_event_id: input.providerEventId,
  });
  if (error) throw error;

  const result = (data as RpcOutcome<"finalized" | "already_finalized">[] | null)?.[0];
  if (!result) throw new Error("create_and_finalize_paid_order returned no outcome");
  return { outcome: result.outcome, orderId: result.order_id };
}

function estimatedDelivery(): string {
  const addBusinessDays = (date: Date, days: number) => {
    const result = new Date(date);
    for (let added = 0; added < days;) {
      result.setDate(result.getDate() + 1);
      if (result.getDay() !== 0 && result.getDay() !== 6) added += 1;
    }
    return result;
  };
  const format = (date: Date) => date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  const now = new Date();
  return `${format(addBusinessDays(now, 5))} – ${format(addBusinessDays(now, 8))}`;
}

async function deliverOrderConfirmation(event: CheckoutOutboxRow): Promise<void> {
  if (event.event_type !== "order.confirmed") {
    throw new Error(`Unsupported checkout outbox event: ${event.event_type}`);
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, subtotal, shipping_cost, tax_amount, discount_amount, total, shipping_address, coupon_id")
    .eq("id", event.aggregate_id)
    .eq("payment_status", "paid")
    .maybeSingle();
  if (orderError) throw orderError;
  if (!order) throw new Error("Confirmed order not found for outbox event");

  const { data: items, error: itemsError } = await supabaseAdmin
    .from("order_items")
    .select("product_name, product_image, quantity, unit_price, total_price")
    .eq("order_id", order.id);
  if (itemsError) throw itemsError;

  let couponCode: string | undefined;
  if (order.coupon_id) {
    const { data: coupon, error: couponError } = await supabaseAdmin
      .from("coupons")
      .select("code")
      .eq("id", order.coupon_id)
      .maybeSingle();
    if (couponError) throw couponError;
    couponCode = (coupon as { code: string } | null)?.code;
  }

  const address = order.shipping_address as Record<string, string>;
  const emailItems: EmailOrderItem[] = (items ?? []).map((item) => ({
    productName: item.product_name,
    productImage: item.product_image,
    quantity: item.quantity,
    unitPrice: item.unit_price,
    totalPrice: item.total_price,
  }));

  await sendOrderConfirmationEmail({
    to: address.email,
    orderNumber: order.order_number,
    orderId: order.id,
    items: emailItems,
    subtotal: order.subtotal,
    shippingCost: order.shipping_cost,
    taxAmount: order.tax_amount,
    discountAmount: order.discount_amount,
    couponCode,
    total: order.total,
    shippingAddress: {
      firstName: address.firstName ?? "",
      lastName: address.lastName ?? "",
      address: address.address ?? "",
      city: address.city ?? "",
      state: address.state ?? "",
      zip: address.zip ?? "",
      country: address.country ?? "US",
    },
    estimatedDelivery: estimatedDelivery(),
  }, event.event_key);
}

let dispatchInProgress = false;

export async function dispatchCheckoutOutbox(limit = 10): Promise<void> {
  if (dispatchInProgress) return;
  dispatchInProgress = true;

  try {
    const { data, error } = await supabaseAdmin.rpc("claim_checkout_outbox", { p_limit: limit });
    if (error) throw error;

    for (const event of (data ?? []) as CheckoutOutboxRow[]) {
      const startedAt = Date.now();
      try {
        await deliverOrderConfirmation(event);
        const { error: completeError } = await supabaseAdmin.rpc("complete_checkout_outbox", {
          p_id: event.id,
          p_success: true,
          p_error: null,
        });
        if (completeError) throw completeError;
        console.info("[OUTBOX]", {
          eventId: event.id,
          orderId: event.aggregate_id,
          result: "delivered",
          attempt: event.attempt_count,
          durationMs: Date.now() - startedAt,
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : "unknown_error";
        await supabaseAdmin.rpc("complete_checkout_outbox", {
          p_id: event.id,
          p_success: false,
          p_error: reason,
        });
        console.error("[OUTBOX]", {
          eventId: event.id,
          orderId: event.aggregate_id,
          result: "retry_scheduled",
          attempt: event.attempt_count,
          durationMs: Date.now() - startedAt,
        });
      }
    }
  } finally {
    dispatchInProgress = false;
  }
}

export function startCheckoutOutboxWorker(intervalMs = 15_000): () => void {
  void dispatchCheckoutOutbox().catch((error) =>
    console.error("[OUTBOX]", { result: "dispatch_failed", reason: error instanceof Error ? error.message : "unknown_error" }),
  );
  const timer = setInterval(() => {
    void dispatchCheckoutOutbox().catch((error) =>
      console.error("[OUTBOX]", { result: "dispatch_failed", reason: error instanceof Error ? error.message : "unknown_error" }),
    );
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
