import { createClient } from "@supabase/supabase-js";
import { env } from "./env.js";

// Service-role client — full access, bypasses RLS. This file is imported
// ONLY on the backend (this repo folder), never shipped to the frontend.
// The frontend never talks to Supabase directly — it only talks to this API.
export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
