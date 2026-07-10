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

    const products = (data as Product[]).map(toPublicProduct);
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

    res.json({ product: toPublicProduct(data as Product) });
  } catch (err) {
    next(err);
  }
}
