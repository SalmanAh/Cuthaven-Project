import { taxjar } from "../config/taxjar.js";
import { env } from "../config/env.js";

// CutHaven nexus address — Palmer, AK 99645
// Alaska has no state sales tax, but some cities/boroughs do.
// This is the origin address used for TaxJar's origin-based calculation.
const NEXUS_FROM = {
  from_country: "US",
  from_zip:     "99645",
  from_state:   "AK",
  from_city:    "Palmer",
  from_street:  "1633 S Industrial Way",
} as const;

export interface TaxLineItem {
  id: string;
  quantity: number;
  unit_price: number; // dollars
  product_tax_code?: string; // leave undefined = general merchandise
}

export interface TaxResult {
  taxAmountCents: number; // rounded integer cents
  taxRate: number;        // e.g. 0.08 = 8%
  taxAmountDollars: number;
  jurisdiction: string;   // human-readable label for the email/receipt
  fallback: boolean;      // true if TaxJar was skipped (no key or API error)
}

/**
 * Calls TaxJar SmartCalcs to calculate US sales tax for a given order.
 *
 * Graceful fallback:
 *  - If TAXJAR_API_KEY is not set → returns $0 (dev mode)
 *  - If TaxJar API throws (timeout, 5xx) → logs the error and returns $0
 *    so the checkout never fails because of a tax service outage
 *
 * TaxJar docs: https://developers.taxjar.com/api/reference/#taxes
 */
export async function calculateTax(
  toAddress: {
    zip: string;
    state: string;
    city: string;
    street: string;
    country?: string;
  },
  lineItems: TaxLineItem[],
  shippingAmountDollars: number,
): Promise<TaxResult> {
  // ── Fallback: no TaxJar key ─────────────────────────────────────────────
  if (!taxjar) {
    if (env.NODE_ENV === "production") {
      console.warn("[TAX] TAXJAR_API_KEY not set — charging $0 tax. Set key to enable tax collection.");
    }
    return {
      taxAmountCents: 0,
      taxRate: 0,
      taxAmountDollars: 0,
      jurisdiction: "No tax",
      fallback: true,
    };
  }

  try {
    const response = await taxjar.taxForOrder({
      ...NEXUS_FROM,
      to_country:  toAddress.country ?? "US",
      to_zip:      toAddress.zip,
      to_state:    toAddress.state,
      to_city:     toAddress.city,
      to_street:   toAddress.street,
      shipping:    shippingAmountDollars,
      line_items:  lineItems.map((item) => ({
        id:               item.id,
        quantity:         item.quantity,
        unit_price:       item.unit_price,
        product_tax_code: item.product_tax_code ?? "20010",
        // 20010 = General Clothing / Merchandise — safe default for tools
        // For power tools specifically use 3589 (Industrial Machinery & Equipment)
        // but general merchandise is fine and less likely to be over-exempt
      })),
    });

    const tax = response.tax;
    const taxAmountDollars = tax.amount_to_collect ?? 0;
    const taxAmountCents   = Math.round(taxAmountDollars * 100);
    const taxRate          = tax.rate ?? 0;

    // Build a readable jurisdiction label for the receipt
    const breakdown = tax.breakdown;
    const stateRate  = breakdown?.state_tax_rate  ?? 0;
    const countyRate = breakdown?.county_tax_rate  ?? 0;
    const cityRate   = breakdown?.city_tax_rate    ?? 0;
    let jurisdiction = toAddress.state;
    if (stateRate > 0 && countyRate > 0) jurisdiction = `${toAddress.city}, ${toAddress.state}`;

    return {
      taxAmountCents,
      taxRate,
      taxAmountDollars,
      jurisdiction,
      fallback: false,
    };
  } catch (err) {
    // TaxJar is down or returned an error — never block checkout
    console.error("[TAX] TaxJar API error — falling back to $0 tax:", err instanceof Error ? err.message : err);
    return {
      taxAmountCents: 0,
      taxRate: 0,
      taxAmountDollars: 0,
      jurisdiction: "Tax unavailable",
      fallback: true,
    };
  }
}
