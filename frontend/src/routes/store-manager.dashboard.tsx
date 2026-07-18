import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { LayoutDashboard, Package, Eye, LogOut, Search } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "sonner";
import { DashboardShell, DashCard, StatCard, type NavItem } from "@/components/dashboard/DashboardShell";
import { TimeFilter } from "@/components/dashboard/TimeFilter";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useAuth } from "@/context/AuthContext";
import {
  adminGetOrders, adminGetOrderById, adminUpdateOrderStatus,
  adminGetProducts, adminGetAnalyticsSummary, adminGetAnalyticsSeries,
  type AdminOrder, type AdminProduct, type AdminStats,
  type AdminRevenueSeries, type AdminPeriod,
} from "@/lib/api-client";

type Tab = "overview" | "orders" | "products";

export const Route = createFileRoute("/store-manager/dashboard")({
  head: () => ({ meta: [
    { title: "Store Manager — CutHaven" },
    { name: "description", content: "Store manager operations panel." },
    { name: "robots", content: "noindex" },
  ] }),
  component: StoreManagerDashboard,
});

function StoreManagerDashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const nav = useNavigate();
  const { logout } = useAuth();
  const handleLogout = async () => { await logout(); nav({ to: "/account/login" }); };
  const items: NavItem[] = [
    { key: "overview", label: "Overview", icon: LayoutDashboard },
    { key: "orders",   label: "Orders",   icon: Package },
    { key: "products", label: "Products", icon: Eye },
    { key: "logout",   label: "Logout",   icon: LogOut, onClick: handleLogout },
  ];
  const titles: Record<Tab, string> = { overview: "Overview", orders: "Orders", products: "Products (view only)" };
  return (
    <RequireAuth roles={["store_manager"]}>
      <DashboardShell title={titles[tab]} sidebarTitle="Store Manager" nav={items} activeKey={tab} onSelect={(k) => setTab(k as Tab)}>
        {tab === "overview" && <SMOverview />}
        {tab === "orders"   && <SMOrders />}
        {tab === "products" && <SMProducts />}
      </DashboardShell>
    </RequireAuth>
  );
}

function Spinner() {
  return <div className="flex justify-center py-12"><div className="h-7 w-7 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div>;
}

function SMOverview() {
  const [period, setPeriod] = useState<AdminPeriod>("today");
  const [stats, setStats]   = useState<AdminStats | null>(null);
  const [series, setSeries] = useState<AdminRevenueSeries[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p: AdminPeriod) => {
    setLoading(true);
    try {
      const [sumRes, serRes, ordRes] = await Promise.all([
        adminGetAnalyticsSummary(p),
        adminGetAnalyticsSeries(p),
        adminGetOrders({ limit: 8 }),
      ]);
      setStats(sumRes.stats);
      setSeries(serRes.series);
      setOrders(ordRes.orders);
    } catch (e: any) { toast.error(e.message ?? "Failed to load overview"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(period); }, [period, load]);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex justify-end"><TimeFilter value={period} onChange={(p) => setPeriod(p as AdminPeriod)} /></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Orders"     value={stats?.orders ?? 0}     accent="#2D6A4F" />
        <StatCard label="Pending"    value={stats?.pending ?? 0}    accent="#E07B1A" />
        <StatCard label="Processing" value={stats?.processing ?? 0} accent="#2D6A4F" />
        <StatCard label="Shipped"    value={stats?.shipped ?? 0}    accent="#4A90E2" />
      </div>
      <DashCard>
        <h3 className="font-display text-lg font-bold mb-4">Orders per Day</h3>
        <div className="h-64">
          <ResponsiveContainer><BarChart data={series}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="label" fontSize={11} /><YAxis fontSize={11} />
            <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--color-border)" }} />
            <Bar dataKey="orders" fill="#E07B1A" radius={[6,6,0,0]} />
          </BarChart></ResponsiveContainer>
        </div>
      </DashCard>
      <DashCard>
        <h3 className="font-display text-lg font-bold mb-4">Recent Orders</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-text-secondary border-b border-border">
              <th className="py-2 pr-3">Order #</th><th className="py-2 pr-3">Customer</th>
              <th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Status</th>
            </tr></thead>
            <tbody>{orders.map((o) => (
              <tr key={o.id} className="border-b border-border">
                <td className="py-2.5 pr-3 font-mono">{o.orderNumber}</td>
                <td className="py-2.5 pr-3">{o.customerName ?? o.customerEmail ?? "Guest"}</td>
                <td className="py-2.5 pr-3">{o.createdAt.slice(0,10)}</td>
                <td className="py-2.5 pr-3"><StatusBadge status={o.status as any} /></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </DashCard>
    </div>
  );
}

function SMOrders() {
  const [orders, setOrders]   = useState<AdminOrder[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState("All");
  const [q, setQ]             = useState("");
  const [detail, setDetail]   = useState<AdminOrder | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminGetOrders({ status: filter !== "All" ? filter.toLowerCase() : undefined, search: q || undefined, limit: 50 });
      setOrders(res.orders); setTotal(res.total);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [filter, q]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string, status: AdminOrder["status"]) => {
    try {
      await adminUpdateOrderStatus(id, status);
      setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status } : o));
      if (detail?.id === id) setDetail((d) => d ? { ...d, status } : d);
      toast.success(`Status → ${status}`);
    } catch (e: any) { toast.error(e.message); }
  };

  const statuses = ["All","pending","confirmed","processing","shipped","delivered","cancelled"];

  return (
    <>
      <DashCard>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {statuses.map((s) => {
            const count = s === "All" ? total : orders.filter((o) => o.status === s).length;
            return <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize ${filter === s ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-primary/10"}`}>{s} ({count})</button>;
          })}
        </div>
        <div className="relative max-w-sm mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} placeholder="Search order # or customer" className="w-full pl-9 pr-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary" />
        </div>
        {loading ? <Spinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-text-secondary border-b border-border">
                <th className="py-2 pr-3">Order #</th><th className="py-2 pr-3">Customer</th>
                <th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Total</th><th className="py-2">Actions</th>
              </tr></thead>
              <tbody>{orders.map((o) => (
                <tr key={o.id} className="border-b border-border">
                  <td className="py-3 pr-3 font-mono">{o.orderNumber}</td>
                  <td className="py-3 pr-3">{o.customerName ?? o.customerEmail ?? "Guest"}</td>
                  <td className="py-3 pr-3">{o.createdAt.slice(0,10)}</td>
                  <td className="py-3 pr-3"><StatusBadge status={o.status as any} /></td>
                  <td className="py-3 pr-3 font-semibold">${o.total.toFixed(2)}</td>
                  <td className="py-3">
                    <div className="flex gap-1">
                      <button onClick={() => setDetail(o)} className="p-1.5 hover:bg-muted rounded"><Eye className="h-4 w-4" /></button>
                      <select value={o.status} onChange={(e) => updateStatus(o.id, e.target.value as AdminOrder["status"])} className="text-xs border border-border rounded px-1.5 py-1 bg-surface">
                        {["pending","confirmed","processing","shipped","delivered","cancelled"].map((s) => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </DashCard>
      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader><DialogTitle>Order {detail.orderNumber}</DialogTitle></DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="flex justify-between items-center">
                  <span>{detail.customerName ?? detail.customerEmail ?? "Guest"}</span>
                  <StatusBadge status={detail.status as any} />
                </div>
                <div className="space-y-2">{detail.items.map((it) => (
                  <div key={it.id} className="flex gap-3 items-center border-b border-border pb-2">
                    {it.productImage && <img src={it.productImage} alt="" className="h-12 w-12 rounded" />}
                    <div className="flex-1"><p className="font-medium">{it.productName}</p><p className="text-xs text-text-secondary">Qty {it.quantity}</p></div>
                    <p className="font-semibold">${it.totalPrice.toFixed(2)}</p>
                  </div>
                ))}</div>
                <div className="pt-3 border-t border-border">
                  <p className="font-semibold mb-1">Shipping Address</p>
                  <p className="text-text-secondary">{detail.shippingAddress.address}, {detail.shippingAddress.city}, {detail.shippingAddress.state} {detail.shippingAddress.zip}</p>
                </div>
                <div className="pt-2">
                  <label className="block text-xs font-medium mb-1">Update Status</label>
                  <select value={detail.status} onChange={(e) => updateStatus(detail.id, e.target.value as AdminOrder["status"])} className="text-sm border border-border rounded px-2 py-1.5 bg-surface">
                    {["pending","confirmed","processing","shipped","delivered","cancelled"].map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function SMProducts() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    adminGetProducts({ limit: 200 }).then((r) => setProducts(r.products)).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  }, []);

  return (
    <DashCard>
      {loading ? <Spinner /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-text-secondary border-b border-border">
              <th className="py-2 pr-3">Image</th><th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">SKU</th><th className="py-2 pr-3">Category</th>
              <th className="py-2 pr-3">Price</th><th className="py-2 pr-3">Stock</th><th className="py-2">Status</th>
            </tr></thead>
            <tbody>{products.map((p) => (
              <tr key={p.id} className="border-b border-border">
                <td className="py-3 pr-3"><img src={p.primaryImageUrl} alt="" className="h-10 w-10 rounded object-cover" /></td>
                <td className="py-3 pr-3 font-medium max-w-[300px] truncate">{p.name}</td>
                <td className="py-3 pr-3 font-mono text-xs">{p.sku ?? "—"}</td>
                <td className="py-3 pr-3">{p.categoryName ?? "—"}</td>
                <td className="py-3 pr-3 font-semibold">${p.price}</td>
                <td className="py-3 pr-3">{p.stockQuantity}</td>
                <td className="py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${p.isActive ? "bg-success/10 text-success" : "bg-muted text-text-secondary"}`}>{p.isActive ? "Active" : "Inactive"}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </DashCard>
  );
}
