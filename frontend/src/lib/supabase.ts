import { createClient } from "@supabase/supabase-js";

// ─── Supabase Client for Realtime Only ────────────────────────────────────
// This client is ONLY used for Realtime WebSocket subscriptions.
// All database operations go through the backend API (queries-client.ts).

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase Realtime not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env"
  );
}

// Create Supabase client (anon key for Realtime subscriptions)
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    realtime: {
      params: {
        eventsPerSecond: 10, // Throttle events
      },
    },
  }
);

// Helper to check if Realtime is properly configured
export function isRealtimeConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}
