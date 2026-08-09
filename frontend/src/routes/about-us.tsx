import { createFileRoute, Link } from "@tanstack/react-router";
import { Star, RotateCcw, CheckCircle2, Truck } from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";

export const Route = createFileRoute("/about-us")({
  head: () => ({
    meta: [
      { title: "About CutHaven — Our Story" },
      { name: "description", content: "CutHaven is your trusted source for premium outdoor and garden tools. Learn about our mission and values." },
      { property: "og:title", content: "About CutHaven" },
      { property: "og:description", content: "Trusted tools, honest pricing, real support." },
    ],
  }),
  component: AboutPage,
});

const stats = [
  { n: "12+", l: "Years Experience" },
  { n: "500+", l: "Products" },
  { n: "10,000+", l: "Happy Customers" },
  { n: "40-Day", l: "Returns" },
];

const why = [
  { icon: Star, t: "Premium Quality", d: "Top-tier materials built to last." },
  { icon: RotateCcw, t: "Easy Returns", d: "40-day hassle-free return policy." },
  { icon: CheckCircle2, t: "Trusted Results", d: "Performance you can count on." },
  { icon: Truck, t: "Free Shipping", d: "Free delivery on orders over $350." },
];

function AboutPage() {
  return (
    <div>
      <PageHero title="About Us" subtitle="Quality tools, honest pricing, real support." />

      <section className="mx-auto max-w-7xl px-4 py-14 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <p className="text-accent text-sm uppercase tracking-widest font-semibold">Who We Are</p>
          <h2 className="font-display text-3xl md:text-4xl font-bold mt-2 mb-5">Built by tool people, for tool people.</h2>
          <div className="space-y-4 text-text-secondary leading-relaxed">
            <p>At CutHaven, we source premium outdoor, garden, hand, and power tools from manufacturers we actually trust. Every product we carry is one we'd use ourselves — no filler, no gimmicks.</p>
            <p>We ship from the US, back every order with a 40-day return window, and answer support emails from real people during business hours.</p>
            <p>Whether you're prepping a garden, rebuilding a deck, or repowering a machine, we want you to get the right tool the first time.</p>
          </div>
          <Link to="/shop" className="btn-primary mt-6 inline-flex">Shop Our Products →</Link>
        </div>
        <div className="aspect-square rounded-2xl overflow-hidden bg-muted relative">
          {/* Background image */}
          <img 
            src="/images/warehouse.jpg" 
            alt="CutHaven Workshop - Premium tool warehouse with organized inventory" 
            width={800}
            height={800}
            loading="eager"
            decoding="async"
            className="w-full h-full object-cover" 
          />
          {/* Dark shaded overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/80 via-primary/60 to-primary-dark/90" />
          {/* Optional: CutHaven Workshop text overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white">
              <h3 className="font-display text-3xl md:text-4xl font-bold drop-shadow-lg">CutHaven Workshop</h3>
              <p className="text-sm md:text-base mt-2 text-white/90 drop-shadow">Premium Tools, Organized Excellence</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-surface border-y border-border py-10">
        <div className="mx-auto max-w-7xl px-4 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {stats.map((s) => (
            <div key={s.l}>
              <p className="font-display text-3xl md:text-4xl font-bold text-primary">{s.n}</p>
              <p className="text-sm text-text-secondary mt-1">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-primary text-primary-foreground py-16 text-center">
        <div className="mx-auto max-w-3xl px-4">
          <p className="text-primary-foreground/70 text-sm uppercase tracking-widest font-semibold">Our Mission</p>
          <h2 className="font-display text-3xl md:text-4xl font-bold mt-2 mb-4">Right tool. Right price. Right support.</h2>
          <p className="text-primary-foreground/85 leading-relaxed">We believe buying a tool shouldn't feel like a gamble. Our mission is to make quality tools accessible, backed by honest advice and dependable service — so every project starts on solid ground.</p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
        {why.map((w) => (
          <div key={w.t}>
            <div className="h-14 w-14 rounded-full bg-primary/10 grid place-items-center mx-auto mb-3"><w.icon className="h-6 w-6 text-primary" /></div>
            <p className="font-semibold">{w.t}</p>
            <p className="text-sm text-text-secondary mt-1">{w.d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
