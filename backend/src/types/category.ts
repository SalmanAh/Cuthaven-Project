// Mirrors the categories table in cuthaven_db_schema.sql

export interface Category {
  id: string;
  slug: string;
  name: string;
  google_product_category: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PublicCategory {
  id: string;
  slug: string;
  name: string;
  productCount: number;
}

export function toPublicCategory(c: Category, productCount: number): PublicCategory {
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    productCount,
  };
}
