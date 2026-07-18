import type { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../config/supabase.js";
import type { AdminCustomer } from "../types/admin.js";

// ─── GET /api/admin/customers ──────────────────────────────────────────────
// Returns paginated customer list with order count and total spent aggregated
// from the orders table.
export async function listAllCustomers(req: Request, res: Response, next: NextFunction) {
  try {
    const { search, page = "1", limit = "50" } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    let query = supabaseAdmin
      .from("customers")
      .select("id, auth_id, email, first_name, last_name, phone, is_active, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (search) {
      query = query.or(
        `email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`,
      );
    }

    const { data: customers, error, count } = await query;
    if (error) throw error;
    if (!customers || customers.length === 0) {
      return res.json({ customers: [], total: 0, page: pageNum, limit: limitNum });
    }

    // ── Aggregate order counts + total spent per customer ────────────────────
    const customerIds = (customers as Array<{ id: string }>).map((c) => c.id);
    const { data: orderAgg } = await supabaseAdmin
      .from("orders")
      .select("customer_id, total, payment_status")
      .in("customer_id", customerIds)
      .eq("payment_status", "paid");

    const aggMap: Record<string, { ordersCount: number; totalSpent: number }> = {};
    (orderAgg ?? []).forEach((o: { customer_id: string; total: number }) => {
      if (!aggMap[o.customer_id]) aggMap[o.customer_id] = { ordersCount: 0, totalSpent: 0 };
      aggMap[o.customer_id].ordersCount += 1;
      aggMap[o.customer_id].totalSpent += o.total;
    });

    const result: AdminCustomer[] = (
      customers as Array<{
        id: string;
        auth_id: string;
        email: string;
        first_name: string;
        last_name: string;
        phone: string | null;
        is_active: boolean;
        created_at: string;
      }>
    ).map((c) => ({
      id: c.id,
      authId: c.auth_id,
      email: c.email,
      firstName: c.first_name,
      lastName: c.last_name,
      phone: c.phone,
      isActive: c.is_active,
      createdAt: c.created_at,
      ordersCount: aggMap[c.id]?.ordersCount ?? 0,
      totalSpent: aggMap[c.id]?.totalSpent ?? 0,
    }));

    return res.json({
      customers: result,
      total: count ?? result.length,
      page: pageNum,
      limit: limitNum,
    });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/admin/customers/:id ─────────────────────────────────────────
// Returns a single customer with their full order history.
export async function getAdminCustomerById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const { data: customer, error } = await supabaseAdmin
      .from("customers")
      .select("id, auth_id, email, first_name, last_name, phone, is_active, created_at")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const c = customer as {
      id: string; auth_id: string; email: string; first_name: string;
      last_name: string; phone: string | null; is_active: boolean; created_at: string;
    };

    // Fetch their orders
    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, status, payment_status, total, created_at")
      .eq("customer_id", id)
      .order("created_at", { ascending: false });

    const paidOrders = (orders ?? []).filter((o: { payment_status: string }) => o.payment_status === "paid");
    const totalSpent = paidOrders.reduce((sum: number, o: { total: number }) => sum + o.total, 0);

    return res.json({
      customer: {
        id: c.id,
        authId: c.auth_id,
        email: c.email,
        firstName: c.first_name,
        lastName: c.last_name,
        phone: c.phone,
        isActive: c.is_active,
        createdAt: c.created_at,
        ordersCount: orders?.length ?? 0,
        totalSpent,
      } satisfies AdminCustomer,
      orders: orders ?? [],
    });
  } catch (err) {
    next(err);
  }
}
