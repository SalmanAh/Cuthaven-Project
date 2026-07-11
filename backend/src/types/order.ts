// Mirrors the orders + order_items tables in cuthaven_db_schema.sql

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  product_slug: string;
  product_image: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id: string | null;
  status: "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded";
  subtotal: number;
  shipping_cost: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  shipping_address: Record<string, string>;
  billing_address: Record<string, string> | null;
  payment_processor: "stripe" | "paypal";
  payment_method: "card" | "paypal_balance" | null;
  payment_status: "pending" | "paid" | "failed" | "refunded" | "partially_refunded";
  payment_transaction_id: string | null;
  customer_notes: string | null;
  created_at: string;
  updated_at: string;
}

// Shape sent to the customer — safe subset only
export interface PublicOrder {
  id: string;
  orderNumber: string;
  status: Order["status"];
  paymentStatus: Order["payment_status"];
  subtotal: number;
  shippingCost: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  shippingAddress: Record<string, string>;
  paymentMethod: string | null;
  customerNotes: string | null;
  createdAt: string;
  items: PublicOrderItem[];
}

export interface PublicOrderItem {
  id: string;
  productId: string | null;
  productName: string;
  productSlug: string;
  productImage: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export function toPublicOrder(order: Order, items: OrderItem[]): PublicOrder {
  return {
    id: order.id,
    orderNumber: order.order_number,
    status: order.status,
    paymentStatus: order.payment_status,
    subtotal: order.subtotal,
    shippingCost: order.shipping_cost,
    taxAmount: order.tax_amount,
    discountAmount: order.discount_amount,
    total: order.total,
    shippingAddress: order.shipping_address,
    paymentMethod: order.payment_method,
    customerNotes: order.customer_notes,
    createdAt: order.created_at,
    items: items.map((i) => ({
      id: i.id,
      productId: i.product_id,
      productName: i.product_name,
      productSlug: i.product_slug,
      productImage: i.product_image,
      quantity: i.quantity,
      unitPrice: i.unit_price,
      totalPrice: i.total_price,
    })),
  };
}
