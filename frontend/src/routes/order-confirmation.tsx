import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/order-confirmation")({
  head: () => ({ meta: [{ title: "Order Confirmed — CutHaven" }, { name: "robots", content: "noindex" }] }),
  component: OrderConfirmationPage,
});

function OrderConfirmationPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <div className="h-20 w-20 rounded-full bg-success/10 grid place-items-center mx-auto mb-6">
        <CheckCircle2 className="h-10 w-10 text-success" />
      </div>
      <h1 className="font-display text-3xl md:text-4xl font-bold">Thank You for Your Order!</h1>
      <p className="text-text-secondary mt-2">Order <span className="font-mono font-semibold">#CUT-2025-00123</span></p>
      <p className="text-text-secondary mt-4 max-w-md mx-auto">We've received your order and will begin processing it shortly. A confirmation email will be sent to your inbox.</p>
      <p className="mt-3 text-sm"><span className="font-semibold">Estimated Delivery:</span> 5–8 business days</p>

      <div className="card-surface p-6 mt-8 text-left">
        <h3 className="font-display text-lg font-bold mb-3">Order Summary</h3>
        <div className="flex justify-between text-sm border-b border-border py-2"><span>Sample Product × 1</span><span className="font-semibold">$290.00</span></div>
        <div className="flex justify-between text-sm py-2"><span>Shipping</span><span className="text-success font-semibold">FREE</span></div>
        <div className="flex justify-between text-lg font-bold border-t border-border pt-3 mt-2"><span>Total</span><span className="text-accent">$290.00</span></div>
      </div>

      <div className="mt-8 flex flex-wrap gap-3 justify-center">
        <Link to="/track-your-order" className="btn-primary">Track Your Order</Link>
        <Link to="/shop" className="btn-outline-primary">Continue Shopping</Link>
      </div>
    </div>
  );
}
