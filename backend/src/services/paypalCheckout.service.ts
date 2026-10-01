import { z } from "zod";

export interface PendingPayPalLineItem {
  productId: string;
  productName: string;
  productSlug: string;
  productImage: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface PendingPayPalOrder {
  orderNumber: string;
  customerId: string | null;
  confirmationTokenHash: string | null;
  subtotal: number;
  shippingCost: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  shippingAddress: Record<string, string>;
  customerNotes: string | null;
  couponId: string | null;
  customerEmail: string;
  items: PendingPayPalLineItem[];
}

export interface PayPalCheckoutDependencies {
  createPendingOrder(input: PendingPayPalOrder): Promise<{ id: string }>;
  createProviderOrder(input: {
    orderId: string;
    orderNumber: string;
    amountCents: number;
    customerEmail: string;
  }): Promise<{ id: string }>;
  linkProviderOrder(orderId: string, providerOrderId: string): Promise<void>;
  releasePendingOrder(orderId: string): Promise<void>;
}

/** Ensures no payable PayPal order is exposed before its trusted draft exists. */
export async function createPendingPayPalCheckout(
  input: PendingPayPalOrder,
  dependencies: PayPalCheckoutDependencies,
): Promise<{ orderId: string; providerOrderId: string }> {
  const order = await dependencies.createPendingOrder(input);

  try {
    const providerOrder = await dependencies.createProviderOrder({
      orderId: order.id,
      orderNumber: input.orderNumber,
      amountCents: Math.round(input.total * 100),
      customerEmail: input.customerEmail,
    });
    if (!providerOrder.id) throw new Error("PayPal did not return an order ID");

    await dependencies.linkProviderOrder(order.id, providerOrder.id);
    return { orderId: order.id, providerOrderId: providerOrder.id };
  } catch (error) {
    await dependencies.releasePendingOrder(order.id).catch(() => undefined);
    throw error;
  }
}

export const capturePayPalRequestSchema = z.object({
  orderId: z.string().uuid(),
  paypalOrderId: z.string().min(1).max(64),
  confirmationToken: z.string().min(32).max(256).nullable().optional(),
}).strict();

export interface PayPalCaptureResponse {
  id: string;
  status: string;
  purchase_units?: Array<{
    reference_id?: string;
    payments?: {
      captures?: Array<{
        id: string;
        status?: string;
        amount?: { currency_code?: string; value?: string };
      }>;
    };
  }>;
}

function decimalCurrencyToCents(value: string): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

export function verifyPayPalCapture(
  response: PayPalCaptureResponse,
  expected: {
    paypalOrderId: string;
    orderNumber: string;
    amountCents: number;
    currency: "USD";
  },
): { captureId: string; amountCents: number; currency: "USD" } {
  if (response.id !== expected.paypalOrderId || response.status !== "COMPLETED") {
    throw new Error("PayPal order identity or status mismatch");
  }

  const purchaseUnits = response.purchase_units ?? [];
  const captures = purchaseUnits[0]?.payments?.captures ?? [];
  if (purchaseUnits.length !== 1 || captures.length !== 1) {
    throw new Error("PayPal returned an unexpected capture structure");
  }

  const capture = captures[0];
  const currency = capture.amount?.currency_code;
  const amountCents = capture.amount?.value
    ? decimalCurrencyToCents(capture.amount.value)
    : null;

  if (purchaseUnits[0].reference_id !== expected.orderNumber) {
    throw new Error("PayPal order reference mismatch");
  }
  if (capture.status !== "COMPLETED" || currency !== expected.currency) {
    throw new Error("PayPal capture status or currency mismatch");
  }
  if (amountCents === null || amountCents !== expected.amountCents) {
    throw new Error("PayPal capture amount mismatch");
  }
  if (!capture.id) throw new Error("PayPal did not return a capture transaction ID");

  return { captureId: capture.id, amountCents, currency: expected.currency };
}
