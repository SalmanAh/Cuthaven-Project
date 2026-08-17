import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCart } from "@/context/CartContext";
import { useCartUI } from "@/context/CartUIContext";
import { Link } from "@tanstack/react-router";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const FREE_SHIP_THRESHOLD = 350;

export function CartDrawer() {
  const { open, setOpen } = useCartUI();
  const { items, subtotal, updateQty, removeItem, count } = useCart();
  const remaining = Math.max(0, FREE_SHIP_THRESHOLD - subtotal);
  const pct = Math.min(100, (subtotal / FREE_SHIP_THRESHOLD) * 100);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="p-5 border-b border-border">
          <SheetTitle className="font-display text-xl">
            Your Cart ({count} {count === 1 ? "item" : "items"})
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
            <ShoppingBag className="h-14 w-14 text-primary mb-3" />
            <p className="font-display text-lg font-bold">Your cart is empty</p>
            <p className="text-sm text-text-secondary mt-1">
              Add some tools and they'll appear here.
            </p>
            <button onClick={() => setOpen(false)} className="btn-primary mt-5">
              Continue Shopping
            </button>
          </div>
        ) : (
          <>
            <div className="px-5 py-4 border-b border-border bg-muted/40">
              {remaining > 0 ? (
                <p className="text-xs text-text-secondary mb-2">
                  You're <span className="font-semibold text-accent">${remaining.toFixed(2)}</span>{" "}
                  away from FREE shipping!
                </p>
              ) : (
                <p className="text-xs text-success font-semibold mb-2">
                  🎉 You've unlocked FREE shipping!
                </p>
              )}
              <Progress value={pct} className="h-2" />
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {items.map(({ product, quantity }) => {
                const price = product.salePrice ?? product.price;
                return (
                  <div key={product.id} className="flex gap-3">
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="h-16 w-16 rounded-lg object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-2">{product.name}</p>
                      <p className="text-xs text-text-secondary mt-0.5">${price.toFixed(2)}</p>
                      <div className="mt-2 flex items-center gap-3">
                        <div className="flex items-center border border-border rounded-full">
                          <button
                            onClick={() => updateQty(product.id, quantity - 1)}
                            className="h-7 w-7 grid place-items-center"
                            aria-label="Decrease"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-7 text-center text-xs font-semibold">{quantity}</span>
                          <button
                            onClick={() => updateQty(product.id, quantity + 1)}
                            className="h-7 w-7 grid place-items-center"
                            aria-label="Increase"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <button
                          onClick={() => removeItem(product.id)}
                          className="text-text-secondary hover:text-destructive"
                          aria-label="Remove"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-accent shrink-0">
                      ${(price * quantity).toFixed(2)}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-border p-5 space-y-3">
              <div className="flex justify-between text-base">
                <span className="font-bold">Subtotal</span>
                <span className="font-bold text-accent">${subtotal.toFixed(2)}</span>
              </div>
              <div className="grid gap-2">
                <Link
                  to="/cart"
                  onClick={() => setOpen(false)}
                  className="btn-outline-primary w-full text-center"
                >
                  View Cart
                </Link>
                <Link
                  to="/checkout"
                  onClick={() => setOpen(false)}
                  className="btn-primary w-full text-center"
                >
                  Checkout →
                </Link>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
