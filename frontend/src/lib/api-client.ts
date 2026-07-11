import type { Product } from "@/data/products";

// The ONLY place the frontend knows about the backend's existence.
// No Supabase client here — just plain HTTP to the separately-running Express service.
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

const TOKEN_KEY = "ch-access-token";

// ─── Core request helper ───────────────────────────────────────────────────

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: boolean; // when true, attaches the stored Bearer token
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = false } = options;

  const headers: Record<string, string> = {};
  if (body) headers["Content-Type"] = "application/json";

  if (auth) {
    const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      typeof data.error === "string"
        ? data.error
        : `Request to ${path} failed with ${res.status}`,
    );
  }

  return res.json() as Promise<T>;
}

// ─── Product types & mapping ───────────────────────────────────────────────

// Shape returned by the backend (backend/src/types/product.ts → PublicProduct)
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

// Maps backend shape → frontend Product type so components don't need to change.
// Known TODOs (intentional, not bugs):
//   rating/reviewCount → needs reviews aggregation endpoint
//   category           → needs /api/categories to resolve name from categoryId
//   attributes         → not yet modeled in DB
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
    category: p.categoryId ?? "",
    images: p.images,
    inStock: p.availability === "in_stock",
    rating: 0,
    reviewCount: 0,
    sku: "",
    brand: p.brand ?? "",
    attributes: {},
    tags: p.features,
  };
}

// ─── Public product endpoints ──────────────────────────────────────────────

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

// ─── Customer profile & address types ──────────────────────────────────────

export interface CustomerAddress {
  id: string;
  label: string;
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  isDefault: boolean;
}

export interface CustomerProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  addresses: CustomerAddress[];
  createdAt: string;
}

// ─── Order types ───────────────────────────────────────────────────────────

export interface ApiOrderItem {
  id: string;
  productId: string | null;
  productName: string;
  productSlug: string;
  productImage: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface ApiOrder {
  id: string;
  orderNumber: string;
  status: "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded";
  paymentStatus: "pending" | "paid" | "failed" | "refunded" | "partially_refunded";
  subtotal: number;
  shippingCost: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  shippingAddress: Record<string, string>;
  paymentMethod: string | null;
  customerNotes: string | null;
  createdAt: string;
  items: ApiOrderItem[];
}

// ─── Authenticated customer endpoints ──────────────────────────────────────

export async function getMyProfile(): Promise<CustomerProfile> {
  const { customer } = await request<{ customer: CustomerProfile }>("/customers/me", { auth: true });
  return customer;
}

export async function updateMyProfile(
  data: Pick<CustomerProfile, "firstName" | "lastName" | "phone">,
): Promise<void> {
  await request("/customers/me", { method: "PATCH", body: data, auth: true });
}

export async function changeMyPassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await request("/customers/me/change-password", {
    method: "POST",
    body: { currentPassword, newPassword },
    auth: true,
  });
}

export async function getMyAddresses(): Promise<CustomerAddress[]> {
  const { addresses } = await request<{ addresses: CustomerAddress[] }>(
    "/customers/me/addresses",
    { auth: true },
  );
  return addresses;
}

export async function updateMyAddresses(addresses: CustomerAddress[]): Promise<CustomerAddress[]> {
  const { addresses: updated } = await request<{ addresses: CustomerAddress[] }>(
    "/customers/me/addresses",
    { method: "PUT", body: { addresses }, auth: true },
  );
  return updated;
}

export async function getMyOrders(): Promise<ApiOrder[]> {
  const { orders } = await request<{ orders: ApiOrder[] }>("/orders/my", { auth: true });
  return orders;
}

export async function getMyOrderById(id: string): Promise<ApiOrder> {
  const { order } = await request<{ order: ApiOrder }>(`/orders/my/${id}`, { auth: true });
  return order;
}

// ─── Categories ────────────────────────────────────────────────────────────

export interface ApiCategory {
  id: string;
  slug: string;
  name: string;
  productCount: number;
}

export async function getCategories(): Promise<ApiCategory[]> {
  const { categories } = await request<{ categories: ApiCategory[] }>("/categories");
  return categories;
}

// ─── Checkout ──────────────────────────────────────────────────────────────

export interface CheckoutItem {
  productId: string;
  quantity: number;
}

export interface CheckoutShippingAddress {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country?: string;
}

export interface PaymentIntentResponse {
  clientSecret: string;
  orderId: string;
  orderNumber: string;
  subtotal: number;
  shippingCost: number;
  taxAmount: number;
  total: number;
}

export async function createPaymentIntent(
  items: CheckoutItem[],
  shippingAddress: CheckoutShippingAddress,
  customerNotes?: string,
): Promise<PaymentIntentResponse> {
  return request<PaymentIntentResponse>("/checkout/payment-intent", {
    method: "POST",
    body: { items, shippingAddress, customerNotes, paymentProcessor: "stripe" },
    auth: true, // works for both guests (no token) and logged-in users
  });
}

export interface OrderSummary {
  order: {
    id: string;
    order_number: string;
    status: string;
    subtotal: number;
    shipping_cost: number;
    tax_amount: number;
    total: number;
    shipping_address: Record<string, string>;
    created_at: string;
  };
  items: Array<{
    id: string;
    product_name: string;
    product_image: string | null;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
}

export async function getOrderSummary(orderId: string): Promise<OrderSummary> {
  return request<OrderSummary>(`/checkout/order/${orderId}`);
}
