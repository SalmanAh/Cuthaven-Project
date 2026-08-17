import { Link } from "@tanstack/react-router";
import { Heart, Star, ShoppingCart, Eye } from "lucide-react";
import type { Product } from "@/data/products";
import { useCart } from "@/context/CartContext";
import { useWishlist } from "@/context/WishlistContext";

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const { toggle, has } = useWishlist();
  const isWished = has(product.id);
  const price = product.salePrice ?? product.price;

  return (
    <div className="group card-surface overflow-hidden flex flex-col">
      <div className="relative aspect-square overflow-hidden bg-muted">
        <Link to="/product/$slug" params={{ slug: product.slug }}>
          <img
            src={product.images[0]}
            alt={product.name}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </Link>

        {product.salePrice && (
          <span className="absolute top-3 left-3 bg-destructive text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
            SALE
          </span>
        )}
        {!product.inStock && (
          <span className="absolute top-3 left-3 bg-black/70 text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
            OUT OF STOCK
          </span>
        )}

        <button
          onClick={() => toggle(product.id)}
          aria-label="Wishlist"
          className={`absolute top-3 right-3 h-9 w-9 rounded-full bg-white/95 flex items-center justify-center shadow hover:scale-110 transition ${isWished ? "text-destructive" : "text-foreground"}`}
        >
          <Heart className={`h-4 w-4 ${isWished ? "fill-current" : ""}`} />
        </button>

        <div className="absolute inset-x-3 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <Link
            to="/product/$slug"
            params={{ slug: product.slug }}
            className="flex items-center justify-center gap-1.5 w-full py-2 rounded-full bg-white/95 text-sm font-medium shadow hover:bg-white"
          >
            <Eye className="h-4 w-4" /> Quick View
          </Link>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-1.5 flex-1">
        <p className="text-[11px] uppercase tracking-wide text-text-secondary">
          {product.category}
        </p>
        <Link
          to="/product/$slug"
          params={{ slug: product.slug }}
          className="font-medium text-sm leading-snug line-clamp-2 hover:text-primary min-h-[2.5rem]"
        >
          {product.name}
        </Link>
        <div className="flex items-center gap-1 text-xs text-text-secondary">
          <div className="flex text-warning">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`h-3 w-3 ${i < Math.round(product.rating) ? "fill-current" : ""}`}
              />
            ))}
          </div>
          <span>({product.reviewCount})</span>
        </div>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-accent font-bold text-lg">${price.toFixed(2)}</span>
          {product.salePrice && (
            <span className="text-xs text-text-muted line-through">
              ${product.price.toFixed(2)}
            </span>
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <button
            disabled={!product.inStock}
            onClick={() => addItem(product)}
            className="btn-primary flex-1 !py-2 !text-xs disabled:!bg-muted disabled:!text-text-muted"
          >
            <ShoppingCart className="h-4 w-4" /> Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}
