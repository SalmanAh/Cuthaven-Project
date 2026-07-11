import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Heart, Minus, Plus, ShoppingCart, Truck, RotateCcw, Lock, Share2, Star, Package } from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";
import { ProductCard } from "@/components/ui/ProductCard";
import { getProductBySlug, getProducts } from "@/lib/api-client";
import { useCart } from "@/context/CartContext";
import { useWishlist } from "@/context/WishlistContext";
import type { Product } from "@/data/products";

export const Route = createFileRoute("/product/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug.replace(/-/g, " ")} — CutHaven` },
      { name: "description", content: "Premium tools at CutHaven." },
    ],
  }),
  component: ProductPage,
});

function ProductPage() {
  const { slug } = Route.useParams();
  const [imgIdx, setImgIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState<"desc" | "specs" | "reviews">("desc");
  const { addItem } = useCart();
  const { toggle, has } = useWishlist();

  const { data: product, isLoading, isError } = useQuery({
    queryKey: ["product", slug],
    queryFn: () => getProductBySlug(slug),
  });

  const { data: allProducts = [] } = useQuery({
    queryKey: ["products"],
    queryFn: getProducts,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <Package className="h-14 w-14 text-text-secondary" />
        <h1 className="font-display text-2xl font-bold">Product not found</h1>
        <p className="text-text-secondary">This product doesn't exist or has been removed.</p>
        <Link to="/shop" className="btn-primary">Back to Shop</Link>
      </div>
    );
  }

  const price = product.salePrice ?? product.price;
  const related = allProducts
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 4);

  return (
    <div>
      <PageHero
        title={product.name}
        crumbs={[{ label: "Shop", to: "/shop" }, { label: product.category || "Product" }, { label: "Detail" }]}
      />

      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid lg:grid-cols-2 gap-10">
          {/* ── Images ── */}
          <div>
            <div className="aspect-square rounded-2xl overflow-hidden bg-muted mb-4">
              <img
                src={product.images[imgIdx] ?? product.images[0]}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </div>
            {product.images.length > 1 && (
              <div className="flex gap-3 flex-wrap">
                {product.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setImgIdx(i)}
                    className={`h-20 w-20 rounded-lg overflow-hidden border-2 shrink-0 ${i === imgIdx ? "border-primary" : "border-border"}`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Info ── */}
          <div>
            <p className="text-xs uppercase tracking-widest text-text-secondary">
              {product.brand && <span>{product.brand} · </span>}
              {product.category || "Product"}
            </p>
            <h1 className="font-display text-3xl md:text-4xl font-bold mt-2">{product.name}</h1>

            <div className="flex items-center gap-2 mt-3 text-sm">
              <div className="flex text-warning">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className={`h-4 w-4 ${i < Math.round(product.rating) ? "fill-current" : ""}`} />
                ))}
              </div>
              <span className="text-text-secondary">
                {product.rating > 0 ? `${product.rating} (${product.reviewCount} reviews)` : "No reviews yet"}
              </span>
            </div>

            <div className="flex items-baseline gap-3 mt-5">
              <span className="text-accent text-3xl font-bold">${price.toFixed(2)}</span>
              {product.salePrice && (
                <span className="text-text-muted line-through">${product.price.toFixed(2)}</span>
              )}
            </div>
            <p className="text-sm text-success mt-1">Free shipping on orders over $350</p>

            <p className="mt-6 text-text-secondary leading-relaxed">
              {product.shortDescription}
            </p>

            <div className="mt-6 flex items-center gap-4">
              <div className="flex items-center border border-border rounded-full">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="h-11 w-11 grid place-items-center"
                  aria-label="Decrease"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-10 text-center font-semibold">{qty}</span>
                <button
                  onClick={() => setQty((q) => q + 1)}
                  className="h-11 w-11 grid place-items-center"
                  aria-label="Increase"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <button
                disabled={!product.inStock}
                onClick={() => addItem(product, qty)}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                <ShoppingCart className="h-4 w-4" />
                {product.inStock ? "Add to Cart" : "Out of Stock"}
              </button>
            </div>

            <div className="mt-3 flex gap-3">
              <Link
                to="/cart"
                onClick={() => product.inStock && addItem(product, qty)}
                className="btn-outline-primary flex-1"
              >
                Buy Now
              </Link>
              <button
                onClick={() => toggle(product.id)}
                className={`h-11 w-11 rounded-full border border-border grid place-items-center hover:border-primary transition ${has(product.id) ? "text-destructive" : ""}`}
                aria-label="Wishlist"
              >
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

        {/* ── Tabs ── */}
        <div className="mt-14">
          <div className="flex gap-1 border-b border-border">
            {(["desc", "specs", "reviews"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-5 py-3 text-sm font-semibold border-b-2 transition ${tab === t ? "border-accent text-primary" : "border-transparent text-text-secondary hover:text-foreground"}`}
              >
                {t === "desc" ? "Description" : t === "specs" ? "Features" : `Reviews (${product.reviewCount})`}
              </button>
            ))}
          </div>
          <div className="py-8 max-w-none">
            {tab === "desc" && (
              <p className="text-text-secondary leading-relaxed max-w-3xl whitespace-pre-line">
                {product.description}
              </p>
            )}
            {tab === "specs" && (
              <ul className="space-y-2 max-w-xl">
                {(product.tags ?? []).length > 0 ? (
                  product.tags.map((f, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="text-primary mt-1">•</span>
                      <span className="text-text-secondary">{f}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-sm text-text-secondary">No specifications listed.</li>
                )}
              </ul>
            )}
            {tab === "reviews" && (
              <div className="space-y-5 max-w-2xl">
                <p className="text-sm text-text-secondary">No reviews yet. Be the first!</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Related products ── */}
        {related.length > 0 && (
          <section className="mt-14">
            <h2 className="font-display text-2xl font-bold mb-6">You May Also Like</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {related.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
