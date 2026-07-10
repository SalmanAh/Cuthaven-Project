import type { Product } from "@/data/products";

// The ONLY place the frontend knows about the backend's existence.
// No Supabase client here, no createServerFn — just plain HTTP to a
// separately-running service. Swap this URL via .env and nothing else changes.
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

// Shape actually returned by the backend (see backend/src/types/product.ts → PublicProduct)
interface ApiProduct {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  description: string;
  price: number;
  compareAtPrice: number | null;
  currency: string;
  brand: string | null;
  condition: "new" | "used" | "refurbished";
  availability: "in_stock" | "out_of_stock" | "preorder" | "backorder";
  images: string[];
  features: string[];
  categoryId: string | null;
}

// Maps the API's shape onto the frontend's existing mock `Product` type so
// components (ProductCard, shop filters, PDP) don't need to change at all —
// only the data source underneath them does.
//
// Known gaps for now (fine for a first wired example, needs follow-up):
// - rating / reviewCount: not in the DB schema yet — needs a reviews aggregation
//   endpoint. Defaulted to 0 here, not fabricated.
// - category: categories endpoint isn't wired yet, so this is a placeholder —
//   shop.tsx's category filter won't fully work until that lands.
// - attributes / tags: not modeled in the DB schema (features[] is). Left empty
//   for now rather than guessing at values.
function toFrontendProduct(p: ApiProduct): Product {
  const onSale = p.compareAtPrice != null && p.compareAtPrice > p.price;
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    shortDescription: p.shortDescription ?? "",
    description: p.description,
    price: onSale ? (p.compareAtPrice as number) : p.price,
    salePrice: onSale ? p.price : null,
    category: p.categoryId ?? "", // TODO: replace once /api/categories exists
    images: p.images,
    inStock: p.availability === "in_stock",
    rating: 0, // TODO: aggregate from reviews table
    reviewCount: 0, // TODO: aggregate from reviews table
    sku: "", // not returned by the public endpoint (internal-only field)
    brand: p.brand ?? "",
    attributes: {}, // TODO: no DB equivalent yet
    tags: p.features, // closest existing equivalent for now
  };
}

async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request to ${path} failed with ${res.status}`);
  }
  return res.json();
}

export async function getProducts(): Promise<Product[]> {
  const { products } = await request<{ products: ApiProduct[] }>("/products");
  return products.map(toFrontendProduct);
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  try {
    const { product } = await request<{ product: ApiProduct }>(`/products/${slug}`);
    return toFrontendProduct(product);
  } catch {
    return null;
  }
}
