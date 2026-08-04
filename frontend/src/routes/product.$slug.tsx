import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Heart, Minus, Plus, ShoppingCart, Truck, RotateCcw, Lock, Share2, Star, Package, CheckCircle2 } from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";
import { ProductCard } from "@/components/ui/ProductCard";
import { getProductBySlug, getProducts, getProductReviews, submitReview, checkCanReview, type ReviewItem, type CanReviewResult } from "@/lib/api-client";
import { useCart } from "@/context/CartContext";
import { useWishlist } from "@/context/WishlistContext";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import type { Product } from "@/data/products";

export const Route = createFileRoute("/product/$slug")({
  head: ({ params }) => {
    const humanName = params.slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return {
      meta: [
        { title: `${humanName} — CutHaven` },
        { name: "description", content: `Buy ${humanName} at CutHaven. Free US shipping over $350, 40-day returns, 12-month warranty.` },
        { property: "og:title", content: `${humanName} — CutHaven` },
        { property: "og:description", content: `Buy ${humanName} at CutHaven. Free US shipping over $350, 40-day returns, 12-month warranty.` },
        { property: "og:type", content: "product" },
      ],
    };
  },
  component: ProductPage,
});

// ─── JSON-LD helpers ───────────────────────────────────────────────────────

const STORE_URL = import.meta.env.VITE_STORE_URL ?? "https://www.cuthaven.com";

function gmcAvailability(avail: string): string {
  switch (avail) {
    case "in_stock":     return "https://schema.org/InStock";
    case "out_of_stock": return "https://schema.org/OutOfStock";
    case "preorder":     return "https://schema.org/PreOrder";
    case "backorder":    return "https://schema.org/BackOrder";
    default:             return "https://schema.org/InStock";
  }
}

function buildProductJsonLd(product: Product, slug: string): object {
  const price = product.salePrice ?? product.price;
  const images = product.images.filter(Boolean);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.shortDescription || product.description,
    ...(product.sku    ? { sku: product.sku }    : {}),
    ...(product.brand  ? { brand: { "@type": "Brand", name: product.brand } } : {}),
    image: images,
    url: `${STORE_URL}/product/${slug}`,
    offers: {
      "@type": "Offer",
      url: `${STORE_URL}/product/${slug}`,
      priceCurrency: "USD",
      price: price.toFixed(2),
      availability: gmcAvailability(product.inStock ? "in_stock" : "out_of_stock"),
      itemCondition: "https://schema.org/NewCondition",
      seller: {
        "@type": "Organization",
        name: "CutHaven",
      },
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingRate: {
          "@type": "MonetaryAmount",
          value: "9.99",
          currency: "USD",
        },
        shippingDestination: {
          "@type": "DefinedRegion",
          addressCountry: "US",
        },
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 1, unitCode: "DAY" },
          transitTime:  { "@type": "QuantitativeValue", minValue: 5, maxValue: 8, unitCode: "DAY" },
        },
      },
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: "US",
        returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
        merchantReturnDays: 40,
        returnMethod: "https://schema.org/ReturnByMail",
        returnFees: "https://schema.org/FreeReturn",
      },
    },
    ...(product.rating > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.rating.toFixed(1),
            reviewCount: product.reviewCount,
            bestRating: "5",
            worstRating: "1",
          },
        }
      : {}),
  };
}

function buildPdpBreadcrumbJsonLd(product: Product): object {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home",  item: STORE_URL },
      { "@type": "ListItem", position: 2, name: "Shop",  item: `${STORE_URL}/shop` },
      ...(product.category
        ? [{ "@type": "ListItem", position: 3, name: product.category, item: `${STORE_URL}/shop` }]
        : []),
      { "@type": "ListItem", position: product.category ? 4 : 3, name: product.name },
    ],
  };
}

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

  // maxQty derived AFTER product is fetched — safe because we guard below
  const maxQty = product && product.stockQuantity > 0 ? product.stockQuantity : 999;

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

  // ── Structured data (injected as <script type="application/ld+json"> in <head>) ──
  const productJsonLd   = buildProductJsonLd(product, slug);
  const breadcrumbJsonLd = buildPdpBreadcrumbJsonLd(product);

  return (
    <div>
      {/* ── JSON-LD structured data ── */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <PageHero
        title={product.name}
      />

      <div className="mx-auto max-w-7xl px-3 sm:px-4 py-6 sm:py-8 md:py-10">
        <div className="grid lg:grid-cols-2 gap-6 sm:gap-8 md:gap-10">
          {/* ── Images ── */}
          <div>
            <div className="aspect-square rounded-xl sm:rounded-2xl overflow-hidden bg-muted mb-3 sm:mb-4">
              <img
                src={product.images[imgIdx] ?? product.images[0]}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </div>
            {product.images.length > 1 && (
              <div className="flex gap-2 sm:gap-3 flex-wrap">
                {product.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setImgIdx(i)}
                    className={`h-16 w-16 sm:h-20 sm:w-20 rounded-lg overflow-hidden border-2 shrink-0 ${i === imgIdx ? "border-primary" : "border-border"}`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Info ── */}
          <div>
            <p className="text-[10px] sm:text-xs uppercase tracking-widest text-text-secondary">
              {product.brand && <span>{product.brand} · </span>}
              {product.category || "Product"}
            </p>
            <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold mt-2">{product.name}</h1>

            <div className="flex items-center gap-2 mt-2 sm:mt-3 text-xs sm:text-sm">
              <div className="flex text-warning">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${i < Math.round(product.rating) ? "fill-current" : ""}`} />
                ))}
              </div>
              <span className="text-text-secondary text-xs sm:text-sm">
                {product.rating > 0 ? `${product.rating} (${product.reviewCount} reviews)` : "No reviews yet"}
              </span>
            </div>

            <div className="flex items-baseline gap-2 sm:gap-3 mt-4 sm:mt-5">
              <span className="text-accent text-2xl sm:text-3xl font-bold">${price.toFixed(2)}</span>
              {product.salePrice && (
                <span className="text-text-muted line-through text-sm sm:text-base">${product.price.toFixed(2)}</span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-success mt-1">Free shipping on orders over $350</p>

            <p className="mt-4 sm:mt-6 text-text-secondary leading-relaxed text-sm sm:text-base">
              {product.shortDescription}
            </p>

            <div className="mt-5 sm:mt-6 flex items-center gap-3 sm:gap-4">
              <div className="flex items-center border border-border rounded-full">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="h-10 w-10 sm:h-11 sm:w-11 grid place-items-center touch-manipulation"
                  aria-label="Decrease"
                >
                  <Minus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>
                <span className="w-9 sm:w-10 text-center font-semibold text-sm sm:text-base">{qty}</span>
                <button
                  onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                  disabled={qty >= maxQty}
                  className="h-10 w-10 sm:h-11 sm:w-11 grid place-items-center disabled:opacity-40 touch-manipulation"
                  aria-label="Increase"
                >
                  <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>
              </div>
              <button
                disabled={!product.inStock}
                onClick={() => addItem(product, qty)}
                className="btn-primary flex-1 disabled:opacity-50 text-sm sm:text-base min-h-[44px]"
              >
                <ShoppingCart className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                {product.inStock ? "Add to Cart" : "Out of Stock"}
              </button>
            </div>

            {/* Stock availability label */}
            <div className="mt-2 text-xs sm:text-sm">
              {!product.inStock ? (
                <p className="text-destructive font-medium">Out of stock</p>
              ) : product.stockQuantity <= 10 && product.stockQuantity > 0 ? (
                <p className="text-warning font-medium">
                  Only {product.stockQuantity} left in stock — order soon
                </p>
              ) : product.stockQuantity > 10 ? (
                <p className="text-success">{product.stockQuantity} in stock</p>
              ) : null}
              {qty >= maxQty && product.inStock && (
                <p className="text-destructive font-medium mt-1">
                  Maximum available quantity reached ({maxQty})
                </p>
              )}
            </div>

            <div className="mt-3 flex gap-2 sm:gap-3">
              <Link
                to="/cart"
                onClick={() => product.inStock && addItem(product, qty)}
                className="btn-outline-primary flex-1 text-sm sm:text-base min-h-[44px]"
              >
                Buy Now
              </Link>
              <button
                onClick={() => toggle(product.id)}
                className={`h-11 w-11 sm:h-11 sm:w-11 rounded-full border border-border grid place-items-center hover:border-primary transition touch-manipulation ${has(product.id) ? "text-destructive" : ""}`}
                aria-label="Wishlist"
              >
                <Heart className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${has(product.id) ? "fill-current" : ""}`} />
              </button>
            </div>

            <div className="mt-6 sm:mt-8 border-t border-border pt-4 sm:pt-5 space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
              <p className="flex gap-2"><Truck className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary shrink-0 mt-0.5" /> Free shipping on orders over $350</p>
              <p className="flex gap-2"><RotateCcw className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary shrink-0 mt-0.5" /> 40-day easy returns</p>
              <p className="flex gap-2"><Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary shrink-0 mt-0.5" /> Secure &amp; safe checkout</p>
            </div>

            <div className="mt-5 sm:mt-6 flex items-center gap-2 text-xs sm:text-sm text-text-secondary">
              <Share2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Share this product
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="mt-10 sm:mt-12 md:mt-14">
          <div className="flex gap-0.5 sm:gap-1 border-b border-border overflow-x-auto">
            {(["desc", "specs", "reviews"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 sm:px-4 md:px-5 py-2 sm:py-3 text-xs sm:text-sm font-semibold border-b-2 transition whitespace-nowrap ${tab === t ? "border-accent text-primary" : "border-transparent text-text-secondary hover:text-foreground"}`}
              >
                {t === "desc" ? "Description" : t === "specs" ? "Features" : `Reviews (${product.reviewCount})`}
              </button>
            ))}
          </div>
          <div className="py-6 sm:py-8 max-w-none">
            {tab === "desc" && (
              <p className="text-text-secondary leading-relaxed max-w-3xl whitespace-pre-line text-sm sm:text-base">
                {product.description}
              </p>
            )}
            {tab === "specs" && (
              <ul className="space-y-1.5 sm:space-y-2 max-w-xl">
                {(product.tags ?? []).length > 0 ? (
                  product.tags.map((f, i) => (
                    <li key={i} className="flex gap-2 text-xs sm:text-sm">
                      <span className="text-primary mt-1">•</span>
                      <span className="text-text-secondary">{f}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-xs sm:text-sm text-text-secondary">No specifications listed.</li>
                )}
              </ul>
            )}
            {tab === "reviews" && (
              <ReviewsTab productSlug={slug} productId={product.id} />
            )}
          </div>
        </div>

        {/* ── Related products ── */}
        {related.length > 0 && (
          <section className="mt-10 sm:mt-12 md:mt-14">
            <h2 className="font-display text-xl sm:text-2xl font-bold mb-4 sm:mb-6">You May Also Like</h2>
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
              {related.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

// ─── Reviews tab ──────────────────────────────────────────────────────────

function StarRow({ rating, size = 4 }: { rating: number; size?: number }) {
  return (
    <div className="flex text-warning">
      {[1,2,3,4,5].map((n) => (
        <Star key={n} className={`h-${size} w-${size} ${n <= rating ? "fill-current" : "stroke-current opacity-30"}`} />
      ))}
    </div>
  );
}

function ReviewsTab({ productSlug, productId }: { productSlug: string; productId: string }) {
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [disclosed, setDisclosed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [eligibility, setEligibility] = useState<CanReviewResult | null>(null);
  const [checkingEligibility, setCheckingEligibility] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["reviews", productSlug],
    queryFn:  () => getProductReviews(productSlug),
  });

  const reviews    = data?.reviews   ?? [];
  const avgRating  = data?.avgRating ?? 0;
  const totalCount = data?.count     ?? 0;

  // Called when customer clicks "Write a Review"
  const handleWriteReviewClick = async () => {
    // Guest — not logged in
    if (!user) {
      toast.error("Only customers who have purchased and received this item can leave a review. Please sign in.");
      return;
    }

    // Check eligibility from the backend
    setCheckingEligibility(true);
    try {
      const result = await checkCanReview(productId);
      setEligibility(result);

      if (result.canReview) {
        setShowForm(true);
        return;
      }

      // Show specific message based on reason
      switch (result.reason) {
        case "not_purchased":
          toast.error("Only customers who have purchased this item can leave a review.");
          break;
        case "not_delivered":
          toast.error("You haven't received this item yet. Reviews can only be submitted after your order has been delivered.");
          break;
        case "already_reviewed":
          toast.info("You have already submitted a review for this product.");
          break;
        default:
          toast.error("You are not eligible to review this product.");
      }
    } catch {
      // If the check fails (network error), still block and show a message
      toast.error("Could not verify purchase status. Please try again.");
    } finally {
      setCheckingEligibility(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating) { toast.error("Please select a star rating"); return; }
    if (!user)   { toast.error("Please sign in to leave a review"); return; }
    setSubmitting(true);
    try {
      await submitReview({ productId, rating, reviewText: reviewText.trim() || undefined, disclosedIncentive: disclosed });
      toast.success("Review submitted — it will appear after moderation.");
      setShowForm(false); setRating(0); setReviewText(""); setDisclosed(false); setEligibility(null);
      refetch();
    } catch (err: any) {
      const msg = typeof err.message === "string" && err.message.includes("{")
        ? "Please check your review and try again."
        : err.message ?? "Failed to submit review";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6 sm:space-y-8">
      {/* Summary bar */}
      {totalCount > 0 && (
        <div className="flex items-center gap-4 sm:gap-5 p-3 sm:p-4 rounded-xl bg-muted/40 border border-border">
          <div className="text-center">
            <p className="text-3xl sm:text-4xl font-bold">{avgRating.toFixed(1)}</p>
            <StarRow rating={Math.round(avgRating)} />
            <p className="text-[10px] sm:text-xs text-text-secondary mt-1">{totalCount} review{totalCount !== 1 ? "s" : ""}</p>
          </div>
        </div>
      )}

      {/* Write review button */}
      {!showForm && (
        <button
          onClick={handleWriteReviewClick}
          disabled={checkingEligibility}
          className="btn-outline-primary text-xs sm:text-sm disabled:opacity-60 min-h-[44px]"
        >
          {checkingEligibility ? "Checking…" : "Write a Review"}
        </button>
      )}

      {/* Review form — only shown after eligibility confirmed */}
      {showForm && (
        <form onSubmit={handleSubmit} className="card-surface p-4 sm:p-5 md:p-6 space-y-3 sm:space-y-4 rounded-xl">
          <h3 className="font-semibold text-sm sm:text-base">Your Review</h3>
          <div>
            <p className="text-[10px] sm:text-xs text-text-secondary mb-2">Rating *</p>
            <div className="flex gap-1">
              {[1,2,3,4,5].map((n) => (
                <button key={n} type="button" onClick={() => setRating(n)} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} aria-label={`${n} star`} className="touch-manipulation">
                  <Star className={`h-6 w-6 sm:h-7 sm:w-7 transition ${(hover||rating)>=n ? "fill-warning text-warning" : "text-border"}`} />
                </button>
              ))}
            </div>
          </div>
          <textarea
            rows={4}
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            placeholder="Share your experience with this product (optional)"
            className="w-full px-3 py-2.5 rounded-lg border border-border text-xs sm:text-sm focus:outline-none focus:border-primary"
          />
          <label className="flex items-center gap-2 text-[10px] sm:text-xs text-text-secondary cursor-pointer">
            <input type="checkbox" checked={disclosed} onChange={(e) => setDisclosed(e.target.checked)} className="rounded" />
            I received this product free or at a discount in exchange for a review (FTC disclosure)
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setShowForm(false); setEligibility(null); }} className="btn-outline-primary text-xs sm:text-sm px-3 sm:px-4 py-2 min-h-[44px]">Cancel</button>
            <button disabled={submitting} className="btn-primary text-xs sm:text-sm px-3 sm:px-4 py-2 disabled:opacity-60 min-h-[44px]">
              {submitting ? "Submitting…" : "Submit Review"}
            </button>
          </div>
        </form>
      )}

      {/* Reviews list */}
      {isLoading ? (
        <div className="flex justify-center py-8"><div className="h-6 w-6 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div>
      ) : reviews.length === 0 ? (
        <p className="text-xs sm:text-sm text-text-secondary">No reviews yet. Be the first!</p>
      ) : (
        <ul className="space-y-5 sm:space-y-6">
          {reviews.map((r) => (
            <li key={r.id} className="border-b border-border pb-5 sm:pb-6 last:border-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-xs sm:text-sm">{r.reviewerName}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <StarRow rating={r.rating} size={3} />
                    {r.isVerifiedPurchase && (
                      <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs text-success"><CheckCircle2 className="h-3 w-3" />Verified</span>
                    )}
                  </div>
                </div>
                <p className="text-[10px] sm:text-xs text-text-secondary shrink-0">{new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
              </div>
              {r.reviewText && <p className="mt-2 text-xs sm:text-sm text-text-secondary leading-relaxed">{r.reviewText}</p>}
              {r.disclosedIncentive && <p className="mt-1 text-[10px] sm:text-xs text-text-secondary italic">* Reviewer disclosed they received an incentive.</p>}
              {r.insiderRelationship && <p className="mt-1 text-[10px] sm:text-xs text-text-secondary italic">* Relationship: {r.insiderRelationship}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
