import Stripe from "stripe";
import { supabaseAdmin } from "./supabase.js";
import { env } from "./env.js";

// ═══════════════════════════════════════════════════════════════════════════
// Dynamic Stripe Instance — Uses Active Gateway from Database
// ═══════════════════════════════════════════════════════════════════════════

let cachedStripeInstance: Stripe | null = null;
let cachedGatewayId: string | null = null;

/**
 * Returns a Stripe instance configured with the active gateway from the database.
 * Falls back to env var if no active gateway exists (backward compatibility).
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
    console.error("[STRIPE] Failed to fetch active gateway:", error.message);
    // Fall back to env var
    if (env.STRIPE_SECRET_KEY) {
      console.warn("[STRIPE] Using fallback env var STRIPE_SECRET_KEY");
      return new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2025-02-24.acacia" });
    }
    throw new Error("No active Stripe gateway found and no STRIPE_SECRET_KEY fallback");
  }

  // If gateway found and cached instance matches, return cached
  if (gateway && cachedGatewayId === gateway.id && cachedStripeInstance) {
    return cachedStripeInstance;
  }

  // If gateway found, create new instance
  if (gateway?.stripe_secret_key) {
    console.log(`[STRIPE] Using gateway from database: ${gateway.id}`);
    cachedStripeInstance = new Stripe(gateway.stripe_secret_key, {
      apiVersion: "2025-02-24.acacia",
    });
    cachedGatewayId = gateway.id;
    return cachedStripeInstance;
  }

  // No gateway in DB, fall back to env var
  if (env.STRIPE_SECRET_KEY) {
    console.warn("[STRIPE] No active gateway in database, using fallback env var");
    return new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2025-02-24.acacia" });
  }

  throw new Error(
    "No active Stripe gateway found in database and no STRIPE_SECRET_KEY env var. " +
    "Add a gateway at /admin/payment-gateways or set STRIPE_SECRET_KEY in .env"
  );
}

/**
 * Returns the webhook secret for the active Stripe gateway.
 * Falls back to env var if no active gateway exists.
 */
export async function getStripeWebhookSecret(): Promise<string> {
  const { data: gateway, error } = await supabaseAdmin
    .from("payment_gateways")
    .select("stripe_webhook_secret")
    .eq("gateway_type", "stripe")
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("[STRIPE] Failed to fetch webhook secret:", error.message);
    if (env.STRIPE_WEBHOOK_SECRET) {
      console.warn("[STRIPE] Using fallback env var STRIPE_WEBHOOK_SECRET");
      return env.STRIPE_WEBHOOK_SECRET;
    }
    throw new Error("No active Stripe gateway found and no STRIPE_WEBHOOK_SECRET fallback");
  }

  if (gateway?.stripe_webhook_secret) {
    return gateway.stripe_webhook_secret;
  }

  if (env.STRIPE_WEBHOOK_SECRET) {
    console.warn("[STRIPE] No active gateway in database, using fallback webhook secret");
    return env.STRIPE_WEBHOOK_SECRET;
  }

  throw new Error("No webhook secret found in database or env vars");
}

// ═══════════════════════════════════════════════════════════════════════════
// DEPRECATED: Static Stripe instance (for backward compatibility)
// ═══════════════════════════════════════════════════════════════════════════
// This export is kept for backward compatibility but should not be used.
// Use getStripeInstance() instead.

let deprecatedStripeInstance: Stripe | null = null;

if (env.STRIPE_SECRET_KEY) {
  deprecatedStripeInstance = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-02-24.acacia",
  });
}

/**
 * @deprecated Use getStripeInstance() instead for database-driven configuration
 */
export const stripe = deprecatedStripeInstance as Stripe;
