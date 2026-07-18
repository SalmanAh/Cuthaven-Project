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
  stockQuantity: number;
  images: string[];
  features: string[];
  categoryId: string | null;
  rating?: number;
  reviewCount?: number;
}

// Maps backend shape → frontend Product type so components don't need to change.
// Known TODOs (intentional, not bugs):
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
    stockQuantity: p.stockQuantity ?? 0,
    rating: p.rating ?? 0,
    reviewCount: p.reviewCount ?? 0,
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
  paymentIntentId: string;
  orderNumber: string;
  subtotal: number;
  shippingCost: number;
  taxAmount: number;
  taxJurisdiction: string;
  taxRate: number;
  discountAmount: number;
  total: number;
  checkoutToken: string;
}

export async function createPaymentIntent(
  items: CheckoutItem[],
  shippingAddress: CheckoutShippingAddress,
  customerNotes?: string,
  couponCode?: string,
): Promise<PaymentIntentResponse> {
  return request<PaymentIntentResponse>("/checkout/payment-intent", {
    method: "POST",
    body: { items, shippingAddress, customerNotes, couponCode, paymentProcessor: "stripe" },
    auth: true,
  });
}

// ─── Coupon validation ──────────────────────────────────────────────────────

export interface CouponValidationResult {
  valid: boolean;
  couponId: string;
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  discountAmount: number;
}

export async function validateCoupon(
  code: string,
  subtotal: number,
  email?: string,
): Promise<CouponValidationResult> {
  return request<CouponValidationResult>("/checkout/validate-coupon", {
    method: "POST",
    body: { code, subtotal, email },
    auth: true, // Send auth token so backend can check per-customer reuse
  });
}

// ─── Admin coupon endpoints ────────────────────────────────────────────────

export interface AdminCoupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  min_order_amount: number | null;
  max_uses: number | null;
  used_count: number;
  is_active: boolean;
  valid_until: string | null;
  valid_from: string;
  created_at: string;
}

export async function adminGetCoupons(): Promise<{ coupons: AdminCoupon[] }> {
  return request("/admin/coupons", { auth: true });
}

export async function adminCreateCoupon(data: {
  code: string;
  description?: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minimumOrderAmount?: number | null;
  usageLimit?: number | null;
  isActive?: boolean;
  expiresAt?: string | null;
}): Promise<{ coupon: AdminCoupon }> {
  return request("/admin/coupons", { method: "POST", body: data, auth: true });
}

export async function adminUpdateCoupon(
  id: string,
  data: Partial<Parameters<typeof adminCreateCoupon>[0]>,
): Promise<{ coupon: AdminCoupon }> {
  return request(`/admin/coupons/${id}`, { method: "PATCH", body: data, auth: true });
}

export async function adminDeleteCoupon(id: string): Promise<void> {
  await request(`/admin/coupons/${id}`, { method: "DELETE", auth: true });
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

// ─── Admin types ───────────────────────────────────────────────────────────

export type AdminPeriod = "today" | "7days" | "month" | "annual";

export interface AdminOrderItem {
  id: string;
  productId: string | null;
  productName: string;
  productSlug: string;
  productImage: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface AdminOrder {
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
  paymentProcessor: string;
  paymentTransactionId: string | null;
  customerNotes: string | null;
  createdAt: string;
  updatedAt: string;
  customerEmail: string | null;
  customerName: string | null;
  items: AdminOrderItem[];
}

export interface AdminProduct {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  shortDescription: string | null;
  description: string;
  price: number;
  compareAtPrice: number | null;
  currency: string;
  sku: string | null;
  brand: string | null;
  gtin: string | null;
  mpn: string | null;
  identifierExists: boolean;
  condition: "new" | "used" | "refurbished";
  googleProductCategory: string | null;
  categoryId: string | null;
  categoryName: string | null;
  availability: "in_stock" | "out_of_stock" | "preorder" | "backorder";
  stockQuantity: number;
  lowStockThreshold: number;
  primaryImageUrl: string;
  imageUrls: string[];
  features: string[];
  featured: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCustomer {
  id: string;
  authId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  ordersCount: number;
  totalSpent: number;
}

export interface AdminStaffMember {
  id: string;
  authId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "admin" | "store_manager";
  isActive: boolean;
  createdAt: string;
}

export interface AdminStats {
  revenue: number;
  orders: number;
  customers: number;
  avgOrder: number;
  pending: number;
  confirmed: number;
  processing: number;
  shipped: number;
  delivered: number;
  cancelled: number;
  revTrend: number;
  ordTrend: number;
  custTrend: number;
  aovTrend: number;
}

export interface AdminRevenueSeries {
  label: string;
  revenue: number;
  orders: number;
}

export interface AdminStatusDistribution {
  name: string;
  value: number;
  color: string;
}

// ─── Admin order endpoints ─────────────────────────────────────────────────

export async function adminGetOrders(params?: {
  status?: string;
  paymentStatus?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{ orders: AdminOrder[]; total: number; page: number; limit: number }> {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.paymentStatus) q.set("paymentStatus", params.paymentStatus);
  if (params?.search) q.set("search", params.search);
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  const qs = q.toString() ? `?${q.toString()}` : "";
  return request(`/admin/orders${qs}`, { auth: true });
}

export async function adminGetOrderById(id: string): Promise<{ order: AdminOrder }> {
  return request(`/admin/orders/${id}`, { auth: true });
}

export async function adminUpdateOrderStatus(
  id: string,
  status: AdminOrder["status"],
): Promise<void> {
  await request(`/admin/orders/${id}/status`, { method: "PATCH", body: { status }, auth: true });
}

// ─── Admin product endpoints ───────────────────────────────────────────────

export async function adminGetProducts(params?: {
  search?: string;
  categoryId?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}): Promise<{ products: AdminProduct[]; total: number; page: number; limit: number }> {
  const q = new URLSearchParams();
  if (params?.search) q.set("search", params.search);
  if (params?.categoryId) q.set("categoryId", params.categoryId);
  if (params?.isActive !== undefined) q.set("isActive", String(params.isActive));
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  const qs = q.toString() ? `?${q.toString()}` : "";
  return request(`/admin/products${qs}`, { auth: true });
}

export async function adminCreateProduct(
  data: Omit<AdminProduct, "id" | "createdAt" | "updatedAt" | "categoryName">,
): Promise<{ product: AdminProduct }> {
  return request("/admin/products", { method: "POST", body: data, auth: true });
}

export async function adminUpdateProduct(
  id: string,
  data: Partial<Omit<AdminProduct, "id" | "createdAt" | "updatedAt" | "categoryName">>,
): Promise<{ product: AdminProduct }> {
  return request(`/admin/products/${id}`, { method: "PUT", body: data, auth: true });
}

export async function adminDeleteProduct(id: string): Promise<void> {
  await request(`/admin/products/${id}`, { method: "DELETE", auth: true });
}

// ─── Admin customer endpoints ──────────────────────────────────────────────

export async function adminGetCustomers(params?: {
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{ customers: AdminCustomer[]; total: number; page: number; limit: number }> {
  const q = new URLSearchParams();
  if (params?.search) q.set("search", params.search);
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  const qs = q.toString() ? `?${q.toString()}` : "";
  return request(`/admin/customers${qs}`, { auth: true });
}

export async function adminGetCustomerById(
  id: string,
): Promise<{ customer: AdminCustomer; orders: AdminOrder[] }> {
  return request(`/admin/customers/${id}`, { auth: true });
}

// ─── Admin staff endpoints ─────────────────────────────────────────────────

export async function adminGetStaff(): Promise<{ staff: AdminStaffMember[] }> {
  return request("/admin/staff", { auth: true });
}

export async function adminCreateStaff(data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: "store_manager";
}): Promise<{ staff: AdminStaffMember }> {
  return request("/admin/staff", { method: "POST", body: data, auth: true });
}

export async function adminToggleStaff(id: string, isActive: boolean): Promise<void> {
  await request(`/admin/staff/${id}/toggle`, { method: "PATCH", body: { isActive }, auth: true });
}

// ─── Admin analytics endpoints ─────────────────────────────────────────────

export async function adminGetAnalyticsSummary(
  period: AdminPeriod,
): Promise<{ stats: AdminStats; period: AdminPeriod }> {
  return request(`/admin/analytics/summary?period=${period}`, { auth: true });
}

export async function adminGetAnalyticsSeries(period: AdminPeriod): Promise<{
  series: AdminRevenueSeries[];
  distribution: AdminStatusDistribution[];
  period: AdminPeriod;
}> {
  return request(`/admin/analytics/series?period=${period}`, { auth: true });
}

// ─── Order tracking ────────────────────────────────────────────────────────

export interface TrackOrderResult {
  order: {
    orderNumber: string;
    status: string;
    paymentStatus: string;
    subtotal: number;
    shippingCost: number;
    taxAmount: number;
    discountAmount: number;
    total: number;
    createdAt: string;
    updatedAt: string;
    shippingAddress: { firstName: string; lastName: string; address: string; city: string; state: string; zip: string; country: string; };
  };
  items: Array<{ product_name: string; product_slug: string; product_image: string | null; quantity: number; unit_price: number; total_price: number; }>;
  history: Array<{ status: string; notes: string | null; created_at: string; }>;
}

export async function trackOrder(orderNumber: string, email: string): Promise<TrackOrderResult> {
  const q = new URLSearchParams({ orderNumber, email });
  return request<TrackOrderResult>(`/orders/track?${q.toString()}`);
}

// ─── Contact form ──────────────────────────────────────────────────────────

export async function submitContact(data: {
  name: string; email: string; phone?: string; subject?: string; message: string;
}): Promise<{ message: string }> {
  return request("/contact", { method: "POST", body: data });
}

// ─── Reviews ───────────────────────────────────────────────────────────────

export interface ReviewItem {
  id: string;
  rating: number;
  reviewText: string | null;
  isVerifiedPurchase: boolean;
  disclosedIncentive: boolean;
  insiderRelationship: string | null;
  createdAt: string;
  reviewerName: string;
}

export interface ReviewsResponse {
  reviews: ReviewItem[];
  count: number;
  avgRating: number;
}

export async function getProductReviews(productSlug: string): Promise<ReviewsResponse> {
  return request<ReviewsResponse>(`/reviews/${productSlug}`);
}

export async function submitReview(data: {
  productId: string;
  rating: number;
  reviewText?: string;
  disclosedIncentive?: boolean;
  insiderRelationship?: string | null;
}): Promise<{ reviewId: string; message: string }> {
  return request("/reviews", { method: "POST", body: data, auth: true });
}

// ─── Blog ──────────────────────────────────────────────────────────────────

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  author: string;
  imageUrl: string | null;
  readTime: string;
  isPublished: boolean;
  publishedAt: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getBlogPosts(params?: {
  category?: string;
  page?: number;
  limit?: number;
}): Promise<{ posts: BlogPost[]; total: number; page: number; limit: number }> {
  const q = new URLSearchParams();
  if (params?.category) q.set("category", params.category);
  if (params?.page)     q.set("page", String(params.page));
  if (params?.limit)    q.set("limit", String(params.limit));
  const qs = q.toString() ? `?${q.toString()}` : "";
  return request(`/blog${qs}`);
}

export async function getBlogCategories(): Promise<{ categories: { name: string; count: number }[] }> {
  return request("/blog/categories");
}

export async function getBlogPostBySlug(slug: string): Promise<{ post: BlogPost }> {
  return request(`/blog/${slug}`);
}

// Admin blog
export async function adminGetBlogPosts(): Promise<{ posts: BlogPost[] }> {
  return request("/admin/blog", { auth: true });
}

export async function adminCreateBlogPost(data: Partial<BlogPost>): Promise<{ post: BlogPost }> {
  return request("/admin/blog", { method: "POST", body: data, auth: true });
}

export async function adminUpdateBlogPost(id: string, data: Partial<BlogPost>): Promise<{ post: BlogPost }> {
  return request(`/admin/blog/${id}`, { method: "PUT", body: data, auth: true });
}

export async function adminDeleteBlogPost(id: string): Promise<void> {
  await request(`/admin/blog/${id}`, { method: "DELETE", auth: true });
}

// ─── Consent log ──────────────────────────────────────────────────────────

export async function logConsent(data: {
  consentAction: "accept_all" | "reject_all" | "custom" | "opt_out_sale_share" | "limit_sensitive_pi";
  analytics?: boolean;
  marketing?: boolean;
  gpcSignalDetected?: boolean;
  privacyPolicyVersion?: string;
  sessionId?: string;
}): Promise<void> {
  await request("/consent", { method: "POST", body: data, auth: true });
}

// ─── PayPal ────────────────────────────────────────────────────────────────

export interface PayPalOrderResponse {
  paypalOrderId: string;
  orderNumber: string;
  subtotal: number;
  shippingCost: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  _checkoutData: {
    orderNumber: string;
    appliedCouponId: string | null;
    subtotalCents: number;
    shippingCents: number;
    taxCents: number;
    discountCents: number;
    totalCents: number;
    shippingAddress: Record<string, string>;
    customerNotes: string | null;
    lineItems: Array<{
      productId: string; productName: string; productSlug: string;
      productImage: string | null; quantity: number; unitPrice: number; totalPrice: number;
    }>;
  };
}

export async function createPayPalOrder(
  items: CheckoutItem[],
  shippingAddress: CheckoutShippingAddress,
  customerNotes?: string,
  couponCode?: string,
): Promise<PayPalOrderResponse> {
  return request<PayPalOrderResponse>("/checkout/paypal/create-order", {
    method: "POST",
    body: { items, shippingAddress, customerNotes, couponCode },
    auth: true,
  });
}

export async function capturePayPalOrder(
  paypalOrderId: string,
  checkoutData: PayPalOrderResponse["_checkoutData"],
): Promise<{ success: boolean; orderId: string; orderNumber: string }> {
  return request("/checkout/paypal/capture-order", {
    method: "POST",
    body: { paypalOrderId, checkoutData },
    auth: true,
  });
}

export async function getPayPalClientId(): Promise<{ clientId: string }> {
  return request("/checkout/paypal/client-id");
}

// ─── Confirm Stripe order (called after stripe.confirmPayment succeeds) ────

export async function confirmStripeOrder(
  paymentIntentId: string,
): Promise<{ orderId: string; orderNumber: string }> {
  return request("/checkout/confirm-stripe-order", {
    method: "POST",
    body: { paymentIntentId },
    auth: true,
  });
}

// ─── Cash on Delivery order ────────────────────────────────────────────────

export interface CodOrderResponse {
  orderId: string;
  orderNumber: string;
  subtotal: number;
  shippingCost: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
}

export async function createCodOrder(
  items: CheckoutItem[],
  shippingAddress: CheckoutShippingAddress,
  customerNotes?: string,
  couponCode?: string,
): Promise<CodOrderResponse> {
  return request("/checkout/cod-order", {
    method: "POST",
    body: { items, shippingAddress, customerNotes, couponCode },
    auth: true,
  });
}

// ─── Review eligibility check ──────────────────────────────────────────────

export type CanReviewReason =
  | "not_logged_in"
  | "not_purchased"
  | "not_delivered"
  | "already_reviewed"
  | "ok";

export interface CanReviewResult {
  canReview: boolean;
  reason: CanReviewReason;
}

export async function checkCanReview(productId: string): Promise<CanReviewResult> {
  return request<CanReviewResult>(`/reviews/can-review/${productId}`, { auth: true });
}

// ─── Admin payment status update ──────────────────────────────────────────

export async function adminUpdatePaymentStatus(
  id: string,
  paymentStatus: "pending" | "paid" | "failed" | "refunded" | "partially_refunded",
): Promise<void> {
  await request(`/admin/orders/${id}/payment-status`, {
    method: "PATCH",
    body: { paymentStatus },
    auth: true,
  });
}
