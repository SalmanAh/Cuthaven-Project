// Tax calculation module
// Client operates in tax-free jurisdiction — no tax collection required

export interface TaxLineItem {
  id: string;
  quantity: number;
  unit_price: number; // dollars
}

export interface TaxResult {
  taxAmountCents: number; // rounded integer cents
  taxRate: number;        // e.g. 0.08 = 8%
  taxAmountDollars: number;
  jurisdiction: string;   // human-readable label for the email/receipt
  fallback: boolean;      // true if tax calculation was skipped
}

/**
 * Calculate sales tax for an order.
 * 
 * Currently returns $0 as the client operates in a tax-free jurisdiction.
 * No external tax service integration required.
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
  return {
    taxAmountCents: 0,
    taxRate: 0,
    taxAmountDollars: 0,
    jurisdiction: "Tax-free",
    fallback: false,
  };
}
