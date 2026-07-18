// Mirrors the `products` table in cuthaven_db_schema.sql.
// Keep this in sync whenever the schema changes.
export interface Product {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  short_description: string | null;
  description: string;

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

  category_id: string | null;
  item_group_id: string | null;
  variant_attributes: Record<string, string> | null;

  availability: "in_stock" | "out_of_stock" | "preorder" | "backorder";
  availability_date: string | null;

  stock_quantity: number;
  low_stock_threshold: number;

  weight_kg: number | null;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;

  primary_image_url: string;
  image_urls: string[];
  primary_image_width_px: number | null;
  primary_image_height_px: number | null;

  features: string[];

  shipping_policy_id: string | null;
  return_policy_id: string | null;

  featured: boolean;
  is_active: boolean;
  meta_title: string | null;
  meta_description: string | null;

  created_at: string;
  updated_at: string;
}

// Shape the frontend actually needs for the shop/PDP — trimmed down from
// the full DB row so we never leak internal-only fields to the client.
export interface PublicProduct {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  description: string;
  price: number;
  compareAtPrice: number | null;
  currency: string;
  brand: string | null;
  condition: Product["condition"];
  availability: Product["availability"];
  stockQuantity: number;
  images: string[];
  features: string[];
  categoryId: string | null;
}

export function toPublicProduct(p: Product): PublicProduct {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    shortDescription: p.short_description,
    description: p.description,
    price: p.price,
    compareAtPrice: p.compare_at_price,
    currency: p.currency,
    brand: p.brand,
    condition: p.condition,
    availability: p.availability,
    stockQuantity: p.stock_quantity,
    images: [p.primary_image_url, ...p.image_urls],
    features: p.features,
    categoryId: p.category_id,
  };
}
