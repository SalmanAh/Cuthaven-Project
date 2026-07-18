import type { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../config/supabase.js";
import { env } from "../config/env.js";
import { buildGmcFeedXml, type FeedProduct } from "../lib/xmlBuilder.js";

// Cache the last generated feed in memory so repeated GMC crawls don't
// hammer the DB. Feed is regenerated at most once every 30 minutes.
const CACHE_TTL_MS = 30 * 60 * 1000;
let cachedXml: string | null = null;
let cacheExpiresAt = 0;

// ─── GET /api/feed/products.xml ─────────────────────────────────────────────
// Returns a Google Merchant Center–compliant RSS 2.0 product feed.
// Public, no auth. Register this URL in GMC:
//   https://merchants.google.com → Products → Feeds → Add feed → Scheduled fetch
//   URL: https://www.cuthaven.com/api/feed/products.xml
export async function getProductFeed(req: Request, res: Response, next: NextFunction) {
  try {
    const now = Date.now();

    // Serve from cache if still fresh (skip DB + XML build on repeated crawls)
    if (cachedXml && now < cacheExpiresAt) {
      res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=1800"); // 30 min browser/CDN cache
      res.setHeader("X-Feed-Cache", "HIT");
      return res.send(cachedXml);
    }

    // ── 1. Fetch active products ─────────────────────────────────────────────
    const { data: products, error: prodError } = await supabaseAdmin
      .from("products")
      .select(`
        id, slug, name, description, short_description,
        price, compare_at_price, currency,
        sku, brand, gtin, mpn, identifier_exists, condition,
        google_product_category, availability, availability_date,
        primary_image_url, image_urls, item_group_id, weight_kg,
        category_id
      `)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (prodError) throw prodError;
    if (!products || products.length === 0) {
      res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
      return res.send(buildGmcFeedXml([], env.STORE_URL));
    }

    // ── 2. Fetch categories to resolve category names ────────────────────────
    const categoryIds = [...new Set(
      (products as Array<{ category_id: string | null }>)
        .map((p) => p.category_id)
        .filter(Boolean) as string[],
    )];

    const categoryMap: Record<string, string> = {};
    if (categoryIds.length > 0) {
      const { data: cats } = await supabaseAdmin
        .from("categories")
        .select("id, name")
        .in("id", categoryIds);

      (cats ?? []).forEach((c: { id: string; name: string }) => {
        categoryMap[c.id] = c.name;
      });
    }

    // ── 3. Map to FeedProduct shape ──────────────────────────────────────────
    const feedProducts: FeedProduct[] = (products as Array<{
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
      item_group_id: string | null;
      weight_kg: number | null;
      category_id: string | null;
    }>).map((p) => ({
      ...p,
      category_name: p.category_id ? (categoryMap[p.category_id] ?? null) : null,
    }));

    // ── 4. Build XML ─────────────────────────────────────────────────────────
    const xml = buildGmcFeedXml(feedProducts, env.STORE_URL);

    // ── 5. Write to feed_sync_log ────────────────────────────────────────────
    // Schema: product_id (NOT NULL FK), sync_status, google_item_id, error_code, error_message, synced_at
    // We log one summary row using a sentinel product_id — or skip if no products.
    // Best-effort — never fail the response if the log write fails.
    if (feedProducts.length > 0) {
      supabaseAdmin
        .from("feed_sync_log")
        .insert({
          product_id: feedProducts[0].id, // sentinel: first product in feed
          sync_status: "synced",
          google_item_id: null,
          error_code: null,
          error_message: `Feed generated: ${feedProducts.length} products`,
          synced_at: new Date().toISOString(),
        })
        .then(({ error }) => {
          if (error) console.error("[FEED] feed_sync_log insert failed:", error.message);
        });
    }

    // ── 6. Cache + respond ───────────────────────────────────────────────────
    cachedXml = xml;
    cacheExpiresAt = now + CACHE_TTL_MS;

    res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=1800");
    res.setHeader("X-Feed-Cache", "MISS");
    res.setHeader("X-Feed-Products", String(feedProducts.length));
    return res.send(xml);

  } catch (err) {
    // Log failure to feed_sync_log — need a real product_id; skip if none available
    // (error happened before we fetched products, so we can't log a row)

    next(err);
  }
}

// ─── GET /api/feed/status ───────────────────────────────────────────────────
// Returns the last N feed sync log entries — useful for debugging in the
// admin dashboard (Milestone 5) and for monitoring.
export async function getFeedStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await supabaseAdmin
      .from("feed_sync_log")
      .select("id, product_id, sync_status, google_item_id, error_code, error_message, synced_at")
      .order("synced_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    return res.json({
      lastSync: data?.[0] ?? null,
      history: data ?? [],
      cacheExpiresAt: cacheExpiresAt > 0 ? new Date(cacheExpiresAt).toISOString() : null,
    });
  } catch (err) {
    next(err);
  }
}
