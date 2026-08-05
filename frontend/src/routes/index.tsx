import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Star, Truck, RotateCcw, ShieldCheck, ShoppingCart } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ProductCard } from "@/components/ui/ProductCard";
import { getProducts, getCategories, submitContact } from "@/lib/api-client";
import { useState } from "react";
import { toast } from "sonner";

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

// ─── JSON-LD constants ─────────────────────────────────────────────────────

const STORE_URL = import.meta.env.VITE_STORE_URL ?? "https://www.cuthaven.com";

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "CutHaven",
  url: STORE_URL,
  logo: `${STORE_URL}/favicon.ico`,
  description:
    "Premium outdoor, garden and workshop tools for the US market. Free shipping over $350, 40-day returns, 12-month warranty.",
  address: {
    "@type": "PostalAddress",
    streetAddress: "1633 S Industrial Way",
    addressLocality: "Palmer",
    addressRegion: "AK",
    postalCode: "99645",
    addressCountry: "US",
  },
  contactPoint: {
    "@type": "ContactPoint",
    telephone: "+1-406-229-9045",
    contactType: "customer service",
    email: "support@cuthaven.com",
    availableLanguage: "English",
    areaServed: "US",
  },
  sameAs: [],
};

const webSiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "CutHaven",
  url: STORE_URL,
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${STORE_URL}/shop?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

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
      {/* ── JSON-LD structured data ── */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteJsonLd) }}
      />

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

        <div className="relative mx-auto max-w-7xl px-3 sm:px-4 pt-12 sm:pt-16 md:pt-24 pb-32 sm:pb-40 md:pb-56 grid lg:grid-cols-2 gap-8 sm:gap-10 items-center">
          {/* Left copy */}
          <div className="max-w-xl">
            <p className="inline-flex items-center gap-2 text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.2em] sm:tracking-[0.25em] text-accent">
              <span className="h-px w-6 sm:w-8 bg-accent" />
              Est. Heritage Craft
            </p>
            <h1 className="font-display font-bold mt-4 sm:mt-5 text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-[1.05] sm:leading-[1.02] tracking-tight">
              Nature
              <br />
              <span className="text-white/95">in Hand.</span>
            </h1>
            <p className="mt-4 sm:mt-6 text-sm sm:text-base md:text-lg text-white/80 leading-relaxed max-w-md">
              Built with Heritage. Made to Last.
            </p>
            <div className="mt-6 sm:mt-8 flex flex-wrap items-center gap-3 sm:gap-4">
              <Link
                to="/shop"
                className="group inline-flex items-center gap-2 rounded-full bg-accent hover:bg-accent-hover text-accent-foreground px-5 sm:px-7 py-3 sm:py-4 text-xs sm:text-sm font-semibold shadow-lg shadow-black/20 transition"
              >
                Shop Premium Tools
                <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>

            {/* Mini trust row */}
            <div className="mt-6 sm:mt-10 flex flex-wrap items-center gap-x-4 sm:gap-x-6 gap-y-2 text-[10px] sm:text-xs text-white/70">
              <span className="inline-flex items-center gap-1.5 sm:gap-2">
                <ShieldCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-accent flex-shrink-0" /> 12-Month Warranty
              </span>
              <span className="inline-flex items-center gap-1.5 sm:gap-2">
                <Truck className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-accent flex-shrink-0" /> Free Shipping $350+
              </span>
              <span className="inline-flex items-center gap-1.5 sm:gap-2">
                <RotateCcw className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-accent flex-shrink-0" /> 40-Day Returns
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
              <div className="relative z-10 w-full h-full p-16">
                <img
                  src="https://images.unsplash.com/photo-1581244277943-fe4a9c777189?w=900&auto=format&fit=crop&q=80"
                  alt="Premium socket wrench ratchet tool set"
                  width={1200}
                  height={1200}
                  className="w-full h-full object-cover rounded-full drop-shadow-[0_25px_40px_rgba(0,0,0,0.45)]"
                />
              </div>
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
        <div className="absolute inset-x-0 bottom-0 h-20 sm:h-24 md:h-32 bg-background rounded-t-[32px] sm:rounded-t-[48px]" aria-hidden />
      </section>

      {/* ============ PEEKING CATEGORY TILES ============ */}
      <section className="relative -mt-24 sm:mt-32 md:-mt-44 z-10">
        <div className="mx-auto max-w-7xl px-3 sm:px-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
            {heroTiles.map((tile) => (
              <Link
                key={tile.label}
                to="/shop"
                className="group relative overflow-hidden rounded-2xl sm:rounded-3xl aspect-[4/5] shadow-lg sm:shadow-xl shadow-black/10 ring-1 ring-black/5"
              >
                <img
                  src={tile.image}
                  alt={tile.label}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                <div className="absolute inset-x-3 sm:inset-x-5 bottom-3 sm:bottom-5 flex items-end justify-between text-white">
                  <h3 className="font-display text-xl sm:text-2xl md:text-3xl font-bold drop-shadow">{tile.label}</h3>
                  <span className="h-7 w-7 sm:h-9 sm:w-9 rounded-full bg-accent grid place-items-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition">
                    <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ============ BEST SELLERS ============ */}
      <section className="mx-auto max-w-7xl px-3 sm:px-4 pt-20 sm:pt-24 md:pt-28 pb-12 sm:pb-16">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-4 mb-8 sm:mb-10">
          <div>
            <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.25em] sm:tracking-[0.3em] text-accent">
              Loved by craftsmen
            </p>
            <h2 className="font-display font-bold text-3xl sm:text-4xl md:text-5xl mt-2 tracking-tight">
              Best Sellers
            </h2>
          </div>
          <Link
            to="/shop"
            className="inline-flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-semibold text-primary hover:text-accent transition"
          >
            View all products <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
          {bestSellers.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* ============ TRUST STRIP ============ */}
      <section className="mx-auto max-w-7xl px-3 sm:px-4 pb-12 sm:pb-16">
        <div className="rounded-xl sm:rounded-2xl border border-border bg-surface grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
          {trustItems.map((t) => (
            <div key={t.title} className="flex items-start gap-3 sm:gap-4 p-4 sm:p-6">
              <div className="h-9 w-9 sm:h-11 sm:w-11 shrink-0 rounded-full bg-primary/10 grid place-items-center text-primary">
                <t.icon className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div>
                <p className="font-semibold text-xs sm:text-sm text-foreground">{t.title}</p>
                <p className="text-[11px] sm:text-xs text-text-secondary mt-0.5 sm:mt-1 leading-relaxed">{t.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ============ CATEGORY / PROMO ROW ============ */}
      <section className="mx-auto max-w-7xl px-3 sm:px-4 pb-16 sm:pb-20">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
          {promoTiles.map((c, i) => {
            // Category-specific images with circular shaded effect
            const categoryImages = [
              "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&auto=format&fit=crop&q=70", // Camping tent
              "https://www.joyebike.com/product/beast/images/banner-img-mobile.png", // E-bike
              "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSNVUgEawjNipvMEgLqWEcuPFvVuawcHCHvD3ObUj_tU7sxWOuPiYW0sdpJ&s=10", // Electric scooter
              "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&auto=format&fit=crop&q=70", // Lawn mower
            ];
            
            return (
              <Link
                key={c.id}
                to="/shop"
                className="group relative overflow-hidden rounded-2xl sm:rounded-3xl min-h-[180px] sm:min-h-[220px]"
              >
                {/* Background gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/90 to-primary-dark" />
                
                {/* Circular shaded product image - fitted to square card */}
                <div className="absolute inset-0 opacity-30 group-hover:opacity-40 transition-opacity duration-500">
                  <div 
                    className="absolute inset-0"
                    style={{
                      background: "radial-gradient(ellipse 100% 100% at 50% 50%, oklch(0.5 0.09 156 / 0.5), transparent 65%)",
                    }}
                  />
                  <img
                    src={categoryImages[i]}
                    alt={c.name}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover opacity-70 mix-blend-soft-light scale-105 group-hover:scale-115 transition-transform duration-700"
                  />
                </div>
                
                {/* Content */}
                <div className="relative p-4 sm:p-5 h-full flex flex-col justify-end text-white z-10">
                  <h3 className="font-display text-lg sm:text-xl md:text-2xl font-bold leading-tight drop-shadow-lg">{c.name}</h3>
                  <p className="mt-1 text-[10px] sm:text-xs uppercase tracking-widest text-white/90 inline-flex items-center gap-1 drop-shadow">
                    {c.productCount} products <ArrowRight className="h-3 w-3" />
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ============ EDITORIAL CTA ============ */}
      <section className="mx-auto max-w-7xl px-3 sm:px-4 pb-16 sm:pb-20">
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-primary text-primary-foreground p-6 sm:p-10 md:p-14 grid md:grid-cols-2 gap-6 sm:gap-8 items-center">
          <div
            aria-hidden
            className="absolute -right-24 -top-24 h-96 w-96 rounded-full"
            style={{
              background:
                "radial-gradient(closest-side, oklch(0.7 0.16 55 / 0.5), transparent)",
            }}
          />
          <div className="relative">
            <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.25em] sm:tracking-[0.3em] text-accent">
              Newsletter
            </p>
            <h2 className="font-display font-bold text-2xl sm:text-3xl md:text-4xl mt-2 sm:mt-3 leading-tight">
              Join the workshop. Get $20 off your first order.
            </h2>
            <p className="mt-2 sm:mt-3 text-white/80 text-xs sm:text-sm max-w-md">
              Field notes, restocks and members-only drops — delivered monthly. No spam.
            </p>
          </div>
          <form
            onSubmit={(e) => e.preventDefault()}
            className="relative flex flex-col sm:flex-row gap-2 sm:gap-3"
          >
            <input
              type="email"
              required
              placeholder="you@workshop.com"
              className="flex-1 rounded-full bg-white/10 border border-white/25 px-4 sm:px-5 py-3 sm:py-4 text-xs sm:text-sm text-white placeholder:text-white/60 focus:outline-none focus:border-accent"
            />
            <button className="inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-full bg-accent hover:bg-accent-hover text-accent-foreground px-5 sm:px-7 py-3 sm:py-4 text-xs sm:text-sm font-semibold transition shrink-0">
              <ShoppingCart className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Subscribe
            </button>
          </form>
        </div>
      </section>

      {/* ============ CUSTOMER REVIEW FORM ============ */}
      <section className="mx-auto max-w-7xl px-3 sm:px-4 pb-16 sm:pb-20">
        <ReviewForm />
      </section>

      {/* ============ REVIEW STRIP ============ */}
      <section className="border-t border-border bg-surface py-6 sm:py-10">
        <div className="mx-auto max-w-7xl px-3 sm:px-4 flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
            <div className="flex text-warning">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-current" />
              ))}
            </div>
            <p className="text-xs sm:text-sm font-semibold text-center sm:text-left">
              Rated 4.8/5 by 2,400+ verified craftsmen
            </p>
          </div>
          <p className="text-[10px] sm:text-xs text-text-secondary text-center md:text-right">
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
  const [product, setProduct] = useState("");
  const [review, setReview] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating || !name.trim() || !review.trim()) return;
    setLoading(true);
    try {
      // Homepage reviews go via contact_submissions so they reach the support inbox
      // and can be manually approved and added to product PDPs by the admin.
      // Direct product reviews with a productId are submitted on the PDP reviews tab.
      await submitContact({
        name: name.trim(),
        email: "review@cuthaven.com", // placeholder — replaced by admin
        subject: `Homepage review — ${product.trim() || "General"} — ${rating}/5 stars`,
        message: `Rating: ${rating}/5\nProduct: ${product.trim() || "Not specified"}\n\nReview:\n${review.trim()}`,
      });
      setSubmitted(true);
      setRating(0); setName(""); setProduct(""); setReview("");
      setTimeout(() => setSubmitted(false), 5000);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to submit. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl sm:rounded-3xl border border-border bg-surface p-6 sm:p-8 md:p-12 grid md:grid-cols-2 gap-8 sm:gap-10 items-start">
      <div>
        <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.25em] sm:tracking-[0.3em] text-accent">Community</p>
        <h2 className="font-display font-bold text-2xl sm:text-3xl md:text-4xl mt-2 leading-tight">
          Share Your Experience
        </h2>
        <p className="mt-2 sm:mt-3 text-xs sm:text-sm text-text-secondary max-w-md">
          Own a CutHaven tool? Tell fellow craftsmen how it holds up on the job. Your review helps
          keep our workshop honest.
        </p>
        <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-xs sm:text-sm text-text-secondary">
          <div className="flex text-warning">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-current" />
            ))}
          </div>
          <span>Rated 4.8/5 by 2,400+ verified craftsmen</span>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-3 sm:space-y-4">
        <div>
          <label className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-text-secondary">
            Your rating
          </label>
          <div className="mt-2 flex gap-0.5 sm:gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                aria-label={`Rate ${n} star${n > 1 ? "s" : ""}`}
                className="p-0.5 sm:p-1"
              >
                <Star
                  className={`h-5 w-5 sm:h-6 sm:w-6 transition ${
                    (hover || rating) >= n
                      ? "fill-warning text-warning"
                      : "text-border"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-2 sm:gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Your name"
            className="rounded-xl border border-border bg-background px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm focus:outline-none focus:border-primary"
          />
          <input
            type="text"
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            placeholder="Product (optional)"
            className="rounded-xl border border-border bg-background px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm focus:outline-none focus:border-primary"
          />
        </div>
        <textarea
          value={review}
          onChange={(e) => setReview(e.target.value)}
          required
          rows={4}
          placeholder="Tell us how the tool performs…"
          className="w-full rounded-xl border border-border bg-background px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm focus:outline-none focus:border-primary resize-none"
        />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <p className="text-[10px] sm:text-xs text-text-secondary">
            {submitted ? "Thanks — your review was received!" : "Reviews are moderated before publishing."}
          </p>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-accent hover:bg-accent-hover text-accent-foreground px-5 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold transition disabled:opacity-60 whitespace-nowrap"
          >
            {loading ? "Submitting…" : <><span>Submit Review</span><ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></>}
          </button>
        </div>
      </form>
    </div>
  );
}
