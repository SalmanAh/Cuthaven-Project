import type { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../config/supabase.js";
import type {
  AdminStats,
  AdminRevenueSeries,
  AdminStatusDistribution,
  AdminPeriod,
} from "../types/admin.js";

// ─── Helpers ───────────────────────────────────────────────────────────────

function periodBounds(period: AdminPeriod): { start: Date; prevStart: Date; prevEnd: Date } {
  const now = new Date();
  let start: Date;
  let prevStart: Date;
  let prevEnd: Date;

  switch (period) {
    case "today":
      start = new Date(now); start.setHours(0, 0, 0, 0);
      prevEnd = new Date(start);
      prevStart = new Date(start); prevStart.setDate(prevStart.getDate() - 1);
      break;
    case "7days":
      start = new Date(now); start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0);
      prevEnd = new Date(start);
      prevStart = new Date(start); prevStart.setDate(prevStart.getDate() - 7);
      break;
    case "month":
      start = new Date(now); start.setDate(1); start.setHours(0, 0, 0, 0);
      prevEnd = new Date(start);
      prevStart = new Date(start); prevStart.setMonth(prevStart.getMonth() - 1);
      break;
    case "annual":
    default:
      start = new Date(now); start.setMonth(0, 1); start.setHours(0, 0, 0, 0);
      prevEnd = new Date(start);
      prevStart = new Date(start); prevStart.setFullYear(prevStart.getFullYear() - 1);
      break;
  }
  return { start, prevStart, prevEnd };
}

function trend(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

// ─── GET /api/admin/analytics/summary ─────────────────────────────────────
export async function getAdminAnalytics(req: Request, res: Response, next: NextFunction) {
  try {
    const period = (req.query.period as AdminPeriod) ?? "today";
    const validPeriods: AdminPeriod[] = ["today", "7days", "month", "annual"];
    if (!validPeriods.includes(period)) {
      return res.status(400).json({ error: "period must be one of: today, 7days, month, annual" });
    }

    const { start, prevStart, prevEnd } = periodBounds(period);
    const startIso = start.toISOString();
    const prevStartIso = prevStart.toISOString();
    const prevEndIso = prevEnd.toISOString();

    // Current period orders (paid only for revenue)
    const { data: currentOrders, error: curErr } = await supabaseAdmin
      .from("orders")
      .select("id, status, payment_status, total, customer_id, created_at")
      .gte("created_at", startIso);
    if (curErr) throw curErr;

    // Previous period orders
    const { data: prevOrders, error: prevErr } = await supabaseAdmin
      .from("orders")
      .select("id, status, payment_status, total, customer_id, created_at")
      .gte("created_at", prevStartIso)
      .lt("created_at", prevEndIso);
    if (prevErr) throw prevErr;

    const cur = currentOrders ?? [];
    const prev = prevOrders ?? [];

    // Revenue = sum of paid orders
    const paidCur = cur.filter((o: { payment_status: string }) => o.payment_status === "paid");
    const paidPrev = prev.filter((o: { payment_status: string }) => o.payment_status === "paid");

    const curRevenue = paidCur.reduce((s: number, o: { total: number }) => s + o.total, 0);
    const prevRevenue = paidPrev.reduce((s: number, o: { total: number }) => s + o.total, 0);
    const curOrders = cur.length;
    const prevOrdersCount = prev.length;
    const curAov = paidCur.length > 0 ? curRevenue / paidCur.length : 0;
    const prevAov = paidPrev.length > 0 ? prevRevenue / paidPrev.length : 0;

    // Unique customers in period
    const curCustIds = new Set(
      cur.map((o: { customer_id: string | null }) => o.customer_id).filter(Boolean),
    );
    const prevCustIds = new Set(
      prev.map((o: { customer_id: string | null }) => o.customer_id).filter(Boolean),
    );

    // Status counts (current period, all payment statuses)
    const statusCount = (status: string) =>
      cur.filter((o: { status: string }) => o.status === status).length;

    const stats: AdminStats = {
      revenue: Math.round(curRevenue * 100) / 100,
      orders: curOrders,
      customers: curCustIds.size,
      avgOrder: Math.round(curAov * 100) / 100,
      pending: statusCount("pending"),
      confirmed: statusCount("confirmed"),
      processing: statusCount("processing"),
      shipped: statusCount("shipped"),
      delivered: statusCount("delivered"),
      cancelled: statusCount("cancelled"),
      revTrend: trend(curRevenue, prevRevenue),
      ordTrend: trend(curOrders, prevOrdersCount),
      custTrend: trend(curCustIds.size, prevCustIds.size),
      aovTrend: trend(curAov, prevAov),
    };

    return res.json({ stats, period });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/admin/analytics/series ──────────────────────────────────────
// Returns revenue + order counts bucketed by time label for charts.
export async function getAdminRevenueSeries(req: Request, res: Response, next: NextFunction) {
  try {
    const period = (req.query.period as AdminPeriod) ?? "today";
    const { start } = periodBounds(period);

    const { data: orders, error } = await supabaseAdmin
      .from("orders")
      .select("total, payment_status, status, created_at")
      .gte("created_at", start.toISOString())
      .order("created_at", { ascending: true });
    if (error) throw error;

    const paid = (orders ?? []).filter((o: { payment_status: string }) => o.payment_status === "paid");

    // Build label extractor based on period
    const getLabel = (iso: string): string => {
      const d = new Date(iso);
      if (period === "today") {
        const h = d.getHours();
        const suffix = h < 12 ? "am" : "pm";
        return `${h === 0 ? 12 : h > 12 ? h - 12 : h}${suffix}`;
      }
      if (period === "7days") {
        return d.toLocaleDateString("en-US", { weekday: "short" });
      }
      if (period === "month") {
        return String(d.getDate());
      }
      return d.toLocaleDateString("en-US", { month: "short" });
    };

    const seriesMap: Record<string, { revenue: number; orders: number }> = {};
    paid.forEach((o: { total: number; created_at: string }) => {
      const label = getLabel(o.created_at);
      if (!seriesMap[label]) seriesMap[label] = { revenue: 0, orders: 0 };
      seriesMap[label].revenue += o.total;
      seriesMap[label].orders += 1;
    });

    const series: AdminRevenueSeries[] = Object.entries(seriesMap).map(
      ([label, v]) => ({ label, revenue: Math.round(v.revenue * 100) / 100, orders: v.orders }),
    );

    // Status distribution for pie chart
    const all = orders ?? [];
    const statusColors: Record<string, string> = {
      pending: "#E07B1A", confirmed: "#4A90E2", processing: "#2D6A4F",
      shipped: "#4A90E2", delivered: "#1B4332", cancelled: "#EF4444",
    };
    const distMap: Record<string, number> = {};
    all.forEach((o: { status: string }) => {
      distMap[o.status] = (distMap[o.status] ?? 0) + 1;
    });
    const distribution: AdminStatusDistribution[] = Object.entries(distMap).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: statusColors[name] ?? "#9CA3AF",
    }));

    return res.json({ series, distribution, period });
  } catch (err) {
    next(err);
  }
}
