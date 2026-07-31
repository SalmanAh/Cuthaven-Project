import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard, Package, ShoppingBag, FolderOpen, Users,
  UserCog, Settings, LogOut, Search, Eye, Pencil, Trash2, Plus,
  MoreVertical, Tag, Star, CheckCircle2, XCircle, BookOpen, CreditCard,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { toast } from "sonner";
import { DashboardShell, DashCard, StatCard, type NavItem } from "@/components/dashboard/DashboardShell";
import { TimeFilter } from "@/components/dashboard/TimeFilter";
import { StatusBadge, PaymentBadge } from "@/components/dashboard/StatusBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useAuth } from "@/context/AuthContext";
import {
  adminGetOrders, adminGetOrderById, adminUpdateOrderStatus,
  adminGetProducts, adminCreateProduct, adminUpdateProduct, adminDeleteProduct,
  adminGetCustomers, adminGetCustomerById,
  adminGetStaff, adminCreateStaff, adminToggleStaff,
  adminGetAnalyticsSummary, adminGetAnalyticsSeries,
  adminGetCoupons, adminCreateCoupon, adminUpdateCoupon, adminDeleteCoupon,
  adminGetBlogPosts, adminCreateBlogPost, adminUpdateBlogPost, adminDeleteBlogPost,
  adminUpdatePaymentStatus,
  adminGetPaymentGateways, adminGetPaymentGateway, adminCreatePaymentGateway,
  adminUpdatePaymentGateway, adminActivatePaymentGateway, adminDeletePaymentGateway,
  getCategories,
  type AdminOrder, type AdminProduct, type AdminCustomer,
  type AdminStaffMember, type AdminStats, type AdminRevenueSeries,
  type AdminStatusDistribution, type AdminPeriod, type ApiCategory,
  type AdminCoupon, type BlogPost, type PaymentGateway, type PaymentGatewayFull,
  type CreatePaymentGatewayRequest, type GatewayType, type PayPalMode,
} from "@/lib/api-client";

// ─── Admin reviews API (not yet in api-client — called directly) ───────────
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";
const TOKEN_KEY = "ch-access-token";

async function adminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Request failed ${res.status}`);
  return data as T;
}

interface AdminReview {
  id: string;
  rating: number;
  review_text: string | null;
  is_verified_purchase: boolean;
  is_approved: boolean;
  disclosed_incentive: boolean;
  insider_relationship: string | null;
  created_at: string;
  products: { name: string; slug: string } | null;
  customers: { first_name: string; last_name: string; email: string } | null;
}

type Tab = "overview" | "orders" | "products" | "categories" | "customers" | "managers" | "coupons" | "gateways" | "reviews" | "blog" | "settings";

export const Route = createFileRoute("/admin/dashboard")({
  head: () => ({ meta: [
    { title: "Admin — CutHaven" },
    { name: "description", content: "Admin control panel for CutHaven." },
    { name: "robots", content: "noindex" },
  ] }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const nav = useNavigate();
  const { logout, user } = useAuth();
  const handleLogout = async () => { await logout(); nav({ to: "/account/login" }); };

  const allItems: NavItem[] = [
    { key: "overview",   label: "Overview",         icon: LayoutDashboard },
    { key: "orders",     label: "Orders",           icon: Package },
    { key: "products",   label: "Products",         icon: ShoppingBag },
    { key: "categories", label: "Categories",       icon: FolderOpen },
    { key: "customers",  label: "Customers",        icon: Users },
    { key: "managers",   label: "Store Managers",   icon: UserCog },
    { key: "coupons",    label: "Coupons",          icon: Tag },
    { key: "gateways",   label: "Payment Gateways", icon: CreditCard },
    { key: "reviews",    label: "Reviews",          icon: Star },
    { key: "blog",       label: "Blog",             icon: BookOpen },
    { key: "settings",   label: "Settings",         icon: Settings },
    { key: "logout",     label: "Logout",           icon: LogOut, onClick: handleLogout },
  ];

  // Filter sidebar based on role — product_manager only sees: overview, orders, products
  const items = user?.role === "product_manager"
    ? allItems.filter((i) => ["overview", "orders", "products", "logout"].includes(i.key))
    : allItems;

  const titles: Record<Tab, string> = {
    overview: "Admin Overview", orders: "Orders", products: "Products",
    categories: "Categories", customers: "Customers", managers: "Store Managers",
    coupons: "Coupons", gateways: "Payment Gateways", reviews: "Reviews", blog: "Blog", settings: "Settings",
  };

  const sidebarTitle = user?.role === "product_manager" ? "Product Manager" : "Admin";

  return (
    <RequireAuth roles={["admin", "store_manager", "product_manager"]}>
      <DashboardShell title={titles[tab]} sidebarTitle={sidebarTitle} nav={items} activeKey={tab} onSelect={(k) => setTab(k as Tab)}>
        {tab === "overview"   && <Overview />}
        {tab === "orders"     && <OrdersPage />}
        {tab === "products"   && <ProductsPage />}
        {tab === "categories" && <CategoriesPage />}
        {tab === "customers"  && <CustomersPage />}
        {tab === "managers"   && <ManagersPage />}
        {tab === "coupons"    && <CouponsPage />}
        {tab === "gateways"   && <GatewaysPage />}
        {tab === "reviews"    && <ReviewsPage />}
        {tab === "blog"       && <BlogPage />}
        {tab === "settings"   && <SettingsPage />}
      </DashboardShell>
    </RequireAuth>
  );
}

// ─── Shared loading / error helpers ───────────────────────────────────────
function Spinner() {
  return <div className="flex justify-center py-12"><div className="h-7 w-7 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div>;
}
function ErrMsg({ msg }: { msg: string }) {
  return <p className="text-sm text-destructive py-8 text-center">{msg}</p>;
}

// ─── Overview ─────────────────────────────────────────────────────────────
function Overview() {
  const [period, setPeriod] = useState<AdminPeriod>("today");
  const [stats, setStats]   = useState<AdminStats | null>(null);
  const [series, setSeries] = useState<AdminRevenueSeries[]>([]);
  const [dist, setDist]     = useState<AdminStatusDistribution[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [products, setProds]= useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p: AdminPeriod) => {
    setLoading(true);
    try {
      const [sumRes, serRes, ordRes, prodRes] = await Promise.all([
        adminGetAnalyticsSummary(p),
        adminGetAnalyticsSeries(p),
        adminGetOrders({ limit: 8 }),
        adminGetProducts({ limit: 5, isActive: true }),
      ]);
      setStats(sumRes.stats);
      setSeries(serRes.series);
      setDist(serRes.distribution);
      setOrders(ordRes.orders);
      setProds(prodRes.products);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load overview");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(period); }, [period, load]);

  if (loading) return <Spinner />;
  if (!stats)  return <ErrMsg msg="Could not load analytics." />;

  return (
    <div className="space-y-6">
      <div className="flex justify-end"><TimeFilter value={period} onChange={(p) => setPeriod(p as AdminPeriod)} /></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Revenue"   value={`$${stats.revenue.toLocaleString()}`} trend={stats.revTrend} />
        <StatCard label="Total Orders"    value={stats.orders}    trend={stats.ordTrend} />
        <StatCard label="Total Customers" value={stats.customers} trend={stats.custTrend} />
        <StatCard label="Avg Order Value" value={`$${stats.avgOrder}`} trend={stats.aovTrend} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Pending"    value={stats.pending}    accent="#E07B1A" />
        <StatCard label="Processing" value={stats.processing} accent="#2D6A4F" />
        <StatCard label="Shipped"    value={stats.shipped}    accent="#4A90E2" />
        <StatCard label="Delivered"  value={stats.delivered}  accent="#1B4332" />
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
              <Bar dataKey="orders" fill="#E07B1A" radius={[6,6,0,0]} />
            </BarChart></ResponsiveContainer>
          </div>
        </DashCard>
        <DashCard>
          <h3 className="font-display text-lg font-bold mb-4">Top Products</h3>
          <ul className="space-y-3">
            {products.map((p) => (
              <li key={p.id} className="flex gap-3 items-center">
                <img src={p.primaryImageUrl} alt="" className="h-10 w-10 rounded object-cover" />
                <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{p.name}</p><p className="text-xs text-text-secondary">{p.stockQuantity} in stock</p></div>
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
              <th className="py-2 pr-3">Order #</th><th className="py-2 pr-3">Customer</th>
              <th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Status</th><th className="py-2">Total</th>
            </tr></thead>
            <tbody>{orders.map((o) => (
              <tr key={o.id} className="border-b border-border">
                <td className="py-2.5 pr-3 font-mono">{o.orderNumber}</td>
                <td className="py-2.5 pr-3">{o.customerName ?? o.customerEmail ?? "Guest"}</td>
                <td className="py-2.5 pr-3">{o.createdAt.slice(0,10)}</td>
                <td className="py-2.5 pr-3"><StatusBadge status={o.status as any} /></td>
                <td className="py-2.5 font-semibold">${o.total.toFixed(2)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </DashCard>
    </div>
  );
}

// ─── Orders ────────────────────────────────────────────────────────────────
function OrdersPage() {
  const [orders, setOrders]   = useState<AdminOrder[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState("All");
  const [payFilter, setPayFilter] = useState("All");
  const [q, setQ]             = useState("");
  const [detail, setDetail]   = useState<AdminOrder | null>(null);
  const [toDelete, setToDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminGetOrders({
        status: filter !== "All" ? filter.toLowerCase() : undefined,
        search: q || undefined,
        limit: 50,
      });
      let rows = res.orders;
      if (payFilter === "Paid")   rows = rows.filter((o) => o.paymentStatus === "paid");
      if (payFilter === "Unpaid") rows = rows.filter((o) => o.paymentStatus !== "paid");
      setOrders(rows);
      setTotal(res.total);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [filter, payFilter, q]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string, status: AdminOrder["status"]) => {
    try {
      await adminUpdateOrderStatus(id, status);
      setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status } : o));
      if (detail?.id === id) setDetail((d) => d ? { ...d, status } : d);
      toast.success(`Status → ${status}`);
    } catch (e: any) { toast.error(e.message); }
  };

  const markAsPaid = async (id: string) => {
    try {
      await adminUpdatePaymentStatus(id, "paid");
      setOrders((prev) => prev.map((o) => o.id === id ? { ...o, paymentStatus: "paid" } : o));
      if (detail?.id === id) setDetail((d) => d ? { ...d, paymentStatus: "paid" } : d);
      toast.success("Order marked as paid");
    } catch (e: any) { toast.error(e.message); }
  };

  const statuses = ["All","pending","confirmed","processing","shipped","delivered","cancelled","refunded"];

  return (
    <div className="space-y-4">
      <DashCard>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {statuses.map((s) => {
            const count = s === "All" ? total : orders.filter((o) => o.status === s).length;
            return (
              <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize ${filter === s ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-primary/10"}`}>{s} ({count})</button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3 items-center mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} placeholder="Search order # or customer" className="w-full pl-9 pr-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary" />
          </div>
          <select value={payFilter} onChange={(e) => setPayFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-border text-sm bg-surface">
            <option>All</option><option>Paid</option><option>Unpaid</option>
          </select>
        </div>
        {loading ? <Spinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-text-secondary border-b border-border">
                <th className="py-2 pr-3">Order #</th><th className="py-2 pr-3">Customer</th>
                <th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Payment</th><th className="py-2 pr-3">Total</th><th className="py-2">Actions</th>
              </tr></thead>
              <tbody>{orders.map((o) => (
                <tr key={o.id} className="border-b border-border">
                  <td className="py-3 pr-3 font-mono">{o.orderNumber}</td>
                  <td className="py-3 pr-3">{o.customerName ?? o.customerEmail ?? "Guest"}</td>
                  <td className="py-3 pr-3">{o.createdAt.slice(0,10)}</td>
                  <td className="py-3 pr-3"><StatusBadge status={o.status as any} /></td>
                  <td className="py-3 pr-3"><PaymentBadge status={o.paymentStatus === "paid" ? "Paid" : "Unpaid"} /></td>
                  <td className="py-3 pr-3 font-semibold">${o.total.toFixed(2)}</td>
                  <td className="py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setDetail(o)} className="p-1.5 hover:bg-muted rounded" aria-label="View"><Eye className="h-4 w-4" /></button>
                      <select value={o.status} onChange={(e) => updateStatus(o.id, e.target.value as AdminOrder["status"])} className="text-xs border border-border rounded px-1.5 py-1 bg-surface">
                        {["pending","confirmed","processing","shipped","delivered","cancelled","refunded"].map((s) => <option key={s}>{s}</option>)}
                      </select>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><button className="p-1.5 hover:bg-muted rounded"><MoreVertical className="h-4 w-4" /></button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {o.paymentStatus !== "paid" && (
                            <DropdownMenuItem onClick={() => markAsPaid(o.id)} className="text-success">
                              Mark as Paid
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => setToDelete(o.id)} className="text-destructive">Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
            <p className="text-xs text-text-secondary mt-4">Showing {orders.length} of {total}</p>
          </div>
        )}
      </DashCard>

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader><DialogTitle>Order {detail.orderNumber}</DialogTitle></DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="flex flex-wrap gap-2 justify-between items-center">
                  <span>{detail.customerName ?? detail.customerEmail ?? "Guest"}</span>
                  <div className="flex gap-2"><StatusBadge status={detail.status as any} /><PaymentBadge status={detail.paymentStatus === "paid" ? "Paid" : "Unpaid"} /></div>
                </div>
                <div className="space-y-2">{detail.items.map((it) => (
                  <div key={it.id} className="flex gap-3 items-center border-b border-border pb-2">
                    {it.productImage && <img src={it.productImage} alt="" className="h-12 w-12 rounded" />}
                    <div className="flex-1"><p className="font-medium">{it.productName}</p><p className="text-xs text-text-secondary">Qty {it.quantity} × ${it.unitPrice}</p></div>
                    <p className="font-semibold">${it.totalPrice.toFixed(2)}</p>
                  </div>
                ))}</div>
                <div className="flex justify-between font-bold"><span>Total</span><span className="text-accent">${detail.total.toFixed(2)}</span></div>
                <div className="pt-3 border-t border-border">
                  <p className="font-semibold mb-1">Shipping Address</p>
                  <p className="text-text-secondary">{detail.shippingAddress.address}, {detail.shippingAddress.city}, {detail.shippingAddress.state} {detail.shippingAddress.zip}</p>
                </div>
                <p className="text-text-secondary">Payment: {detail.paymentMethod ?? detail.paymentProcessor}</p>
                <div className="pt-2 flex flex-wrap gap-3 items-end">
                  <div className="flex-1">
                    <label className="block text-xs font-medium mb-1">Update Status</label>
                    <select value={detail.status} onChange={(e) => updateStatus(detail.id, e.target.value as AdminOrder["status"])} className="text-sm border border-border rounded px-2 py-1.5 bg-surface">
                      {["pending","confirmed","processing","shipped","delivered","cancelled","refunded"].map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  {detail.paymentStatus !== "paid" && (
                    <button
                      onClick={() => markAsPaid(detail.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success text-white text-sm font-semibold hover:bg-success/90 transition"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Mark as Paid
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete order?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setOrders((p) => p.filter((o) => o.id !== toDelete)); toast.success("Order removed from view"); setToDelete(null); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Products ──────────────────────────────────────────────────────────────
function ProductsPage() {
  const [items, setItems]     = useState<AdminProduct[]>([]);
  const [cats, setCats]       = useState<ApiCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ]             = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [editing, setEditing] = useState<AdminProduct | null>(null);
  const [adding, setAdding]   = useState(false);
  const [toDelete, setToDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [prodRes, catRes] = await Promise.all([adminGetProducts({ limit: 200 }), getCategories()]);
      setItems(prodRes.products);
      setCats(catRes);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter((p) =>
    (catFilter === "All" || p.categoryName === catFilter) &&
    (q === "" || p.name.toLowerCase().includes(q.toLowerCase()))
  );

  const saveProduct = async (data: Partial<AdminProduct> & { id?: string }) => {
    try {
      if (data.id) {
        const res = await adminUpdateProduct(data.id, data as any);
        setItems((prev) => prev.map((p) => p.id === data.id ? res.product : p));
        toast.success("Product updated");
      } else {
        const res = await adminCreateProduct(data as any);
        setItems((prev) => [res.product, ...prev]);
        toast.success("Product created");
      }
      setEditing(null); setAdding(false);
    } catch (e: any) { toast.error(e.message); }
  };

  const softDelete = async (id: string) => {
    try {
      await adminDeleteProduct(id);
      setItems((prev) => prev.filter((p) => p.id !== id));
      toast.success("Product deactivated");
      setToDelete(null);
    } catch (e: any) { toast.error(e.message); }
  };

  const catNames = ["All", ...Array.from(new Set(items.map((p) => p.categoryName).filter(Boolean) as string[]))];

  return (
    <div className="space-y-4">
      <DashCard>
        <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
          <div className="flex gap-3 flex-1 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" className="w-full pl-9 pr-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary" />
            </div>
            <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-border text-sm bg-surface">
              {catNames.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <button onClick={() => setAdding(true)} className="btn-primary text-sm flex items-center gap-1"><Plus className="h-4 w-4" /> Add Product</button>
        </div>
        {loading ? <Spinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-text-secondary border-b border-border">
                <th className="py-2 pr-3">Image</th><th className="py-2 pr-3">Name</th><th className="py-2 pr-3">SKU</th>
                <th className="py-2 pr-3">Category</th><th className="py-2 pr-3">Price</th><th className="py-2 pr-3">Stock</th>
                <th className="py-2 pr-3">Active</th><th className="py-2">Actions</th>
              </tr></thead>
              <tbody>{filtered.map((p) => (
                <tr key={p.id} className="border-b border-border">
                  <td className="py-3 pr-3"><img src={p.primaryImageUrl} alt="" className="h-10 w-10 rounded object-cover" /></td>
                  <td className="py-3 pr-3 font-medium max-w-[220px] truncate">{p.name}</td>
                  <td className="py-3 pr-3 font-mono text-xs">{p.sku ?? "—"}</td>
                  <td className="py-3 pr-3">{p.categoryName ?? "—"}</td>
                  <td className="py-3 pr-3 font-semibold">${p.price}</td>
                  <td className="py-3 pr-3">{p.stockQuantity}</td>
                  <td className="py-3 pr-3">
                    <Switch checked={p.isActive} onCheckedChange={async (v) => {
                      try { await adminUpdateProduct(p.id, { isActive: v }); setItems((prev) => prev.map((x) => x.id === p.id ? { ...x, isActive: v } : x)); }
                      catch (e: any) { toast.error(e.message); }
                    }} />
                  </td>
                  <td className="py-3">
                    <div className="flex gap-1">
                      <button onClick={() => setEditing(p)} className="p-1.5 hover:bg-muted rounded"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => setToDelete(p.id)} className="p-1.5 hover:bg-muted rounded text-destructive"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </DashCard>
      <ProductDialog open={!!editing || adding} onClose={() => { setEditing(null); setAdding(false); }} initial={editing} onSave={saveProduct} categories={cats} />
      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Deactivate product?</AlertDialogTitle><AlertDialogDescription>The product will be hidden from the store but order history is preserved.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => toDelete && softDelete(toDelete)}>Deactivate</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ProductDialog({ open, onClose, initial, onSave, categories }: {
  open: boolean; onClose: () => void;
  initial: AdminProduct | null;
  onSave: (d: any) => Promise<void>;
  categories: ApiCategory[];
}) {
  const blank = { name: "", slug: "", description: "", price: 0, primaryImageUrl: "", imageUrls: [] as string[], stockQuantity: 0, isActive: true, compareAtPrice: null, sku: "", brand: "CutHaven", categoryId: null, availability: "in_stock" as const };
  const [form, setForm] = useState<any>(initial ?? blank);
  const [uploadingPrimary, setUploadingPrimary] = useState(false);
  const [uploadingExtra, setUploadingExtra] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initial ? { ...initial, imageUrls: initial.imageUrls ?? [] } : { ...blank });
    }
  }, [initial, open]);

  const upd = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const genSlug = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";
  const TOKEN_KEY = "ch-access-token";

  // Upload a single file — returns the public URL
  const uploadFile = async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append("file", file);
    const token = localStorage.getItem(TOKEN_KEY);
    const res = await fetch(`${API_URL}/upload/product-image`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Upload failed");
    return data.url as string;
  };

  // Handle primary image — file picker
  const handlePrimaryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPrimary(true);
    try {
      const url = await uploadFile(file);
      upd("primaryImageUrl", url);
      toast.success("Primary image uploaded");
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setUploadingPrimary(false);
      e.target.value = "";
    }
  };

  // Handle multiple additional images
  const handleExtraUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploadingExtra(true);
    try {
      const urls = await Promise.all(files.map(uploadFile));
      setForm((f: any) => ({ ...f, imageUrls: [...(f.imageUrls ?? []), ...urls] }));
      toast.success(`${urls.length} image${urls.length > 1 ? "s" : ""} uploaded`);
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setUploadingExtra(false);
      e.target.value = "";
    }
  };

  const removeExtraImage = (idx: number) => {
    setForm((f: any) => ({ ...f, imageUrls: f.imageUrls.filter((_: string, i: number) => i !== idx) }));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initial ? "Edit Product" : "Add Product"}</DialogTitle></DialogHeader>
        <form onSubmit={async (e) => { e.preventDefault(); await onSave({ ...form, slug: form.slug || genSlug(form.name), id: initial?.id }); }} className="grid grid-cols-2 gap-3">

          {/* Name */}
          <div className="col-span-2">
            <label className="block text-xs font-medium mb-1">Name *</label>
            <input required value={form.name} onChange={(e) => upd("name", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border text-sm" />
          </div>

          {/* Slug + SKU */}
          <div>
            <label className="block text-xs font-medium mb-1">Slug</label>
            <input value={form.slug} onChange={(e) => upd("slug", e.target.value)} placeholder={genSlug(form.name)} className="w-full px-3 py-2 rounded-lg border border-border text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">SKU</label>
            <input value={form.sku ?? ""} onChange={(e) => upd("sku", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border text-sm" />
          </div>

          {/* Category + Price */}
          <div>
            <label className="block text-xs font-medium mb-1">Category</label>
            <select value={form.categoryId ?? ""} onChange={(e) => upd("categoryId", e.target.value || null)} className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-surface">
              <option value="">— None —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Price *</label>
            <input required type="number" step="0.01" value={form.price} onChange={(e) => upd("price", +e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border text-sm" />
          </div>

          {/* Compare-at + Stock */}
          <div>
            <label className="block text-xs font-medium mb-1">Compare-at Price</label>
            <input type="number" step="0.01" value={form.compareAtPrice ?? ""} onChange={(e) => upd("compareAtPrice", e.target.value ? +e.target.value : null)} className="w-full px-3 py-2 rounded-lg border border-border text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Stock Qty</label>
            <input type="number" value={form.stockQuantity} onChange={(e) => upd("stockQuantity", +e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border text-sm" />
          </div>

          {/* Description */}
          <div className="col-span-2">
            <label className="block text-xs font-medium mb-1">Description *</label>
            <textarea rows={3} required value={form.description} onChange={(e) => upd("description", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border text-sm" />
          </div>

          {/* ── Primary Image ── */}
          <div className="col-span-2">
            <label className="block text-xs font-medium mb-1">Primary Image *</label>
            <div className="flex gap-2 items-center">
              <input
                value={form.primaryImageUrl}
                onChange={(e) => upd("primaryImageUrl", e.target.value)}
                placeholder="Paste URL or upload below"
                className="flex-1 px-3 py-2 rounded-lg border border-border text-sm"
              />
              <label className={`cursor-pointer px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition whitespace-nowrap ${uploadingPrimary ? "opacity-50 pointer-events-none" : ""}`}>
                {uploadingPrimary ? "Uploading…" : "📁 Upload"}
                <input type="file" accept="image/*" className="hidden" onChange={handlePrimaryUpload} disabled={uploadingPrimary} />
              </label>
            </div>
            {form.primaryImageUrl && (
              <div className="mt-2 flex items-center gap-2">
                <img src={form.primaryImageUrl} alt="Primary" className="h-20 w-20 rounded-lg object-cover border border-border" />
                <button type="button" onClick={() => upd("primaryImageUrl", "")} className="text-xs text-destructive hover:underline">Remove</button>
              </div>
            )}
          </div>

          {/* ── Additional Images ── */}
          <div className="col-span-2">
            <label className="block text-xs font-medium mb-1">
              Additional Images
              <span className="text-text-secondary ml-1 font-normal">(up to 9 — shown in product gallery)</span>
            </label>

            {/* Upload button */}
            <label className={`inline-flex items-center gap-1.5 cursor-pointer px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition ${uploadingExtra ? "opacity-50 pointer-events-none" : ""}`}>
              {uploadingExtra ? "Uploading…" : "📁 Upload Images"}
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleExtraUpload} disabled={uploadingExtra} />
            </label>
            <p className="text-xs text-text-secondary mt-1">Select multiple files at once — Ctrl/Cmd+Click to select several.</p>

            {/* Current extra images grid */}
            {(form.imageUrls ?? []).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {(form.imageUrls as string[]).map((url: string, idx: number) => (
                  <div key={idx} className="relative group">
                    <img src={url} alt={`Image ${idx + 1}`} className="h-16 w-16 rounded-lg object-cover border border-border" />
                    <button
                      type="button"
                      onClick={() => removeExtraImage(idx)}
                      className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                      aria-label="Remove image"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active toggle */}
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <Switch checked={form.isActive} onCheckedChange={(v) => upd("isActive", v)} /> Active
          </label>

          <div className="col-span-2 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-outline-primary text-sm px-4 py-2">Cancel</button>
            <button className="btn-primary text-sm px-4 py-2">Save</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Categories (read from real API, write via existing public categories) ─
function CategoriesPage() {
  const [cats, setCats] = useState<ApiCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCategories().then(setCats).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  }, []);

  return (
    <DashCard>
      {loading ? <Spinner /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-text-secondary border-b border-border">
              <th className="py-2 pr-3">Name</th><th className="py-2 pr-3">Slug</th><th className="py-2">Products</th>
            </tr></thead>
            <tbody>{cats.map((c) => (
              <tr key={c.id} className="border-b border-border">
                <td className="py-3 pr-3 font-medium">{c.name}</td>
                <td className="py-3 pr-3 font-mono text-xs">{c.slug}</td>
                <td className="py-3">{c.productCount}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </DashCard>
  );
}

// ─── Customers ─────────────────────────────────────────────────────────────
function CustomersPage() {
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [q, setQ]                 = useState("");
  const [detail, setDetail]       = useState<{ customer: AdminCustomer; orders: any[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminGetCustomers({ search: q || undefined, limit: 100 });
      setCustomers(res.customers); setTotal(res.total);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [q]);

  useEffect(() => { load(); }, []);

  const viewCustomer = async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await adminGetCustomerById(id);
      setDetail(res as any);
    } catch (e: any) { toast.error(e.message); }
    finally { setDetailLoading(false); }
  };

  return (
    <div className="space-y-4">
      <DashCard>
        <div className="flex gap-3 items-center mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} placeholder="Search customers" className="w-full pl-9 pr-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary" />
          </div>
        </div>
        {loading ? <Spinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-text-secondary border-b border-border">
                <th className="py-2 pr-3">Name</th><th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Orders</th><th className="py-2 pr-3">Total Spent</th>
                <th className="py-2 pr-3">Joined</th><th className="py-2"></th>
              </tr></thead>
              <tbody>{customers.map((c) => (
                <tr key={c.id} className="border-b border-border">
                  <td className="py-3 pr-3 font-medium">{c.firstName} {c.lastName}</td>
                  <td className="py-3 pr-3 text-text-secondary">{c.email}</td>
                  <td className="py-3 pr-3">{c.ordersCount}</td>
                  <td className="py-3 pr-3 font-semibold">${c.totalSpent.toFixed(2)}</td>
                  <td className="py-3 pr-3">{c.createdAt.slice(0,10)}</td>
                  <td className="py-3"><button onClick={() => viewCustomer(c.id)} className="text-primary hover:underline text-sm">View</button></td>
                </tr>
              ))}</tbody>
            </table>
            <p className="text-xs text-text-secondary mt-3">Showing {customers.length} of {total}</p>
          </div>
        )}
      </DashCard>
      <Dialog open={!!detail || detailLoading} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {detailLoading ? <Spinner /> : detail && (
            <>
              <DialogHeader><DialogTitle>{detail.customer.firstName} {detail.customer.lastName}</DialogTitle></DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-muted rounded-lg"><p className="text-xs text-text-secondary">Orders</p><p className="font-bold text-lg">{detail.customer.ordersCount}</p></div>
                  <div className="p-3 bg-muted rounded-lg"><p className="text-xs text-text-secondary">Total Spent</p><p className="font-bold text-lg">${detail.customer.totalSpent.toFixed(2)}</p></div>
                  <div className="p-3 bg-muted rounded-lg"><p className="text-xs text-text-secondary">Joined</p><p className="font-bold text-base">{detail.customer.createdAt.slice(0,10)}</p></div>
                </div>
                <p className="text-text-secondary">{detail.customer.email}</p>
                {detail.orders.length > 0 && (
                  <div>
                    <p className="font-semibold mb-2">Order History</p>
                    <table className="w-full text-xs">
                      <thead><tr className="text-left text-text-secondary border-b border-border"><th className="py-2">Order #</th><th className="py-2">Date</th><th className="py-2">Status</th><th className="py-2">Total</th></tr></thead>
                      <tbody>{detail.orders.slice(0,10).map((o: any) => (
                        <tr key={o.id} className="border-b border-border"><td className="py-2 font-mono">{o.order_number}</td><td className="py-2">{o.created_at?.slice(0,10)}</td><td className="py-2 capitalize">{o.status}</td><td className="py-2 font-semibold">${Number(o.total).toFixed(2)}</td></tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Managers ──────────────────────────────────────────────────────────────
function ManagersPage() {
  const [staff, setStaff]     = useState<AdminStaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding]   = useState(false);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [form, setForm]       = useState({ firstName: "", lastName: "", email: "", password: "" });

  useEffect(() => {
    adminGetStaff().then((r) => setStaff(r.staff)).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  }, []);

  const addManager = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await adminCreateStaff({ ...form, role: "store_manager" });
      setStaff((p) => [...p, res.staff]);
      toast.success("Store manager added");
      setForm({ firstName: "", lastName: "", email: "", password: "" });
      setAdding(false);
    } catch (err: any) { toast.error(err.message); }
  };

  const toggle = async (id: string, isActive: boolean) => {
    try {
      await adminToggleStaff(id, isActive);
      setStaff((p) => p.map((s) => s.id === id ? { ...s, isActive } : s));
    } catch (err: any) { toast.error(err.message); }
  };

  return (
    <div className="space-y-4">
      <DashCard>
        <div className="flex justify-end mb-4">
          <button onClick={() => setAdding(true)} className="btn-primary text-sm flex items-center gap-1"><Plus className="h-4 w-4" /> Add Store Manager</button>
        </div>
        {loading ? <Spinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-text-secondary border-b border-border">
                <th className="py-2 pr-3">Name</th><th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Role</th><th className="py-2 pr-3">Active</th>
                <th className="py-2 pr-3">Added</th><th className="py-2">Actions</th>
              </tr></thead>
              <tbody>{staff.map((m) => (
                <tr key={m.id} className="border-b border-border">
                  <td className="py-3 pr-3 font-medium">{m.firstName} {m.lastName}</td>
                  <td className="py-3 pr-3 text-text-secondary">{m.email}</td>
                  <td className="py-3 pr-3 capitalize">{m.role.replace("_", " ")}</td>
                  <td className="py-3 pr-3"><Switch checked={m.isActive} onCheckedChange={(v) => toggle(m.id, v)} /></td>
                  <td className="py-3 pr-3">{m.createdAt.slice(0,10)}</td>
                  <td className="py-3">
                    {m.role !== "admin" && (
                      <button onClick={() => setToDelete(m.id)} className="text-destructive hover:underline text-sm flex items-center gap-1"><Trash2 className="h-3.5 w-3.5" /> Remove</button>
                    )}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </DashCard>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Store Manager</DialogTitle></DialogHeader>
          <form onSubmit={addManager} className="space-y-3">
            <div><label className="block text-xs font-medium mb-1">First Name</label><input required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border text-sm" /></div>
            <div><label className="block text-xs font-medium mb-1">Last Name</label><input required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border text-sm" /></div>
            <div><label className="block text-xs font-medium mb-1">Email</label><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border text-sm" /></div>
            <div><label className="block text-xs font-medium mb-1">Temporary Password</label><input required type="password" autoComplete="new-password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border text-sm" /></div>
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setAdding(false)} className="btn-outline-primary text-sm px-4 py-2">Cancel</button><button className="btn-primary text-sm px-4 py-2">Add</button></div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Remove store manager?</AlertDialogTitle><AlertDialogDescription>Their account will be deactivated.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (toDelete) { await adminToggleStaff(toDelete, false); setStaff((p) => p.filter((s) => s.id !== toDelete)); toast.success("Removed"); setToDelete(null); } }}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Blog management ───────────────────────────────────────────────────────
function BlogPage() {
  const [posts, setPosts]     = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<BlogPost | null>(null);
  const [adding, setAdding]   = useState(false);
  const [toDelete, setToDelete] = useState<string | null>(null);

  useEffect(() => {
    adminGetBlogPosts()
      .then((r) => setPosts(r.posts))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleTogglePublish = async (post: BlogPost) => {
    try {
      const res = await adminUpdateBlogPost(post.id, { isPublished: !post.isPublished });
      setPosts((p) => p.map((x) => x.id === post.id ? res.post : x));
      toast.success(!post.isPublished ? "Post published" : "Post set to draft");
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: string) => {
    try {
      await adminDeleteBlogPost(id);
      setPosts((p) => p.filter((x) => x.id !== id));
      toast.success("Post deleted");
      setToDelete(null);
    } catch (e: any) { toast.error(e.message); }
  };

  const onSaved = (post: BlogPost, isNew: boolean) => {
    setPosts((p) => isNew ? [post, ...p] : p.map((x) => x.id === post.id ? post : x));
    setAdding(false);
    setEditing(null);
    toast.success(isNew ? "Post created" : "Post updated");
  };

  return (
    <div className="space-y-4">
      <DashCard>
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-text-secondary">{posts.length} post{posts.length !== 1 ? "s" : ""}</p>
          <button onClick={() => setAdding(true)} className="btn-primary text-sm flex items-center gap-1">
            <Plus className="h-4 w-4" /> New Post
          </button>
        </div>

        {loading ? <Spinner /> : posts.length === 0 ? (
          <div className="py-12 text-center">
            <BookOpen className="h-10 w-10 text-text-secondary mx-auto mb-3" />
            <p className="text-sm text-text-secondary">No posts yet. Create your first blog post.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-text-secondary border-b border-border">
                  <th className="py-2 pr-3">Title</th>
                  <th className="py-2 pr-3">Category</th>
                  <th className="py-2 pr-3">Author</th>
                  <th className="py-2 pr-3">Read Time</th>
                  <th className="py-2 pr-3">Published</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((p) => (
                  <tr key={p.id} className="border-b border-border">
                    <td className="py-3 pr-3 font-medium max-w-[260px]">
                      <p className="truncate">{p.title}</p>
                      <p className="text-xs text-text-secondary font-mono">{p.slug}</p>
                    </td>
                    <td className="py-3 pr-3">{p.category}</td>
                    <td className="py-3 pr-3">{p.author}</td>
                    <td className="py-3 pr-3">{p.readTime}</td>
                    <td className="py-3 pr-3 text-xs">
                      {p.publishedAt
                        ? new Date(p.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : "—"}
                    </td>
                    <td className="py-3 pr-3">
                      <Switch
                        checked={p.isPublished}
                        onCheckedChange={() => handleTogglePublish(p)}
                      />
                    </td>
                    <td className="py-3">
                      <div className="flex gap-1">
                        <button onClick={() => setEditing(p)} className="p-1.5 hover:bg-muted rounded">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => setToDelete(p.id)} className="p-1.5 hover:bg-muted rounded text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashCard>

      <BlogPostDialog
        open={adding || !!editing}
        onClose={() => { setAdding(false); setEditing(null); }}
        initial={editing}
        onSaved={onSaved}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone. The post will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => toDelete && handleDelete(toDelete)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BlogPostDialog({ open, onClose, initial, onSaved }: {
  open: boolean;
  onClose: () => void;
  initial: BlogPost | null;
  onSaved: (post: BlogPost, isNew: boolean) => void;
}) {
  const blank = {
    title: "", slug: "", excerpt: "", content: "",
    category: "General", author: "CutHaven Team",
    imageUrl: "", readTime: "5 min read", isPublished: false,
  };
  const [form, setForm] = useState<any>({ ...blank });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initial ? {
        title:       initial.title,
        slug:        initial.slug,
        excerpt:     initial.excerpt,
        content:     initial.content,
        category:    initial.category,
        author:      initial.author,
        imageUrl:    initial.imageUrl ?? "",
        readTime:    initial.readTime,
        isPublished: initial.isPublished,
      } : { ...blank });
    }
  }, [open, initial]);

  const upd = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const genSlug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.excerpt.trim() || !form.content.trim()) {
      toast.error("Title, excerpt and content are required"); return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        slug:     form.slug.trim() || genSlug(form.title),
        imageUrl: form.imageUrl.trim() || null,
      };
      if (initial) {
        const res = await adminUpdateBlogPost(initial.id, payload);
        onSaved(res.post, false);
      } else {
        const res = await adminCreateBlogPost(payload);
        onSaved(res.post, true);
      }
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Post" : "New Blog Post"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1">Title *</label>
            <input required value={form.title} onChange={(e) => upd("title", e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Slug</label>
              <input value={form.slug} onChange={(e) => upd("slug", e.target.value)}
                placeholder={genSlug(form.title) || "auto-generated"}
                className="w-full px-3 py-2 rounded-lg border border-border text-sm font-mono focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Category</label>
              <input value={form.category} onChange={(e) => upd("category", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Author</label>
              <input value={form.author} onChange={(e) => upd("author", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Read Time</label>
              <input value={form.readTime} onChange={(e) => upd("readTime", e.target.value)}
                placeholder="e.g. 5 min read"
                className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Image URL</label>
            <input value={form.imageUrl} onChange={(e) => upd("imageUrl", e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary" />
            {form.imageUrl && (
              <img src={form.imageUrl} alt="" className="mt-2 h-24 w-full object-cover rounded-lg border border-border" />
            )}
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Excerpt * <span className="text-text-secondary">(shown on blog listing)</span></label>
            <textarea required rows={2} value={form.excerpt} onChange={(e) => upd("excerpt", e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary resize-none" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Content * <span className="text-text-secondary">(separate paragraphs with a blank line)</span></label>
            <textarea required rows={10} value={form.content} onChange={(e) => upd("content", e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary" />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Switch checked={form.isPublished} onCheckedChange={(v) => upd("isPublished", v)} />
            Publish immediately
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-outline-primary text-sm px-4 py-2">Cancel</button>
            <button disabled={saving} className="btn-primary text-sm px-4 py-2">
              {saving ? "Saving…" : initial ? "Save Changes" : "Create Post"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Reviews moderation ────────────────────────────────────────────────────
function ReviewsPage() {
  const [reviews, setReviews]   = useState<AdminReview[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<"all" | "pending" | "approved">("pending");
  const [detail, setDetail]     = useState<AdminReview | null>(null);

  const load = useCallback(async (f: typeof filter) => {
    setLoading(true);
    try {
      const qs = f === "all" ? "" : `?approved=${f === "approved"}`;
      const data = await adminFetch<{ reviews: AdminReview[] }>(`/admin/reviews${qs}`);
      setReviews(data.reviews);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(filter); }, [filter, load]);

  const moderate = async (id: string, isApproved: boolean) => {
    try {
      await adminFetch(`/admin/reviews/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isApproved }),
      });
      setReviews((prev) => prev.map((r) => r.id === id ? { ...r, is_approved: isApproved } : r));
      if (detail?.id === id) setDetail((d) => d ? { ...d, is_approved: isApproved } : d);
      toast.success(isApproved ? "Review approved — now visible on product page" : "Review rejected");
    } catch (e: any) { toast.error(e.message); }
  };

  const tabs: { key: typeof filter; label: string }[] = [
    { key: "pending",  label: "Pending Approval" },
    { key: "approved", label: "Approved" },
    { key: "all",      label: "All" },
  ];

  const pendingCount = reviews.filter((r) => !r.is_approved).length;

  return (
    <div className="space-y-4">
      <DashCard>
        {/* Filter tabs */}
        <div className="flex gap-1.5 mb-5 flex-wrap">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
                filter === t.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-primary/10"
              }`}
            >
              {t.label}
              {t.key === "pending" && pendingCount > 0 && filter !== "pending" && (
                <span className="ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full bg-destructive text-white text-[10px]">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? <Spinner /> : reviews.length === 0 ? (
          <div className="py-12 text-center">
            <Star className="h-10 w-10 text-text-secondary mx-auto mb-3" />
            <p className="text-sm text-text-secondary">
              {filter === "pending" ? "No reviews awaiting approval." : "No reviews found."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((r) => {
              const reviewer = r.customers
                ? `${r.customers.first_name} ${r.customers.last_name}`
                : "Unknown";
              const productName = r.products?.name ?? "Unknown product";

              return (
                <div
                  key={r.id}
                  className={`rounded-xl border p-4 transition ${
                    r.is_approved ? "border-border bg-surface" : "border-warning/30 bg-warning/5"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    {/* Left — reviewer + product + stars */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{reviewer}</p>
                        {r.is_verified_purchase && (
                          <span className="inline-flex items-center gap-1 text-xs text-success font-medium">
                            <CheckCircle2 className="h-3 w-3" /> Verified Purchase
                          </span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          r.is_approved
                            ? "bg-success/10 text-success"
                            : "bg-warning/20 text-warning-foreground"
                        }`}>
                          {r.is_approved ? "Approved" : "Pending"}
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary mt-0.5">
                        {r.customers?.email ?? ""} · {productName}
                      </p>

                      {/* Star rating */}
                      <div className="flex gap-0.5 mt-2">
                        {[1,2,3,4,5].map((n) => (
                          <Star
                            key={n}
                            className={`h-3.5 w-3.5 ${n <= r.rating ? "fill-warning text-warning" : "text-border"}`}
                          />
                        ))}
                        <span className="text-xs text-text-secondary ml-1">{r.rating}/5</span>
                      </div>

                      {/* Review text */}
                      {r.review_text && (
                        <p className="mt-2 text-sm text-text-secondary leading-relaxed line-clamp-3">
                          "{r.review_text}"
                        </p>
                      )}

                      {/* FTC flags */}
                      {r.disclosed_incentive && (
                        <p className="mt-1 text-xs text-warning">⚠ Reviewer disclosed an incentive</p>
                      )}
                      {r.insider_relationship && (
                        <p className="mt-0.5 text-xs text-warning">⚠ Insider relationship: {r.insider_relationship}</p>
                      )}

                      <p className="text-xs text-text-secondary mt-2">
                        {new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>

                    {/* Right — action buttons */}
                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        onClick={() => setDetail(r)}
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        <Eye className="h-3.5 w-3.5" /> Full review
                      </button>
                      {!r.is_approved ? (
                        <button
                          onClick={() => moderate(r.id, true)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-success/10 text-success text-xs font-semibold hover:bg-success/20 transition"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                        </button>
                      ) : (
                        <button
                          onClick={() => moderate(r.id, false)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-semibold hover:bg-destructive/20 transition"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Reject
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DashCard>

      {/* Full review detail modal */}
      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-lg">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle>Review by {detail.customers ? `${detail.customers.first_name} ${detail.customers.last_name}` : "Unknown"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                {/* Product */}
                <div className="rounded-lg bg-muted/40 px-4 py-3">
                  <p className="text-xs text-text-secondary uppercase tracking-widest mb-1">Product</p>
                  <p className="font-semibold">{detail.products?.name ?? "Unknown"}</p>
                  {detail.products?.slug && (
                    <a
                      href={`/product/${detail.products.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      View product →
                    </a>
                  )}
                </div>

                {/* Reviewer */}
                <div>
                  <p className="text-xs text-text-secondary">Reviewer</p>
                  <p className="font-medium">{detail.customers?.first_name} {detail.customers?.last_name}</p>
                  <p className="text-text-secondary text-xs">{detail.customers?.email}</p>
                </div>

                {/* Stars */}
                <div className="flex gap-0.5 items-center">
                  {[1,2,3,4,5].map((n) => (
                    <Star key={n} className={`h-5 w-5 ${n <= detail.rating ? "fill-warning text-warning" : "text-border"}`} />
                  ))}
                  <span className="text-sm font-semibold ml-2">{detail.rating} / 5</span>
                </div>

                {/* Full text */}
                {detail.review_text ? (
                  <div className="rounded-lg border border-border bg-surface p-4">
                    <p className="text-sm leading-relaxed">{detail.review_text}</p>
                  </div>
                ) : (
                  <p className="text-text-secondary text-sm italic">No written review — rating only.</p>
                )}

                {/* Flags */}
                <div className="space-y-1">
                  <p className="flex items-center gap-2 text-xs">
                    {detail.is_verified_purchase
                      ? <><CheckCircle2 className="h-3.5 w-3.5 text-success" /><span className="text-success">Verified purchase</span></>
                      : <><XCircle className="h-3.5 w-3.5 text-text-secondary" /><span className="text-text-secondary">Not verified</span></>
                    }
                  </p>
                  {detail.disclosed_incentive && (
                    <p className="text-xs text-warning">⚠ Reviewer disclosed receiving an incentive</p>
                  )}
                  {detail.insider_relationship && (
                    <p className="text-xs text-warning">⚠ Insider relationship: {detail.insider_relationship}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2 border-t border-border">
                  {!detail.is_approved ? (
                    <button
                      onClick={() => moderate(detail.id, true)}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-success text-white text-sm font-semibold hover:bg-success/90 transition"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Approve Review
                    </button>
                  ) : (
                    <button
                      onClick={() => moderate(detail.id, false)}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-destructive text-white text-sm font-semibold hover:bg-destructive/90 transition"
                    >
                      <XCircle className="h-4 w-4" /> Reject Review
                    </button>
                  )}
                  <button onClick={() => setDetail(null)} className="btn-outline-primary text-sm px-4 py-2">
                    Close
                  </button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Coupons ───────────────────────────────────────────────────────────────
function CouponsPage() {
  const [coupons, setCoupons] = useState<AdminCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding]   = useState(false);
  const [editing, setEditing] = useState<AdminCoupon | null>(null);
  const [toDelete, setToDelete] = useState<string | null>(null);

  useEffect(() => {
    adminGetCoupons()
      .then((r) => setCoupons(r.coupons))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await adminDeleteCoupon(id);
      setCoupons((p) => p.filter((c) => c.id !== id));
      toast.success("Coupon deleted");
      setToDelete(null);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleToggle = async (c: AdminCoupon) => {
    try {
      const res = await adminUpdateCoupon(c.id, { isActive: !c.is_active });
      setCoupons((p) => p.map((x) => x.id === c.id ? res.coupon : x));
    } catch (e: any) { toast.error(e.message); }
  };

  const onSaved = (coupon: AdminCoupon, isNew: boolean) => {
    setCoupons((p) => isNew ? [coupon, ...p] : p.map((x) => x.id === coupon.id ? coupon : x));
    setAdding(false);
    setEditing(null);
    toast.success(isNew ? "Coupon created" : "Coupon updated");
  };

  return (
    <div className="space-y-4">
      <DashCard>
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-text-secondary">{coupons.length} coupon{coupons.length !== 1 ? "s" : ""}</p>
          <button onClick={() => setAdding(true)} className="btn-primary text-sm flex items-center gap-1">
            <Plus className="h-4 w-4" /> Create Coupon
          </button>
        </div>

        {loading ? <Spinner /> : coupons.length === 0 ? (
          <div className="py-12 text-center">
            <Tag className="h-10 w-10 text-text-secondary mx-auto mb-3" />
            <p className="text-text-secondary text-sm">No coupons yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-text-secondary border-b border-border">
                  <th className="py-2 pr-3">Code</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Value</th>
                  <th className="py-2 pr-3">Min Order</th>
                  <th className="py-2 pr-3">Uses</th>
                  <th className="py-2 pr-3">Expires</th>
                  <th className="py-2 pr-3">Active</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((c) => (
                  <tr key={c.id} className="border-b border-border">
                    <td className="py-3 pr-3 font-mono font-semibold">{c.code}</td>
                    <td className="py-3 pr-3 capitalize">{c.discount_type === "percentage" ? "%" : "$"} off</td>
                    <td className="py-3 pr-3 font-semibold text-accent">
                      {c.discount_type === "percentage"
                        ? `${c.discount_value}%`
                        : `$${c.discount_value.toFixed(2)}`}
                    </td>
                    <td className="py-3 pr-3">
                      {c.min_order_amount ? `$${Number(c.min_order_amount).toFixed(2)}` : "—"}
                    </td>
                    <td className="py-3 pr-3">
                      {c.used_count}
                      {c.max_uses ? ` / ${c.max_uses}` : " / ∞"}
                    </td>
                    <td className="py-3 pr-3">
                      {c.valid_until ? new Date(c.valid_until).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "No expiry"}
                    </td>
                    <td className="py-3 pr-3">
                      <Switch checked={c.is_active} onCheckedChange={() => handleToggle(c)} />
                    </td>
                    <td className="py-3">
                      <div className="flex gap-1">
                        <button onClick={() => setEditing(c)} className="p-1.5 hover:bg-muted rounded" aria-label="Edit">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => setToDelete(c.id)} className="p-1.5 hover:bg-muted rounded text-destructive" aria-label="Delete">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashCard>

      {/* Create / Edit dialog */}
      <CouponDialog
        open={adding || !!editing}
        onClose={() => { setAdding(false); setEditing(null); }}
        initial={editing}
        onSaved={onSaved}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete coupon?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone. Existing orders that used this coupon are unaffected.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => toDelete && handleDelete(toDelete)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CouponDialog({ open, onClose, initial, onSaved }: {
  open: boolean;
  onClose: () => void;
  initial: AdminCoupon | null;
  onSaved: (coupon: AdminCoupon, isNew: boolean) => void;
}) {
  const blank = {
    code: "", discountType: "percentage" as "percentage" | "fixed",
    discountValue: 10, minOrderAmount: "", maxUses: "", validUntil: "", isActive: true,
  };
  const [form, setForm] = useState({ ...blank });
  const [saving, setSaving] = useState(false);

  // Reset form whenever dialog opens with a different initial value
  useEffect(() => {
    if (open) {
      setForm(initial ? {
        code:            initial.code,
        discountType:    initial.discount_type,
        discountValue:   initial.discount_value,
        minOrderAmount:  initial.min_order_amount != null ? String(initial.min_order_amount) : "",
        maxUses:         initial.max_uses != null ? String(initial.max_uses) : "",
        validUntil:      initial.valid_until ? initial.valid_until.slice(0, 10) : "",
        isActive:        initial.is_active,
      } : { ...blank });
    }
  }, [open, initial]);

  const upd = (k: keyof typeof form, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim()) { toast.error("Code is required"); return; }
    if (form.discountValue <= 0) { toast.error("Discount value must be positive"); return; }
    if (form.discountType === "percentage" && form.discountValue > 100) {
      toast.error("Percentage discount cannot exceed 100"); return;
    }

    setSaving(true);
    try {
      const payload = {
        code:               form.code.trim().toUpperCase(),
        discountType:       form.discountType,
        discountValue:      Number(form.discountValue),
        minOrderAmount:     form.minOrderAmount ? Number(form.minOrderAmount) : null,
        maxUses:            form.maxUses ? Number(form.maxUses) : null,
        validUntil:         form.validUntil ? new Date(form.validUntil + "T23:59:59Z").toISOString() : null,
        isActive:           form.isActive,
      };

      if (initial) {
        const res = await adminUpdateCoupon(initial.id, payload);
        onSaved(res.coupon, false);
      } else {
        const res = await adminCreateCoupon(payload);
        onSaved(res.coupon, true);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Coupon" : "Create Coupon"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Code */}
          <div>
            <label className="block text-xs font-medium mb-1">
              Coupon Code <span className="text-destructive">*</span>
            </label>
            <input
              value={form.code}
              onChange={(e) => upd("code", e.target.value.toUpperCase())}
              placeholder="e.g. SAVE20"
              className="w-full px-3 py-2 rounded-lg border border-border text-sm font-mono focus:outline-none focus:border-primary"
              required
            />
            <p className="text-xs text-text-secondary mt-1">Customers enter this at checkout. Automatically uppercased.</p>
          </div>

          {/* Discount type + value */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Discount Type <span className="text-destructive">*</span></label>
              <select
                value={form.discountType}
                onChange={(e) => upd("discountType", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-surface focus:outline-none focus:border-primary"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount ($)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Value <span className="text-destructive">*</span>
                <span className="text-text-secondary ml-1">
                  ({form.discountType === "percentage" ? "e.g. 20 = 20% off" : "e.g. 15 = $15 off"})
                </span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={form.discountType === "percentage" ? 100 : undefined}
                value={form.discountValue}
                onChange={(e) => upd("discountValue", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary"
                required
              />
            </div>
          </div>

          {/* Min order + max uses */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Min. Order Amount ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.minOrderAmount}
                onChange={(e) => upd("minOrderAmount", e.target.value)}
                placeholder="No minimum"
                className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Max Uses</label>
              <input
                type="number"
                step="1"
                min="1"
                value={form.maxUses}
                onChange={(e) => upd("maxUses", e.target.value)}
                placeholder="Unlimited"
                className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Expiry */}
          <div>
            <label className="block text-xs font-medium mb-1">Expiry Date</label>
            <input
              type="date"
              value={form.validUntil}
              onChange={(e) => upd("validUntil", e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary"
            />
            <p className="text-xs text-text-secondary mt-1">Leave empty for no expiry.</p>
          </div>

          {/* Active toggle */}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Switch checked={form.isActive} onCheckedChange={(v) => upd("isActive", v)} />
            Active — customers can use this coupon
          </label>

          {/* Preview */}
          {form.code && form.discountValue > 0 && (
            <div className="rounded-lg bg-success/10 border border-success/20 px-4 py-3 text-sm">
              <p className="font-semibold text-success">Preview</p>
              <p className="text-text-secondary mt-0.5">
                Code <span className="font-mono font-bold">{form.code.toUpperCase()}</span> gives{" "}
                {form.discountType === "percentage"
                  ? `${form.discountValue}% off`
                  : `$${Number(form.discountValue).toFixed(2)} off`}
                {form.minOrderAmount ? ` on orders over $${form.minOrderAmount}` : ""}
                {form.maxUses ? ` · ${form.maxUses} total uses` : " · unlimited uses"}
                {form.validUntil ? ` · expires ${new Date(form.validUntil).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-outline-primary text-sm px-4 py-2">
              Cancel
            </button>
            <button className="btn-primary text-sm px-4 py-2" disabled={saving}>
              {saving ? "Saving…" : initial ? "Save Changes" : "Create Coupon"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Settings (local UI only — no DB-backed settings table yet) ────────────
function SettingsPage() {
  const [store, setStore] = useState({ name: "CutHaven", email: "support@cuthaven.com", phone: "+1 406 229-9045", address: "1633 S Industrial Way, Palmer, AK 99645" });
  const [ship, setShip]   = useState({ freeThreshold: 350, flatRate: 9.99 });
  const [notif, setNotif] = useState({ newOrder: true, lowStock: true, weekly: false });
  return (
    <div className="space-y-4">
      <DashCard>
        <h3 className="font-display text-lg font-bold mb-4">Store Information</h3>
        <form onSubmit={(e) => { e.preventDefault(); toast.success("Saved (UI only — backend settings endpoint coming in a future milestone)"); }} className="grid md:grid-cols-2 gap-3">
          <div><label className="block text-xs font-medium mb-1">Store Name</label><input value={store.name} onChange={(e) => setStore({ ...store, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border text-sm" /></div>
          <div><label className="block text-xs font-medium mb-1">Support Email</label><input type="email" value={store.email} onChange={(e) => setStore({ ...store, email: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border text-sm" /></div>
          <div><label className="block text-xs font-medium mb-1">Phone</label><input value={store.phone} onChange={(e) => setStore({ ...store, phone: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border text-sm" /></div>
          <div><label className="block text-xs font-medium mb-1">Address</label><input value={store.address} onChange={(e) => setStore({ ...store, address: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border text-sm" /></div>
          <div className="md:col-span-2 flex justify-end"><button className="btn-primary text-sm px-4 py-2">Save</button></div>
        </form>
      </DashCard>
      <DashCard>
        <h3 className="font-display text-lg font-bold mb-4">Shipping</h3>
        <form onSubmit={(e) => { e.preventDefault(); toast.success("Saved"); }} className="grid md:grid-cols-2 gap-3">
          <div><label className="block text-xs font-medium mb-1">Free shipping threshold ($)</label><input type="number" value={ship.freeThreshold} onChange={(e) => setShip({ ...ship, freeThreshold: +e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border text-sm" /></div>
          <div><label className="block text-xs font-medium mb-1">Flat rate ($)</label><input type="number" step="0.01" value={ship.flatRate} onChange={(e) => setShip({ ...ship, flatRate: +e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border text-sm" /></div>
          <div className="md:col-span-2 flex justify-end"><button className="btn-primary text-sm px-4 py-2">Save</button></div>
        </form>
      </DashCard>
      <DashCard>
        <h3 className="font-display text-lg font-bold mb-4">Notifications</h3>
        <div className="space-y-3">
          {[{ k: "newOrder", l: "Email on new order" }, { k: "lowStock", l: "Email on low stock" }, { k: "weekly", l: "Weekly summary" }].map((n) => (
            <label key={n.k} className="flex items-center justify-between"><span className="text-sm">{n.l}</span><Switch checked={(notif as any)[n.k]} onCheckedChange={(v) => setNotif({ ...notif, [n.k]: v })} /></label>
          ))}
        </div>
      </DashCard>
    </div>
  );
}


// ─── Payment Gateways ──────────────────────────────────────────────────────

function GatewaysPage() {
  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminGetPaymentGateways();
      setGateways(data);
    } catch (err: any) {
      setError(err.message ?? "Failed to load gateways");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleActivate = async (id: string) => {
    try {
      await adminActivatePaymentGateway(id);
      toast.success("Gateway activated");
      load();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to activate gateway");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await adminDeletePaymentGateway(id);
      toast.success("Gateway deleted");
      setDeleteConfirm(null);
      load();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to delete gateway");
    }
  };

  const openForm = (id?: string) => {
    setEditingId(id ?? null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
  };

  const stripeGateways = gateways.filter((g) => g.gatewayType === "stripe");
  const paypalGateways = gateways.filter((g) => g.gatewayType === "paypal");

  if (loading) return <Spinner />;
  if (error) return <ErrMsg msg={error} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          Manage multiple Stripe and PayPal accounts. Only one per type can be active at a time.
        </p>
        <button
          onClick={() => openForm()}
          className="btn-primary inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Gateway
        </button>
      </div>

      {/* Stripe Section */}
      <DashCard>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-bold flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Stripe Accounts
          </h3>
        </div>

        {stripeGateways.length === 0 ? (
          <p className="text-sm text-text-secondary py-4 text-center">No Stripe accounts configured</p>
        ) : (
          <div className="space-y-3">
            {stripeGateways.map((g) => (
              <GatewayCard
                key={g.id}
                gateway={g}
                onActivate={() => handleActivate(g.id)}
                onEdit={() => openForm(g.id)}
                onDelete={() => setDeleteConfirm(g.id)}
              />
            ))}
          </div>
        )}
      </DashCard>

      {/* PayPal Section */}
      <DashCard>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-bold flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            PayPal Accounts
          </h3>
        </div>

        {paypalGateways.length === 0 ? (
          <p className="text-sm text-text-secondary py-4 text-center">No PayPal accounts configured</p>
        ) : (
          <div className="space-y-3">
            {paypalGateways.map((g) => (
              <GatewayCard
                key={g.id}
                gateway={g}
                onActivate={() => handleActivate(g.id)}
                onEdit={() => openForm(g.id)}
                onDelete={() => setDeleteConfirm(g.id)}
              />
            ))}
          </div>
        )}
      </DashCard>

      {/* Add/Edit Form Dialog */}
      {showForm && (
        <GatewayFormDialog
          gatewayId={editingId}
          onClose={closeForm}
          onSuccess={() => { closeForm(); load(); }}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment Gateway?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this payment gateway. If it's the only active gateway of its type, you cannot delete it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirm && handleDelete(deleteConfirm)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Gateway Card Component ────────────────────────────────────────────────

interface GatewayCardProps {
  gateway: PaymentGateway;
  onActivate: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function GatewayCard({ gateway, onActivate, onEdit, onDelete }: GatewayCardProps) {
  const isStripe = gateway.gatewayType === "stripe";

  return (
    <div className={`rounded-lg border ${gateway.isActive ? "border-primary bg-primary/5" : "border-border bg-surface"} p-4`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h4 className="font-semibold">{gateway.accountName}</h4>
            {gateway.isActive ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/10 text-success text-xs font-medium">
                <CheckCircle2 className="h-3 w-3" /> Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-500 text-xs font-medium">
                Inactive
              </span>
            )}
          </div>

          <div className="space-y-1 text-sm text-text-secondary">
            {isStripe ? (
              <>
                <p className="font-mono">Secret: {gateway.stripeSecretKey}</p>
                <p className="font-mono">Publishable: {gateway.stripePublishableKey}</p>
                <p className="font-mono">Webhook: {gateway.stripeWebhookSecret}</p>
              </>
            ) : (
              <>
                <p className="font-mono">Client ID: {gateway.paypalClientId}</p>
                <p className="font-mono">Secret: {gateway.paypalClientSecret}</p>
                <p className="capitalize">Mode: {gateway.paypalMode}</p>
              </>
            )}
          </div>

          <p className="text-xs text-text-muted mt-2">
            Created {new Date(gateway.createdAt).toLocaleDateString()}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!gateway.isActive && (
            <button
              onClick={onActivate}
              className="px-3 py-1.5 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition"
            >
              Activate
            </button>
          )}
          <button
            onClick={onEdit}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            aria-label="Edit"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 rounded-lg hover:bg-destructive/10 text-destructive transition"
            aria-label="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Gateway Form Dialog ───────────────────────────────────────────────────

interface GatewayFormDialogProps {
  gatewayId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

function GatewayFormDialog({ gatewayId, onClose, onSuccess }: GatewayFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const [gatewayType, setGatewayType] = useState<GatewayType>("stripe");
  const [accountName, setAccountName] = useState("");
  const [isActive, setIsActive] = useState(false);

  // Stripe fields
  const [stripeSecretKey, setStripeSecretKey] = useState("");
  const [stripePublishableKey, setStripePublishableKey] = useState("");
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState("");

  // PayPal fields
  const [paypalClientId, setPaypalClientId] = useState("");
  const [paypalClientSecret, setPaypalClientSecret] = useState("");
  const [paypalMode, setPaypalMode] = useState<PayPalMode>("live");

  // Load existing gateway for editing
  useEffect(() => {
    if (gatewayId) {
      setLoading(true);
      adminGetPaymentGateway(gatewayId)
        .then((g) => {
          setGatewayType(g.gatewayType);
          setAccountName(g.accountName);
          setIsActive(g.isActive);

          if (g.gatewayType === "stripe") {
            setStripeSecretKey(g.stripeSecretKey ?? "");
            setStripePublishableKey(g.stripePublishableKey ?? "");
            setStripeWebhookSecret(g.stripeWebhookSecret ?? "");
          } else {
            setPaypalClientId(g.paypalClientId ?? "");
            setPaypalClientSecret(g.paypalClientSecret ?? "");
            setPaypalMode((g.paypalMode as PayPalMode) ?? "live");
          }
        })
        .catch((err) => {
          toast.error(err.message ?? "Failed to load gateway");
          onClose();
        })
        .finally(() => setLoading(false));
    }
  }, [gatewayId, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const baseData = { accountName, isActive };

      if (gatewayType === "stripe") {
        const data: CreatePaymentGatewayRequest = {
          gatewayType: "stripe",
          ...baseData,
          stripeSecretKey,
          stripePublishableKey,
          stripeWebhookSecret,
        };

        if (gatewayId) {
          await adminUpdatePaymentGateway(gatewayId, data);
          toast.success("Gateway updated");
        } else {
          await adminCreatePaymentGateway(data);
          toast.success("Gateway created");
        }
      } else {
        const data: CreatePaymentGatewayRequest = {
          gatewayType: "paypal",
          ...baseData,
          paypalClientId,
          paypalClientSecret,
          paypalMode,
        };

        if (gatewayId) {
          await adminUpdatePaymentGateway(gatewayId, data);
          toast.success("Gateway updated");
        } else {
          await adminCreatePaymentGateway(data);
          toast.success("Gateway created");
        }
      }

      onSuccess();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save gateway");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{gatewayId ? "Edit" : "Add"} Payment Gateway</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Gateway Type (only for new gateways) */}
          {!gatewayId && (
            <div>
              <label className="block text-sm font-semibold mb-2">Gateway Type</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="stripe"
                    checked={gatewayType === "stripe"}
                    onChange={(e) => setGatewayType(e.target.value as GatewayType)}
                    className="accent-primary"
                  />
                  <span>Stripe</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="paypal"
                    checked={gatewayType === "paypal"}
                    onChange={(e) => setGatewayType(e.target.value as GatewayType)}
                    className="accent-primary"
                  />
                  <span>PayPal</span>
                </label>
              </div>
            </div>
          )}

          {/* Account Name */}
          <div>
            <label className="block text-sm font-semibold mb-2">Account Name</label>
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="e.g., Primary Stripe Account"
              required
              className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:border-primary"
            />
          </div>

          {/* Stripe Fields */}
          {gatewayType === "stripe" && (
            <>
              <div>
                <label className="block text-sm font-semibold mb-2">Secret Key</label>
                <input
                  type="password"
                  value={stripeSecretKey}
                  onChange={(e) => setStripeSecretKey(e.target.value)}
                  placeholder="sk_live_..."
                  required
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:border-primary font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Publishable Key</label>
                <input
                  type="text"
                  value={stripePublishableKey}
                  onChange={(e) => setStripePublishableKey(e.target.value)}
                  placeholder="pk_live_..."
                  required
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:border-primary font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Webhook Secret</label>
                <input
                  type="password"
                  value={stripeWebhookSecret}
                  onChange={(e) => setStripeWebhookSecret(e.target.value)}
                  placeholder="whsec_..."
                  required
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:border-primary font-mono text-sm"
                />
              </div>
            </>
          )}

          {/* PayPal Fields */}
          {gatewayType === "paypal" && (
            <>
              <div>
                <label className="block text-sm font-semibold mb-2">Client ID</label>
                <input
                  type="text"
                  value={paypalClientId}
                  onChange={(e) => setPaypalClientId(e.target.value)}
                  placeholder="AXxxx..."
                  required
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:border-primary font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Client Secret</label>
                <input
                  type="password"
                  value={paypalClientSecret}
                  onChange={(e) => setPaypalClientSecret(e.target.value)}
                  placeholder="EYxxx..."
                  required
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:border-primary font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Mode</label>
                <select
                  value={paypalMode}
                  onChange={(e) => setPaypalMode(e.target.value as PayPalMode)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:border-primary"
                >
                  <option value="sandbox">Sandbox (Test)</option>
                  <option value="live">Live (Production)</option>
                </select>
              </div>
            </>
          )}

          {/* Set as Active */}
          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <label className="text-sm font-medium">Set as active gateway</label>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 btn-primary"
            >
              {loading ? "Saving..." : gatewayId ? "Update Gateway" : "Add Gateway"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border hover:bg-surface transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
