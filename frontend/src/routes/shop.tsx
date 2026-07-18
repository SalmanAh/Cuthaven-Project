import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LayoutGrid, List, X, Search } from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";
import { ProductCard } from "@/components/ui/ProductCard";
import { getProducts, getCategories } from "@/lib/api-client";
import { z } from "zod";

export const Route = createFileRoute("/shop")({
  head: () => ({
    meta: [
      { title: "Shop All Tools — CutHaven" },
      { name: "description", content: "Browse our full catalog of garden, hand, and power tools. Free shipping on every order." },
      { property: "og:title", content: "Shop All Tools — CutHaven" },
      { property: "og:description", content: "Full CutHaven catalog with filters, sorting, and free shipping." },
    ],
  }),
  validateSearch: z.object({ q: z.string().optional(), category: z.string().optional() }).parse,
  component: ShopPage,
});

const STORE_URL = import.meta.env.VITE_STORE_URL ?? "https://www.cuthaven.com";

const shopBreadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: STORE_URL },
    { "@type": "ListItem", position: 2, name: "Shop", item: `${STORE_URL}/shop` },
  ],
};

type Sort = "default" | "price-asc" | "price-desc" | "rating";

const PAGE_SIZE = 12;

function ShopPage() {
  const { q: initialQ, category: initialCat } = Route.useSearch();
  const [searchQ, setSearchQ] = useState(initialQ ?? "");
  const [selectedCats, setSelectedCats] = useState<string[]>(initialCat ? [initialCat] : []);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("default");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);

  const { data: products, isLoading, isError } = useQuery({
    queryKey: ["products"],
    queryFn: getProducts,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });

  // Calculate the highest price from products to set as default max
  const highestPrice = useMemo(() => {
    if (!products || products.length === 0) return 5000;
    return Math.ceil(Math.max(...products.map(p => p.salePrice ?? p.price)));
  }, [products]);

  const [maxPrice, setMaxPrice] = useState(highestPrice);

  // Update maxPrice when products load and highestPrice changes
  useMemo(() => {
    if (highestPrice > maxPrice) {
      setMaxPrice(highestPrice);
    }
  }, [highestPrice]);

  const filtered = useMemo(() => {
    let list = (products ?? []).filter((p) => {
      if (searchQ.trim()) {
        const q = searchQ.trim().toLowerCase();
        const matches =
          p.name.toLowerCase().includes(q) ||
          (p.shortDescription ?? "").toLowerCase().includes(q) ||
          (p.brand ?? "").toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (selectedCats.length && !selectedCats.includes(p.category)) return false;
      if ((p.salePrice ?? p.price) > maxPrice) return false;
      if (inStockOnly && !p.inStock) return false;
      return true;
    });
    if (sort === "price-asc") list = [...list].sort((a, b) => (a.salePrice ?? a.price) - (b.salePrice ?? b.price));
    if (sort === "price-desc") list = [...list].sort((a, b) => (b.salePrice ?? b.price) - (a.salePrice ?? a.price));
    if (sort === "rating") list = [...list].sort((a, b) => b.rating - a.rating);
    return list;
  }, [products, searchQ, selectedCats, maxPrice, inStockOnly, sort]);

  const toggleCat = (c: string) => { setPage(1); setSelectedCats((s) => s.includes(c) ? s.filter((x) => x !== c) : [...s, c]); };
  const clearAll = () => { setSelectedCats([]); setMaxPrice(highestPrice); setInStockOnly(false); setSearchQ(""); setPage(1); };
  const activeCount = selectedCats.length + (inStockOnly ? 1 : 0) + (maxPrice < highestPrice ? 1 : 0) + (searchQ.trim() ? 1 : 0);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // build page number list — always show first, last, current ±1, with ellipsis
  const pageNumbers: (number | "…")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= safePage - 1 && i <= safePage + 1)) {
      pageNumbers.push(i);
    } else if (pageNumbers[pageNumbers.length - 1] !== "…") {
      pageNumbers.push("…");
    }
  }

  return (
    <div>
      {/* ── JSON-LD breadcrumb ── */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(shopBreadcrumbJsonLd) }}
      />
      <PageHero title="Shop" subtitle="Every tool, hand-picked for pros and weekend builders." />

      <div className="mx-auto max-w-7xl px-4 py-10 grid lg:grid-cols-[280px_1fr] gap-8">
        <aside className="card-surface p-5 h-fit lg:sticky lg:top-24">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg font-bold">Filters</h3>
            {activeCount > 0 && <button onClick={clearAll} className="text-xs text-accent hover:underline">Clear ({activeCount})</button>}
          </div>

          <div className="mb-6">
            <p className="text-sm font-semibold mb-3">Category</p>
            <div className="space-y-2">
              {categories.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={selectedCats.includes(c.id)} onChange={() => toggleCat(c.id)} className="accent-primary" />
                  <span>{c.name}</span>
                  <span className="text-text-muted text-xs ml-auto">({c.productCount})</span>
                </label>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <p className="text-sm font-semibold mb-2">Max Price: <span className="text-accent">${maxPrice}</span></p>
            <input type="range" min={20} max={highestPrice} step={10} value={maxPrice} onChange={(e) => { setMaxPrice(Number(e.target.value)); setPage(1); }} className="w-full accent-primary" />
          </div>

          <div className="mb-2">
            <p className="text-sm font-semibold mb-3">Availability</p>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={inStockOnly} onChange={(e) => { setInStockOnly(e.target.checked); setPage(1); }} className="accent-primary" />
              In stock only
            </label>
          </div>
        </aside>

        <div>
          {/* ── Search bar ── */}
          <div className="relative mb-5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary pointer-events-none" />
            <input
              type="search"
              value={searchQ}
              onChange={(e) => { setSearchQ(e.target.value); setPage(1); }}
              placeholder="Search tools by name, brand or description…"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-primary bg-surface"
              aria-label="Search products"
            />
            {searchQ && (
              <button
                onClick={() => { setSearchQ(""); setPage(1); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-3 items-center justify-between mb-5">
            <p className="text-sm text-text-secondary">Showing <span className="font-semibold text-foreground">{filtered.length}</span> results</p>
            <div className="flex items-center gap-3">
              <select value={sort} onChange={(e) => { setSort(e.target.value as Sort); setPage(1); }}
                className="px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary bg-surface">
                <option value="default">Default sorting</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="rating">Top Rated</option>
              </select>
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button onClick={() => setView("grid")} className={`p-2 ${view === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`} aria-label="Grid"><LayoutGrid className="h-4 w-4" /></button>
                <button onClick={() => setView("list")} className={`p-2 ${view === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`} aria-label="List"><List className="h-4 w-4" /></button>
              </div>
            </div>
          </div>

          {selectedCats.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {selectedCats.map((c) => (
                <span key={c} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                  {c} <button onClick={() => toggleCat(c)}><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
          )}

          {isLoading ? (
            <div className="card-surface p-12 text-center text-text-secondary">Loading products…</div>
          ) : isError ? (
            <div className="card-surface p-12 text-center text-destructive">
              Couldn't reach the store backend. Is it running on the port set in VITE_API_URL?
            </div>
          ) : filtered.length === 0 ? (
            <div className="card-surface p-12 text-center">
              <p className="text-text-secondary">No products match your filters.</p>
              <button onClick={clearAll} className="btn-primary mt-4">Clear filters</button>
            </div>
          ) : view === "grid" ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
              {paged.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          ) : (
            <div className="space-y-4">
              {paged.map((p) => (
                <div key={p.id} className="card-surface p-4 flex gap-4">
                  <img src={p.images[0]} alt={p.name} className="h-32 w-32 rounded-lg object-cover" />
                  <div className="flex-1">
                    <p className="text-xs uppercase text-text-secondary">{p.category}</p>
                    <h3 className="font-semibold mb-1">{p.name}</h3>
                    <p className="text-sm text-text-secondary line-clamp-2">{p.shortDescription}</p>
                    <p className="text-accent font-bold mt-2">${(p.salePrice ?? p.price).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 mt-10">
              <button
                onClick={() => { setPage((p) => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                disabled={safePage === 1}
                className="h-9 px-4 rounded-full text-sm font-medium hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
              >← Prev</button>

              {pageNumbers.map((n, i) =>
                n === "…" ? (
                  <span key={`ellipsis-${i}`} className="h-9 w-9 flex items-center justify-center text-text-secondary text-sm">…</span>
                ) : (
                  <button
                    key={n}
                    onClick={() => { setPage(n); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    className={`h-9 w-9 rounded-full text-sm font-medium transition-colors ${n === safePage ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                  >{n}</button>
                )
              )}

              <button
                onClick={() => { setPage((p) => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                disabled={safePage === totalPages}
                className="h-9 px-4 rounded-full text-sm font-medium hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
              >Next →</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
