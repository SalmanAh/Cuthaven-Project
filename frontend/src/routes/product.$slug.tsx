import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { Heart, Minus, Plus, ShoppingCart, Truck, RotateCcw, Lock, Share2, Star } from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";
import { PageBreadcrumb } from "@/components/ui/PageBreadcrumb";
import { ProductCard } from "@/components/ui/ProductCard";
import { getProductBySlug, products } from "@/data/products";
import { useCart } from "@/context/CartContext";
import { useWishlist } from "@/context/WishlistContext";

export const Route = createFileRoute("/product/$slug")({
  head: ({ params }) => {
    const p = getProductBySlug(params.slug);
    return {
      meta: [
        { title: p ? `${p.name} — CutHaven` : "Product — CutHaven" },
        { name: "description", content: p?.shortDescription ?? "Premium tools at CutHaven." },
        { property: "og:title", content: p?.name ?? "CutHaven Product" },
        { property: "og:description", content: p?.shortDescription ?? "" },
        ...(p?.images[0] ? [{ property: "og:image", content: p.images[0] }] : []),
      ],
    };
  },
  loader: ({ params }) => {
    const product = getProductBySlug(params.slug);
    if (!product) throw notFound();
    return { product };
  },
  component: ProductPage,
});

function ProductPage() {
  const { product } = Route.useLoaderData();
  const [imgIdx, setImgIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState<"desc" | "specs" | "reviews">("desc");
  const { addItem } = useCart();
  const { toggle, has } = useWishlist();

  const price = product.salePrice ?? product.price;
  const related = products.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 4);

  return (
    <div>
      <PageHero title={product.name} crumbs={[{ label: "Shop", to: "/shop" }, { label: product.category }, { label: "Detail" }]} />

      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid lg:grid-cols-2 gap-10">
          <div>
            <div className="aspect-square rounded-2xl overflow-hidden bg-muted mb-4">
              <img src={product.images[imgIdx]} alt={product.name} className="w-full h-full object-cover" />
            </div>
            <div className="flex gap-3">
              {product.images.map((img: string, i: number) => (
                <button key={i} onClick={() => setImgIdx(i)}
                  className={`h-20 w-20 rounded-lg overflow-hidden border-2 ${i === imgIdx ? "border-primary" : "border-border"}`}>
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-widest text-text-secondary">SKU: {product.sku} · {product.category}</p>
            <h1 className="font-display text-3xl md:text-4xl font-bold mt-2">{product.name}</h1>
            <div className="flex items-center gap-2 mt-3 text-sm">
              <div className="flex text-warning">
                {[...Array(5)].map((_, i) => <Star key={i} className={`h-4 w-4 ${i < Math.round(product.rating) ? "fill-current" : ""}`} />)}
              </div>
              <span className="text-text-secondary">{product.rating} ({product.reviewCount} reviews)</span>
            </div>

            <div className="flex items-baseline gap-3 mt-5">
              <span className="text-accent text-3xl font-bold">${price.toFixed(2)}</span>
              {product.salePrice && <span className="text-text-muted line-through">${product.price.toFixed(2)}</span>}
            </div>
            <p className="text-sm text-success mt-1">Free shipping on orders over $350</p>

            <p className="mt-6 text-text-secondary leading-relaxed">{product.shortDescription}</p>

            <div className="mt-6 flex items-center gap-4">
              <div className="flex items-center border border-border rounded-full">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="h-11 w-11 grid place-items-center" aria-label="Decrease"><Minus className="h-4 w-4" /></button>
                <span className="w-10 text-center font-semibold">{qty}</span>
                <button onClick={() => setQty((q) => q + 1)} className="h-11 w-11 grid place-items-center" aria-label="Increase"><Plus className="h-4 w-4" /></button>
              </div>
              <button onClick={() => addItem(product, qty)} className="btn-primary flex-1"><ShoppingCart className="h-4 w-4" /> Add to Cart</button>
            </div>

            <div className="mt-3 flex gap-3">
              <Link to="/cart" onClick={() => addItem(product, qty)} className="btn-outline-primary flex-1">Buy Now</Link>
              <button onClick={() => toggle(product.id)} className={`h-11 w-11 rounded-full border border-border grid place-items-center hover:border-primary ${has(product.id) ? "text-destructive" : ""}`} aria-label="Wishlist">
                <Heart className={`h-4 w-4 ${has(product.id) ? "fill-current" : ""}`} />
              </button>
            </div>

            <div className="mt-8 border-t border-border pt-5 space-y-2 text-sm">
              <p className="flex gap-2"><Truck className="h-4 w-4 text-primary" /> Free shipping on orders over $350</p>
              <p className="flex gap-2"><RotateCcw className="h-4 w-4 text-primary" /> 40-day easy returns</p>
              <p className="flex gap-2"><Lock className="h-4 w-4 text-primary" /> Secure &amp; safe checkout</p>
            </div>

            <div className="mt-6 flex items-center gap-2 text-sm text-text-secondary">
              <Share2 className="h-4 w-4" /> Share this product
            </div>
          </div>
        </div>

        <div className="mt-14">
          <div className="flex gap-1 border-b border-border">
            {(["desc", "specs", "reviews"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-5 py-3 text-sm font-semibold border-b-2 transition ${tab === t ? "border-accent text-primary" : "border-transparent text-text-secondary hover:text-foreground"}`}>
                {t === "desc" ? "Description" : t === "specs" ? "Specifications" : `Reviews (${product.reviewCount})`}
              </button>
            ))}
          </div>
          <div className="py-8 prose max-w-none">
            {tab === "desc" && <p className="text-text-secondary leading-relaxed max-w-3xl">{product.description}</p>}
            {tab === "specs" && (
              <table className="w-full max-w-xl text-sm">
                <tbody>
                  {(Object.entries(product.attributes) as [string, string][]).map(([k, v]) => (
                    <tr key={k} className="border-b border-border">
                      <td className="py-3 font-semibold w-1/3">{k}</td>
                      <td className="py-3 text-text-secondary">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {tab === "reviews" && (
              <div className="space-y-5 max-w-2xl">
                {[
                  { name: "Marcus H.", rating: 5, comment: "Solid build, delivered fast. Exactly what I needed." },
                  { name: "Priya S.", rating: 4, comment: "Great value. Handle grip is comfortable even after long use." },
                  { name: "Ted W.", rating: 5, comment: "Used it for a full weekend project — no complaints." },
                ].map((r, i) => (
                  <div key={i} className="card-surface p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold">{r.name}</span>
                      <div className="flex text-warning">{[...Array(5)].map((_, j) => <Star key={j} className={`h-3.5 w-3.5 ${j < r.rating ? "fill-current" : ""}`} />)}</div>
                    </div>
                    <p className="text-sm text-text-secondary">{r.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <section className="mt-14">
          <h2 className="font-display text-2xl font-bold mb-6">You May Also Like</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {related.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      </div>
    </div>
  );
}
