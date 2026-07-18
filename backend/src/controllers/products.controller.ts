import type { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../config/supabase.js";
import { toPublicProduct, type Product } from "../types/product.js";

// GET /api/products
// Public-facing catalog list — only active products, only public-safe fields.
export async function listProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await supabaseAdmin
      .from("products")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Fetch review stats for all products
    const productIds = (data as Product[]).map(p => p.id);
    const { data: reviewStats } = await supabaseAdmin
      .from("reviews")
      .select("product_id, rating")
      .in("product_id", productIds)
      .eq("is_approved", true);

    // Calculate avg rating and count per product
    const statsMap = new Map<string, { avgRating: number; count: number }>();
    (reviewStats ?? []).forEach((r: { product_id: string; rating: number }) => {
      const current = statsMap.get(r.product_id) || { avgRating: 0, count: 0, sum: 0 };
      statsMap.set(r.product_id, {
        avgRating: 0, // will calculate after
        count: current.count + 1,
        sum: (current as any).sum + r.rating,
      } as any);
    });

    // Calculate averages
    statsMap.forEach((stats, productId) => {
      (stats as any).avgRating = Math.round(((stats as any).sum / stats.count) * 10) / 10;
    });

    const products = (data as Product[]).map(p => ({
      ...toPublicProduct(p),
      rating: statsMap.get(p.id)?.avgRating || 0,
      reviewCount: statsMap.get(p.id)?.count || 0,
    }));

    res.json({ products });
  } catch (err) {
    next(err);
  }
}

// GET /api/products/:slug
// Single product for the PDP, by slug (matches the frontend's product.$slug.tsx route).
export async function getProductBySlug(req: Request, res: Response, next: NextFunction) {
  try {
    const { slug } = req.params;

    const { data, error } = await supabaseAdmin
      .from("products")
      .select("*")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Fetch review stats for this product
    const { data: reviewStats } = await supabaseAdmin
      .from("reviews")
      .select("rating")
      .eq("product_id", data.id)
      .eq("is_approved", true);

    const reviews = reviewStats ?? [];
    const avgRating = reviews.length > 0
      ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
      : 0;

    res.json({ 
      product: {
        ...toPublicProduct(data as Product),
        rating: avgRating,
        reviewCount: reviews.length,
      }
    });
  } catch (err) {
    next(err);
  }
}
