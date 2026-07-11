import { createClient } from "@supabase/supabase-js";
import { env } from "./env.js";

// ── Service-role client ────────────────────────────────────────────────────
// Used for ALL database operations (select, insert, update, delete).
// The service-role key bypasses RLS — this client must NEVER be used for
// auth.signInWithPassword() because that call mutates the internal session
// and subsequent DB queries would then run as that user, losing the bypass.
export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      // Explicitly set the Authorization header to the service-role key
      // so it is never overwritten by a user session
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  },
});

// ── Anon client ────────────────────────────────────────────────────────────
// Used ONLY for auth operations: signInWithPassword, resetPasswordForEmail etc.
// Never used for DB queries — it only has anon-level access.
// Keeping this separate ensures supabaseAdmin's service-role context is never
// polluted by a user session.
export const supabaseAuth = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
