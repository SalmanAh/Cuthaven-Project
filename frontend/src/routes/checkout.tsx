import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Lock, ShoppingBag, Tag, X } from "lucide-react";
import { loadStripe, Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { PageHero } from "@/components/ui/PageHero";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import {
  createPaymentIntent,
  createPayPalOrder,
  capturePayPalOrder,
  validateCoupon,
  getMyAddresses,
  confirmStripeOrder,
  createCodOrder,
  getActiveGatewaysForCheckout,
  type PaymentIntentResponse,
  type PayPalOrderResponse,
  type CustomerAddress,
  type CodOrderResponse,
} from "@/lib/api-client";
import { toast } from "sonner";

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

const REQUIRED_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "address",
  "city",
  "state",
  "zip",
] as const;
type RequiredField = (typeof REQUIRED_FIELDS)[number];
type FormState = Record<RequiredField | "business" | "notes", string>;

const emptyForm = (): FormState => ({
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  zip: "",
  business: "",
  notes: "",
});

// ─── Field — TOP-LEVEL component. Never define inside another component.
// Defining inside a parent causes remount on every parent re-render → input loses focus.
function Field({
  name,
  label,
  type = "text",
  full = false,
  form,
  errors,
  onChange,
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
      <label className="block text-xs sm:text-sm font-medium mb-1.5">
        {label} {isRequired && <span className="text-destructive">*</span>}
      </label>
      <input
        type={type}
        value={form[name]}
        onChange={(e) => onChange(name, e.target.value)}
        autoComplete={name === "zip" ? "postal-code" : name}
        className={`w-full px-3 py-2.5 rounded-lg border text-xs sm:text-sm focus:outline-none min-h-[44px] ${
          err ? "border-destructive" : "border-border focus:border-primary"
        }`}
      />
      {err && <p className="text-[10px] sm:text-xs text-destructive mt-1">{err}</p>}
    </div>
  );
}

const FORM_KEY = "ch-checkout-form";

function savedForm(): FormState {
  try {
    const s = typeof window !== "undefined" ? sessionStorage.getItem(FORM_KEY) : null;
    return s ? { ...emptyForm(), ...JSON.parse(s) } : emptyForm();
  } catch {
    return emptyForm();
  }
}

// ─── CheckoutPage ──────────────────────────────────────────────────────────

function CheckoutPage() {
  const { items, subtotal, count, clear } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>(savedForm);
  const [errors, setErrors] = useState<Partial<Record<RequiredField, string>>>({});
  const [step, setStep] = useState<"details" | "payment">("details");
  const [intentData, setIntentData] = useState<PaymentIntentResponse | null>(null);
  const [paypalData, setPaypalData] = useState<PayPalOrderResponse | null>(null);
  const [codData, setCodData] = useState<CodOrderResponse | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"stripe" | "paypal" | "cod">("stripe");
  const [creatingIntent, setCreatingIntent] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<CustomerAddress[]>([]);

  // ── Active gateways from database ──────────────────────────────────────
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [paypalClientId, setPaypalClientId] = useState<string>("");
  const [gatewaysLoaded, setGatewaysLoaded] = useState(false);

  // Load active gateways on mount
  useEffect(() => {
    getActiveGatewaysForCheckout()
      .then((gateways) => {
        if (gateways.stripe?.publishableKey) {
          setStripePromise(loadStripe(gateways.stripe.publishableKey));
        }
        if (gateways.paypal?.clientId) {
          setPaypalClientId(gateways.paypal.clientId);
        }
        setGatewaysLoaded(true);

        // Set default payment method based on what's available
        if (gateways.stripe) {
          setPaymentMethod("stripe");
        } else if (gateways.paypal) {
          setPaymentMethod("paypal");
        } else {
          setPaymentMethod("cod");
        }
      })
      .catch((err) => {
        console.error("Failed to load payment gateways:", err);
        toast.error("Failed to load payment options. Please refresh the page.");
        setGatewaysLoaded(true);
      });
  }, []);

  // ── Coupon state (lives here now, not on cart page) ──────────────────────
  const [couponInput, setCouponInput] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountAmount: number;
    couponId: string;
  } | null>(null);

  // Load saved addresses for logged-in customers
  useEffect(() => {
    if (!user) return;
    getMyAddresses()
      .then((addrs) => setSavedAddresses(addrs))
      .catch(() => {});
  }, [user]);

  // Persist form to sessionStorage on every keystroke
  useEffect(() => {
    try {
      sessionStorage.setItem(FORM_KEY, JSON.stringify(form));
    } catch {}
  }, [form]);

  // Pre-fill form with logged-in user's name and email
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

  // ── Coupon handlers ──────────────────────────────────────────────────────
  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;

    // For guests: require email first
    if (!user && !form.email.trim()) {
      toast.error("Please enter your email address above before applying a coupon");
      return;
    }

    setCouponLoading(true);
    try {
      // Email from the form (filled in by now since they're on the details step)
      // or fallback to logged-in user's email
      const emailForCheck = form.email || user?.email;
      const result = await validateCoupon(couponInput.trim(), subtotal, emailForCheck);
      setAppliedCoupon({
        code: result.code,
        discountAmount: result.discountAmount,
        couponId: result.couponId,
      });
      setCouponInput("");
      toast.success(`Coupon "${result.code}" applied — $${result.discountAmount.toFixed(2)} off!`);
    } catch (err: any) {
      toast.error(err.message ?? "Invalid coupon code");
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    toast.info("Coupon removed");
  };

  if (count === 0) {
    return (
      <div className="mx-auto max-w-lg px-3 sm:px-4 py-12 sm:py-16 md:py-20 text-center">
        <ShoppingBag className="h-12 w-12 sm:h-14 sm:w-14 text-primary mx-auto mb-3 sm:mb-4" />
        <h2 className="font-display text-xl sm:text-2xl font-bold mb-2">Your cart is empty</h2>
        <p className="text-text-secondary text-sm sm:text-base mb-4 sm:mb-6">
          Add some tools before checking out.
        </p>
        <Link
          to="/shop"
          className="btn-primary text-sm sm:text-base min-h-[44px] inline-flex items-center justify-center"
        >
          Shop Now
        </Link>
      </div>
    );
  }

  // Show loading while fetching gateways
  if (!gatewaysLoaded) {
    return (
      <div className="mx-auto max-w-lg px-3 sm:px-4 py-12 sm:py-16 md:py-20 text-center">
        <p className="text-text-secondary text-sm">Loading payment options...</p>
      </div>
    );
  }

  const shippingCost = subtotal >= 350 ? 0 : 9.99;
  const discountAmount = appliedCoupon?.discountAmount ?? 0;
  // After PI/PayPal creation use the server-authoritative total
  const serverData = intentData ?? paypalData;
  const previewTotal = serverData
    ? serverData.total
    : Math.max(0, subtotal + shippingCost - discountAmount);

  const validate = () => {
    const newErrors: Partial<Record<RequiredField, string>> = {};
    REQUIRED_FIELDS.forEach((k) => {
      if (!form[k]?.trim()) newErrors[k] = "Required";
    });
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) newErrors.email = "Invalid email";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setCreatingIntent(true);
    try {
      const checkoutItems = items.map((i) => ({ productId: i.product.id, quantity: i.quantity }));
      const shippingAddr = {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        address: form.address,
        city: form.city,
        state: form.state,
        zip: form.zip,
        country: "US",
      };

      if (paymentMethod === "cod") {
        const data = await createCodOrder(
          checkoutItems,
          shippingAddr,
          form.notes || undefined,
          appliedCoupon?.code || undefined,
        );
        try {
          sessionStorage.removeItem(FORM_KEY);
        } catch {}
        navigate({ to: "/order-confirmation", search: { orderId: data.orderId } });
      } else if (paymentMethod === "paypal") {
        const data = await createPayPalOrder(
          checkoutItems,
          shippingAddr,
          form.notes || undefined,
          appliedCoupon?.code || undefined,
        );
        setPaypalData(data);
        setStep("payment");
      } else {
        const data = await createPaymentIntent(
          checkoutItems,
          shippingAddr,
          form.notes || undefined,
          appliedCoupon?.code || undefined,
        );
        setIntentData(data);
        setStep("payment");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to initialise payment.");
    } finally {
      setCreatingIntent(false);
    }
  };

  return (
    <div>
      <PageHero title="Checkout" />
      <div className="mx-auto max-w-7xl px-3 sm:px-4 py-6 sm:py-8 md:py-10">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-6 sm:mb-8 text-xs sm:text-sm">
          <span className="text-primary font-semibold">1. Cart ✓</span>
          <span className="text-text-muted">→</span>
          <span
            className={
              step === "details" ? "text-accent font-semibold" : "text-primary font-semibold"
            }
          >
            2. Details {step === "payment" && "✓"}
          </span>
          <span className="text-text-muted">→</span>
          <span className={step === "payment" ? "text-accent font-semibold" : "text-text-muted"}>
            3. Payment
          </span>
        </div>

        <div className="grid lg:grid-cols-[1fr_400px] gap-6 sm:gap-8">
          {/* Left panel */}
          {step === "details" ? (
            <form onSubmit={handleDetailsSubmit} className="card-surface p-4 sm:p-5 md:p-6 lg:p-8">
              {/* ── Saved address selector (logged-in customers only) ── */}
              {user && savedAddresses.length > 0 && (
                <div className="mb-5 sm:mb-6 p-3 sm:p-4 rounded-xl bg-muted/40 border border-border">
                  <p className="text-xs sm:text-sm font-semibold mb-2 sm:mb-3">
                    Use a saved address
                  </p>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {savedAddresses.map((addr) => (
                      <button
                        key={addr.id}
                        type="button"
                        onClick={() => {
                          setForm((f) => ({
                            ...f,
                            firstName: addr.firstName,
                            lastName: addr.lastName,
                            address: addr.address,
                            city: addr.city,
                            state: addr.state,
                            zip: addr.zip,
                          }));
                          setErrors({});
                          toast.success(`Address "${addr.label}" applied`);
                        }}
                        className="text-left p-2.5 sm:p-3 rounded-lg border border-border hover:border-primary bg-surface transition text-xs sm:text-sm touch-manipulation min-h-[44px]"
                      >
                        <p className="font-semibold text-[10px] sm:text-xs text-primary mb-0.5 sm:mb-1">
                          {addr.label}
                        </p>
                        <p className="text-text-secondary leading-snug text-xs sm:text-sm">
                          {addr.firstName} {addr.lastName}
                          <br />
                          {addr.address}, {addr.city}, {addr.state} {addr.zip}
                        </p>
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] sm:text-xs text-text-secondary mt-2">
                    Selecting an address fills the form — you can still edit any field.
                  </p>
                </div>
              )}

              <h2 className="font-display text-xl sm:text-2xl font-bold mb-4 sm:mb-6">
                Billing Details
              </h2>
              <div className="grid md:grid-cols-2 gap-3 sm:gap-4">
                <Field
                  name="firstName"
                  label="First Name"
                  form={form}
                  errors={errors}
                  onChange={upd}
                />
                <Field
                  name="lastName"
                  label="Last Name"
                  form={form}
                  errors={errors}
                  onChange={upd}
                />
                <Field
                  name="email"
                  label="Email"
                  type="email"
                  form={form}
                  errors={errors}
                  onChange={upd}
                />
                <Field
                  name="phone"
                  label="Phone"
                  type="tel"
                  form={form}
                  errors={errors}
                  onChange={upd}
                />
                <div className="md:col-span-2">
                  <label className="block text-xs sm:text-sm font-medium mb-1.5">
                    Business Name (optional)
                  </label>
                  <input
                    value={form.business}
                    onChange={(e) => upd("business", e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-border text-xs sm:text-sm focus:outline-none focus:border-primary min-h-[44px]"
                  />
                </div>
                <Field
                  name="address"
                  label="Address"
                  full
                  form={form}
                  errors={errors}
                  onChange={upd}
                />
                <Field name="city" label="City" form={form} errors={errors} onChange={upd} />
                <Field name="state" label="State" form={form} errors={errors} onChange={upd} />
                <Field name="zip" label="ZIP" form={form} errors={errors} onChange={upd} />
                <div>
                  <label className="block text-xs sm:text-sm font-medium mb-1.5">Country</label>
                  <select className="w-full px-3 py-2.5 rounded-lg border border-border text-xs sm:text-sm focus:outline-none focus:border-primary bg-surface min-h-[44px]">
                    <option>United States</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs sm:text-sm font-medium mb-1.5">
                    Order notes (optional)
                  </label>
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={(e) => upd("notes", e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-border text-xs sm:text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* ── Payment method selector ── */}
              <div className="mt-5 sm:mt-6">
                <p className="text-xs sm:text-sm font-semibold mb-2 sm:mb-3">Payment Method</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
                  {stripePromise && (
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("stripe")}
                      className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-xs sm:text-sm font-semibold transition min-h-[44px] ${
                        paymentMethod === "stripe"
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border text-text-secondary hover:border-primary/40"
                      }`}
                    >
                      <Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span className="hidden xs:inline">Credit / Debit Card</span>
                      <span className="xs:hidden">Card</span>
                    </button>
                  )}
                  {paypalClientId && (
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("paypal")}
                      className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-xs sm:text-sm font-semibold transition min-h-[44px] ${
                        paymentMethod === "paypal"
                          ? "border-[#003087] bg-[#003087]/5 text-[#003087]"
                          : "border-border text-text-secondary hover:border-[#003087]/40"
                      }`}
                    >
                      <img
                        src="https://www.paypalobjects.com/webstatic/icon/pp258.png"
                        alt="PayPal"
                        className="h-4 w-4 sm:h-5 sm:w-5"
                      />
                      PayPal
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("cod")}
                    className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-xs sm:text-sm font-semibold transition min-h-[44px] ${
                      paymentMethod === "cod"
                        ? "border-success bg-success/5 text-success"
                        : "border-border text-text-secondary hover:border-success/40"
                    }`}
                  >
                    <ShoppingBag className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden xs:inline">Cash on Delivery</span>
                    <span className="xs:hidden">COD</span>
                  </button>
                </div>
                {paymentMethod === "cod" && (
                  <p className="text-[10px] sm:text-xs text-text-secondary mt-2">
                    Pay in cash when your order arrives. Your order is confirmed immediately.
                  </p>
                )}
                {!stripePromise && !paypalClientId && (
                  <p className="text-[10px] sm:text-xs text-warning mt-2">
                    Online payment methods are currently unavailable. Only Cash on Delivery is
                    available.
                  </p>
                )}
              </div>

              {/* ── Coupon code ── */}
              <div className="mt-5 sm:mt-6 pt-5 sm:pt-6 border-t border-border">
                <p className="text-xs sm:text-sm font-semibold mb-2 flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" /> Coupon code
                </p>
                {appliedCoupon ? (
                  <div className="flex items-center justify-between bg-success/10 border border-success/30 rounded-lg px-3 py-2.5 min-h-[44px]">
                    <span className="text-xs sm:text-sm font-mono font-semibold text-success">
                      {appliedCoupon.code}
                    </span>
                    <div className="flex items-center gap-2 sm:gap-3">
                      <span className="text-xs sm:text-sm font-semibold text-success">
                        −${appliedCoupon.discountAmount.toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={handleRemoveCoupon}
                        className="text-text-secondary hover:text-destructive p-1 touch-manipulation"
                        aria-label="Remove coupon"
                      >
                        <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) =>
                        e.key === "Enter" && (e.preventDefault(), handleApplyCoupon())
                      }
                      placeholder="Enter coupon code"
                      className="flex-1 px-3 py-2.5 rounded-lg border border-border text-xs sm:text-sm focus:outline-none focus:border-primary font-mono uppercase min-h-[44px]"
                    />
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      disabled={couponLoading || !couponInput.trim()}
                      className="px-3 sm:px-4 rounded-lg bg-primary text-primary-foreground text-xs sm:text-sm font-semibold disabled:opacity-50 transition min-h-[44px]"
                    >
                      {couponLoading ? "…" : "Apply"}
                    </button>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="btn-primary mt-5 sm:mt-6 w-full text-sm sm:text-base min-h-[44px]"
                disabled={creatingIntent}
              >
                {creatingIntent
                  ? "Processing…"
                  : paymentMethod === "cod"
                    ? "Confirm Order →"
                    : "Continue to Payment →"}
              </button>
            </form>
          ) : (
            <div className="card-surface p-4 sm:p-5 md:p-6 lg:p-8">
              <div className="flex items-center justify-between mb-5 sm:mb-6">
                <h2 className="font-display text-xl sm:text-2xl font-bold">Payment</h2>
                <button
                  onClick={() => {
                    setStep("details");
                    setIntentData(null);
                    setPaypalData(null);
                    setCodData(null);
                  }}
                  className="text-xs sm:text-sm text-primary hover:underline"
                >
                  ← Edit details
                </button>
              </div>

              {/* Stripe */}
              {intentData && stripePromise && (
                <Elements
                  stripe={stripePromise}
                  options={{ clientSecret: intentData.clientSecret }}
                >
                  <StripePaymentForm
                    intentData={intentData}
                    onSuccess={async (paymentIntentId) => {
                      try {
                        const { orderId } = await confirmStripeOrder(paymentIntentId);
                        sessionStorage.removeItem(FORM_KEY);
                        navigate({ to: "/order-confirmation", search: { orderId } });
                      } catch {
                        // Webhook will handle it — redirect to confirmation with paymentIntentId as fallback
                        sessionStorage.removeItem(FORM_KEY);
                        navigate({
                          to: "/order-confirmation",
                          search: { orderId: paymentIntentId },
                        });
                      }
                    }}
                  />
                </Elements>
              )}

              {/* PayPal */}
              {paypalData && paypalClientId && (
                <PayPalScriptProvider options={{ clientId: paypalClientId, currency: "USD" }}>
                  <PayPalPaymentForm
                    paypalData={paypalData}
                    onSuccess={(orderId) => {
                      try {
                        sessionStorage.removeItem(FORM_KEY);
                      } catch {}
                      navigate({ to: "/order-confirmation", search: { orderId } });
                    }}
                  />
                </PayPalScriptProvider>
              )}
            </div>
          )}

          {/* Order summary sidebar */}
          <aside className="card-surface p-4 sm:p-5 md:p-6 h-fit lg:sticky lg:top-24">
            <h3 className="font-display text-lg sm:text-xl font-bold mb-3 sm:mb-4">Your Order</h3>
            <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm border-b border-border pb-3 sm:pb-4">
              {items.map(({ product, quantity }) => (
                <div key={product.id} className="flex justify-between gap-2">
                  <span className="line-clamp-1 flex-1">
                    {product.name} × {quantity}
                  </span>
                  <span className="font-semibold shrink-0">
                    ${((product.salePrice ?? product.price) * quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm border-b border-border py-3 sm:py-4">
              <div className="flex justify-between">
                <span className="text-text-secondary">Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Shipping</span>
                <span className={shippingCost === 0 ? "text-success font-semibold" : ""}>
                  {shippingCost === 0 ? "FREE" : `$${shippingCost.toFixed(2)}`}
                </span>
              </div>
              {(intentData ?? paypalData) && (intentData ?? paypalData)!.discountAmount > 0 && (
                <div className="flex justify-between text-success">
                  <span className="flex items-center gap-1">
                    <Tag className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Coupon ({appliedCoupon?.code})
                  </span>
                  <span className="font-semibold">
                    −${(intentData ?? paypalData)!.discountAmount.toFixed(2)}
                  </span>
                </div>
              )}
              {!intentData && !paypalData && appliedCoupon && (
                <div className="flex justify-between text-success">
                  <span className="flex items-center gap-1">
                    <Tag className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Coupon ({appliedCoupon.code})
                  </span>
                  <span className="font-semibold">−${appliedCoupon.discountAmount.toFixed(2)}</span>
                </div>
              )}
              {intentData && intentData.taxAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-text-secondary">
                    Tax
                    {intentData.taxRate > 0 && (
                      <span className="ml-1 text-[10px] sm:text-xs">
                        ({(intentData.taxRate * 100).toFixed(2)}%
                        {intentData.taxJurisdiction ? ` · ${intentData.taxJurisdiction}` : ""})
                      </span>
                    )}
                  </span>
                  <span>${intentData.taxAmount.toFixed(2)}</span>
                </div>
              )}
              {intentData &&
                intentData.taxAmount === 0 &&
                intentData.taxJurisdiction &&
                intentData.taxJurisdiction !== "No tax" && (
                  <div className="flex justify-between text-[10px] sm:text-xs text-text-secondary">
                    <span>Tax ({intentData.taxJurisdiction})</span>
                    <span>$0.00</span>
                  </div>
                )}
              {paypalData && paypalData.taxAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-text-secondary">Tax</span>
                  <span>${paypalData.taxAmount.toFixed(2)}</span>
                </div>
              )}
            </div>
            <div className="flex justify-between py-3 sm:py-4 text-base sm:text-lg font-bold">
              <span>Total</span>
              <span className="text-accent">${previewTotal.toFixed(2)}</span>
            </div>
            <p className="flex items-center gap-1.5 text-[10px] sm:text-xs text-text-secondary justify-center mt-2">
              <Lock className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Secure SSL checkout
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}

// ─── PayPalPaymentForm ─────────────────────────────────────────────────────

function PayPalPaymentForm({
  paypalData,
  onSuccess,
}: {
  paypalData: PayPalOrderResponse;
  onSuccess: (orderId: string) => void;
}) {
  const [error, setError] = useState("");

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Order summary line */}
      <div className="space-y-1 text-xs sm:text-sm text-text-secondary border-b border-border pb-3 sm:pb-4">
        <div className="flex justify-between">
          <span>Order total</span>
          <span className="font-bold text-foreground text-sm sm:text-base">
            ${paypalData.total.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Order #</span>
          <span className="font-mono">{paypalData.orderNumber}</span>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-destructive">
          {error}
        </div>
      )}

      {/* PayPal buttons — rendered by PayPal JS SDK */}
      <PayPalButtons
        style={{ layout: "vertical", color: "blue", shape: "rect", label: "pay", height: 48 }}
        createOrder={async () => paypalData.paypalOrderId}
        onApprove={async () => {
          try {
            const result = await capturePayPalOrder(
              paypalData.paypalOrderId,
              paypalData._checkoutData,
            );
            if (result.success) {
              onSuccess(result.orderId);
            } else {
              setError("Payment capture failed. Please contact support.");
            }
          } catch (err) {
            setError(
              err instanceof Error ? err.message : "PayPal payment failed. Please try again.",
            );
          }
        }}
        onError={(err) => {
          console.error("[PAYPAL] Button error:", err);
          setError("PayPal encountered an error. Please try again or use a card.");
        }}
        onCancel={() => {
          setError("Payment was cancelled. You have not been charged.");
        }}
      />

      <p className="flex items-center gap-1.5 text-[10px] sm:text-xs text-text-secondary justify-center">
        <Lock className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Payments processed securely by PayPal.
      </p>
    </div>
  );
}

function StripePaymentForm({
  intentData,
  onSuccess,
}: {
  intentData: PaymentIntentResponse;
  onSuccess: (paymentIntentId: string) => Promise<void>;
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

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/order-confirmation?piid=${intentData.checkoutToken}`,
      },
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message ?? "Payment failed. Please try again.");
      setLoading(false);
      return;
    }

    const piId = paymentIntent?.id ?? intentData.checkoutToken;
    await onSuccess(piId);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
      <div className="p-3 sm:p-4 rounded-xl border border-border bg-muted/20">
        <PaymentElement />
      </div>
      {error && (
        <div className="rounded-lg bg-destructive/10 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="space-y-1 text-xs sm:text-sm text-text-secondary border-t border-border pt-3 sm:pt-4">
        <div className="flex justify-between">
          <span>Order total</span>
          <span className="font-bold text-foreground text-sm sm:text-base">
            ${intentData.total.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Order #</span>
          <span className="font-mono">{intentData.orderNumber}</span>
        </div>
      </div>
      <button
        type="submit"
        disabled={!stripe || !elements || loading}
        className="btn-primary w-full text-sm sm:text-base min-h-[44px]"
      >
        {loading ? "Processing…" : `Pay $${intentData.total.toFixed(2)}`}
      </button>
      <p className="flex items-center gap-1.5 text-[10px] sm:text-xs text-text-secondary justify-center">
        <Lock className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Payments processed securely by Stripe.
      </p>
    </form>
  );
}
