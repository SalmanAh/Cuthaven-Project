import { env } from "./env.js";

// ─── PayPal REST API credentials ───────────────────────────────────────────
// Returns null if credentials are not configured — the controller handles
// the graceful fallback (returns 503 so the frontend hides the PayPal button).

export function getPayPalBaseURL(): string {
  return env.PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

export async function getPayPalAccessToken(): Promise<string | null> {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) return null;

  const auth = Buffer.from(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${getPayPalBaseURL()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    console.error("[PAYPAL] Failed to get access token:", res.status, await res.text());
    return null;
  }

  const data = await res.json() as { access_token: string };
  return data.access_token;
}
