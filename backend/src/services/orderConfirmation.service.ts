import { createHash, timingSafeEqual } from "node:crypto";

export function hashConfirmationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function tokenMatches(token: string | undefined, expectedHash: string | null): boolean {
  if (!token || !expectedHash) return false;
  const actual = Buffer.from(hashConfirmationToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function canAccessOrder(
  input: {
    authId?: string;
    customerId: string | null;
    confirmationToken?: string;
    confirmationTokenHash: string | null;
  },
  customerOwnsOrder: (authId: string, customerId: string) => Promise<boolean>,
): Promise<boolean> {
  if (input.customerId && input.authId) {
    return customerOwnsOrder(input.authId, input.customerId);
  }
  return !input.customerId && tokenMatches(input.confirmationToken, input.confirmationTokenHash);
}

export function toConfirmationOrder(order: {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  subtotal: number;
  shipping_cost: number;
  tax_amount: number;
  total: number;
}) {
  return {
    id: order.id,
    order_number: order.order_number,
    status: order.status,
    payment_status: order.payment_status,
    subtotal: order.subtotal,
    shipping_cost: order.shipping_cost,
    tax_amount: order.tax_amount,
    total: order.total,
  };
}
