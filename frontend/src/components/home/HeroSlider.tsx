import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";

const slides = [
  {
    title: "Premium Outdoor Tools",
    subtitle: "Built for performance, crafted for durability.",
    primary: "Shop Now",
    secondary: "View More",
    bg: "from-primary-dark via-primary to-primary-light",
  },
  {
    title: "Garden Like a Pro",
    subtitle: "Professional tools for every gardener.",
    primary: "Shop Now",
    secondary: "Explore Tools",
    bg: "from-primary via-primary-dark to-black",
  },
  {
    title: "Free Shipping",
    subtitle: "On all orders over $350.",
    primary: "Shop Now",
    secondary: "Learn More",
    bg: "from-accent-hover via-accent to-primary-dark",
  },
];

export function HeroSlider() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setI((v: number) => (v + 1) % slides.length), 4500);
    return () => clearInterval(t);
  }, []);

  const s = slides[i];

  return (
    <section className="relative overflow-hidden">
      <div className={`bg-gradient-to-br ${s.bg} transition-all duration-700`}>
        <div className="mx-auto max-w-7xl px-4 min-h-[400px] md:min-h-[520px] grid md:grid-cols-2 gap-8 items-center py-14">
          <div className="text-white space-y-5">
            <p className="text-sm uppercase tracking-widest text-white/80">CutHaven Collection</p>
            <h1 className="font-display text-4xl md:text-6xl font-bold leading-tight">{s.title}</h1>
            <p className="text-white/85 text-lg max-w-md">{s.subtitle}</p>
            <div className="flex flex-wrap gap-3 pt-3">
              <Link to="/shop" className="btn-primary">{s.primary}</Link>
              <Link
                to="/shop"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-white text-white text-sm font-semibold hover:bg-white hover:text-primary transition"
              >
                {s.secondary}
              </Link>
            </div>
          </div>
          <div className="hidden md:flex justify-center">
            <div className="h-80 w-80 rounded-3xl bg-white/10 backdrop-blur border border-white/20 grid place-items-center">
              <span className="text-white/50 text-sm">Featured product</span>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => setI((v: number) => (v - 1 + slides.length) % slides.length)}
        className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/80 hover:bg-white grid place-items-center"
        aria-label="Previous"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <button
        onClick={() => setI((v: number) => (v + 1) % slides.length)}
        className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/80 hover:bg-white grid place-items-center"
        aria-label="Next"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        {slides.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setI(idx)}
            className={`h-2 rounded-full transition-all ${i === idx ? "w-8 bg-white" : "w-2 bg-white/50"}`}
            aria-label={`Slide ${idx + 1}`}
          />
        ))}
      </div>
    </section>
  );
}
