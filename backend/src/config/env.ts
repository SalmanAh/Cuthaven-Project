import "dotenv/config";
import { z } from "zod";

// Fail fast and loud if required env vars are missing, instead of a confusing
// runtime error later when something tries to use an undefined value.
const envSchema = z.object({
  PORT: z.string().default("4000"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  FRONTEND_ORIGIN: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid or missing environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error("Fix backend/.env before starting the server (see .env.example).");
}

export const env = parsed.data;
