import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { LayoutDashboard, Package, Heart, User, MapPin, Key, LogOut, Eye, EyeOff, Plus, Pencil, Trash2, Star } from "lucide-react";
import { toast } from "sonner";
import { DashboardShell, DashCard, StatCard, type NavItem } from "@/components/dashboard/DashboardShell";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { mockOrders } from "@/data/orders";
import { mockAddresses, type Address } from "@/data/addresses";
import { useWishlist } from "@/context/WishlistContext";
import { PasswordStrength } from "@/components/ui/PasswordStrength";

type Tab = "dashboard" | "orders" | "addresses" | "profile" | "password";

export const Route = createFileRoute("/account/dashboard")({
  head: () => ({ meta: [
    { title: "My Account — CutHaven" },
    { name: "description", content: "Manage your CutHaven orders, wishlist, addresses, and profile." },
    { property: "og:title", content: "My Account — CutHaven" },
    { property: "og:description", content: "Manage your CutHaven orders, wishlist, addresses, and profile." },
  ] }),
  component: CustomerDashboard,
});

function CustomerDashboard() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const nav = useNavigate();
  const { count: wishCount } = useWishlist();

  const items: NavItem[] = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "orders", label: "My Orders", icon: Package },
    { key: "wishlist", label: "My Wishlist", icon: Heart, onClick: () => nav({ to: "/wishlist" }) },
    { key: "addresses", label: "Addresses", icon: MapPin },
    { key: "profile", label: "Profile", icon: User },
    { key: "password", label: "Change Password", icon: Key },
    { key: "logout", label: "Logout", icon: LogOut, onClick: () => nav({ to: "/account/login" }) },
  ];

  const titles: Record<Tab, string> = {
    dashboard: "Dashboard", orders: "My Orders", addresses: "Addresses", profile: "Profile", password: "Change Password",
  };

  return (
    <DashboardShell title={titles[tab]} sidebarTitle="My Account" nav={items} activeKey={tab} onSelect={(k) => setTab(k as Tab)}>
      {tab === "dashboard" && <DashboardOverview wishCount={wishCount} onView={() => setTab("orders")} />}
      {tab === "orders" && <MyOrders />}
      {tab === "addresses" && <MyAddresses />}
      {tab === "profile" && <MyProfile />}
      {tab === "password" && <ChangePassword />}
    </DashboardShell>
  );
}

function DashboardOverview({ wishCount, onView }: { wishCount: number; onView: () => void }) {
  const recent = mockOrders.slice(0, 5);
  return (
    <div className="space-y-6">
      <p className="font-display text-xl">Hello, <span className="font-bold text-primary">Sarah!</span></p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Orders" value={mockOrders.length} />
        <StatCard label="Wishlist Items" value={wishCount} />
        <StatCard label="Saved Addresses" value={mockAddresses.length} />
      </div>
      <DashCard>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-bold">Recent Orders</h3>
          <button onClick={onView} className="text-primary text-sm hover:underline">View all</button>
        </div>
        <OrdersTable orders={recent} />
      </DashCard>
    </div>
  );
}

function OrdersTable({ orders, onView }: { orders: typeof mockOrders; onView?: (id: string) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-text-secondary border-b border-border">
          <th className="py-2 pr-3">Order #</th><th className="py-2 pr-3">Date</th>
          <th className="py-2 pr-3">Items</th><th className="py-2 pr-3">Status</th>
          <th className="py-2 pr-3">Total</th><th className="py-2"></th>
        </tr></thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-b border-border">
              <td className="py-3 pr-3 font-mono">{o.id}</td>
              <td className="py-3 pr-3">{o.date}</td>
              <td className="py-3 pr-3">{o.items.reduce((a, i) => a + i.quantity, 0)}</td>
              <td className="py-3 pr-3"><StatusBadge status={o.status} /></td>
              <td className="py-3 pr-3 font-semibold">${o.total.toFixed(2)}</td>
              <td className="py-3">
                {onView ? <button onClick={() => onView(o.id)} className="text-primary hover:underline">View</button>
                  : <Link to="/order-confirmation" className="text-primary hover:underline">View</Link>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MyOrders() {
  const [detail, setDetail] = useState<string | null>(null);
  const order = detail ? mockOrders.find((o) => o.id === detail) : null;
  if (mockOrders.length === 0) return (
    <DashCard><div className="text-center py-10"><Package className="h-12 w-12 text-primary mx-auto mb-3" /><p className="font-semibold">You haven't placed any orders yet</p><Link to="/shop" className="btn-primary mt-4 inline-flex">Start Shopping</Link></div></DashCard>
  );
  return (
    <>
      <DashCard><OrdersTable orders={mockOrders} onView={setDetail} /></DashCard>
      <Dialog open={!!order} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {order && (
            <>
              <DialogHeader><DialogTitle>Order {order.id}</DialogTitle></DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="flex justify-between"><span>Date: {order.date}</span><StatusBadge status={order.status} /></div>
                <div className="space-y-2">
                  {order.items.map((it, i) => (
                    <div key={i} className="flex gap-3 items-center border-b border-border pb-2">
                      <img src={it.image} alt="" className="h-12 w-12 rounded" />
                      <div className="flex-1"><p className="font-medium">{it.name}</p><p className="text-xs text-text-secondary">Qty {it.quantity}</p></div>
                      <p className="font-semibold">${(it.price * it.quantity).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between font-bold text-base"><span>Total</span><span className="text-accent">${order.total.toFixed(2)}</span></div>
                <div className="pt-3 border-t border-border">
                  <p className="font-semibold mb-1">Shipping Address</p>
                  <p className="text-text-secondary">{order.address.line1}, {order.address.city}, {order.address.state} {order.address.zip}</p>
                </div>
                <p className="text-text-secondary">Payment: {order.paymentMethod}</p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function MyAddresses() {
  const [addrs, setAddrs] = useState<Address[]>(mockAddresses);
  const [editing, setEditing] = useState<Address | null>(null);
  const [adding, setAdding] = useState(false);

  const save = (a: Address) => {
    setAddrs((prev) => {
      const next = prev.some((x) => x.id === a.id) ? prev.map((x) => x.id === a.id ? a : x) : [...prev, a];
      return a.isDefault ? next.map((x) => x.id === a.id ? x : { ...x, isDefault: false }) : next;
    });
    toast.success("Address saved"); setEditing(null); setAdding(false);
  };
  const remove = (id: string) => { setAddrs((p) => p.filter((a) => a.id !== id)); toast.success("Address removed"); };

  return (
    <>
      <div className="grid md:grid-cols-2 gap-4">
        {addrs.map((a) => (
          <DashCard key={a.id}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <p className="font-semibold">{a.label}</p>
                {a.isDefault && <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">Default</span>}
              </div>
            </div>
            <p className="text-sm">{a.firstName} {a.lastName}</p>
            <p className="text-sm text-text-secondary">{a.address}</p>
            <p className="text-sm text-text-secondary">{a.city}, {a.state} {a.zip}</p>
            <p className="text-sm text-text-secondary">{a.phone}</p>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setEditing(a)} className="text-primary text-sm flex items-center gap-1 hover:underline"><Pencil className="h-3.5 w-3.5" /> Edit</button>
              <button onClick={() => remove(a.id)} className="text-destructive text-sm flex items-center gap-1 hover:underline"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
            </div>
          </DashCard>
        ))}
        <button onClick={() => setAdding(true)} className="bg-surface rounded-2xl border-2 border-dashed border-border p-5 flex flex-col items-center justify-center hover:border-primary hover:text-primary transition min-h-[180px]">
          <Plus className="h-8 w-8 mb-2" /><span className="font-medium">Add New Address</span>
        </button>
      </div>
      <AddressDialog open={!!editing || adding} onClose={() => { setEditing(null); setAdding(false); }} initial={editing} onSave={save} />
    </>
  );
}

function AddressDialog({ open, onClose, initial, onSave }: { open: boolean; onClose: () => void; initial: Address | null; onSave: (a: Address) => void }) {
  const [form, setForm] = useState<Address>(initial ?? { id: `a${Date.now()}`, label: "", firstName: "", lastName: "", address: "", city: "", state: "", zip: "", phone: "", isDefault: false });
  const upd = (k: keyof Address, v: any) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{initial ? "Edit Address" : "Add New Address"}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="grid grid-cols-2 gap-3">
          <LabelInput label="Label" value={form.label} onChange={(v) => upd("label", v)} full />
          <LabelInput label="First Name" value={form.firstName} onChange={(v) => upd("firstName", v)} />
          <LabelInput label="Last Name" value={form.lastName} onChange={(v) => upd("lastName", v)} />
          <LabelInput label="Address" value={form.address} onChange={(v) => upd("address", v)} full />
          <LabelInput label="City" value={form.city} onChange={(v) => upd("city", v)} />
          <LabelInput label="State" value={form.state} onChange={(v) => upd("state", v)} />
          <LabelInput label="ZIP" value={form.zip} onChange={(v) => upd("zip", v)} />
          <LabelInput label="Phone" value={form.phone} onChange={(v) => upd("phone", v)} />
          <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isDefault} onChange={(e) => upd("isDefault", e.target.checked)} className="accent-primary" /> Set as default</label>
          <div className="col-span-2 flex justify-end gap-2"><button type="button" onClick={onClose} className="btn-outline-primary text-sm px-4 py-2">Cancel</button><button className="btn-primary text-sm px-4 py-2">Save</button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LabelInput({ label, value, onChange, full, type = "text" }: { label: string; value: string; onChange: (v: string) => void; full?: boolean; type?: string }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <label className="block text-xs font-medium mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} required className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary" />
    </div>
  );
}

function MyProfile() {
  const [form, setForm] = useState({ firstName: "Sarah", lastName: "Mitchell", email: "sarah@example.com", phone: "+1 907 555-0123" });
  const submit = (e: React.FormEvent) => { e.preventDefault(); toast.success("Profile updated"); };
  return (
    <DashCard>
      <form onSubmit={submit} className="grid md:grid-cols-2 gap-4 max-w-2xl">
        <LabelInput label="First Name" value={form.firstName} onChange={(v) => setForm({ ...form, firstName: v })} />
        <LabelInput label="Last Name" value={form.lastName} onChange={(v) => setForm({ ...form, lastName: v })} />
        <div className="md:col-span-2">
          <label htmlFor="prof-email" className="block text-xs font-medium mb-1">Email</label>
          <input id="prof-email" type="email" autoComplete="email" value={form.email} disabled className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-muted text-text-secondary" />
          <p className="text-xs text-text-secondary mt-1">Email cannot be changed</p>
        </div>
        <LabelInput label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} full />
        <div className="md:col-span-2 flex justify-end"><button className="btn-primary">Save Changes</button></div>
      </form>
    </DashCard>
  );
}

function ChangePassword() {
  const [cur, setCur] = useState(""); const [n, setN] = useState(""); const [c, setC] = useState("");
  const [s1, setS1] = useState(false); const [s2, setS2] = useState(false); const [s3, setS3] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const e2: Record<string, string> = {};
    if (!cur) e2.cur = "Required";
    if (n.length < 8) e2.n = "Must be at least 8 characters";
    if (n !== c) e2.c = "Passwords do not match";
    setErr(e2);
    if (Object.keys(e2).length === 0) { toast.success("Password updated"); setCur(""); setN(""); setC(""); }
  };
  const PwField = ({ id, label, value, on, show, toggle, error, autoComplete }: any) => (
    <div>
      <label htmlFor={id} className="block text-sm font-medium mb-1.5">{label}</label>
      <div className="relative">
        <input id={id} type={show ? "text" : "password"} autoComplete={autoComplete} value={value} onChange={(e) => on(e.target.value)}
          className={`w-full px-3 py-2.5 pr-10 rounded-lg border text-sm focus:outline-none ${error ? "border-destructive" : "border-border focus:border-primary"}`} />
        <button type="button" onClick={toggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary" aria-label="Toggle password">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
      </div>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
  return (
    <DashCard>
      <form onSubmit={submit} className="space-y-4 max-w-md">
        <PwField id="pw-cur" label="Current Password" value={cur} on={setCur} show={s1} toggle={() => setS1(!s1)} error={err.cur} autoComplete="current-password" />
        <div>
          <PwField id="pw-new" label="New Password" value={n} on={setN} show={s2} toggle={() => setS2(!s2)} error={err.n} autoComplete="new-password" />
          <PasswordStrength password={n} />
        </div>
        <PwField id="pw-conf" label="Confirm New Password" value={c} on={setC} show={s3} toggle={() => setS3(!s3)} error={err.c} autoComplete="new-password" />
        <button className="btn-primary">Update Password</button>
      </form>
    </DashCard>
  );
}
