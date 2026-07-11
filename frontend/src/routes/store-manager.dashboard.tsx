import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { LayoutDashboard, Package, Eye, LogOut, Search } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "sonner";
import { DashboardShell, DashCard, StatCard, type NavItem } from "@/components/dashboard/DashboardShell";
import { TimeFilter } from "@/components/dashboard/TimeFilter";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { mockOrders, type Order, type OrderStatus } from "@/data/orders";
import { products } from "@/data/products";
import { periodStats, revenueSeries, type Period } from "@/data/analytics";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useAuth } from "@/context/AuthContext";

type Tab = "overview" | "orders" | "products";

export const Route = createFileRoute("/store-manager/dashboard")({
  head: () => ({ meta: [
    { title: "Store Manager — CutHaven" },
    { name: "description", content: "Store manager operations panel." },
    { property: "og:title", content: "Store Manager — CutHaven" },
    { property: "og:description", content: "Store manager operations panel." },
    { name: "robots", content: "noindex" },
  ] }),
  component: StoreManagerDashboard,
});

function StoreManagerDashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const nav = useNavigate();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    nav({ to: "/account/login" });
  };

  const items: NavItem[] = [
    { key: "overview", label: "Overview", icon: LayoutDashboard },
    { key: "orders", label: "Orders", icon: Package },
    { key: "products", label: "Products", icon: Eye },
    { key: "logout", label: "Logout", icon: LogOut, onClick: handleLogout },
  ];
  const titles: Record<Tab, string> = { overview: "Overview", orders: "Orders", products: "Products (view only)" };
  return (
    <RequireAuth roles={["store_manager"]}>
      <DashboardShell title={titles[tab]} sidebarTitle="Store Manager" nav={items} activeKey={tab} onSelect={(k) => setTab(k as Tab)}>
        {tab === "overview" && <SMOverview />}
        {tab === "orders" && <SMOrders />}
        {tab === "products" && <SMProducts />}
      </DashboardShell>
    </RequireAuth>
  );
}

function SMOverview() {
  const [period, setPeriod] = useState<Period>("today");
  const s = periodStats[period];
  const series = revenueSeries[period];
  return (
    <div className="space-y-6">
      <div className="flex justify-end"><TimeFilter value={period} onChange={setPeriod} /></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Orders" value={s.orders} accent="#2D6A4F" />
        <StatCard label="Pending" value={s.pending} accent="#E07B1A" />
        <StatCard label="Processing" value={s.processing} accent="#2D6A4F" />
        <StatCard label="Shipped" value={s.shipped} accent="#4A90E2" />
      </div>
      <DashCard>
        <h3 className="font-display text-lg font-bold mb-4">Orders per Day</h3>
        <div className="h-64">
          <ResponsiveContainer><BarChart data={series}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="label" fontSize={11} /><YAxis fontSize={11} />
            <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--color-border)" }} />
            <Bar dataKey="orders" fill="#E07B1A" radius={[6, 6, 0, 0]} />
          </BarChart></ResponsiveContainer>
        </div>
      </DashCard>
      <DashCard>
        <h3 className="font-display text-lg font-bold mb-4">Recent Orders</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-text-secondary border-b border-border"><th className="py-2 pr-3">Order #</th><th className="py-2 pr-3">Customer</th><th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Status</th></tr></thead>
            <tbody>{mockOrders.slice(0, 8).map((o) => (
              <tr key={o.id} className="border-b border-border"><td className="py-2.5 pr-3 font-mono">{o.id}</td><td className="py-2.5 pr-3">{o.customer}</td><td className="py-2.5 pr-3">{o.date}</td><td className="py-2.5 pr-3"><StatusBadge status={o.status} /></td></tr>
            ))}</tbody>
          </table>
        </div>
      </DashCard>
    </div>
  );
}

function SMOrders() {
  const [orders, setOrders] = useState<Order[]>(mockOrders);
  const [filter, setFilter] = useState<OrderStatus | "All">("All");
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<string | null>(null);
  const statuses: (OrderStatus | "All")[] = ["All", "Pending", "Processing", "Shipped", "Delivered", "Cancelled", "Failed"];
  const filtered = orders.filter((o) => (filter === "All" || o.status === filter) && (q === "" || o.id.toLowerCase().includes(q.toLowerCase()) || o.customer.toLowerCase().includes(q.toLowerCase())));
  const detailOrder = detail ? orders.find((o) => o.id === detail) : null;
  return (
    <>
      <DashCard>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {statuses.map((s) => {
            const count = s === "All" ? orders.length : orders.filter((o) => o.status === s).length;
            return <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-full text-xs font-medium ${filter === s ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-primary/10"}`}>{s} ({count})</button>;
          })}
        </div>
        <div className="relative max-w-sm mb-4"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search order # or customer" className="w-full pl-9 pr-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary" /></div>
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-left text-text-secondary border-b border-border"><th className="py-2 pr-3">Order #</th><th className="py-2 pr-3">Customer</th><th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Origin</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Total</th><th className="py-2">Actions</th></tr></thead>
          <tbody>{filtered.map((o) => (
            <tr key={o.id} className="border-b border-border">
              <td className="py-3 pr-3 font-mono">{o.id}</td><td className="py-3 pr-3">{o.customer}</td><td className="py-3 pr-3">{o.date}</td>
              <td className="py-3 pr-3 text-text-secondary">{o.origin}</td><td className="py-3 pr-3"><StatusBadge status={o.status} /></td><td className="py-3 pr-3 font-semibold">${o.total.toFixed(2)}</td>
              <td className="py-3"><div className="flex gap-1">
                <button onClick={() => setDetail(o.id)} className="p-1.5 hover:bg-muted rounded"><Eye className="h-4 w-4" /></button>
                <select value={o.status} onChange={(e) => { setOrders((prev) => prev.map((x) => x.id === o.id ? { ...x, status: e.target.value as OrderStatus } : x)); toast.success(`Status → ${e.target.value}`); }} className="text-xs border border-border rounded px-1.5 py-1 bg-surface">
                  {(["Pending", "Processing", "Shipped", "Delivered", "Cancelled"] as OrderStatus[]).map((s) => <option key={s}>{s}</option>)}
                </select>
              </div></td>
            </tr>))}</tbody>
        </table></div>
      </DashCard>
      <Dialog open={!!detailOrder} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">{detailOrder && (<>
          <DialogHeader><DialogTitle>Order {detailOrder.id}</DialogTitle></DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="flex justify-between items-center"><span>{detailOrder.customer}</span><StatusBadge status={detailOrder.status} /></div>
            <div className="space-y-2">{detailOrder.items.map((it, i) => (
              <div key={i} className="flex gap-3 items-center border-b border-border pb-2">
                <img src={it.image} alt="" className="h-12 w-12 rounded" />
                <div className="flex-1"><p className="font-medium">{it.name}</p><p className="text-xs text-text-secondary">Qty {it.quantity}</p></div>
              </div>))}</div>
            <div className="pt-3 border-t border-border">
              <p className="font-semibold mb-1">Shipping Address</p>
              <p className="text-text-secondary">{detailOrder.address.line1}, {detailOrder.address.city}, {detailOrder.address.state} {detailOrder.address.zip}</p>
              <p className="text-text-secondary">{detailOrder.address.phone}</p>
            </div>
          </div>
        </>)}</DialogContent>
      </Dialog>
    </>
  );
}

function SMProducts() {
  return (
    <DashCard>
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="text-left text-text-secondary border-b border-border"><th className="py-2 pr-3">Image</th><th className="py-2 pr-3">Name</th><th className="py-2 pr-3">SKU</th><th className="py-2 pr-3">Category</th><th className="py-2 pr-3">Price</th><th className="py-2 pr-3">Stock</th><th className="py-2">Status</th></tr></thead>
        <tbody>{products.map((p) => (
          <tr key={p.id} className="border-b border-border">
            <td className="py-3 pr-3"><img src={p.images[0]} alt="" className="h-10 w-10 rounded object-cover" /></td>
            <td className="py-3 pr-3 font-medium max-w-[300px] truncate">{p.name}</td>
            <td className="py-3 pr-3 font-mono text-xs">{p.sku}</td>
            <td className="py-3 pr-3">{p.category}</td>
            <td className="py-3 pr-3 font-semibold">${p.price}</td>
            <td className="py-3 pr-3">{p.inStock ? "In stock" : "Out"}</td>
            <td className="py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${p.inStock ? "bg-success/10 text-success" : "bg-muted"}`}>{p.inStock ? "Active" : "Inactive"}</span></td>
          </tr>))}</tbody>
      </table></div>
    </DashCard>
  );
}
