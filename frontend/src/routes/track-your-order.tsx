import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  CheckCircle2,
  Circle,
  Package,
  Truck,
  MapPin,
  Clock,
  ShieldCheck,
  Headphones,
  RotateCcw,
  Mail,
  Phone,
  ArrowRight,
} from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";

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

// Client-side validation helpers — keep raw input out of the DOM without sanitizing libraries.
const ORDER_RE = /^[A-Z0-9-]{6,32}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type FormErrors = { order?: string; email?: string };

function TrackOrderPage() {
  const [order, setOrder] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [shown, setShown] = useState(false);
  const [displayOrder, setDisplayOrder] = useState("");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: FormErrors = {};
    const o = order.trim();
    const em = email.trim();
    if (!ORDER_RE.test(o)) next.order = "Enter a valid order number (letters, numbers and dashes).";
    if (!EMAIL_RE.test(em) || em.length > 254) next.email = "Enter the email address used at checkout.";
    setErrors(next);
    if (Object.keys(next).length === 0) {
      setDisplayOrder(o.toUpperCase());
      setShown(true);
    }
  };

  return (
    <div>
      <PageHero title="Track Your Order" crumbs={[{ label: "Track Order" }]} />

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
              inputMode="text"
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
              <p id="order-error" className="text-xs text-destructive mt-1">
                {errors.order}
              </p>
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
              <p id="email-error" className="text-xs text-destructive mt-1">
                {errors.email}
              </p>
            )}
          </div>

          <button type="submit" className="btn-primary w-full">
            Track Order <ArrowRight className="inline h-4 w-4 ml-1" />
          </button>

          <p className="text-xs text-text-secondary text-center">
            We only use these details to look up your order. They are not stored on this device.
          </p>
        </form>

        {shown && <OrderStatusPanel orderId={displayOrder} />}
      </div>

      <TrackingCompanion />
    </div>
  );
}

function OrderStatusPanel({ orderId }: { orderId: string }) {
  const steps = [
    { label: "Order Placed", date: "Jun 18", done: true, icon: CheckCircle2 },
    { label: "Processing", date: "Jun 19", done: true, icon: Package },
    { label: "Shipped", date: "Jun 20", done: true, icon: Truck },
    { label: "Delivered", date: "Est. Jun 26", done: false, icon: MapPin },
  ];

  return (
    <section
      aria-labelledby="order-status-heading"
      className="mx-auto max-w-3xl mt-8 rounded-3xl border border-border bg-surface shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500"
    >
      <header className="bg-primary text-primary-foreground px-6 py-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest opacity-80">Order</p>
          <h2 id="order-status-heading" className="font-display text-2xl font-bold font-mono">
            #{orderId}
          </h2>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-accent/95 text-accent-foreground px-3 py-1 text-xs font-semibold uppercase tracking-wide">
          <Truck className="h-3.5 w-3.5" aria-hidden="true" /> In Transit
        </span>
      </header>

      <div className="p-6 md:p-8">
        <ol
          className="relative grid grid-cols-2 md:grid-cols-4 gap-6"
          aria-label="Shipment progress"
        >
          {steps.map((s) => {
            const Icon = s.icon;
            return (
              <li key={s.label} className="flex flex-col items-center text-center">
                <div
                  className={`h-10 w-10 rounded-full grid place-items-center border transition-colors ${
                    s.done
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-text-muted border-border"
                  }`}
                  aria-hidden="true"
                >
                  {s.done ? <Icon className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                </div>
                <p className={`mt-2 text-sm font-semibold ${s.done ? "" : "text-text-muted"}`}>
                  {s.label}
                </p>
                <p className="text-xs text-text-secondary">{s.date}</p>
              </li>
            );
          })}
        </ol>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-muted/30 p-4">
            <p className="text-xs uppercase tracking-widest text-text-secondary">Carrier</p>
            <p className="mt-1 font-semibold">USPS Priority Mail</p>
            <p className="text-xs text-text-secondary mt-1 inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" /> Updated 2 hours ago
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-muted/30 p-4">
            <p className="text-xs uppercase tracking-widest text-text-secondary">Ships to</p>
            <p className="mt-1 font-semibold">United States only</p>
            <p className="text-xs text-text-secondary mt-1">Signature not required</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function TrackingCompanion() {
  return (
    <section
      aria-labelledby="tracking-support-heading"
      className="bg-gradient-to-b from-surface to-muted/40 border-t border-border mt-16"
    >
      <div className="mx-auto max-w-6xl px-4 py-16">
        <div className="text-center max-w-2xl mx-auto">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-primary">
            The CutHaven Promise
          </span>
          <h2
            id="tracking-support-heading"
            className="font-display text-3xl md:text-4xl font-bold mt-2"
          >
            From our workshop to your doorstep.
          </h2>
          <p className="text-text-secondary mt-3">
            Every order ships from Palmer, Alaska with care. Here's what stands behind your
            purchase while it's on the way.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mt-10">
          {[
            {
              icon: Truck,
              title: "Free U.S. Shipping",
              body: "Complimentary ground shipping on every order over $350. No surprises at checkout.",
            },
            {
              icon: RotateCcw,
              title: "40-Day Returns",
              body: "Not the right fit? Send it back within 40 days for a full refund — no restocking fees.",
            },
            {
              icon: ShieldCheck,
              title: "12-Month Warranty",
              body: "Every tool is covered against manufacturer defects for a full year from delivery.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <article
              key={title}
              className="rounded-3xl border border-border bg-surface p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="h-11 w-11 rounded-2xl bg-primary/10 text-primary grid place-items-center">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="font-display text-xl font-bold mt-4">{title}</h3>
              <p className="text-sm text-text-secondary mt-2">{body}</p>
            </article>
          ))}
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-3xl bg-primary text-primary-foreground p-8 md:p-10 relative overflow-hidden">
            <div
              className="absolute -right-16 -bottom-16 h-64 w-64 rounded-full bg-accent/20 blur-3xl"
              aria-hidden="true"
            />
            <Headphones className="h-8 w-8 text-accent" aria-hidden="true" />
            <h3 className="font-display text-2xl md:text-3xl font-bold mt-4">
              Need a hand with your order?
            </h3>
            <p className="mt-2 text-primary-foreground/80 max-w-md">
              Our support crew answers in under one business day. Reach out anytime — we're here to
              make it right.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="mailto:support@cuthaven.com"
                className="inline-flex items-center gap-2 rounded-full bg-accent text-accent-foreground px-4 py-2 text-sm font-semibold hover:brightness-110 transition"
              >
                <Mail className="h-4 w-4" aria-hidden="true" /> support@cuthaven.com
              </a>
              <a
                href="tel:+14062299045"
                className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/30 px-4 py-2 text-sm font-semibold hover:bg-primary-foreground/10 transition"
              >
                <Phone className="h-4 w-4" aria-hidden="true" /> +1 (406) 229-9045
              </a>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-surface p-8 md:p-10">
            <h3 className="font-display text-2xl font-bold">Helpful next steps</h3>
            <ul className="mt-4 space-y-3 text-sm">
              {[
                { to: "/shipping-policy", label: "Read the full shipping policy" },
                { to: "/returns-refund-policy", label: "Start a return or exchange" },
                { to: "/order-cancellation-policy", label: "Cancel or change your order" },
                { to: "/contact-us", label: "Contact the CutHaven team" },
              ].map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    className="group inline-flex items-center gap-2 text-primary font-semibold hover:text-accent transition-colors"
                  >
                    {l.label}
                    <ArrowRight
                      className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
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
