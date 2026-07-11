import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Lock, ShoppingBag } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { PageHero } from "@/components/ui/PageHero";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { createPaymentIntent, type PaymentIntentResponse } from "@/lib/api-client";
import { toast } from "sonner";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? "");

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — CutHaven" },
      { name: "description", content: "Secure checkout at CutHaven." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckoutPage,
});

const REQUIRED_FIELDS = ["firstName", "lastName", "email", "phone", "address", "city", "state", "zip"] as const;
type RequiredField = (typeof REQUIRED_FIELDS)[number];
type FormState = Record<RequiredField | "business" | "notes", string>;

const emptyForm = (): FormState => ({
  firstName: "", lastName: "", email: "", phone: "",
  address: "", city: "", state: "", zip: "",
  business: "", notes: "",
});

// ─── Field — TOP-LEVEL component. Never define inside another component.
// Defining inside a parent causes remount on every parent re-render → input loses focus.
function Field({
  name, label, type = "text", full = false, form, errors, onChange,
}: {
  name: keyof FormState;
  label: string;
  type?: string;
  full?: boolean;
  form: FormState;
  errors: Partial<Record<RequiredField, string>>;
  onChange: (k: keyof FormState, v: string) => void;
}) {
  const isRequired = REQUIRED_FIELDS.includes(name as RequiredField);
  const err = errors[name as RequiredField];
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <label className="block text-sm font-medium mb-1.5">
        {label} {isRequired && <span className="text-destructive">*</span>}
      </label>
      <input
        type={type}
        value={form[name]}
        onChange={(e) => onChange(name, e.target.value)}
        autoComplete={name === "zip" ? "postal-code" : name}
        className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none ${
          err ? "border-destructive" : "border-border focus:border-primary"
        }`}
      />
      {err && <p className="text-xs text-destructive mt-1">{err}</p>}
    </div>
  );
}

// ─── CheckoutPage ──────────────────────────────────────────────────────────

function CheckoutPage() {
  const { items, subtotal, count } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<RequiredField, string>>>({});
  const [step, setStep] = useState<"details" | "payment">("details");
  const [intentData, setIntentData] = useState<PaymentIntentResponse | null>(null);
  const [creatingIntent, setCreatingIntent] = useState(false);

  useEffect(() => {
    if (user) {
      setForm((f) => ({
        ...f,
        firstName: f.firstName || user.firstName,
        lastName: f.lastName || user.lastName,
        email: f.email || user.email,
      }));
    }
  }, [user]);

  const upd = (k: keyof FormState, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  if (count === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <ShoppingBag className="h-14 w-14 text-primary mx-auto mb-4" />
        <h2 className="font-display text-2xl font-bold mb-2">Your cart is empty</h2>
        <p className="text-text-secondary mb-6">Add some tools before checking out.</p>
        <Link to="/shop" className="btn-primary">Shop Now</Link>
      </div>
    );
  }

  const shippingCost = subtotal >= 350 ? 0 : 9.99;
  const total = subtotal + shippingCost;

  const validate = (): boolean => {
    const newErrors: Partial<Record<RequiredField, string>> = {};
    REQUIRED_FIELDS.forEach((k) => { if (!form[k]?.trim()) newErrors[k] = "Required"; });
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) newErrors.email = "Invalid email";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setCreatingIntent(true);
    try {
      const data = await createPaymentIntent(
        items.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
        { firstName: form.firstName, lastName: form.lastName, email: form.email,
          phone: form.phone, address: form.address, city: form.city,
          state: form.state, zip: form.zip, country: "US" },
        form.notes || undefined,
      );
      setIntentData(data);
      setStep("payment");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to initialise payment.");
    } finally {
      setCreatingIntent(false);
    }
  };

  return (
    <div>
      <PageHero title="Checkout" crumbs={[{ label: "Cart", to: "/cart" }, { label: "Checkout" }]} />
      <div className="mx-auto max-w-7xl px-4 py-10">

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8 text-sm">
          <span className="text-primary font-semibold">1. Cart ✓</span>
          <span className="text-text-muted">→</span>
          <span className={step === "details" ? "text-accent font-semibold" : "text-primary font-semibold"}>
            2. Details {step === "payment" && "✓"}
          </span>
          <span className="text-text-muted">→</span>
          <span className={step === "payment" ? "text-accent font-semibold" : "text-text-muted"}>
            3. Payment
          </span>
        </div>

        <div className="grid lg:grid-cols-[1fr_400px] gap-8">

          {/* Left panel */}
          {step === "details" ? (
            <form onSubmit={handleDetailsSubmit} className="card-surface p-6 md:p-8">
              <h2 className="font-display text-2xl font-bold mb-6">Billing Details</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <Field name="firstName" label="First Name" form={form} errors={errors} onChange={upd} />
                <Field name="lastName" label="Last Name" form={form} errors={errors} onChange={upd} />
                <Field name="email" label="Email" type="email" form={form} errors={errors} onChange={upd} />
                <Field name="phone" label="Phone" type="tel" form={form} errors={errors} onChange={upd} />
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1.5">Business Name (optional)</label>
                  <input value={form.business} onChange={(e) => upd("business", e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-border text-sm focus:outline-none focus:border-primary" />
                </div>
                <Field name="address" label="Address" full form={form} errors={errors} onChange={upd} />
                <Field name="city" label="City" form={form} errors={errors} onChange={upd} />
                <Field name="state" label="State" form={form} errors={errors} onChange={upd} />
                <Field name="zip" label="ZIP" form={form} errors={errors} onChange={upd} />
                <div>
                  <label className="block text-sm font-medium mb-1.5">Country</label>
                  <select className="w-full px-3 py-2.5 rounded-lg border border-border text-sm focus:outline-none focus:border-primary bg-surface">
                    <option>United States</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1.5">Order notes (optional)</label>
                  <textarea rows={3} value={form.notes} onChange={(e) => upd("notes", e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-border text-sm focus:outline-none focus:border-primary" />
                </div>
              </div>
              <button type="submit" className="btn-primary mt-6 w-full" disabled={creatingIntent}>
                {creatingIntent ? "Preparing payment…" : "Continue to Payment →"}
              </button>
            </form>
          ) : (
            intentData && (
              <div className="card-surface p-6 md:p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-display text-2xl font-bold">Payment</h2>
                  <button onClick={() => setStep("details")} className="text-sm text-primary hover:underline">
                    ← Edit details
                  </button>
                </div>
                <Elements stripe={stripePromise} options={{ clientSecret: intentData.clientSecret }}>
                  <StripePaymentForm
                    intentData={intentData}
                    onSuccess={(orderId) => navigate({ to: "/order-confirmation", search: { orderId } })}
                  />
                </Elements>
              </div>
            )
          )}

          {/* Order summary sidebar */}
          <aside className="card-surface p-6 h-fit lg:sticky lg:top-24">
            <h3 className="font-display text-xl font-bold mb-4">Your Order</h3>
            <div className="space-y-2 text-sm border-b border-border pb-4">
              {items.map(({ product, quantity }) => (
                <div key={product.id} className="flex justify-between gap-2">
                  <span className="line-clamp-1 flex-1">{product.name} × {quantity}</span>
                  <span className="font-semibold shrink-0">${((product.salePrice ?? product.price) * quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2 text-sm border-b border-border py-4">
              <div className="flex justify-between"><span className="text-text-secondary">Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Shipping</span>
                <span className={shippingCost === 0 ? "text-success font-semibold" : ""}>{shippingCost === 0 ? "FREE" : `$${shippingCost.toFixed(2)}`}</span>
              </div>
            </div>
            <div className="flex justify-between py-4 text-lg font-bold">
              <span>Total</span><span className="text-accent">${total.toFixed(2)}</span>
            </div>
            <p className="flex items-center gap-1.5 text-xs text-text-secondary justify-center mt-2">
              <Lock className="h-3.5 w-3.5" /> Secure SSL checkout
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}

// ─── StripePaymentForm ─────────────────────────────────────────────────────

function StripePaymentForm({ intentData, onSuccess }: {
  intentData: PaymentIntentResponse;
  onSuccess: (orderId: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setError("");

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/order-confirmation?orderId=${intentData.orderId}`,
      },
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message ?? "Payment failed. Please try again.");
      setLoading(false);
      return;
    }
    onSuccess(intentData.orderId);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="p-4 rounded-xl border border-border bg-muted/20">
        <PaymentElement />
      </div>
      {error && (
        <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      )}
      <div className="space-y-1 text-sm text-text-secondary border-t border-border pt-4">
        <div className="flex justify-between">
          <span>Order total</span>
          <span className="font-bold text-foreground text-base">${intentData.total.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Order #</span><span className="font-mono">{intentData.orderNumber}</span>
        </div>
      </div>
      <button type="submit" disabled={!stripe || !elements || loading} className="btn-primary w-full">
        {loading ? "Processing…" : `Pay $${intentData.total.toFixed(2)}`}
      </button>
      <p className="flex items-center gap-1.5 text-xs text-text-secondary justify-center">
        <Lock className="h-3.5 w-3.5" /> Payments processed securely by Stripe.
      </p>
    </form>
  );
}
