/**
 * xmlBuilder.ts
 *
 * Builds a Google Merchant Center–compliant RSS 2.0 product feed.
 *
 * Spec reference:
 *   https://support.google.com/merchants/answer/7052112
 *
 * Required attributes per GMC spec (as of July 2026):
 *   id, title, description, link, image_link, availability, price,
 *   brand, condition, google_product_category
 *
 * Optional but strongly recommended (improves approval + ranking):
 *   additional_image_link, sale_price, gtin, mpn, identifier_exists,
 *   product_type, item_group_id, shipping, shipping_weight
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export interface FeedProduct {
  id: string;
  slug: string;
  name: string;
  description: string;
  short_description: string | null;

  price: number;
  compare_at_price: number | null;
  currency: string;

  sku: string | null;
  brand: string | null;
  gtin: string | null;
  mpn: string | null;
  identifier_exists: boolean;
  condition: "new" | "used" | "refurbished";
  google_product_category: string | null;

  availability: "in_stock" | "out_of_stock" | "preorder" | "backorder";
  availability_date: string | null;

  primary_image_url: string;
  image_urls: string[];

  category_name: string | null;       // joined from categories table
  item_group_id: string | null;

  weight_kg: number | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Escape special XML characters in text content. */
function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Wrap a value in a CDATA block — used for description/title so HTML
 * entities and special characters don't break the feed parser.
 */
function cdata(str: string): string {
  // Strip any CDATA end sequences that appear inside the string
  return `<![CDATA[${str.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

/** Format a price for GMC: "29.99 USD" */
function fmtPrice(amount: number, currency: string): string {
  return `${amount.toFixed(2)} ${currency.toUpperCase()}`;
}

/** Map our DB availability enum to GMC values. */
function gmcAvailability(a: FeedProduct["availability"]): string {
  switch (a) {
    case "in_stock":   return "in stock";
    case "out_of_stock": return "out of stock";
    case "preorder":   return "preorder";
    case "backorder":  return "backorder";
  }
}

// ─── Single item ───────────────────────────────────────────────────────────

function buildItem(p: FeedProduct, storeUrl: string): string {
  const productUrl = `${storeUrl}/product/${esc(p.slug)}`;
  const isOnSale =
    p.compare_at_price !== null && p.compare_at_price > p.price;

  // GMC spec: if identifier_exists=false, omit gtin/mpn entirely rather than
  // sending empty strings (which trigger "incorrect identifier" policy violations)
  const identifierBlock = p.identifier_exists
    ? [
        p.gtin  ? `      <g:gtin>${esc(p.gtin)}</g:gtin>` : "",
        p.mpn   ? `      <g:mpn>${esc(p.mpn)}</g:mpn>`   : "",
      ]
        .filter(Boolean)
        .join("\n")
    : `      <g:identifier_exists>no</g:identifier_exists>`;

  // Additional images (GMC allows up to 10 additional_image_link entries)
  const additionalImages = (p.image_urls ?? [])
    .slice(0, 9) // primary is already in image_link; max 10 total including primary
    .map((url) => `      <g:additional_image_link>${esc(url)}</g:additional_image_link>`)
    .join("\n");

  const salePriceLine = isOnSale
    ? `      <g:sale_price>${fmtPrice(p.price, p.currency)}</g:sale_price>`
    : "";

  const availabilityDateLine =
    (p.availability === "preorder" || p.availability === "backorder") && p.availability_date
      ? `      <g:availability_date>${esc(p.availability_date)}</g:availability_date>`
      : "";

  const itemGroupLine = p.item_group_id
    ? `      <g:item_group_id>${esc(p.item_group_id)}</g:item_group_id>`
    : "";

  // Shipping — free on orders ≥ $350 (flat $9.99 below).
  // GMC's shipping attribute doesn't know about order-level thresholds so we
  // set the flat rate here. The free shipping threshold is shown in product
  // description and on the store.
  const shippingBlock = `
      <g:shipping>
        <g:country>US</g:country>
        <g:service>Standard Shipping</g:service>
        <g:price>9.99 USD</g:price>
      </g:shipping>`;

  const weightLine = p.weight_kg
    ? `      <g:shipping_weight>${(p.weight_kg * 2.20462).toFixed(2)} lb</g:shipping_weight>`
    : "";

  // google_product_category is the GMC numeric/string taxonomy path
  const categoryLine = p.google_product_category
    ? `      <g:google_product_category>${esc(p.google_product_category)}</g:google_product_category>`
    : "";

  // product_type is our internal category name — helps GMC understand structure
  const productTypeLine = p.category_name
    ? `      <g:product_type>${esc(p.category_name)}</g:product_type>`
    : "";

  // Description: prefer short_description for feed (cleaner), fall back to
  // first 5000 chars of full description (GMC limit)
  const descText = (p.short_description ?? p.description).slice(0, 5000);

  return `    <item>
      <g:id>${esc(p.id)}</g:id>
      <g:title>${cdata(p.name)}</g:title>
      <g:description>${cdata(descText)}</g:description>
      <g:link>${productUrl}</g:link>
      <g:image_link>${esc(p.primary_image_url)}</g:image_link>
${additionalImages ? additionalImages + "\n" : ""}      <g:availability>${gmcAvailability(p.availability)}</g:availability>
${availabilityDateLine ? availabilityDateLine + "\n" : ""}      <g:price>${fmtPrice(isOnSale ? p.compare_at_price! : p.price, p.currency)}</g:price>
${salePriceLine ? salePriceLine + "\n" : ""}      <g:brand>${esc(p.brand ?? "CutHaven")}</g:brand>
      <g:condition>${esc(p.condition)}</g:condition>
${categoryLine ? categoryLine + "\n" : ""}${productTypeLine ? productTypeLine + "\n" : ""}${identifierBlock ? identifierBlock + "\n" : ""}${itemGroupLine ? itemGroupLine + "\n" : ""}${shippingBlock}
${weightLine ? weightLine + "\n" : ""}    </item>`;
}

// ─── Full feed ─────────────────────────────────────────────────────────────

export function buildGmcFeedXml(products: FeedProduct[], storeUrl: string): string {
  const now = new Date().toUTCString();
  const items = products.map((p) => buildItem(p, storeUrl)).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>CutHaven Product Feed</title>
    <link>${storeUrl}</link>
    <description>Garden, outdoor and power tools — US market</description>
    <lastBuildDate>${now}</lastBuildDate>
${items}
  </channel>
</rss>`;
}
