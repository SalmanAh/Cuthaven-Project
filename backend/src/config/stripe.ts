import Stripe from "stripe";
import { supabaseAdmin } from "./supabase.js";

// ═══════════════════════════════════════════════════════════════════════════
// Database-Only Stripe Instance — NO FALLBACKS
// ═══════════════════════════════════════════════════════════════════════════
// Payment gateway keys are ONLY stored in database (payment_gateways table).
// If database fails or no active gateway exists, the system will fail.
// This ensures consistency and prevents using outdated keys.
// ═══════════════════════════════════════════════════════════════════════════

let cachedStripeInstance: Stripe | null = null;
let cachedGatewayId: string | null = null;

/**
 * Returns a Stripe instance configured with the active gateway from the database.
 * THROWS ERROR if no active gateway exists - NO FALLBACKS.
 * Caches the instance to avoid repeated database queries.
 */
export async function getStripeInstance(): Promise<Stripe> {
  // Check if we have an active Stripe gateway in database
  const { data: gateway, error } = await supabaseAdmin
    .from("payment_gateways")
    .select("id, stripe_secret_key")
    .eq("gateway_type", "stripe")
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("[STRIPE] Database query failed:", error.message);
    throw new Error(
      `Failed to fetch Stripe gateway from database: ${error.message}. ` +
      `Check database connection and payment_gateways table.`
    );
  }

  if (!gateway) {
    throw new Error(
      "No active Stripe gateway found in database. " +
      "Add a gateway at /admin/payment-gateways with is_active = true"
    );
  }

  if (!gateway.stripe_secret_key) {
    throw new Error(
      `Active Stripe gateway (${gateway.id}) has no secret key. ` +
      `Update the gateway at /admin/payment-gateways`
    );
  }

  // If gateway found and cached instance matches, return cached
  if (cachedGatewayId === gateway.id && cachedStripeInstance) {
    return cachedStripeInstance;
  }

  // Create new instance from database
  console.log(`[STRIPE] Using gateway from database: ${gateway.id}`);
  cachedStripeInstance = new Stripe(gateway.stripe_secret_key, {
    apiVersion: "2025-02-24.acacia",
  });
  cachedGatewayId = gateway.id;
  
  return cachedStripeInstance;
}

/**
 * Returns the webhook secret for the active Stripe gateway.
 * THROWS ERROR if no active gateway exists - NO FALLBACKS.
 */
export async function getStripeWebhookSecret(): Promise<string> {
  const { data: gateway, error } = await supabaseAdmin
    .from("payment_gateways")
    .select("stripe_webhook_secret")
    .eq("gateway_type", "stripe")
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("[STRIPE] Database query failed:", error.message);
    throw new Error(
      `Failed to fetch Stripe webhook secret from database: ${error.message}`
    );
  }

  if (!gateway) {
    throw new Error(
      "No active Stripe gateway found in database. " +
      "Add a gateway at /admin/payment-gateways"
    );
  }

  if (!gateway.stripe_webhook_secret) {
    throw new Error(
      "Active Stripe gateway has no webhook secret. " +
      "Update the gateway at /admin/payment-gateways"
    );
  }

  return gateway.stripe_webhook_secret;
}
