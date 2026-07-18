// ─── Admin-facing types ────────────────────────────────────────────────────
// These extend the existing customer-facing types with fields only admins see.

// ── Orders ──────────────────────────────────────────────────────────────────

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
  // Joined fields
  customerEmail: string | null;
  customerName: string | null;
  items: AdminOrderItem[];
}

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

// ── Products ─────────────────────────────────────────────────────────────────

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

// ── Customers ────────────────────────────────────────────────────────────────

export interface AdminCustomer {
  id: string;
  authId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  // Aggregated
  ordersCount: number;
  totalSpent: number;
}

// ── Staff ────────────────────────────────────────────────────────────────────

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

// ── Analytics ────────────────────────────────────────────────────────────────

export interface AdminStats {
  revenue: number;
  orders: number;
  customers: number;
  avgOrder: number;
  pending: number;
  processing: number;
  shipped: number;
  delivered: number;
  confirmed: number;
  cancelled: number;
  // Trend vs previous period (percentage, can be negative)
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

export type AdminPeriod = "today" | "7days" | "month" | "annual";
