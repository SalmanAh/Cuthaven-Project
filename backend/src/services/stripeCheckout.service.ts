export interface PendingStripeLineItem {
  productId: string;
  productName: string;
  productSlug: string;
  productImage: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface PendingStripeOrder {
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
  items: PendingStripeLineItem[];
}

export interface StripeIntentResult {
  id: string;
  clientSecret: string | null;
}

export interface StripeCheckoutDependencies {
  createPendingOrder(input: PendingStripeOrder): Promise<{ id: string }>;
  createPaymentIntent(input: {
    orderId: string;
    orderNumber: string;
    amountCents: number;
    customerEmail: string;
  }): Promise<StripeIntentResult>;
  linkPaymentIntent(orderId: string, paymentIntentId: string): Promise<void>;
  cancelPaymentIntent(paymentIntentId: string): Promise<void>;
  markOrderFailed(orderId: string): Promise<void>;
}

/**
 * Enforces the CH-002 ordering invariant: a complete pending database order
 * exists before a payable Stripe client secret can be returned.
 */
export async function createPendingStripeCheckout(
  input: PendingStripeOrder,
  dependencies: StripeCheckoutDependencies,
): Promise<{ orderId: string; paymentIntent: StripeIntentResult }> {
  const order = await dependencies.createPendingOrder(input);
  let paymentIntent: StripeIntentResult | null = null;

  try {
    paymentIntent = await dependencies.createPaymentIntent({
      orderId: order.id,
      orderNumber: input.orderNumber,
      amountCents: Math.round(input.total * 100),
      customerEmail: input.customerEmail,
    });

    if (!paymentIntent.clientSecret) {
      throw new Error("Stripe did not return a client secret");
    }

    await dependencies.linkPaymentIntent(order.id, paymentIntent.id);
    return { orderId: order.id, paymentIntent };
  } catch (error) {
    if (paymentIntent) {
      await dependencies.cancelPaymentIntent(paymentIntent.id).catch(() => undefined);
    }
    await dependencies.markOrderFailed(order.id).catch(() => undefined);
    throw error;
  }
}
