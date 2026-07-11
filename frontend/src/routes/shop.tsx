import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LayoutGrid, List, X } from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";
import { ProductCard } from "@/components/ui/ProductCard";
import { getProducts, getCategories } from "@/lib/api-client";

export const Route = createFileRoute("/shop")({
  head: () => ({
    meta: [
      { title: "Shop All Tools — CutHaven" },
      { name: "description", content: "Browse our full catalog of garden, hand, and power tools. Free shipping on every order." },
      { property: "og:title", content: "Shop All Tools — CutHaven" },
      { property: "og:description", content: "Full CutHaven catalog with filters, sorting, and free shipping." },
    ],
  }),
  component: ShopPage,
});

type Sort = "default" | "price-asc" | "price-desc" | "rating";

function ShopPage() {
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [maxPrice, setMaxPrice] = useState(500);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("default");
  const [view, setView] = useState<"grid" | "list">("grid");

  const { data: products, isLoading, isError } = useQuery({
    queryKey: ["products"],
    queryFn: getProducts,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });

  const filtered = useMemo(() => {
    let list = (products ?? []).filter((p) => {
      if (selectedCats.length && !selectedCats.includes(p.category)) return false;
      if ((p.salePrice ?? p.price) > maxPrice) return false;
      if (inStockOnly && !p.inStock) return false;
      return true;
    });
    if (sort === "price-asc") list = [...list].sort((a, b) => (a.salePrice ?? a.price) - (b.salePrice ?? b.price));
    if (sort === "price-desc") list = [...list].sort((a, b) => (b.salePrice ?? b.price) - (a.salePrice ?? a.price));
    if (sort === "rating") list = [...list].sort((a, b) => b.rating - a.rating);
    return list;
  }, [selectedCats, maxPrice, inStockOnly, sort]);

  const toggleCat = (c: string) => setSelectedCats((s) => s.includes(c) ? s.filter((x) => x !== c) : [...s, c]);
  const clearAll = () => { setSelectedCats([]); setMaxPrice(500); setInStockOnly(false); };
  const activeCount = selectedCats.length + (inStockOnly ? 1 : 0) + (maxPrice < 500 ? 1 : 0);

  return (
    <div>
      <PageHero title="Shop" subtitle="Every tool, hand-picked for pros and weekend builders." crumbs={[{ label: "Shop" }]} />

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
            <input type="range" min={20} max={500} step={10} value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} className="w-full accent-primary" />
          </div>

          <div className="mb-2">
            <p className="text-sm font-semibold mb-3">Availability</p>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} className="accent-primary" />
              In stock only
            </label>
          </div>
        </aside>

        <div>
          <div className="flex flex-wrap gap-3 items-center justify-between mb-5">
            <p className="text-sm text-text-secondary">Showing <span className="font-semibold text-foreground">{filtered.length}</span> results</p>
            <div className="flex items-center gap-3">
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}
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
              {filtered.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((p) => (
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

          <div className="flex items-center justify-center gap-1 mt-10">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} className={`h-9 w-9 rounded-full text-sm font-medium ${n === 1 ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{n}</button>
            ))}
            <button className="h-9 px-4 rounded-full text-sm font-medium hover:bg-muted">Next →</button>
          </div>
        </div>
      </div>
    </div>
  );
}
