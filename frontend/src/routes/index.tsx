import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Star, Truck, RotateCcw, ShieldCheck, ShoppingCart } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ProductCard } from "@/components/ui/ProductCard";
import { getProducts, getCategories } from "@/lib/api-client";
import heroTool from "@/assets/hero-tool.png.asset.json";
import { useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CutHaven — Forged for the Wild. Built for the Hand." },
      {
        name: "description",
        content:
          "Premium outdoor, garden and workshop tools designed with heritage and grit. Free US shipping over $350, 40-day returns, 12-month warranty.",
      },
      { property: "og:title", content: "CutHaven — Forged for the Wild. Built for the Hand." },
      {
        property: "og:description",
        content:
          "Premium outdoor, garden and workshop tools designed with heritage and grit.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: HomePage,
});

const trustItems = [
  { icon: Truck, title: "Ships within the United States Only", desc: "Fast, tracked delivery from Palmer, AK." },
  { icon: RotateCcw, title: "40-Day Return Window", desc: "No-questions-asked returns on every order." },
  { icon: ShieldCheck, title: "12-Month Manufacturer Warranty", desc: "Every tool is covered against defects." },
];

// Peeking category tiles — match reference composition (Shovels, Categories, Tools, Warranties)
const heroTiles = [
  { label: "Shovels", image: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&auto=format&fit=crop&q=70" },
  { label: "Categories", image: "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=800&auto=format&fit=crop&q=70" },
  { label: "Tools", image: "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=800&auto=format&fit=crop&q=70" },
  { label: "Warranties", image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800&auto=format&fit=crop&q=70" },
];

function HomePage() {
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: getProducts });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: getCategories });

  const bestSellers = [...products].sort((a, b) => b.rating - a.rating).slice(0, 8);
  const promoTiles = categories.slice(0, 4);

  return (
    <div className="bg-background">
      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden bg-primary-dark text-primary-foreground">
        {/* Subtle radial glow behind */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(1000px 600px at 78% 45%, oklch(0.55 0.09 156 / 0.55), transparent 60%), linear-gradient(180deg, var(--color-primary-dark), var(--color-primary))",
          }}
        />

        <div className="relative mx-auto max-w-7xl px-4 pt-16 md:pt-24 pb-40 md:pb-56 grid lg:grid-cols-2 gap-10 items-center">
          {/* Left copy */}
          <div className="max-w-xl">
            <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-accent">
              <span className="h-px w-8 bg-accent" />
              Est. Heritage Craft
            </p>
            <h1 className="font-display font-bold mt-5 text-5xl md:text-6xl lg:text-7xl leading-[1.02] tracking-tight">
              Nature
              <br />
              <span className="text-white/95">in Hand.</span>
            </h1>
            <p className="mt-6 text-base md:text-lg text-white/80 leading-relaxed max-w-md">
              Built with Heritage. Made to Last.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                to="/shop"
                className="group inline-flex items-center gap-2 rounded-full bg-accent hover:bg-accent-hover text-accent-foreground px-7 py-4 text-sm font-semibold shadow-lg shadow-black/20 transition"
              >
                Shop Premium Tools
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>

            {/* Mini trust row */}
            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-white/70">
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-accent" /> 12-Month Warranty
              </span>
              <span className="inline-flex items-center gap-2">
                <Truck className="h-4 w-4 text-accent" /> Free US Shipping over $350
              </span>
              <span className="inline-flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-accent" /> 40-Day Returns
              </span>
            </div>
          </div>

          {/* Right — circular frame with product */}
          <div className="relative hidden lg:flex justify-center items-center">
            <div className="relative aspect-square w-[520px] max-w-full">
              <div className="absolute inset-0 rounded-full border border-white/15" />
              <div className="absolute inset-6 rounded-full border border-white/10" />
              <div
                className="absolute inset-10 rounded-full"
                style={{
                  background:
                    "radial-gradient(closest-side, oklch(0.5 0.09 156 / 0.6), oklch(0.34 0.08 156 / 0.1) 70%, transparent)",
                }}
              />
              <img
                src={heroTool.url}
                alt="Premium socket wrench ratchet tool set"
                width={1200}
                height={1200}
                className="relative z-10 w-full h-full object-contain p-16 drop-shadow-[0_25px_40px_rgba(0,0,0,0.45)]"
              />
              {/* Floating feature chip — refined */}
              <div className="absolute -right-2 bottom-8 z-20 flex items-center gap-3 rounded-2xl bg-surface/95 backdrop-blur text-foreground pl-3 pr-4 py-3 shadow-2xl ring-1 ring-black/5">
                <div className="h-10 w-10 rounded-xl bg-accent/15 grid place-items-center">
                  <ShieldCheck className="h-5 w-5 text-accent" />
                </div>
                <div className="leading-tight">
                  <p className="text-[10px] uppercase tracking-widest text-text-secondary">Featured Set</p>
                  <p className="font-display font-bold text-base">Pro Ratchet Kit</p>
                  <p className="text-accent font-bold text-xs mt-0.5">From $149.99</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Wave / curve base to transition to light surface */}
        <div className="absolute inset-x-0 bottom-0 h-24 md:h-32 bg-background rounded-t-[48px]" aria-hidden />
      </section>

      {/* ============ PEEKING CATEGORY TILES ============ */}
      <section className="relative -mt-32 md:-mt-44 z-10">
        <div className="mx-auto max-w-7xl px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
            {heroTiles.map((tile) => (
              <Link
                key={tile.label}
                to="/shop"
                className="group relative overflow-hidden rounded-3xl aspect-[4/5] shadow-xl shadow-black/10 ring-1 ring-black/5"
              >
                <img
                  src={tile.image}
                  alt={tile.label}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                <div className="absolute inset-x-5 bottom-5 flex items-end justify-between text-white">
                  <h3 className="font-display text-2xl md:text-3xl font-bold drop-shadow">{tile.label}</h3>
                  <span className="h-9 w-9 rounded-full bg-accent grid place-items-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition">
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ============ BEST SELLERS ============ */}
      <section className="mx-auto max-w-7xl px-4 pt-24 md:pt-28 pb-16">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-accent">
              Loved by craftsmen
            </p>
            <h2 className="font-display font-bold text-4xl md:text-5xl mt-2 tracking-tight">
              Best Sellers
            </h2>
          </div>
          <Link
            to="/shop"
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-accent transition"
          >
            View all products <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {bestSellers.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* ============ TRUST STRIP ============ */}
      <section className="mx-auto max-w-7xl px-4 pb-16">
        <div className="rounded-2xl border border-border bg-surface grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
          {trustItems.map((t) => (
            <div key={t.title} className="flex items-start gap-4 p-6">
              <div className="h-11 w-11 shrink-0 rounded-full bg-primary/10 grid place-items-center text-primary">
                <t.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground">{t.title}</p>
                <p className="text-xs text-text-secondary mt-1 leading-relaxed">{t.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ============ CATEGORY / PROMO ROW ============ */}
      <section className="mx-auto max-w-7xl px-4 pb-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
          {promoTiles.map((c, i) => (
            <Link
              key={c.id}
              to="/shop"
              className={`group relative overflow-hidden rounded-3xl min-h-[220px] ${
                i === 3 ? "bg-primary text-primary-foreground" : ""
              }`}
            >
              {i !== 3 && (
                <div className="absolute inset-0 bg-gradient-to-br from-primary/80 to-primary-dark" />
              )}
              <div className="relative p-5 h-full flex flex-col justify-end text-white">
                <h3 className="font-display text-xl md:text-2xl font-bold leading-tight">{c.name}</h3>
                <p className="mt-1 text-xs uppercase tracking-widest text-white/80 inline-flex items-center gap-1">
                  {c.productCount} products <ArrowRight className="h-3 w-3" />
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ============ EDITORIAL CTA ============ */}
      <section className="mx-auto max-w-7xl px-4 pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-primary text-primary-foreground p-10 md:p-14 grid md:grid-cols-2 gap-8 items-center">
          <div
            aria-hidden
            className="absolute -right-24 -top-24 h-96 w-96 rounded-full"
            style={{
              background:
                "radial-gradient(closest-side, oklch(0.7 0.16 55 / 0.5), transparent)",
            }}
          />
          <div className="relative">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-accent">
              Newsletter
            </p>
            <h2 className="font-display font-bold text-3xl md:text-4xl mt-3 leading-tight">
              Join the workshop. Get $20 off your first order.
            </h2>
            <p className="mt-3 text-white/80 text-sm max-w-md">
              Field notes, restocks and members-only drops — delivered monthly. No spam.
            </p>
          </div>
          <form
            onSubmit={(e) => e.preventDefault()}
            className="relative flex flex-col sm:flex-row gap-3"
          >
            <input
              type="email"
              required
              placeholder="you@workshop.com"
              className="flex-1 rounded-full bg-white/10 border border-white/25 px-5 py-4 text-sm text-white placeholder:text-white/60 focus:outline-none focus:border-accent"
            />
            <button className="inline-flex items-center justify-center gap-2 rounded-full bg-accent hover:bg-accent-hover text-accent-foreground px-7 py-4 text-sm font-semibold transition">
              <ShoppingCart className="h-4 w-4" /> Subscribe
            </button>
          </form>
        </div>
      </section>

      {/* ============ CUSTOMER REVIEW FORM ============ */}
      <section className="mx-auto max-w-7xl px-4 pb-20">
        <ReviewForm />
      </section>

      {/* ============ REVIEW STRIP ============ */}
      <section className="border-t border-border bg-surface py-10">
        <div className="mx-auto max-w-7xl px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex text-warning">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-current" />
              ))}
            </div>
            <p className="text-sm font-semibold">
              Rated 4.8/5 by 2,400+ verified craftsmen
            </p>
          </div>
          <p className="text-xs text-text-secondary">
            1633 S Industrial Way, Palmer, AK 99645 · +1 (406) 229-9045 · support@cuthaven.com
          </p>
        </div>
      </section>
    </div>
  );
}

function ReviewForm() {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [name, setName] = useState("");
  const [review, setReview] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating || !name.trim() || !review.trim()) return;
    setSubmitted(true);
    setRating(0);
    setName("");
    setReview("");
    setTimeout(() => setSubmitted(false), 4000);
  };

  return (
    <div className="rounded-3xl border border-border bg-surface p-8 md:p-12 grid md:grid-cols-2 gap-10 items-start">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-accent">Community</p>
        <h2 className="font-display font-bold text-3xl md:text-4xl mt-2 leading-tight">
          Share Your Experience
        </h2>
        <p className="mt-3 text-sm text-text-secondary max-w-md">
          Own a CutHaven tool? Tell fellow craftsmen how it holds up on the job. Your review helps
          keep our workshop honest.
        </p>
        <div className="mt-6 flex items-center gap-3 text-sm text-text-secondary">
          <div className="flex text-warning">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="h-4 w-4 fill-current" />
            ))}
          </div>
          <span>Rated 4.8/5 by 2,400+ verified craftsmen</span>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest text-text-secondary">
            Your rating
          </label>
          <div className="mt-2 flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                aria-label={`Rate ${n} star${n > 1 ? "s" : ""}`}
                className="p-1"
              >
                <Star
                  className={`h-6 w-6 transition ${
                    (hover || rating) >= n
                      ? "fill-warning text-warning"
                      : "text-border"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Your name"
            className="rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary"
          />
          <input
            type="text"
            placeholder="Product (optional)"
            className="rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary"
          />
        </div>
        <textarea
          value={review}
          onChange={(e) => setReview(e.target.value)}
          required
          rows={4}
          placeholder="Tell us how the tool performs…"
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary resize-none"
        />
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-text-secondary">
            {submitted ? "Thanks — your review was submitted." : "Reviews are moderated before publishing."}
          </p>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-full bg-accent hover:bg-accent-hover text-accent-foreground px-6 py-3 text-sm font-semibold transition"
          >
            Submit Review
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
