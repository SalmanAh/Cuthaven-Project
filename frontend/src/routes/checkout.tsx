import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Lock } from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";
import { useCart } from "@/context/CartContext";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Checkout — CutHaven" }, { name: "description", content: "Secure guest checkout at CutHaven." }, { name: "robots", content: "noindex" }] }),
  component: CheckoutPage,
});

const required = ["firstName", "lastName", "email", "phone", "address", "city", "state", "zip"] as const;

function CheckoutPage() {
  const { items, subtotal, clear } = useCart();
  const nav = useNavigate();
  const [form, setForm] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [payment, setPayment] = useState("card");

  const update = (k: string, v: string) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: "" })); };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErr: Record<string, string> = {};
    required.forEach((k) => { if (!form[k]?.trim()) newErr[k] = "Required"; });
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) newErr.email = "Invalid email";
    setErrors(newErr);
    if (Object.keys(newErr).length === 0) {
      clear();
      nav({ to: "/order-confirmation" });
    }
  };

  const Field = ({ name, label, type = "text", full = false }: { name: string; label: string; type?: string; full?: boolean }) => (
    <div className={full ? "md:col-span-2" : ""}>
      <label className="block text-sm font-medium mb-1.5">{label} {required.includes(name as any) && <span className="text-destructive">*</span>}</label>
      <input type={type} value={form[name] ?? ""} onChange={(e) => update(name, e.target.value)}
        className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none ${errors[name] ? "border-destructive" : "border-border focus:border-primary"}`} />
      {errors[name] && <p className="text-xs text-destructive mt-1">{errors[name]}</p>}
    </div>
  );

  return (
    <div>
      <PageHero title="Checkout" crumbs={[{ label: "Cart", to: "/cart" }, { label: "Checkout" }]} />
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="flex items-center justify-center gap-2 mb-8 text-sm">
          <span className="text-primary font-semibold">1. Cart ✓</span>
          <span className="text-text-muted">→</span>
          <span className="text-accent font-semibold">2. Details</span>
          <span className="text-text-muted">→</span>
          <span className="text-text-muted">3. Confirmation</span>
        </div>

        <form onSubmit={submit} className="grid lg:grid-cols-[1fr_400px] gap-8">
          <div className="card-surface p-6 md:p-8">
            <h2 className="font-display text-2xl font-bold mb-6">Billing Details</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <Field name="firstName" label="First Name" />
              <Field name="lastName" label="Last Name" />
              <Field name="email" label="Email" type="email" />
              <Field name="phone" label="Phone" type="tel" />
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1.5">Business Name (optional)</label>
                <input value={form.business ?? ""} onChange={(e) => update("business", e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-border text-sm focus:outline-none focus:border-primary" />
              </div>
              <Field name="address" label="Address" full />
              <Field name="city" label="City" />
              <Field name="state" label="State" />
              <Field name="zip" label="ZIP" />
              <div>
                <label className="block text-sm font-medium mb-1.5">Country</label>
                <select className="w-full px-3 py-2.5 rounded-lg border border-border text-sm focus:outline-none focus:border-primary bg-surface">
                  <option>United States</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1.5">Order notes (optional)</label>
                <textarea rows={3} className="w-full px-3 py-2.5 rounded-lg border border-border text-sm focus:outline-none focus:border-primary" />
              </div>
            </div>
          </div>

          <aside className="card-surface p-6 h-fit lg:sticky lg:top-24">
            <h3 className="font-display text-xl font-bold mb-4">Your Order</h3>
            <div className="space-y-2 text-sm border-b border-border pb-4">
              {items.map(({ product, quantity }) => (
                <div key={product.id} className="flex justify-between">
                  <span className="line-clamp-1 pr-2">{product.name} × {quantity}</span>
                  <span className="font-semibold shrink-0">${((product.salePrice ?? product.price) * quantity).toFixed(2)}</span>
                </div>
              ))}
              {items.length === 0 && <p className="text-text-secondary">No items in cart.</p>}
            </div>
            <div className="space-y-2 text-sm border-b border-border py-4">
              <div className="flex justify-between"><span className="text-text-secondary">Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-text-secondary">Shipping</span><span className="text-success font-semibold">FREE</span></div>
            </div>
            <div className="flex justify-between py-4 text-lg">
              <span className="font-bold">Total</span><span className="font-bold text-accent">${subtotal.toFixed(2)}</span>
            </div>
            <div className="mb-5">
              <p className="font-semibold mb-2 text-sm">Payment Method</p>
              <div className="flex gap-1.5 mb-3">
                {["Visa", "Mastercard", "Amex", "Discover"].map((b) => (
                  <span key={b} className="text-[10px] px-2 py-1 rounded bg-muted border border-border font-semibold text-text-secondary">{b}</span>
                ))}
              </div>
              {[{ id: "card", label: "Credit / Debit Card" }, { id: "paypal", label: "PayPal" }].map((p) => (
                <label key={p.id} className="flex items-center gap-2 py-1.5 text-sm cursor-pointer">
                  <input type="radio" name="pay" checked={payment === p.id} onChange={() => setPayment(p.id)} className="accent-primary" />
                  {p.label}
                </label>
              ))}
              {payment === "card" && (
                <div className="mt-3 space-y-2 p-3 rounded-lg border border-border bg-muted/30">
                  <div><label htmlFor="cc-num" className="block text-xs font-medium mb-1">Card Number</label>
                    <input id="cc-num" autoComplete="cc-number" inputMode="numeric" placeholder="1234 5678 9012 3456" maxLength={19} className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary" /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label htmlFor="cc-exp" className="block text-xs font-medium mb-1">Expiry (MM/YY)</label>
                      <input id="cc-exp" autoComplete="cc-exp" placeholder="MM/YY" maxLength={5} className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary" /></div>
                    <div><label htmlFor="cc-cvc" className="block text-xs font-medium mb-1">CVC</label>
                      <input id="cc-cvc" autoComplete="cc-csc" inputMode="numeric" placeholder="123" maxLength={4} className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary" /></div>
                  </div>
                  <div><label htmlFor="cc-name" className="block text-xs font-medium mb-1">Name on Card</label>
                    <input id="cc-name" autoComplete="cc-name" className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary" /></div>
                </div>
              )}
              {payment === "paypal" && (
                <div className="mt-3 p-3 rounded-lg border border-border bg-muted/30 text-xs">
                  <p className="mb-2">You'll be redirected to PayPal to complete your purchase securely.</p>
                  <div className="px-3 py-2 rounded-md text-center bg-[#FFC439] text-[#111] font-bold text-sm">PayPal</div>
                </div>
              )}
            </div>
            <button type="submit" className="btn-primary w-full">Place Order →</button>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-text-secondary justify-center"><Lock className="h-3.5 w-3.5" /> Secure SSL checkout</p>
          </aside>
        </form>
      </div>
    </div>
  );
}
