import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";
import { useCart } from "@/context/CartContext";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Cart — CutHaven" },
      { name: "description", content: "Your CutHaven shopping cart." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const { items, subtotal, updateQty, removeItem } = useCart();

  const shippingCost = subtotal >= 350 ? 0 : 9.99;
  const total = subtotal + shippingCost;

  if (items.length === 0) {
    return (
      <div>
        <PageHero title="Your Cart" />
        <div className="mx-auto max-w-2xl px-3 sm:px-4 py-12 sm:py-16 md:py-20 text-center">
          <ShoppingBag className="h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16 text-primary mx-auto mb-3 sm:mb-4" />
          <h2 className="font-display text-xl sm:text-2xl font-bold">Your cart is empty</h2>
          <p className="text-text-secondary text-sm sm:text-base mt-2">
            Add some tools and they'll appear here.
          </p>
          <Link to="/shop" className="btn-primary mt-4 sm:mt-6 inline-flex text-sm sm:text-base">
            Start Shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHero title="Shopping Cart" />
      <div className="mx-auto max-w-7xl px-3 sm:px-4 py-6 sm:py-8 md:py-10 grid lg:grid-cols-[1fr_380px] gap-6 sm:gap-8">
        {/* ── Item list ── */}
        <div className="space-y-3 sm:space-y-4">
          {items.map(({ product, quantity }) => {
            const price = product.salePrice ?? product.price;
            return (
              <div key={product.id} className="card-surface p-3 sm:p-4 flex gap-3 sm:gap-4">
                <img
                  src={product.images[0]}
                  alt={product.name}
                  className="h-20 w-20 sm:h-24 sm:w-24 rounded-lg object-cover shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <Link
                    to="/product/$slug"
                    params={{ slug: product.slug }}
                    className="font-semibold text-sm sm:text-base hover:text-primary line-clamp-2"
                  >
                    {product.name}
                  </Link>
                  <p className="text-[10px] sm:text-xs text-text-secondary mt-0.5">
                    SKU: {product.sku}
                  </p>
                  <div className="mt-2 sm:mt-3 flex items-center gap-3 sm:gap-4">
                    <div className="flex items-center border border-border rounded-full">
                      <button
                        onClick={() => updateQty(product.id, quantity - 1)}
                        className="h-7 w-7 sm:h-8 sm:w-8 grid place-items-center touch-manipulation"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-7 sm:w-8 text-center text-xs sm:text-sm font-semibold">
                        {quantity}
                      </span>
                      <button
                        onClick={() => updateQty(product.id, quantity + 1)}
                        className="h-7 w-7 sm:h-8 sm:w-8 grid place-items-center touch-manipulation"
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <button
                      onClick={() => removeItem(product.id)}
                      className="text-[10px] sm:text-xs text-text-secondary hover:text-destructive flex items-center gap-1 touch-manipulation min-h-[44px] sm:min-h-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />{" "}
                      <span className="hidden xs:inline">Remove</span>
                    </button>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-accent text-sm sm:text-base">
                    ${(price * quantity).toFixed(2)}
                  </p>
                  <p className="text-[10px] sm:text-xs text-text-secondary mt-1">
                    ${price.toFixed(2)} each
                  </p>
                </div>
              </div>
            );
          })}
          <Link
            to="/shop"
            className="inline-flex items-center gap-2 text-xs sm:text-sm text-primary hover:underline mt-3 sm:mt-4"
          >
            ← Continue shopping
          </Link>
        </div>

        {/* ── Order summary ── */}
        <aside className="card-surface p-4 sm:p-5 md:p-6 h-fit lg:sticky lg:top-24 space-y-3 sm:space-y-4">
          <h3 className="font-display text-lg sm:text-xl font-bold">Order Summary</h3>

          <div className="space-y-2 text-xs sm:text-sm border-b border-border pb-3 sm:pb-4">
            <div className="flex justify-between">
              <span className="text-text-secondary">Subtotal</span>
              <span className="font-semibold">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Shipping</span>
              <span className={shippingCost === 0 ? "text-success font-semibold" : "font-semibold"}>
                {shippingCost === 0 ? "FREE" : `$${shippingCost.toFixed(2)}`}
              </span>
            </div>
          </div>

          <div className="flex justify-between text-base sm:text-lg">
            <span className="font-bold">Total</span>
            <span className="font-bold text-accent">${total.toFixed(2)}</span>
          </div>

          <p className="text-[10px] sm:text-xs text-text-secondary">
            Have a coupon? You can apply it on the next step.
          </p>

          <Link
            to="/checkout"
            className="btn-primary w-full text-center block text-sm sm:text-base min-h-[44px] flex items-center justify-center"
          >
            Proceed to Checkout →
          </Link>
        </aside>
      </div>
    </div>
  );
}
