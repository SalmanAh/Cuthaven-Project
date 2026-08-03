import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../config/supabase.js";
import type { Product } from "../types/product.js";
import type { AdminProduct } from "../types/admin.js";

// ─── Mapping ───────────────────────────────────────────────────────────────

function toAdminProduct(p: Product, categoryName: string | null): AdminProduct {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    tagline: p.tagline,
    shortDescription: p.short_description,
    description: p.description,
    price: p.price,
    compareAtPrice: p.compare_at_price,
    currency: p.currency,
    sku: p.sku,
    brand: p.brand,
    gtin: p.gtin,
    mpn: p.mpn,
    identifierExists: p.identifier_exists,
    condition: p.condition,
    googleProductCategory: p.google_product_category,
    categoryId: p.category_id,
    categoryName,
    availability: p.availability,
    stockQuantity: p.stock_quantity,
    lowStockThreshold: p.low_stock_threshold,
    primaryImageUrl: p.primary_image_url,
    imageUrls: p.image_urls,
    features: p.features,
    featured: p.featured,
    isActive: p.is_active,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

// ─── Validation schemas ────────────────────────────────────────────────────

const productWriteSchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  name: z.string().min(1, "Name is required"),
  tagline: z.string().nullable().optional(),
  shortDescription: z.string().nullable().optional(),
  description: z.string().min(1, "Description is required"),
  price: z.number().positive("Price must be positive"),
  compareAtPrice: z.number().positive().nullable().optional(),
  currency: z.string().default("USD"),
  sku: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  gtin: z.string().nullable().optional(),
  mpn: z.string().nullable().optional(),
  identifierExists: z.boolean().default(true),
  condition: z.enum(["new", "used", "refurbished"]).default("new"),
  googleProductCategory: z.string().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  availability: z.enum(["in_stock", "out_of_stock", "preorder", "backorder"]).default("in_stock"),
  stockQuantity: z.number().int().min(0).default(0),
  lowStockThreshold: z.number().int().min(0).default(5),
  primaryImageUrl: z.string().url("Primary image must be a valid URL"),
  imageUrls: z.array(z.string().url()).default([]),
  features: z.array(z.string()).default([]),
  featured: z.boolean().default(false),
  isActive: z.boolean().default(true),
  metaTitle: z.string().nullable().optional(),
  metaDescription: z.string().nullable().optional(),
});

// ─── Helper: resolve category names for a list of products ────────────────

async function resolveCategoryNames(
  products: Product[],
): Promise<Record<string, string>> {
  const ids = [
    ...new Set(products.map((p) => p.category_id).filter(Boolean) as string[]),
  ];
  if (ids.length === 0) return {};
  const { data } = await supabaseAdmin
    .from("categories")
    .select("id, name")
    .in("id", ids);
  const map: Record<string, string> = {};
  (data ?? []).forEach((c: { id: string; name: string }) => {
    map[c.id] = c.name;
  });
  return map;
}

// ─── GET /api/admin/products ───────────────────────────────────────────────
// Returns ALL products (including inactive) — admin needs to see everything.
export async function adminListProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const { search, categoryId, isActive, page = "1", limit = "100" } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 100));
    const offset = (pageNum - 1) * limitNum;

    let query = supabaseAdmin
      .from("products")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (search) query = query.ilike("name", `%${search}%`);
    if (categoryId) query = query.eq("category_id", categoryId);
    if (isActive !== undefined) query = query.eq("is_active", isActive === "true");

    const { data, error, count } = await query;
    if (error) throw error;

    const products = (data ?? []) as Product[];
    const categoryMap = await resolveCategoryNames(products);

    return res.json({
      products: products.map((p) => toAdminProduct(p, categoryMap[p.category_id ?? ""] ?? null)),
      total: count ?? products.length,
      page: pageNum,
      limit: limitNum,
    });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/admin/products ──────────────────────────────────────────────
export async function createProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = productWriteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }
    const d = parsed.data;

    // Check slug uniqueness
    const { data: existing } = await supabaseAdmin
      .from("products")
      .select("id")
      .eq("slug", d.slug)
      .maybeSingle();
    if (existing) {
      return res.status(409).json({ error: "A product with this slug already exists" });
    }

    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from("products")
      .insert({
        slug: d.slug,
        name: d.name,
        tagline: d.tagline ?? null,
        short_description: d.shortDescription ?? null,
        description: d.description,
        price: d.price,
        compare_at_price: d.compareAtPrice ?? null,
        currency: d.currency,
        sku: d.sku ?? null,
        brand: d.brand ?? null,
        gtin: d.gtin ?? null,
        mpn: d.mpn ?? null,
        identifier_exists: d.identifierExists,
        condition: d.condition,
        google_product_category: d.googleProductCategory ?? null,
        category_id: d.categoryId ?? null,
        availability: d.availability,
        stock_quantity: d.stockQuantity,
        low_stock_threshold: d.lowStockThreshold,
        primary_image_url: d.primaryImageUrl,
        image_urls: d.imageUrls,
        features: d.features,
        featured: d.featured,
        is_active: d.isActive,
        meta_title: d.metaTitle ?? null,
        meta_description: d.metaDescription ?? null,
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single();

    if (error) throw error;

    const catMap = await resolveCategoryNames([data as Product]);
    const p = data as Product;
    return res.status(201).json({
      product: toAdminProduct(p, catMap[p.category_id ?? ""] ?? null),
    });
  } catch (err) {
    next(err);
  }
}

// ─── PUT /api/admin/products/:id ───────────────────────────────────────────
export async function updateProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const parsed = productWriteSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }
    const d = parsed.data;

    // If slug is changing, check it's not taken by another product
    if (d.slug) {
      const { data: existing } = await supabaseAdmin
        .from("products")
        .select("id")
        .eq("slug", d.slug)
        .neq("id", id)
        .maybeSingle();
      if (existing) {
        return res.status(409).json({ error: "A product with this slug already exists" });
      }
    }

    // Build the update payload — only include fields that were sent
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (d.slug !== undefined)                patch.slug = d.slug;
    if (d.name !== undefined)                patch.name = d.name;
    if (d.tagline !== undefined)             patch.tagline = d.tagline;
    if (d.shortDescription !== undefined)    patch.short_description = d.shortDescription;
    if (d.description !== undefined)         patch.description = d.description;
    if (d.price !== undefined)               patch.price = d.price;
    if (d.compareAtPrice !== undefined)      patch.compare_at_price = d.compareAtPrice;
    if (d.currency !== undefined)            patch.currency = d.currency;
    if (d.sku !== undefined)                 patch.sku = d.sku;
    if (d.brand !== undefined)               patch.brand = d.brand;
    if (d.gtin !== undefined)                patch.gtin = d.gtin;
    if (d.mpn !== undefined)                 patch.mpn = d.mpn;
    if (d.identifierExists !== undefined)    patch.identifier_exists = d.identifierExists;
    if (d.condition !== undefined)           patch.condition = d.condition;
    if (d.googleProductCategory !== undefined) patch.google_product_category = d.googleProductCategory;
    if (d.categoryId !== undefined)          patch.category_id = d.categoryId;
    if (d.availability !== undefined)        patch.availability = d.availability;
    if (d.stockQuantity !== undefined)       patch.stock_quantity = d.stockQuantity;
    if (d.lowStockThreshold !== undefined)   patch.low_stock_threshold = d.lowStockThreshold;
    if (d.primaryImageUrl !== undefined)     patch.primary_image_url = d.primaryImageUrl;
    if (d.imageUrls !== undefined)           patch.image_urls = d.imageUrls;
    if (d.features !== undefined)            patch.features = d.features;
    if (d.featured !== undefined)            patch.featured = d.featured;
    if (d.isActive !== undefined)            patch.is_active = d.isActive;
    if (d.metaTitle !== undefined)           patch.meta_title = d.metaTitle;
    if (d.metaDescription !== undefined)     patch.meta_description = d.metaDescription;

    const { data, error } = await supabaseAdmin
      .from("products")
      .update(patch)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Product not found" });

    const p = data as Product;
    const catMap = await resolveCategoryNames([p]);
    return res.json({ product: toAdminProduct(p, catMap[p.category_id ?? ""] ?? null) });
  } catch (err) {
    next(err);
  }
}

// ─── DELETE /api/admin/products/:id ────────────────────────────────────────
// Hybrid delete: checks if product has orders
// - NO ORDERS: Hard delete (permanently removes from DB)
// - HAS ORDERS: Soft delete (sets is_active = false to preserve order history)
export async function deleteProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    // Check if product has any orders
    const { data: orderItems, error: checkError } = await supabaseAdmin
      .from("order_items")
      .select("id")
      .eq("product_id", id)
      .limit(1);

    if (checkError) throw checkError;

    if (orderItems && orderItems.length > 0) {
      // Product has orders - SOFT DELETE only (preserve order history)
      const { data, error } = await supabaseAdmin
        .from("products")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("id, name")
        .maybeSingle();

      if (error) throw error;
      if (!data) return res.status(404).json({ error: "Product not found" });

      return res.json({ 
        message: "Product deactivated (has existing orders - cannot be permanently deleted)", 
        product: data,
        deleteType: "deactivated"
      });
    } else {
      // No orders - HARD DELETE is safe
      const { data, error } = await supabaseAdmin
        .from("products")
        .delete()
        .eq("id", id)
        .select("id, name")
        .maybeSingle();

      if (error) throw error;
      if (!data) return res.status(404).json({ error: "Product not found" });

      return res.json({ 
        message: "Product permanently deleted", 
        product: data,
        deleteType: "deleted"
      });
    }
  } catch (err) {
    next(err);
  }
}
