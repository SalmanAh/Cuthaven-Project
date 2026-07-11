import type { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../config/supabase.js";
import { toPublicOrder, type Order, type OrderItem } from "../types/order.js";

// GET /api/orders/my
// Returns all orders belonging to the authenticated customer.
export async function getMyOrders(req: Request, res: Response, next: NextFunction) {
  try {
    // req.user is populated by requireAuth middleware — auth_id is the Supabase UUID
    const authId = req.user!.id;

    // Look up the customers.id (our internal UUID) from the auth_id
    const { data: customer, error: custError } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("auth_id", authId)
      .maybeSingle();

    if (custError) throw custError;
    if (!customer) return res.json({ orders: [] });

    // Fetch orders for this customer, newest first
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false });

    if (ordersError) throw ordersError;
    if (!orders || orders.length === 0) return res.json({ orders: [] });

    // Fetch all items for these orders in one query
    const orderIds = (orders as Order[]).map((o) => o.id);
    const { data: items, error: itemsError } = await supabaseAdmin
      .from("order_items")
      .select("*")
      .in("order_id", orderIds);

    if (itemsError) throw itemsError;

    const itemsByOrder = ((items ?? []) as OrderItem[]).reduce<Record<string, OrderItem[]>>(
      (acc, item) => {
        if (!acc[item.order_id]) acc[item.order_id] = [];
        acc[item.order_id].push(item);
        return acc;
      },
      {},
    );

    const publicOrders = (orders as Order[]).map((o) =>
      toPublicOrder(o, itemsByOrder[o.id] ?? []),
    );

    return res.json({ orders: publicOrders });
  } catch (err) {
    next(err);
  }
}

// GET /api/orders/my/:id
// Returns a single order by ID — only if it belongs to the authenticated customer.
export async function getMyOrderById(req: Request, res: Response, next: NextFunction) {
  try {
    const authId = req.user!.id;
    const { id } = req.params;

    const { data: customer, error: custError } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("auth_id", authId)
      .maybeSingle();

    if (custError) throw custError;
    if (!customer) return res.status(404).json({ error: "Order not found" });

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", id)
      .eq("customer_id", customer.id) // ownership check — can't fetch another customer's order
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order) return res.status(404).json({ error: "Order not found" });

    const { data: items, error: itemsError } = await supabaseAdmin
      .from("order_items")
      .select("*")
      .eq("order_id", id);

    if (itemsError) throw itemsError;

    return res.json({ order: toPublicOrder(order as Order, (items ?? []) as OrderItem[]) });
  } catch (err) {
    next(err);
  }
}
