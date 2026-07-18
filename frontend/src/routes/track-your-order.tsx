import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  CheckCircle2, Circle, Package, Truck, MapPin,
  Clock, ShieldCheck, Headphones, RotateCcw, Mail, Phone, ArrowRight, AlertCircle,
} from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";
import { trackOrder, type TrackOrderResult } from "@/lib/api-client";
import { toast } from "sonner";

export const Route = createFileRoute("/track-your-order")({
  head: () => ({
    meta: [
      { title: "Track Your Order — CutHaven" },
      { name: "description", content: "Track your CutHaven order status in real time." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TrackOrderPage,
});

const ORDER_RE = /^[A-Z0-9-]{6,32}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
type FormErrors = { order?: string; email?: string };

const STATUS_STEPS = ["pending", "confirmed", "processing", "shipped", "delivered"];

function TrackOrderPage() {
  const [order, setOrder] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TrackOrderResult | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: FormErrors = {};
    const o = order.trim();
    const em = email.trim();
    if (!ORDER_RE.test(o)) next.order = "Enter a valid order number (letters, numbers and dashes).";
    if (!EMAIL_RE.test(em) || em.length > 254) next.email = "Enter the email address used at checkout.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    setResult(null);
    try {
      const data = await trackOrder(o.toUpperCase(), em.toLowerCase());
      setResult(data);
    } catch (err: any) {
      toast.error(err.message ?? "Order not found. Check your details and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHero title="Track Your Order" />
      <div className="mx-auto max-w-3xl px-4 py-12">
        <form
          className="card-surface p-6 md:p-8 space-y-4"
          onSubmit={onSubmit}
          noValidate
          aria-label="Order tracking form"
        >
          <div>
            <label htmlFor="order-number" className="block text-sm font-medium mb-1.5">
              Order Number <span className="text-destructive">*</span>
            </label>
            <input
              id="order-number"
              name="order"
              autoComplete="off"
              maxLength={32}
              value={order}
              onChange={(e) => setOrder(e.target.value)}
              placeholder="CUT-2025-00123"
              aria-invalid={!!errors.order}
              aria-describedby={errors.order ? "order-error" : undefined}
              className={`w-full px-3 py-2.5 rounded-lg border focus:outline-none text-sm ${
                errors.order ? "border-destructive" : "border-border focus:border-primary"
              }`}
              required
            />
            {errors.order && (
              <p id="order-error" className="text-xs text-destructive mt-1">{errors.order}</p>
            )}
          </div>

          <div>
            <label htmlFor="order-email" className="block text-sm font-medium mb-1.5">
              Email Address <span className="text-destructive">*</span>
            </label>
            <input
              id="order-email"
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email-error" : undefined}
              className={`w-full px-3 py-2.5 rounded-lg border focus:outline-none text-sm ${
                errors.email ? "border-destructive" : "border-border focus:border-primary"
              }`}
              required
            />
            {errors.email && (
              <p id="email-error" className="text-xs text-destructive mt-1">{errors.email}</p>
            )}
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-60">
            {loading ? "Looking up…" : <>Track Order <ArrowRight className="inline h-4 w-4 ml-1" /></>}
          </button>
          <p className="text-xs text-text-secondary text-center">
            We only use these details to look up your order. They are not stored on this device.
          </p>
        </form>

        {result && <OrderStatusPanel result={result} />}
      </div>
      <TrackingCompanion />
    </div>
  );
}

function OrderStatusPanel({ result }: { result: TrackOrderResult }) {
  const { order, items, history } = result;
  const stepIdx = STATUS_STEPS.indexOf(order.status);
  const isCancelled = order.status === "cancelled" || order.status === "refunded";

  const steps = [
    { label: "Order Placed", icon: CheckCircle2, key: "pending"    },
    { label: "Confirmed",    icon: CheckCircle2, key: "confirmed"  },
    { label: "Processing",   icon: Package,      key: "processing" },
    { label: "Shipped",      icon: Truck,        key: "shipped"    },
    { label: "Delivered",    icon: MapPin,       key: "delivered"  },
  ];

  return (
    <section className="mt-8 rounded-3xl border border-border bg-surface shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
      <header
        className={`px-6 py-5 flex flex-wrap items-center justify-between gap-3 ${
          isCancelled ? "bg-destructive/80" : "bg-primary"
        } text-white`}
      >
        <div>
          <p className="text-xs uppercase tracking-widest opacity-80">Order</p>
          <h2 className="font-display text-2xl font-bold font-mono">#{order.orderNumber}</h2>
          <p className="text-xs opacity-70 mt-0.5">
            Placed {new Date(order.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide capitalize">
          {isCancelled ? <AlertCircle className="h-3.5 w-3.5" /> : <Truck className="h-3.5 w-3.5" />}
          {order.status.replace("_", " ")}
        </span>
      </header>

      <div className="p-6 md:p-8 space-y-8">
        {/* Progress steps */}
        {!isCancelled && (
          <ol className="grid grid-cols-5 gap-2" aria-label="Shipment progress">
            {steps.map((s, i) => {
              const done = i <= stepIdx;
              const Icon = done ? s.icon : Circle;
              return (
                <li key={s.key} className="flex flex-col items-center text-center">
                  <div
                    className={`h-9 w-9 rounded-full grid place-items-center border-2 transition-colors ${
                      done
                        ? "bg-primary text-white border-primary"
                        : "bg-muted text-text-secondary border-border"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className={`mt-1.5 text-xs font-semibold leading-tight ${done ? "" : "text-text-secondary"}`}>
                    {s.label}
                  </p>
                </li>
              );
            })}
          </ol>
        )}

        {/* Items */}
        <div>
          <p className="text-xs uppercase tracking-widest text-text-secondary mb-3">Items Ordered</p>
          <div className="space-y-3">
            {items.map((it, i) => (
              <div key={i} className="flex gap-3 items-center">
                {it.product_image && (
                  <img src={it.product_image} alt="" className="h-12 w-12 rounded-lg object-cover border border-border" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{it.product_name}</p>
                  <p className="text-xs text-text-secondary">Qty: {it.quantity}</p>
                </div>
                <p className="text-sm font-semibold">${it.total_price.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="rounded-xl bg-muted/40 border border-border p-4 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-text-secondary">Subtotal</span>
            <span>${order.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">Shipping</span>
            <span>{order.shippingCost === 0 ? "FREE" : `$${order.shippingCost.toFixed(2)}`}</span>
          </div>
          {order.discountAmount > 0 && (
            <div className="flex justify-between text-success">
              <span>Discount</span>
              <span>−${order.discountAmount.toFixed(2)}</span>
            </div>
          )}
          {order.taxAmount > 0 && (
            <div className="flex justify-between">
              <span className="text-text-secondary">Tax</span>
              <span>${order.taxAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold border-t border-border pt-2 mt-1">
            <span>Total</span>
            <span className="text-accent">${order.total.toFixed(2)}</span>
          </div>
        </div>

        {/* Shipping address + history */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <p className="text-xs uppercase tracking-widest text-text-secondary mb-1.5">Shipping To</p>
            <p className="text-sm">{order.shippingAddress.firstName} {order.shippingAddress.lastName}</p>
            <p className="text-sm text-text-secondary">{order.shippingAddress.address}</p>
            <p className="text-sm text-text-secondary">
              {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zip}
            </p>
          </div>
          {history.length > 0 && (
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-xs uppercase tracking-widest text-text-secondary mb-1.5">Status History</p>
              <ul className="space-y-1.5">
                {history.slice(-4).map((h, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <Clock className="h-3.5 w-3.5 text-text-secondary mt-0.5 shrink-0" />
                    <span>
                      <span className="font-semibold capitalize">{h.status}</span>
                      {h.notes && <span className="text-text-secondary"> — {h.notes}</span>}
                      <span className="text-text-secondary block">
                        {new Date(h.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function TrackingCompanion() {
  return (
    <section className="bg-gradient-to-b from-surface to-muted/40 border-t border-border mt-16">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <div className="text-center max-w-2xl mx-auto">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-primary">
            The CutHaven Promise
          </span>
          <h2 className="font-display text-3xl md:text-4xl font-bold mt-2">
            From our workshop to your doorstep.
          </h2>
          <p className="text-text-secondary mt-3">Every order ships from Palmer, Alaska with care.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mt-10">
          {[
            { icon: Truck,       title: "Free U.S. Shipping",  body: "Complimentary ground shipping on every order over $350." },
            { icon: RotateCcw,   title: "40-Day Returns",       body: "Not the right fit? Send it back within 40 days for a full refund." },
            { icon: ShieldCheck, title: "12-Month Warranty",    body: "Every tool is covered against manufacturer defects for a full year." },
          ].map(({ icon: Icon, title, body }) => (
            <article key={title} className="rounded-3xl border border-border bg-surface p-6 shadow-sm">
              <div className="h-11 w-11 rounded-2xl bg-primary/10 text-primary grid place-items-center">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-display text-xl font-bold mt-4">{title}</h3>
              <p className="text-sm text-text-secondary mt-2">{body}</p>
            </article>
          ))}
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-3xl bg-primary text-primary-foreground p-8 md:p-10">
            <Headphones className="h-8 w-8 text-accent" />
            <h3 className="font-display text-2xl md:text-3xl font-bold mt-4">
              Need a hand with your order?
            </h3>
            <p className="mt-2 text-primary-foreground/80">
              Our support crew answers in under one business day.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="mailto:support@cuthaven.com"
                className="inline-flex items-center gap-2 rounded-full bg-accent text-accent-foreground px-4 py-2 text-sm font-semibold"
              >
                <Mail className="h-4 w-4" /> support@cuthaven.com
              </a>
              <a
                href="tel:+14062299045"
                className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/30 px-4 py-2 text-sm font-semibold"
              >
                <Phone className="h-4 w-4" /> +1 (406) 229-9045
              </a>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-surface p-8 md:p-10">
            <h3 className="font-display text-2xl font-bold">Helpful next steps</h3>
            <ul className="mt-4 space-y-3 text-sm">
              {[
                { to: "/shipping-policy",           label: "Read the full shipping policy" },
                { to: "/returns-refund-policy",      label: "Start a return or exchange" },
                { to: "/order-cancellation-policy",  label: "Cancel or change your order" },
                { to: "/contact-us",                 label: "Contact the CutHaven team" },
              ].map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    className="group inline-flex items-center gap-2 text-primary font-semibold hover:text-accent"
                  >
                    {l.label}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
