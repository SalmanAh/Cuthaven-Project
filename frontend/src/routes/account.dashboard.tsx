import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Package,
  Heart,
  User,
  MapPin,
  Key,
  LogOut,
  Eye,
  EyeOff,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  DashboardShell,
  DashCard,
  StatCard,
  type NavItem,
} from "@/components/dashboard/DashboardShell";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useWishlist } from "@/context/WishlistContext";
import { PasswordStrength } from "@/components/ui/PasswordStrength";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useAuth } from "@/context/AuthContext";
import {
  getMyOrders,
  getMyProfile,
  updateMyProfile,
  changeMyPassword,
  getMyAddresses,
  updateMyAddresses,
  type ApiOrder,
  type CustomerAddress,
  type CustomerProfile,
} from "@/lib/api-client";

type Tab = "dashboard" | "orders" | "addresses" | "profile" | "password";

export const Route = createFileRoute("/account/dashboard")({
  head: () => ({
    meta: [
      { title: "My Account — CutHaven" },
      {
        name: "description",
        content: "Manage your CutHaven orders, wishlist, addresses, and profile.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CustomerDashboard,
});

function CustomerDashboard() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const nav = useNavigate();
  const { count: wishCount } = useWishlist();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    nav({ to: "/account/login" });
  };

  const items: NavItem[] = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "orders", label: "My Orders", icon: Package },
    { key: "wishlist", label: "My Wishlist", icon: Heart, onClick: () => nav({ to: "/wishlist" }) },
    { key: "addresses", label: "Addresses", icon: MapPin },
    { key: "profile", label: "Profile", icon: User },
    { key: "password", label: "Change Password", icon: Key },
    { key: "logout", label: "Logout", icon: LogOut, onClick: handleLogout },
  ];

  const titles: Record<Tab, string> = {
    dashboard: "Dashboard",
    orders: "My Orders",
    addresses: "Addresses",
    profile: "Profile",
    password: "Change Password",
  };

  return (
    <RequireAuth roles={["customer"]}>
      <DashboardShell
        title={titles[tab]}
        sidebarTitle="My Account"
        nav={items}
        activeKey={tab}
        onSelect={(k) => setTab(k as Tab)}
      >
        {tab === "dashboard" && (
          <DashboardOverview
            wishCount={wishCount}
            onViewOrders={() => setTab("orders")}
            user={user}
          />
        )}
        {tab === "orders" && <MyOrders />}
        {tab === "addresses" && <MyAddresses />}
        {tab === "profile" && <MyProfile />}
        {tab === "password" && <ChangePassword />}
      </DashboardShell>
    </RequireAuth>
  );
}

// ─── Overview tab ──────────────────────────────────────────────────────────

function DashboardOverview({
  wishCount,
  onViewOrders,
  user,
}: {
  wishCount: number;
  onViewOrders: () => void;
  user: { firstName: string } | null;
}) {
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["my-orders"],
    queryFn: getMyOrders,
  });

  const { data: addresses = [] } = useQuery({
    queryKey: ["my-addresses"],
    queryFn: getMyAddresses,
  });

  return (
    <div className="space-y-6">
      <p className="font-display text-xl">
        Hello, <span className="font-bold text-primary">{user?.firstName ?? "there"}!</span>
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Orders" value={isLoading ? "…" : orders.length} />
        <StatCard label="Wishlist Items" value={wishCount} />
        <StatCard label="Saved Addresses" value={addresses.length} />
      </div>

      <DashCard>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-bold">Recent Orders</h3>
          <button onClick={onViewOrders} className="text-primary text-sm hover:underline">
            View all
          </button>
        </div>
        {isLoading ? (
          <p className="text-sm text-text-secondary py-4">Loading orders…</p>
        ) : orders.length === 0 ? (
          <div className="text-center py-8">
            <Package className="h-10 w-10 text-primary mx-auto mb-2" />
            <p className="text-sm text-text-secondary">No orders yet</p>
            <Link to="/shop" className="btn-primary mt-3 inline-flex text-sm">
              Start Shopping
            </Link>
          </div>
        ) : (
          <OrdersTable orders={orders.slice(0, 5)} />
        )}
      </DashCard>
    </div>
  );
}

// ─── Orders tab ────────────────────────────────────────────────────────────

function MyOrders() {
  const [detail, setDetail] = useState<ApiOrder | null>(null);
  const {
    data: orders = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["my-orders"],
    queryFn: getMyOrders,
  });

  if (isLoading)
    return (
      <DashCard>
        <p className="py-8 text-center text-text-secondary text-sm">Loading orders…</p>
      </DashCard>
    );
  if (isError)
    return (
      <DashCard>
        <p className="py-8 text-center text-destructive text-sm">
          Failed to load orders. Please try again.
        </p>
      </DashCard>
    );
  if (orders.length === 0)
    return (
      <DashCard>
        <div className="text-center py-10">
          <Package className="h-12 w-12 text-primary mx-auto mb-3" />
          <p className="font-semibold">You haven't placed any orders yet</p>
          <Link to="/shop" className="btn-primary mt-4 inline-flex">
            Start Shopping
          </Link>
        </div>
      </DashCard>
    );

  return (
    <>
      <DashCard>
        <OrdersTable orders={orders} onView={setDetail} />
      </DashCard>

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle>Order {detail.orderNumber}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary">
                    {new Date(detail.createdAt).toLocaleDateString()}
                  </span>
                  <StatusBadge status={detail.status} />
                </div>

                <div className="space-y-2">
                  {detail.items.map((it) => (
                    <div
                      key={it.id}
                      className="flex gap-3 items-center border-b border-border pb-2"
                    >
                      {it.productImage ? (
                        <img
                          src={it.productImage}
                          alt=""
                          className="h-12 w-12 rounded object-cover"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
                          <Package className="h-5 w-5 text-text-secondary" />
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-medium">{it.productName}</p>
                        <p className="text-xs text-text-secondary">Qty {it.quantity}</p>
                      </div>
                      <p className="font-semibold">${it.totalPrice.toFixed(2)}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-1 pt-2 border-t border-border text-text-secondary">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>${detail.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shipping</span>
                    <span>
                      {detail.shippingCost === 0 ? "Free" : `$${detail.shippingCost.toFixed(2)}`}
                    </span>
                  </div>
                  {detail.taxAmount > 0 && (
                    <div className="flex justify-between">
                      <span>Tax</span>
                      <span>${detail.taxAmount.toFixed(2)}</span>
                    </div>
                  )}
                  {detail.discountAmount > 0 && (
                    <div className="flex justify-between text-success">
                      <span>Discount</span>
                      <span>-${detail.discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base text-foreground pt-1 border-t border-border">
                    <span>Total</span>
                    <span className="text-accent">${detail.total.toFixed(2)}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-border">
                  <p className="font-semibold mb-1">Shipping Address</p>
                  <p className="text-text-secondary">
                    {detail.shippingAddress.line1 ?? detail.shippingAddress.address ?? ""},{" "}
                    {detail.shippingAddress.city}, {detail.shippingAddress.state}{" "}
                    {detail.shippingAddress.zip}
                  </p>
                </div>

                {detail.paymentMethod && (
                  <p className="text-text-secondary">Payment: {detail.paymentMethod}</p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function OrdersTable({
  orders,
  onView,
}: {
  orders: ApiOrder[];
  onView?: (order: ApiOrder) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-text-secondary border-b border-border">
            <th className="py-2 pr-3">Order #</th>
            <th className="py-2 pr-3">Date</th>
            <th className="py-2 pr-3">Items</th>
            <th className="py-2 pr-3">Status</th>
            <th className="py-2 pr-3">Total</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-b border-border">
              <td className="py-3 pr-3 font-mono">{o.orderNumber}</td>
              <td className="py-3 pr-3">{new Date(o.createdAt).toLocaleDateString()}</td>
              <td className="py-3 pr-3">{o.items.reduce((a, i) => a + i.quantity, 0)}</td>
              <td className="py-3 pr-3">
                <StatusBadge status={o.status} />
              </td>
              <td className="py-3 pr-3 font-semibold">${o.total.toFixed(2)}</td>
              <td className="py-3">
                {onView && (
                  <button
                    onClick={() => onView(o)}
                    className="text-primary hover:underline text-xs"
                  >
                    View
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Addresses tab ─────────────────────────────────────────────────────────

function MyAddresses() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<CustomerAddress | null>(null);
  const [adding, setAdding] = useState(false);

  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ["my-addresses"],
    queryFn: getMyAddresses,
  });

  const saveMutation = useMutation({
    mutationFn: updateMyAddresses,
    onSuccess: (updated) => {
      qc.setQueryData(["my-addresses"], updated);
      toast.success("Address saved");
      setEditing(null);
      setAdding(false);
    },
    onError: () => toast.error("Failed to save address"),
  });

  const handleSave = (addr: CustomerAddress) => {
    let next: CustomerAddress[];
    const exists = addresses.some((a) => a.id === addr.id);
    if (exists) {
      next = addresses.map((a) => (a.id === addr.id ? addr : a));
    } else {
      next = [...addresses, addr];
    }
    // Enforce single default
    if (addr.isDefault) {
      next = next.map((a) => ({ ...a, isDefault: a.id === addr.id }));
    }
    saveMutation.mutate(next);
  };

  const handleRemove = (id: string) => {
    const next = addresses.filter((a) => a.id !== id);
    saveMutation.mutate(next);
    toast.success("Address removed");
  };

  if (isLoading)
    return (
      <DashCard>
        <p className="py-8 text-center text-text-secondary text-sm">Loading addresses…</p>
      </DashCard>
    );

  return (
    <>
      <div className="grid md:grid-cols-2 gap-4">
        {addresses.map((a) => (
          <DashCard key={a.id}>
            <div className="flex items-center gap-2 mb-2">
              <p className="font-semibold">{a.label}</p>
              {a.isDefault && (
                <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                  Default
                </span>
              )}
            </div>
            <p className="text-sm">
              {a.firstName} {a.lastName}
            </p>
            <p className="text-sm text-text-secondary">{a.address}</p>
            <p className="text-sm text-text-secondary">
              {a.city}, {a.state} {a.zip}
            </p>
            {a.phone && <p className="text-sm text-text-secondary">{a.phone}</p>}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setEditing(a)}
                className="text-primary text-sm flex items-center gap-1 hover:underline"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
              <button
                onClick={() => handleRemove(a.id)}
                className="text-destructive text-sm flex items-center gap-1 hover:underline"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          </DashCard>
        ))}
        <button
          onClick={() => setAdding(true)}
          className="bg-surface rounded-2xl border-2 border-dashed border-border p-5 flex flex-col items-center justify-center hover:border-primary hover:text-primary transition min-h-[180px]"
        >
          <Plus className="h-8 w-8 mb-2" />
          <span className="font-medium">Add New Address</span>
        </button>
      </div>

      <AddressDialog
        open={!!editing || adding}
        onClose={() => {
          setEditing(null);
          setAdding(false);
        }}
        initial={editing}
        onSave={handleSave}
        saving={saveMutation.isPending}
      />
    </>
  );
}

function AddressDialog({
  open,
  onClose,
  initial,
  onSave,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  initial: CustomerAddress | null;
  onSave: (a: CustomerAddress) => void;
  saving: boolean;
}) {
  const blank: CustomerAddress = {
    id: `addr-${Date.now()}`,
    label: "",
    firstName: "",
    lastName: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    phone: "",
    isDefault: false,
  };
  const [form, setForm] = useState<CustomerAddress>(initial ?? blank);
  const upd = <K extends keyof CustomerAddress>(k: K, v: CustomerAddress[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Reset form when dialog opens
  useState(() => {
    setForm(initial ?? blank);
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Address" : "Add New Address"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(form);
          }}
          className="grid grid-cols-2 gap-3"
        >
          <LabelInput
            label="Label (e.g. Home)"
            value={form.label}
            onChange={(v) => upd("label", v)}
            full
          />
          <LabelInput
            label="First Name"
            value={form.firstName}
            onChange={(v) => upd("firstName", v)}
          />
          <LabelInput
            label="Last Name"
            value={form.lastName}
            onChange={(v) => upd("lastName", v)}
          />
          <LabelInput
            label="Street Address"
            value={form.address}
            onChange={(v) => upd("address", v)}
            full
          />
          <LabelInput label="City" value={form.city} onChange={(v) => upd("city", v)} />
          <LabelInput label="State" value={form.state} onChange={(v) => upd("state", v)} />
          <LabelInput label="ZIP Code" value={form.zip} onChange={(v) => upd("zip", v)} />
          <LabelInput
            label="Phone (optional)"
            value={form.phone}
            onChange={(v) => upd("phone", v)}
            required={false}
          />
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => upd("isDefault", e.target.checked)}
              className="accent-primary"
            />
            Set as default address
          </label>
          <div className="col-span-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-outline-primary text-sm px-4 py-2"
            >
              Cancel
            </button>
            <button className="btn-primary text-sm px-4 py-2" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Profile tab ───────────────────────────────────────────────────────────

function MyProfile() {
  const qc = useQueryClient();
  const { data: profile, isLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: getMyProfile,
  });

  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "" });
  const [initialized, setInitialized] = useState(false);

  if (profile && !initialized) {
    setForm({
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: profile.phone ?? "",
    });
    setInitialized(true);
  }

  const mutation = useMutation({
    mutationFn: () => updateMyProfile(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success("Profile updated");
    },
    onError: () => toast.error("Failed to update profile"),
  });

  if (isLoading)
    return (
      <DashCard>
        <p className="py-8 text-center text-text-secondary text-sm">Loading…</p>
      </DashCard>
    );

  return (
    <DashCard>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
        className="grid md:grid-cols-2 gap-4 max-w-2xl"
      >
        <LabelInput
          label="First Name"
          value={form.firstName}
          onChange={(v) => setForm({ ...form, firstName: v })}
        />
        <LabelInput
          label="Last Name"
          value={form.lastName}
          onChange={(v) => setForm({ ...form, lastName: v })}
        />
        <div className="md:col-span-2">
          <label className="block text-xs font-medium mb-1">Email</label>
          <input
            type="email"
            value={profile?.email ?? ""}
            disabled
            className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-muted text-text-secondary"
          />
          <p className="text-xs text-text-secondary mt-1">Email cannot be changed here</p>
        </div>
        <LabelInput
          label="Phone (optional)"
          value={form.phone}
          onChange={(v) => setForm({ ...form, phone: v })}
          full
          required={false}
        />
        <div className="md:col-span-2 flex justify-end">
          <button className="btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </DashCard>
  );
}

// ─── PwField — TOP-LEVEL. Never define inside ChangePassword or any other component.
function PwField({
  id,
  label,
  value,
  onChange,
  showPw,
  onToggle,
  error,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  showPw: boolean;
  onToggle: () => void;
  error?: string;
  autoComplete: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={showPw ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full px-3 py-2.5 pr-10 rounded-lg border text-sm focus:outline-none ${error ? "border-destructive" : "border-border focus:border-primary"}`}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary"
          aria-label="Toggle password"
        >
          {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}

// ─── Change Password tab ───────────────────────────────────────────────────

function ChangePassword() {
  const [cur, setCur] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState({ cur: false, new: false, confirm: false });
  const [err, setErr] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: () => changeMyPassword(cur, newPw),
    onSuccess: () => {
      toast.success("Password updated successfully");
      setCur("");
      setNewPw("");
      setConfirm("");
    },
    onError: (e: Error) => setErr({ form: e.message }),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const e2: Record<string, string> = {};
    if (!cur) e2.cur = "Required";
    if (newPw.length < 8) e2.new = "Must be at least 8 characters";
    if (newPw !== confirm) e2.confirm = "Passwords do not match";
    setErr(e2);
    if (Object.keys(e2).length === 0) mutation.mutate();
  };

  return (
    <DashCard>
      <form onSubmit={submit} className="space-y-4 max-w-md">
        {err.form && (
          <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {err.form}
          </div>
        )}
        <PwField
          id="pw-cur"
          label="Current Password"
          value={cur}
          onChange={setCur}
          showPw={show.cur}
          onToggle={() => setShow((s) => ({ ...s, cur: !s.cur }))}
          error={err.cur}
          autoComplete="current-password"
        />
        <div>
          <PwField
            id="pw-new"
            label="New Password"
            value={newPw}
            onChange={setNewPw}
            showPw={show.new}
            onToggle={() => setShow((s) => ({ ...s, new: !s.new }))}
            error={err.new}
            autoComplete="new-password"
          />
          <PasswordStrength password={newPw} />
        </div>
        <PwField
          id="pw-conf"
          label="Confirm New Password"
          value={confirm}
          onChange={setConfirm}
          showPw={show.confirm}
          onToggle={() => setShow((s) => ({ ...s, confirm: !s.confirm }))}
          error={err.confirm}
          autoComplete="new-password"
        />
        <button className="btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? "Updating…" : "Update Password"}
        </button>
      </form>
    </DashCard>
  );
}

// ─── Shared input component ────────────────────────────────────────────────

function LabelInput({
  label,
  value,
  onChange,
  full,
  type = "text",
  required = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  full?: boolean;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <label className="block text-xs font-medium mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary"
      />
    </div>
  );
}
