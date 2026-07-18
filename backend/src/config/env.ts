import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.string().default("4000"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  FRONTEND_ORIGIN: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  // Resend — transactional email. Get from https://resend.com/api-keys
  // Optional in development (emails are skipped with a console log when absent).
  RESEND_API_KEY: z.string().optional(),
  // The "from" address shown to customers. Must be a verified domain in Resend.
  // e.g. "CutHaven <orders@cuthaven.com>"
  FROM_EMAIL: z.string().default("CutHaven <orders@cuthaven.com>"),

  // Public-facing store URL — used to build product links in the GMC feed.
  // Dev:  http://localhost:8080
  // Prod: https://www.cuthaven.com
  STORE_URL: z.string().url().default("http://localhost:8080"),

  // TaxJar — US sales tax calculation. Get from https://app.taxjar.com/api_playground
  // Optional — if absent, tax defaults to $0 and a warning is logged in production.
  TAXJAR_API_KEY: z.string().optional(),

  // PayPal — required for PayPal checkout. Get from https://developer.paypal.com
  // Use sandbox credentials for development, live credentials for production.
  PAYPAL_CLIENT_ID:     z.string().optional(),
  PAYPAL_CLIENT_SECRET: z.string().optional(),
  PAYPAL_MODE: z.enum(["sandbox", "live"]).default("sandbox"),

  // Stripe — required for checkout. Get from https://dashboard.stripe.com/apikeys
  STRIPE_SECRET_KEY: z.string().min(1, "STRIPE_SECRET_KEY is required"),
  // Required in production — get from Stripe Dashboard > Webhooks after registering endpoint.
  // In development it's optional (Stripe CLI forwards events locally).
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid or missing environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error("Fix backend/.env before starting the server (see .env.example).");
}

export const env = parsed.data;

// In production, STRIPE_WEBHOOK_SECRET is mandatory.
// Without it, the webhook endpoint cannot verify Stripe's signature and will
// accept any arbitrary POST — a serious security hole.
if (env.NODE_ENV === "production" && !env.STRIPE_WEBHOOK_SECRET) {
  throw new Error(
    "STRIPE_WEBHOOK_SECRET is required in production. " +
    "Register your webhook at https://dashboard.stripe.com/webhooks and paste the secret here.",
  );
}

// In production, warn if email is not configured — orders will confirm but no email is sent.
if (env.NODE_ENV === "production" && !env.RESEND_API_KEY) {
  console.warn(
    "⚠️  RESEND_API_KEY is not set. Order confirmation emails will be skipped. " +
    "Get a key at https://resend.com and add it to your production .env.",
  );
}

// In production, warn if TaxJar is not configured — tax will be charged as $0.
// This is legally acceptable only in states where you have no nexus.
// You MUST resolve this before going live to avoid under-collecting sales tax.
if (env.NODE_ENV === "production" && !env.TAXJAR_API_KEY) {
  console.warn(
    "⚠️  TAXJAR_API_KEY is not set. Tax will be calculated as $0. " +
    "Get a key at https://app.taxjar.com and add it to your production .env.",
  );
}

// In production, warn if PayPal is not configured
if (env.NODE_ENV === "production" && (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET)) {
  console.warn("⚠️  PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET not set. PayPal checkout will be unavailable.");
}
