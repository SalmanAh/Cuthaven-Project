import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";
import { ProductCard } from "@/components/ui/ProductCard";
import { useWishlist } from "@/context/WishlistContext";
import { useCart } from "@/context/CartContext";
import { products } from "@/data/products";
import { toast } from "sonner";

export const Route = createFileRoute("/wishlist")({
  head: () => ({ meta: [
    { title: "My Wishlist — CutHaven" },
    { name: "description", content: "Your saved CutHaven products." },
    { property: "og:title", content: "My Wishlist — CutHaven" },
    { property: "og:description", content: "Your saved CutHaven products." },
  ] }),
  component: WishlistPage,
});

function WishlistPage() {
  const { ids } = useWishlist();
  const { addItem } = useCart();
  const items = products.filter((p) => ids.includes(p.id));

  const addAll = () => { items.forEach((p) => addItem(p, 1)); toast.success("Added all wishlist items to cart"); };

  return (
    <div>
      <PageHero title="My Wishlist" crumbs={[{ label: "Wishlist" }]} />
      <div className="mx-auto max-w-7xl px-4 py-10">
        {items.length === 0 ? (
          <div className="text-center py-16">
            <Heart className="h-16 w-16 text-primary mx-auto mb-4" />
            <h2 className="font-display text-2xl font-bold">Your wishlist is empty</h2>
            <p className="text-text-secondary mt-2">Save products you love to find them here later.</p>
            <Link to="/shop" className="btn-primary mt-6 inline-flex">Browse Products</Link>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm text-text-secondary">{items.length} item{items.length !== 1 ? "s" : ""}</p>
              <button onClick={addAll} className="btn-primary text-sm">Add All to Cart</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {items.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
