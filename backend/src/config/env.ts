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

  // PayPal — DEPRECATED: Now managed via payment_gateways table
  // These are kept as optional fallback for backward compatibility
  PAYPAL_CLIENT_ID:     z.string().optional(),
  PAYPAL_CLIENT_SECRET: z.string().optional(),
  PAYPAL_MODE: z.enum(["sandbox", "live"]).default("sandbox"),

  // Stripe — DEPRECATED: Now managed via payment_gateways table
  // These are kept as optional fallback for backward compatibility
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid or missing environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error("Fix backend/.env before starting the server (see .env.example).");
}

export const env = parsed.data;

// In production, warn if email is not configured — orders will confirm but no email is sent.
if (env.NODE_ENV === "production" && !env.RESEND_API_KEY) {
  console.warn(
    "⚠️  RESEND_API_KEY is not set. Order confirmation emails will be skipped. " +
    "Get a key at https://resend.com and add it to your production .env.",
  );
}
