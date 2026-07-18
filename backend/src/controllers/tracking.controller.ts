import type { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../config/supabase.js";

// ─── GET /api/orders/track?orderNumber=CUT-XXX&email=x@y.com ───────────────
// Public endpoint — no auth required. Guest-accessible by design.
// Returns enough info to show status + items without exposing sensitive data.
export async function trackOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const { orderNumber, email } = req.query as { orderNumber?: string; email?: string };

    if (!orderNumber?.trim() || !email?.trim()) {
      return res.status(400).json({ error: "orderNumber and email are required" });
    }

    const normalOrder = orderNumber.trim().toUpperCase();
    const normalEmail = email.trim().toLowerCase();

    // Find order by order_number — then verify email matches shipping_address.email
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select(`
        id, order_number, status, payment_status,
        subtotal, shipping_cost, tax_amount, discount_amount, total,
        shipping_address, created_at, updated_at, customer_id
      `)
      .eq("order_number", normalOrder)
      .maybeSingle();

    if (error) throw error;

    if (!order) {
      return res.status(404).json({ error: "Order not found. Check your order number and try again." });
    }

    // Verify the email matches — compare against shipping_address.email first,
    // then fall back to the customer's account email.
    const addrEmail = (order.shipping_address?.email ?? "").toLowerCase();
    let emailMatches = addrEmail === normalEmail;

    if (!emailMatches && order.customer_id) {
      // Check customer account email
      const { data: cust } = await supabaseAdmin
        .from("customers")
        .select("email")
        .eq("id", order.customer_id)
        .maybeSingle();
      if (cust && cust.email.toLowerCase() === normalEmail) emailMatches = true;
    }

    if (!emailMatches) {
      // Return same 404 to avoid order number enumeration
      return res.status(404).json({ error: "Order not found. Check your order number and try again." });
    }

    // Fetch order items (denormalised — safe to return)
    const { data: items } = await supabaseAdmin
      .from("order_items")
      .select("product_name, product_slug, product_image, quantity, unit_price, total_price")
      .eq("order_id", order.id);

    // Fetch status history
    const { data: history } = await supabaseAdmin
      .from("order_status_history")
      .select("status, notes, created_at")
      .eq("order_id", order.id)
      .order("created_at", { ascending: true });

    return res.json({
      order: {
        orderNumber: order.order_number,
        status: order.status,
        paymentStatus: order.payment_status,
        subtotal: order.subtotal,
        shippingCost: order.shipping_cost,
        taxAmount: order.tax_amount,
        discountAmount: order.discount_amount,
        total: order.total,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        shippingAddress: {
          firstName: order.shipping_address?.firstName ?? "",
          lastName:  order.shipping_address?.lastName  ?? "",
          address:   order.shipping_address?.address   ?? "",
          city:      order.shipping_address?.city      ?? "",
          state:     order.shipping_address?.state     ?? "",
          zip:       order.shipping_address?.zip       ?? "",
          country:   order.shipping_address?.country   ?? "US",
        },
      },
      items: (items ?? []),
      history: (history ?? []),
    });
  } catch (err) {
    next(err);
  }
}
