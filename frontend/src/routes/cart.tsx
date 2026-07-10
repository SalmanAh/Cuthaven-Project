import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { PageHero } from "@/components/ui/PageHero";
import { useCart } from "@/context/CartContext";

export const Route = createFileRoute("/cart")({
  head: () => ({ meta: [{ title: "Cart — CutHaven" }, { name: "description", content: "Your CutHaven shopping cart." }, { name: "robots", content: "noindex" }] }),
  component: CartPage,
});

function CartPage() {
  const { items, subtotal, updateQty, removeItem } = useCart();
  const [coupon, setCoupon] = useState("");

  if (items.length === 0) {
    return (
      <div>
        <PageHero title="Your Cart" crumbs={[{ label: "Cart" }]} />
        <div className="mx-auto max-w-2xl px-4 py-20 text-center">
          <ShoppingBag className="h-16 w-16 text-primary mx-auto mb-4" />
          <h2 className="font-display text-2xl font-bold">Your cart is empty</h2>
          <p className="text-text-secondary mt-2">Add some tools and they'll appear here.</p>
          <Link to="/shop" className="btn-primary mt-6 inline-flex">Start Shopping</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHero title="Shopping Cart" crumbs={[{ label: "Cart" }]} />
      <div className="mx-auto max-w-7xl px-4 py-10 grid lg:grid-cols-[1fr_380px] gap-8">
        <div className="space-y-4">
          {items.map(({ product, quantity }) => {
            const price = product.salePrice ?? product.price;
            return (
              <div key={product.id} className="card-surface p-4 flex gap-4">
                <img src={product.images[0]} alt={product.name} className="h-24 w-24 rounded-lg object-cover" />
                <div className="flex-1 min-w-0">
                  <Link to="/product/$slug" params={{ slug: product.slug }} className="font-semibold hover:text-primary line-clamp-2">{product.name}</Link>
                  <p className="text-xs text-text-secondary mt-0.5">SKU: {product.sku}</p>
                  <div className="mt-3 flex items-center gap-4">
                    <div className="flex items-center border border-border rounded-full">
                      <button onClick={() => updateQty(product.id, quantity - 1)} className="h-8 w-8 grid place-items-center"><Minus className="h-3 w-3" /></button>
                      <span className="w-8 text-center text-sm font-semibold">{quantity}</span>
                      <button onClick={() => updateQty(product.id, quantity + 1)} className="h-8 w-8 grid place-items-center"><Plus className="h-3 w-3" /></button>
                    </div>
                    <button onClick={() => removeItem(product.id)} className="text-xs text-text-secondary hover:text-destructive flex items-center gap-1"><Trash2 className="h-3.5 w-3.5" /> Remove</button>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-accent">${(price * quantity).toFixed(2)}</p>
                  <p className="text-xs text-text-secondary mt-1">${price.toFixed(2)} each</p>
                </div>
              </div>
            );
          })}
          <Link to="/shop" className="inline-flex items-center gap-2 text-sm text-primary hover:underline mt-4">← Continue shopping</Link>
        </div>

        <aside className="card-surface p-6 h-fit lg:sticky lg:top-24">
          <h3 className="font-display text-xl font-bold mb-4">Order Summary</h3>
          <div className="space-y-2 text-sm border-b border-border pb-4">
            <div className="flex justify-between"><span className="text-text-secondary">Subtotal</span><span className="font-semibold">${subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-text-secondary">Shipping</span><span className="font-semibold text-success">FREE</span></div>
          </div>
          <div className="flex justify-between py-4 text-lg">
            <span className="font-bold">Total</span>
            <span className="font-bold text-accent">${subtotal.toFixed(2)}</span>
          </div>
          <Link to="/checkout" className="btn-primary w-full">Proceed to Checkout →</Link>
          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-sm font-semibold mb-2">Coupon code</p>
            <div className="flex gap-2">
              <input value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder="Enter code" className="flex-1 px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary" />
              <button className="px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">Apply</button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
