// ─── PayPal REST API Helper Functions ─────────────────────────────────────
// Updated to accept credentials as parameters instead of reading from env
// This allows using database-stored credentials from payment_gateways table

export function getPayPalBaseURL(mode: "sandbox" | "live"): string {
  return mode === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

export async function getPayPalAccessToken(
  clientId: string,
  clientSecret: string,
  mode: "sandbox" | "live"
): Promise<string | null> {
  if (!clientId || !clientSecret) return null;

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(`${getPayPalBaseURL(mode)}/v1/oauth2/token`, {
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
