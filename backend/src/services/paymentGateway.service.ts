import type { PaymentGatewayResponse, PaymentGatewayRow } from "../types/payment-gateway.js";

function maskKey(key: string | null): string | undefined {
  if (!key) return undefined;
  if (key.length <= 8) return "***";
  return `${key.slice(0, 8)}...${key.slice(-4)}`;
}

export function toPaymentGatewayResponse(row: PaymentGatewayRow): PaymentGatewayResponse {
  const base = {
    id: row.id,
    gatewayType: row.gateway_type,
    accountName: row.account_name,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  return row.gateway_type === "stripe"
    ? {
        ...base,
        stripeSecretKey: maskKey(row.stripe_secret_key),
        stripePublishableKey: maskKey(row.stripe_publishable_key),
        stripeWebhookSecret: maskKey(row.stripe_webhook_secret),
      }
    : {
        ...base,
        paypalClientId: maskKey(row.paypal_client_id),
        paypalClientSecret: maskKey(row.paypal_client_secret),
        paypalMode: row.paypal_mode ?? undefined,
      };
}
