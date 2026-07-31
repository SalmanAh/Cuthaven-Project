// ═══════════════════════════════════════════════════════════════════════════
// Payment Gateway Types
// ═══════════════════════════════════════════════════════════════════════════

export type GatewayType = "stripe" | "paypal";
export type PayPalMode = "sandbox" | "live";

// ─── Database row ──────────────────────────────────────────────────────────

export interface PaymentGatewayRow {
  id: string;
  gateway_type: GatewayType;
  account_name: string;
  is_active: boolean;
  
  // Stripe fields
  stripe_secret_key: string | null;
  stripe_publishable_key: string | null;
  stripe_webhook_secret: string | null;
  
  // PayPal fields
  paypal_client_id: string | null;
  paypal_client_secret: string | null;
  paypal_mode: PayPalMode | null;
  
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

// ─── API Response (for admin dashboard) ────────────────────────────────────

export interface PaymentGatewayResponse {
  id: string;
  gatewayType: GatewayType;
  accountName: string;
  isActive: boolean;
  
  // Masked keys for security (only show last 4 chars)
  stripeSecretKey?: string; // "sk_live_***...1234"
  stripePublishableKey?: string;
  stripeWebhookSecret?: string;
  
  paypalClientId?: string;
  paypalClientSecret?: string; // Masked
  paypalMode?: PayPalMode;
  
  createdAt: string;
  updatedAt: string;
}

// ─── Create/Update request body ────────────────────────────────────────────

export interface CreateStripeGatewayRequest {
  gatewayType: "stripe";
  accountName: string;
  stripeSecretKey: string;
  stripePublishableKey: string;
  stripeWebhookSecret: string;
  isActive?: boolean;
}

export interface CreatePayPalGatewayRequest {
  gatewayType: "paypal";
  accountName: string;
  paypalClientId: string;
  paypalClientSecret: string;
  paypalMode: PayPalMode;
  isActive?: boolean;
}

export type CreatePaymentGatewayRequest = 
  | CreateStripeGatewayRequest 
  | CreatePayPalGatewayRequest;

// ─── Active Gateway Configuration (used by checkout) ───────────────────────

export interface ActiveStripeConfig {
  type: "stripe";
  secretKey: string;
  publishableKey: string;
  webhookSecret: string;
}

export interface ActivePayPalConfig {
  type: "paypal";
  clientId: string;
  clientSecret: string;
  mode: PayPalMode;
}

export type ActiveGatewayConfig = ActiveStripeConfig | ActivePayPalConfig;
