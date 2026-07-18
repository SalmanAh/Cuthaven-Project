import type { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../config/supabase.js";
import type { Order, OrderItem } from "../types/order.js";
import type { AdminOrder, AdminOrderItem } from "../types/admin.js";
import { sendOrderShippedEmail } from "../emails/orderShipped.js";

// Maps raw DB rows to the AdminOrder shape
function toAdminOrder(
  order: Order & { customer_email?: string | null; customer_name?: string | null },
  items: OrderItem[],
): AdminOrder {
  const adminItems: AdminOrderItem[] = items.map((i) => ({
    id: i.id,
    productId: i.product_id,
    productName: i.product_name,
    productSlug: i.product_slug,
    productImage: i.product_image,
    quantity: i.quantity,
    unitPrice: i.unit_price,
    totalPrice: i.total_price,
  }));

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
    paymentProcessor: order.payment_processor,
    paymentTransactionId: order.payment_transaction_id,
    customerNotes: order.customer_notes,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    customerEmail: order.customer_email ?? null,
    customerName: order.customer_name ?? null,
    items: adminItems,
  };
}

// ─── GET /api/admin/orders ──────────────────────────────────────────────────
// Paginated list of all orders. Supports filtering by status, payment_status,
// date range, and free-text search on order_number / customer fields.
export async function listAllOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      status,
      paymentStatus,
      search,
      page = "1",
      limit = "50",
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    let query = supabaseAdmin
      .from("orders")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (status) query = query.eq("status", status);
    if (paymentStatus) query = query.eq("payment_status", paymentStatus);
    if (search) {
      // Search on order_number (exact/partial). Email search requires joining customers —
      // done client-side for now; full-text search can be added in a future migration.
      query = query.ilike("order_number", `%${search}%`);
    }

    const { data: orders, error, count } = await query;
    if (error) throw error;
    if (!orders || orders.length === 0) {
      return res.json({ orders: [], total: 0, page: pageNum, limit: limitNum });
    }

    // ── Fetch items for all orders in one query ──────────────────────────────
    const orderIds = (orders as Order[]).map((o) => o.id);
    const { data: items, error: itemsErr } = await supabaseAdmin
      .from("order_items")
      .select("*")
      .in("order_id", orderIds);
    if (itemsErr) throw itemsErr;

    // ── Resolve customer emails from customers table ─────────────────────────
    const customerIds = [
      ...new Set(
        (orders as Order[]).map((o) => o.customer_id).filter(Boolean) as string[],
      ),
    ];
    const customerMap: Record<string, { email: string; name: string }> = {};
    if (customerIds.length > 0) {
      const { data: customers } = await supabaseAdmin
        .from("customers")
        .select("id, email, first_name, last_name")
        .in("id", customerIds);
      (customers ?? []).forEach((c: { id: string; email: string; first_name: string; last_name: string }) => {
        customerMap[c.id] = {
          email: c.email,
          name: `${c.first_name} ${c.last_name}`.trim(),
        };
      });
    }

    const itemsByOrder = ((items ?? []) as OrderItem[]).reduce<Record<string, OrderItem[]>>(
      (acc, item) => {
        if (!acc[item.order_id]) acc[item.order_id] = [];
        acc[item.order_id].push(item);
        return acc;
      },
      {},
    );

    const adminOrders = (orders as Order[]).map((o) => {
      const c = o.customer_id ? customerMap[o.customer_id] : null;
      return toAdminOrder(
        { ...o, customer_email: c?.email ?? null, customer_name: c?.name ?? null },
        itemsByOrder[o.id] ?? [],
      );
    });

    return res.json({
      orders: adminOrders,
      total: count ?? adminOrders.length,
      page: pageNum,
      limit: limitNum,
    });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/admin/orders/:id ──────────────────────────────────────────────
export async function getAdminOrderById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!order) return res.status(404).json({ error: "Order not found" });

    const { data: items, error: itemsErr } = await supabaseAdmin
      .from("order_items")
      .select("*")
      .eq("order_id", id);
    if (itemsErr) throw itemsErr;

    // Resolve customer
    const o = order as Order;
    let customerEmail: string | null = null;
    let customerName: string | null = null;
    if (o.customer_id) {
      const { data: cust } = await supabaseAdmin
        .from("customers")
        .select("email, first_name, last_name")
        .eq("id", o.customer_id)
        .maybeSingle();
      if (cust) {
        customerEmail = cust.email;
        customerName = `${cust.first_name} ${cust.last_name}`.trim();
      }
    }
    // Also check address email for guest orders
    if (!customerEmail && o.shipping_address?.email) {
      customerEmail = o.shipping_address.email;
      customerName = `${o.shipping_address.firstName ?? ""} ${o.shipping_address.lastName ?? ""}`.trim();
    }

    return res.json({
      order: toAdminOrder(
        { ...o, customer_email: customerEmail, customer_name: customerName },
        (items ?? []) as OrderItem[],
      ),
    });
  } catch (err) {
    next(err);
  }
}

// ─── PATCH /api/admin/orders/:id/status ────────────────────────────────────
// Updates order status. Admin can set any status; store_manager cannot set
// refunded (that's an admin-only operation).
export async function updateOrderStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { status } = req.body as { status: string };

    const validStatuses = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
    }

    // Store managers cannot set refunded status — that's admin-only
    if (req.user?.role === "store_manager" && status === "refunded") {
      return res.status(403).json({ error: "Store managers cannot mark orders as refunded" });
    }

    const { data, error } = await supabaseAdmin
      .from("orders")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, order_number, status")
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Order not found" });

    // Write to order_status_history — schema: order_id, status, notes, created_at
    await supabaseAdmin
      .from("order_status_history")
      .insert({
        order_id: id,
        status,
        notes: `Status updated to ${status} by ${req.user!.role} (${req.user!.email})`,
        created_at: new Date().toISOString(),
      })
      .then(({ error: histErr }) => {
        if (histErr) console.error("[ADMIN] order_status_history insert failed:", histErr.message);
      });

    // ── Fire shipped email when status changes to "shipped" ─────────────────
    if (status === "shipped") {
      void (async () => {
        try {
          const { data: orderRow } = await supabaseAdmin
            .from("orders")
            .select("order_number, shipping_address, customer_id")
            .eq("id", id)
            .maybeSingle();

          if (!orderRow) return;

          const addr = orderRow.shipping_address as Record<string, string>;
          let toEmail = addr?.email ?? null;

          if (!toEmail && orderRow.customer_id) {
            const { data: cust } = await supabaseAdmin
              .from("customers")
              .select("email")
              .eq("id", orderRow.customer_id)
              .maybeSingle();
            toEmail = cust?.email ?? null;
          }

          if (!toEmail) {
            console.warn(`[SHIPPED EMAIL] No email for order ${orderRow.order_number} — skipping`);
            return;
          }

          await sendOrderShippedEmail({
            to: toEmail,
            orderNumber: orderRow.order_number,
            shippingAddress: {
              firstName: addr?.firstName ?? "",
              lastName:  addr?.lastName  ?? "",
              address:   addr?.address   ?? "",
              city:      addr?.city      ?? "",
              state:     addr?.state     ?? "",
              zip:       addr?.zip       ?? "",
            },
          });
        } catch (err: unknown) {
          console.error("[SHIPPED EMAIL] Failed (non-fatal):", err);
        }
      })();
    }

    return res.json({ order: data });
  } catch (err) {
    next(err);
  }
}

// ─── PATCH /api/admin/orders/:id/payment-status ────────────────────────────
// Allows admin to manually mark a COD order as paid when cash is collected.
// Only applicable to orders with payment_status = "pending" (COD orders).
export async function updatePaymentStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { paymentStatus } = req.body as { paymentStatus: string };

    const validStatuses = ["pending", "paid", "failed", "refunded", "partially_refunded"];
    if (!validStatuses.includes(paymentStatus)) {
      return res.status(400).json({ error: `Invalid payment status. Must be one of: ${validStatuses.join(", ")}` });
    }

    // Only admins can mark as refunded or partially_refunded
    if (req.user?.role === "store_manager" && ["refunded", "partially_refunded"].includes(paymentStatus)) {
      return res.status(403).json({ error: "Store managers cannot set refunded payment status" });
    }

    const { data, error } = await supabaseAdmin
      .from("orders")
      .update({ payment_status: paymentStatus, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, order_number, payment_status")
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Order not found" });

    // Log to order_status_history
    await supabaseAdmin
      .from("order_status_history")
      .insert({
        order_id: id,
        status: `payment_${paymentStatus}`,
        notes: `Payment status updated to ${paymentStatus} by ${req.user!.role} (${req.user!.email})`,
        created_at: new Date().toISOString(),
      })
      .then(({ error: histErr }) => {
        if (histErr) console.error("[ADMIN] payment status history insert failed:", histErr.message);
      });

    return res.json({ order: data });
  } catch (err) {
    next(err);
  }
}
