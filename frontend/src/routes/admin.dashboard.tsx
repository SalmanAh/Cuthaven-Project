import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { LayoutDashboard, Package, ShoppingBag, FolderOpen, Users, UserCog, Settings, LogOut, Search, Eye, Pencil, Trash2, Plus, MoreVertical } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { toast } from "sonner";
import { DashboardShell, DashCard, StatCard, type NavItem } from "@/components/dashboard/DashboardShell";
import { TimeFilter } from "@/components/dashboard/TimeFilter";
import { StatusBadge, PaymentBadge } from "@/components/dashboard/StatusBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { mockOrders, type Order, type OrderStatus } from "@/data/orders";
import { products as seedProducts, type Product } from "@/data/products";
import { categories as seedCats, type Category } from "@/data/categories";
import { customers } from "@/data/customers";
import { storeManagers as seedSMs, type StoreManager } from "@/data/store-managers";
import { periodStats, revenueSeries, statusDistribution, type Period } from "@/data/analytics";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useAuth } from "@/context/AuthContext";

type Tab = "overview" | "orders" | "products" | "categories" | "customers" | "managers" | "settings";

export const Route = createFileRoute("/admin/dashboard")({
  head: () => ({ meta: [
    { title: "Admin — CutHaven" },
    { name: "description", content: "Admin control panel for CutHaven." },
    { property: "og:title", content: "Admin — CutHaven" },
    { property: "og:description", content: "Admin control panel for CutHaven." },
    { name: "robots", content: "noindex" },
  ] }),
  component: AdminDashboard,
});

function AdminDashboard() {
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
    { key: "products", label: "Products", icon: ShoppingBag },
    { key: "categories", label: "Categories", icon: FolderOpen },
    { key: "customers", label: "Customers", icon: Users },
    { key: "managers", label: "Store Managers", icon: UserCog },
    { key: "settings", label: "Settings", icon: Settings },
    { key: "logout", label: "Logout", icon: LogOut, onClick: handleLogout },
  ];
  const titles: Record<Tab, string> = { overview: "Admin Overview", orders: "Orders", products: "Products", categories: "Categories", customers: "Customers", managers: "Store Managers", settings: "Settings" };
  return (
    <RequireAuth roles={["admin"]}>
      <DashboardShell title={titles[tab]} sidebarTitle="Admin" nav={items} activeKey={tab} onSelect={(k) => setTab(k as Tab)}>
        {tab === "overview" && <Overview />}
        {tab === "orders" && <OrdersPage />}
        {tab === "products" && <ProductsPage />}
        {tab === "categories" && <CategoriesPage />}
        {tab === "customers" && <CustomersPage />}
        {tab === "managers" && <ManagersPage />}
        {tab === "settings" && <SettingsPage />}
      </DashboardShell>
    </RequireAuth>
  );
}

function Overview() {
  const [period, setPeriod] = useState<Period>("today");
  const s = periodStats[period];
  const series = revenueSeries[period];
  const dist = statusDistribution[period];
  const topProducts = [...seedProducts].sort((a, b) => b.reviewCount - a.reviewCount).slice(0, 5);
  return (
    <div className="space-y-6">
      <div className="flex justify-end"><TimeFilter value={period} onChange={setPeriod} /></div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Revenue" value={`$${s.revenue.toLocaleString()}`} trend={s.revTrend} />
        <StatCard label="Total Orders" value={s.orders} trend={s.ordTrend} />
        <StatCard label="Total Customers" value={s.customers} trend={s.custTrend} />
        <StatCard label="Avg Order Value" value={`$${s.avgOrder}`} trend={s.aovTrend} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Pending" value={s.pending} accent="#E07B1A" />
        <StatCard label="Processing" value={s.processing} accent="#2D6A4F" />
        <StatCard label="Shipped" value={s.shipped} accent="#4A90E2" />
        <StatCard label="Delivered" value={s.delivered} accent="#1B4332" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <DashCard className="lg:col-span-2">
          <h3 className="font-display text-lg font-bold mb-4">Revenue</h3>
          <div className="h-64">
            <ResponsiveContainer><AreaChart data={series}>
              <defs><linearGradient id="rev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2D6A4F" stopOpacity={0.4} /><stop offset="100%" stopColor="#2D6A4F" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="label" fontSize={11} stroke="var(--color-text-secondary)" />
              <YAxis fontSize={11} stroke="var(--color-text-secondary)" />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--color-border)" }} />
              <Area type="monotone" dataKey="revenue" stroke="#2D6A4F" strokeWidth={2} fill="url(#rev)" />
            </AreaChart></ResponsiveContainer>
          </div>
        </DashCard>
        <DashCard>
          <h3 className="font-display text-lg font-bold mb-4">Orders by Status</h3>
          <div className="h-64">
            <ResponsiveContainer><PieChart>
              <Pie data={dist} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80}>
                {dist.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip /><Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart></ResponsiveContainer>
          </div>
        </DashCard>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <DashCard className="lg:col-span-2">
          <h3 className="font-display text-lg font-bold mb-4">Orders per Day</h3>
          <div className="h-64">
            <ResponsiveContainer><BarChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="label" fontSize={11} stroke="var(--color-text-secondary)" />
              <YAxis fontSize={11} stroke="var(--color-text-secondary)" />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--color-border)" }} />
              <Bar dataKey="orders" fill="#E07B1A" radius={[6, 6, 0, 0]} />
            </BarChart></ResponsiveContainer>
          </div>
        </DashCard>
        <DashCard>
          <h3 className="font-display text-lg font-bold mb-4">Top Products</h3>
          <ul className="space-y-3">
            {topProducts.map((p) => (
              <li key={p.id} className="flex gap-3 items-center">
                <img src={p.images[0]} alt="" className="h-10 w-10 rounded object-cover" />
                <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{p.name}</p><p className="text-xs text-text-secondary">{p.reviewCount} sold</p></div>
                <span className="text-accent font-semibold text-sm">${p.price}</span>
              </li>
            ))}
          </ul>
        </DashCard>
      </div>

      <DashCard>
        <h3 className="font-display text-lg font-bold mb-4">Recent Orders</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-text-secondary border-b border-border">
              <th className="py-2 pr-3">Order #</th><th className="py-2 pr-3">Customer</th><th className="py-2 pr-3">Date</th>
              <th className="py-2 pr-3">Status</th><th className="py-2">Total</th>
            </tr></thead>
            <tbody>
              {mockOrders.slice(0, 8).map((o) => (
                <tr key={o.id} className="border-b border-border">
                  <td className="py-2.5 pr-3 font-mono">{o.id}</td>
                  <td className="py-2.5 pr-3">{o.customer}</td>
                  <td className="py-2.5 pr-3">{o.date}</td>
                  <td className="py-2.5 pr-3"><StatusBadge status={o.status} /></td>
                  <td className="py-2.5 font-semibold">${o.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DashCard>
    </div>
  );
}

// ---- Orders ----
function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>(mockOrders);
  const [filter, setFilter] = useState<OrderStatus | "All">("All");
  const [payFilter, setPayFilter] = useState<"All" | "Paid" | "Unpaid">("All");
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<string | null>(null);

  const statuses: (OrderStatus | "All")[] = ["All", "Pending", "Processing", "Shipped", "Delivered", "Cancelled", "Failed"];
  const filtered = orders.filter((o) =>
    (filter === "All" || o.status === filter) &&
    (payFilter === "All" || o.payment === payFilter) &&
    (q === "" || o.id.toLowerCase().includes(q.toLowerCase()) || o.customer.toLowerCase().includes(q.toLowerCase()) || o.email.toLowerCase().includes(q.toLowerCase()))
  );
  const detailOrder = detail ? orders.find((o) => o.id === detail) : null;
  const update = (id: string, patch: Partial<Order>) => setOrders((prev) => prev.map((o) => o.id === id ? { ...o, ...patch } : o));

  return (
    <div className="space-y-4">
      <DashCard>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {statuses.map((s) => {
            const count = s === "All" ? orders.length : orders.filter((o) => o.status === s).length;
            return (
              <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-full text-xs font-medium ${filter === s ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-primary/10"}`}>{s} ({count})</button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3 items-center mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search order #, customer, or email" className="w-full pl-9 pr-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary" />
          </div>
          <select value={payFilter} onChange={(e) => setPayFilter(e.target.value as any)} className="px-3 py-2 rounded-lg border border-border text-sm bg-surface">
            <option value="All">All payments</option><option value="Paid">Paid</option><option value="Unpaid">Unpaid</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-text-secondary border-b border-border">
              <th className="py-2 pr-3">Order #</th><th className="py-2 pr-3">Customer</th><th className="py-2 pr-3">Email</th>
              <th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Payment</th>
              <th className="py-2 pr-3">Total</th><th className="py-2">Actions</th>
            </tr></thead>
            <tbody>
              {filtered.slice(0, 20).map((o) => (
                <tr key={o.id} className="border-b border-border">
                  <td className="py-3 pr-3 font-mono">{o.id}</td>
                  <td className="py-3 pr-3">{o.customer}</td>
                  <td className="py-3 pr-3 text-text-secondary">{o.email}</td>
                  <td className="py-3 pr-3">{o.date}</td>
                  <td className="py-3 pr-3"><StatusBadge status={o.status} /></td>
                  <td className="py-3 pr-3"><PaymentBadge status={o.payment} /></td>
                  <td className="py-3 pr-3 font-semibold">${o.total.toFixed(2)}</td>
                  <td className="py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setDetail(o.id)} className="p-1.5 hover:bg-muted rounded" aria-label="View"><Eye className="h-4 w-4" /></button>
                      <select value={o.status} onChange={(e) => { update(o.id, { status: e.target.value as OrderStatus }); toast.success(`Status → ${e.target.value}`); }} className="text-xs border border-border rounded px-1.5 py-1 bg-surface">
                        {(["Pending", "Processing", "Shipped", "Delivered", "Cancelled", "Failed"] as OrderStatus[]).map((s) => <option key={s}>{s}</option>)}
                      </select>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><button className="p-1.5 hover:bg-muted rounded"><MoreVertical className="h-4 w-4" /></button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { update(o.id, { payment: "Paid" }); toast.success("Marked as paid"); }}>Mark as Paid</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setToDelete(o.id)} className="text-destructive">Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-text-secondary mt-4">Showing 1–{Math.min(20, filtered.length)} of {filtered.length}</p>
      </DashCard>

      <Dialog open={!!detailOrder} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {detailOrder && (
            <>
              <DialogHeader><DialogTitle>Order {detailOrder.id}</DialogTitle></DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="flex flex-wrap gap-2 justify-between items-center">
                  <span>{detailOrder.customer} · {detailOrder.email}</span>
                  <div className="flex gap-2"><StatusBadge status={detailOrder.status} /><PaymentBadge status={detailOrder.payment} /></div>
                </div>
                <div className="space-y-2">
                  {detailOrder.items.map((it, i) => (
                    <div key={i} className="flex gap-3 items-center border-b border-border pb-2">
                      <img src={it.image} alt="" className="h-12 w-12 rounded" />
                      <div className="flex-1"><p className="font-medium">{it.name}</p><p className="text-xs text-text-secondary">Qty {it.quantity} × ${it.price}</p></div>
                      <p className="font-semibold">${(it.price * it.quantity).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between font-bold"><span>Total</span><span className="text-accent">${detailOrder.total.toFixed(2)}</span></div>
                <div className="pt-3 border-t border-border">
                  <p className="font-semibold mb-1">Shipping Address</p>
                  <p className="text-text-secondary">{detailOrder.address.line1}, {detailOrder.address.city}, {detailOrder.address.state} {detailOrder.address.zip}</p>
                  <p className="text-text-secondary">{detailOrder.address.phone}</p>
                </div>
                <p className="text-text-secondary">Payment: {detailOrder.paymentMethod}</p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete order?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setOrders((p) => p.filter((o) => o.id !== toDelete)); toast.success("Order deleted"); setToDelete(null); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---- Products ----
function ProductsPage() {
  const [items, setItems] = useState<Product[]>(seedProducts);
  const [q, setQ] = useState(""); const [cat, setCat] = useState("All");
  const [editing, setEditing] = useState<Product | null>(null);
  const [adding, setAdding] = useState(false);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const cats = ["All", ...Array.from(new Set(items.map((p) => p.category)))];
  const filtered = items.filter((p) => (cat === "All" || p.category === cat) && (q === "" || p.name.toLowerCase().includes(q.toLowerCase())));

  const save = (p: Product) => {
    setItems((prev) => prev.some((x) => x.id === p.id) ? prev.map((x) => x.id === p.id ? p : x) : [...prev, p]);
    toast.success("Product saved"); setEditing(null); setAdding(false);
  };

  return (
    <div className="space-y-4">
      <DashCard>
        <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
          <div className="flex gap-3 flex-1 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" className="w-full pl-9 pr-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary" />
            </div>
            <select value={cat} onChange={(e) => setCat(e.target.value)} className="px-3 py-2 rounded-lg border border-border text-sm bg-surface">
              {cats.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <button onClick={() => setAdding(true)} className="btn-primary text-sm flex items-center gap-1"><Plus className="h-4 w-4" /> Add Product</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-text-secondary border-b border-border">
              <th className="py-2 pr-3">Image</th><th className="py-2 pr-3">Name</th><th className="py-2 pr-3">SKU</th>
              <th className="py-2 pr-3">Category</th><th className="py-2 pr-3">Price</th><th className="py-2 pr-3">Stock</th>
              <th className="py-2 pr-3">Status</th><th className="py-2">Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-border">
                  <td className="py-3 pr-3"><img src={p.images[0]} alt="" className="h-10 w-10 rounded object-cover" /></td>
                  <td className="py-3 pr-3 font-medium max-w-[240px] truncate">{p.name}</td>
                  <td className="py-3 pr-3 font-mono text-xs">{p.sku}</td>
                  <td className="py-3 pr-3">{p.category}</td>
                  <td className="py-3 pr-3 font-semibold">${p.price}</td>
                  <td className="py-3 pr-3">{p.inStock ? "In stock" : "Out"}</td>
                  <td className="py-3 pr-3"><Switch checked={p.inStock} onCheckedChange={(v) => setItems((prev) => prev.map((x) => x.id === p.id ? { ...x, inStock: v } : x))} /></td>
                  <td className="py-3"><div className="flex gap-1">
                    <button onClick={() => setEditing(p)} className="p-1.5 hover:bg-muted rounded" aria-label="Edit"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => setToDelete(p.id)} className="p-1.5 hover:bg-muted rounded text-destructive" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DashCard>

      <ProductDialog open={!!editing || adding} onClose={() => { setEditing(null); setAdding(false); }} initial={editing} onSave={save} categories={cats.filter((c) => c !== "All")} />

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete product?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setItems((p) => p.filter((x) => x.id !== toDelete)); toast.success("Deleted"); setToDelete(null); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ProductDialog({ open, onClose, initial, onSave, categories }: { open: boolean; onClose: () => void; initial: Product | null; onSave: (p: Product) => void; categories: string[] }) {
  const blank: Product = { id: `p${Date.now()}`, slug: "", name: "", shortDescription: "", description: "", price: 0, salePrice: null, category: categories[0] ?? "", images: [""], inStock: true, rating: 0, reviewCount: 0, sku: "", brand: "CutHaven", attributes: {}, tags: [] };
  const [form, setForm] = useState<Product>(initial ?? blank);
  const upd = (k: keyof Product, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const genSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initial ? "Edit Product" : "Add Product"}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); onSave({ ...form, slug: form.slug || genSlug(form.name), images: [form.images[0] || "https://placehold.co/800x800/2D6A4F/FAFAF7?text=Product"] }); }} className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="block text-xs font-medium mb-1">Name</label><input required value={form.name} onChange={(e) => upd("name", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border text-sm" /></div>
          <div><label className="block text-xs font-medium mb-1">Slug</label><input value={form.slug} onChange={(e) => upd("slug", e.target.value)} placeholder={genSlug(form.name)} className="w-full px-3 py-2 rounded-lg border border-border text-sm" /></div>
          <div><label className="block text-xs font-medium mb-1">SKU</label><input required value={form.sku} onChange={(e) => upd("sku", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border text-sm" /></div>
          <div><label className="block text-xs font-medium mb-1">Category</label><select value={form.category} onChange={(e) => upd("category", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-surface">{categories.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div><label className="block text-xs font-medium mb-1">Price</label><input required type="number" value={form.price} onChange={(e) => upd("price", +e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border text-sm" /></div>
          <div><label className="block text-xs font-medium mb-1">Sale Price</label><input type="number" value={form.salePrice ?? ""} onChange={(e) => upd("salePrice", e.target.value ? +e.target.value : null)} className="w-full px-3 py-2 rounded-lg border border-border text-sm" /></div>
          <div><label className="block text-xs font-medium mb-1">Stock Qty</label><input type="number" defaultValue={10} className="w-full px-3 py-2 rounded-lg border border-border text-sm" /></div>
          <div className="col-span-2"><label className="block text-xs font-medium mb-1">Description</label><textarea rows={3} value={form.description} onChange={(e) => upd("description", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border text-sm" /></div>
          <div className="col-span-2"><label className="block text-xs font-medium mb-1">Image URL</label><input value={form.images[0]} onChange={(e) => upd("images", [e.target.value])} placeholder="https://..." className="w-full px-3 py-2 rounded-lg border border-border text-sm" />{form.images[0] && <img src={form.images[0]} alt="" className="mt-2 h-20 w-20 rounded object-cover border border-border" />}</div>
          <label className="col-span-2 flex items-center gap-2 text-sm"><Switch checked={form.inStock} onCheckedChange={(v) => upd("inStock", v)} /> Active</label>
          <div className="col-span-2 flex justify-end gap-2"><button type="button" onClick={onClose} className="btn-outline-primary text-sm px-4 py-2">Cancel</button><button className="btn-primary text-sm px-4 py-2">Save</button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---- Categories ----
function CategoriesPage() {
  const [items, setItems] = useState<Category[]>(seedCats);
  const [editing, setEditing] = useState<Category | null>(null);
  const [adding, setAdding] = useState(false);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const counts = useMemo(() => Object.fromEntries(items.map((c) => [c.name, seedProducts.filter((p) => p.category === c.name).length])), [items]);
  const save = (c: Category) => { setItems((prev) => prev.some((x) => x.id === c.id) ? prev.map((x) => x.id === c.id ? c : x) : [...prev, c]); toast.success("Category saved"); setEditing(null); setAdding(false); };
  return (
    <div className="space-y-4">
      <DashCard>
        <div className="flex justify-end mb-4"><button onClick={() => setAdding(true)} className="btn-primary text-sm flex items-center gap-1"><Plus className="h-4 w-4" /> Add Category</button></div>
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-left text-text-secondary border-b border-border"><th className="py-2 pr-3">Image</th><th className="py-2 pr-3">Name</th><th className="py-2 pr-3">Slug</th><th className="py-2 pr-3">Products</th><th className="py-2">Actions</th></tr></thead>
          <tbody>{items.map((c) => (
            <tr key={c.id} className="border-b border-border">
              <td className="py-3 pr-3"><img src={c.image} alt="" className="h-10 w-10 rounded object-cover" /></td>
              <td className="py-3 pr-3 font-medium">{c.name}</td>
              <td className="py-3 pr-3 font-mono text-xs">{c.slug}</td>
              <td className="py-3 pr-3">{counts[c.name] ?? 0}</td>
              <td className="py-3"><div className="flex gap-1"><button onClick={() => setEditing(c)} className="p-1.5 hover:bg-muted rounded"><Pencil className="h-4 w-4" /></button><button onClick={() => setToDelete(c.id)} className="p-1.5 hover:bg-muted rounded text-destructive"><Trash2 className="h-4 w-4" /></button></div></td>
            </tr>))}</tbody>
        </table></div>
      </DashCard>
      <CategoryDialog open={!!editing || adding} onClose={() => { setEditing(null); setAdding(false); }} initial={editing} onSave={save} />
      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete category?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { setItems((p) => p.filter((x) => x.id !== toDelete)); toast.success("Deleted"); setToDelete(null); }}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CategoryDialog({ open, onClose, initial, onSave }: { open: boolean; onClose: () => void; initial: Category | null; onSave: (c: Category) => void }) {
  const blank: Category = { id: `cat${Date.now()}`, name: "", slug: "", count: 0, image: "https://placehold.co/200x200/2D6A4F/FAFAF7?text=Cat", description: "" };
  const [form, setForm] = useState<Category>(initial ?? blank);
  const genSlug = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent><DialogHeader><DialogTitle>{initial ? "Edit Category" : "Add Category"}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); onSave({ ...form, slug: form.slug || genSlug(form.name) }); }} className="space-y-3">
          <div><label className="block text-xs font-medium mb-1">Name</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border text-sm" /></div>
          <div><label className="block text-xs font-medium mb-1">Slug</label><input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder={genSlug(form.name)} className="w-full px-3 py-2 rounded-lg border border-border text-sm" /></div>
          <div><label className="block text-xs font-medium mb-1">Image URL</label><input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border text-sm" /></div>
          <div><label className="block text-xs font-medium mb-1">Description</label><textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border text-sm" /></div>
          <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="btn-outline-primary text-sm px-4 py-2">Cancel</button><button className="btn-primary text-sm px-4 py-2">Save</button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---- Customers ----
function CustomersPage() {
  const [q, setQ] = useState(""); const [view, setView] = useState<string | null>(null);
  const filtered = customers.filter((c) => q === "" || c.name.toLowerCase().includes(q.toLowerCase()) || c.email.toLowerCase().includes(q.toLowerCase()));
  const cust = view ? customers.find((c) => c.id === view) : null;
  return (
    <div className="space-y-4">
      <DashCard>
        <div className="relative mb-4 max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customers" className="w-full pl-9 pr-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary" /></div>
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-left text-text-secondary border-b border-border"><th className="py-2 pr-3">Name</th><th className="py-2 pr-3">Email</th><th className="py-2 pr-3">Role</th><th className="py-2 pr-3">Orders</th><th className="py-2 pr-3">Total Spent</th><th className="py-2 pr-3">Joined</th><th className="py-2"></th></tr></thead>
          <tbody>{filtered.map((c) => (
            <tr key={c.id} className="border-b border-border">
              <td className="py-3 pr-3 font-medium">{c.name}</td><td className="py-3 pr-3 text-text-secondary">{c.email}</td>
              <td className="py-3 pr-3"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${c.role === "VIP" ? "bg-accent/10 text-accent" : "bg-muted"}`}>{c.role}</span></td>
              <td className="py-3 pr-3">{c.ordersCount}</td><td className="py-3 pr-3 font-semibold">${c.totalSpent.toFixed(2)}</td>
              <td className="py-3 pr-3">{c.joinedDate}</td>
              <td className="py-3"><button onClick={() => setView(c.id)} className="text-primary hover:underline text-sm">View</button></td>
            </tr>))}</tbody>
        </table></div>
      </DashCard>
      <Dialog open={!!cust} onOpenChange={(v) => !v && setView(null)}>
        <DialogContent className="max-w-2xl">{cust && (<>
          <DialogHeader><DialogTitle>{cust.name}</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-muted rounded-lg"><p className="text-xs text-text-secondary">Orders</p><p className="font-bold text-lg">{cust.ordersCount}</p></div>
              <div className="p-3 bg-muted rounded-lg"><p className="text-xs text-text-secondary">Total Spent</p><p className="font-bold text-lg">${cust.totalSpent.toFixed(2)}</p></div>
              <div className="p-3 bg-muted rounded-lg"><p className="text-xs text-text-secondary">Joined</p><p className="font-bold text-lg">{cust.joinedDate}</p></div>
            </div>
            <p className="text-text-secondary">{cust.email}</p>
            <div><p className="font-semibold mb-2">Order History</p>
              <table className="w-full text-xs">
                <thead><tr className="text-left text-text-secondary border-b border-border"><th className="py-2">Order #</th><th className="py-2">Date</th><th className="py-2">Status</th><th className="py-2">Total</th></tr></thead>
                <tbody>{mockOrders.filter((o) => o.email === cust.email).slice(0, 5).map((o) => (
                  <tr key={o.id} className="border-b border-border"><td className="py-2 font-mono">{o.id}</td><td className="py-2">{o.date}</td><td className="py-2"><StatusBadge status={o.status} /></td><td className="py-2 font-semibold">${o.total.toFixed(2)}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        </>)}</DialogContent>
      </Dialog>
    </div>
  );
}

// ---- Store Managers ----
function ManagersPage() {
  const [items, setItems] = useState<StoreManager[]>(seedSMs);
  const [adding, setAdding] = useState(false);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  return (
    <div className="space-y-4">
      <DashCard>
        <div className="flex justify-end mb-4"><button onClick={() => setAdding(true)} className="btn-primary text-sm flex items-center gap-1"><Plus className="h-4 w-4" /> Add Store Manager</button></div>
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-left text-text-secondary border-b border-border"><th className="py-2 pr-3">Name</th><th className="py-2 pr-3">Email</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Added</th><th className="py-2">Actions</th></tr></thead>
          <tbody>{items.map((m) => (
            <tr key={m.id} className="border-b border-border">
              <td className="py-3 pr-3 font-medium">{m.name}</td><td className="py-3 pr-3 text-text-secondary">{m.email}</td>
              <td className="py-3 pr-3"><Switch checked={m.active} onCheckedChange={(v) => setItems((p) => p.map((x) => x.id === m.id ? { ...x, active: v } : x))} /></td>
              <td className="py-3 pr-3">{m.addedDate}</td>
              <td className="py-3"><button onClick={() => setToDelete(m.id)} className="text-destructive hover:underline text-sm flex items-center gap-1"><Trash2 className="h-3.5 w-3.5" /> Remove</button></td>
            </tr>))}</tbody>
        </table></div>
      </DashCard>
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent><DialogHeader><DialogTitle>Add Store Manager</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); setItems((p) => [...p, { id: `sm${Date.now()}`, name: form.name, email: form.email, active: true, addedDate: new Date().toISOString().slice(0, 10) }]); toast.success("Manager added"); setForm({ name: "", email: "", password: "" }); setAdding(false); }} className="space-y-3">
            <div><label className="block text-xs font-medium mb-1">Name</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border text-sm" /></div>
            <div><label className="block text-xs font-medium mb-1">Email</label><input required type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border text-sm" /></div>
            <div><label className="block text-xs font-medium mb-1">Temporary Password</label><input required type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border text-sm" /></div>
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setAdding(false)} className="btn-outline-primary text-sm px-4 py-2">Cancel</button><button className="btn-primary text-sm px-4 py-2">Add</button></div>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remove store manager?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { setItems((p) => p.filter((x) => x.id !== toDelete)); toast.success("Removed"); setToDelete(null); }}>Remove</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---- Settings ----
function SettingsPage() {
  const [store, setStore] = useState({ name: "CutHaven", email: "support@cuthaven.com", phone: "+1 406 229-9045", address: "1633 S Industrial Way, Palmer, AK 99645" });
  const [ship, setShip] = useState({ freeThreshold: 350, flatRate: 12.99 });
  const [notif, setNotif] = useState({ newOrder: true, lowStock: true, weekly: false });
  const [clearOpen, setClearOpen] = useState(false);
  return (
    <div className="space-y-4">
      <DashCard>
        <h3 className="font-display text-lg font-bold mb-4">Store Information</h3>
        <form onSubmit={(e) => { e.preventDefault(); toast.success("Store info saved"); }} className="grid md:grid-cols-2 gap-3">
          <div><label className="block text-xs font-medium mb-1">Store Name</label><input value={store.name} onChange={(e) => setStore({ ...store, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border text-sm" /></div>
          <div><label className="block text-xs font-medium mb-1">Support Email</label><input type="email" value={store.email} onChange={(e) => setStore({ ...store, email: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border text-sm" /></div>
          <div><label className="block text-xs font-medium mb-1">Phone</label><input value={store.phone} onChange={(e) => setStore({ ...store, phone: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border text-sm" /></div>
          <div><label className="block text-xs font-medium mb-1">Address</label><input value={store.address} onChange={(e) => setStore({ ...store, address: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border text-sm" /></div>
          <div className="md:col-span-2 flex justify-end"><button className="btn-primary text-sm px-4 py-2">Save</button></div>
        </form>
      </DashCard>
      <DashCard>
        <h3 className="font-display text-lg font-bold mb-4">Shipping</h3>
        <form onSubmit={(e) => { e.preventDefault(); toast.success("Shipping saved"); }} className="grid md:grid-cols-2 gap-3">
          <div><label className="block text-xs font-medium mb-1">Free shipping threshold ($)</label><input type="number" value={ship.freeThreshold} onChange={(e) => setShip({ ...ship, freeThreshold: +e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border text-sm" /></div>
          <div><label className="block text-xs font-medium mb-1">Flat shipping rate ($)</label><input type="number" step="0.01" value={ship.flatRate} onChange={(e) => setShip({ ...ship, flatRate: +e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border text-sm" /></div>
          <div className="md:col-span-2 flex justify-end"><button className="btn-primary text-sm px-4 py-2">Save</button></div>
        </form>
      </DashCard>
      <DashCard>
        <h3 className="font-display text-lg font-bold mb-4">Notifications</h3>
        <div className="space-y-3">
          {[{ k: "newOrder", l: "Email on new order" }, { k: "lowStock", l: "Email on low stock" }, { k: "weekly", l: "Weekly summary" }].map((n) => (
            <label key={n.k} className="flex items-center justify-between"><span className="text-sm">{n.l}</span>
              <Switch checked={(notif as any)[n.k]} onCheckedChange={(v) => setNotif({ ...notif, [n.k]: v })} /></label>
          ))}
        </div>
      </DashCard>
      <DashCard className="border-destructive/40">
        <h3 className="font-display text-lg font-bold mb-2 text-destructive">Danger Zone</h3>
        <p className="text-sm text-text-secondary mb-4">Clear demo data — this is a placeholder and does not delete anything yet.</p>
        <button onClick={() => setClearOpen(true)} className="text-sm px-4 py-2 rounded-lg border border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">Clear demo data</button>
      </DashCard>
      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Clear demo data?</AlertDialogTitle><AlertDialogDescription>This is a UI placeholder and will not delete anything.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { toast.success("Demo data cleared (placeholder)"); setClearOpen(false); }}>Clear</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
