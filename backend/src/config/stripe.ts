import Stripe from "stripe";
import { supabaseAdmin } from "./supabase.js";

interface StripeGateway {
  gatewayId: string;
  stripe: Stripe;
  webhookSecret: string | null;
}

function stripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, { apiVersion: "2025-02-24.acacia" });
}

/** Uses the active gateway for new checkouts or an order-bound gateway by ID. */
export async function getStripeGateway(gatewayId?: string): Promise<StripeGateway> {
  let query = supabaseAdmin
    .from("payment_gateways")
    .select("id, stripe_secret_key, stripe_webhook_secret")
    .eq("gateway_type", "stripe");
  query = gatewayId ? query.eq("id", gatewayId) : query.eq("is_active", true);
  const { data: gateway, error } = await query.maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch Stripe gateway: ${error.message}`);
  }
  if (!gateway) {
    throw new Error(
      gatewayId ? `Stripe gateway ${gatewayId} was not found` : "No active Stripe gateway found",
    );
  }
  if (!gateway.stripe_secret_key) {
    throw new Error(`Stripe gateway ${gateway.id} has no secret key`);
  }

  return {
    gatewayId: gateway.id,
    stripe: stripeClient(gateway.stripe_secret_key),
    webhookSecret: gateway.stripe_webhook_secret,
  };
}

export async function getStripeInstance(gatewayId?: string): Promise<Stripe> {
  return (await getStripeGateway(gatewayId)).stripe;
}

/** Old accounts must continue verifying delayed events after gateway rotation. */
export async function getStripeWebhookConfigs(): Promise<StripeGateway[]> {
  const { data: gateways, error } = await supabaseAdmin
    .from("payment_gateways")
    .select("id, stripe_secret_key, stripe_webhook_secret")
    .eq("gateway_type", "stripe")
    .not("stripe_secret_key", "is", null)
    .not("stripe_webhook_secret", "is", null);

  if (error) {
    throw new Error(`Failed to fetch Stripe webhook configurations: ${error.message}`);
  }
  if (!gateways?.length) {
    throw new Error("No Stripe webhook configuration found");
  }

  return gateways.map((gateway) => ({
    gatewayId: gateway.id,
    stripe: stripeClient(gateway.stripe_secret_key!),
    webhookSecret: gateway.stripe_webhook_secret!,
  }));
}
