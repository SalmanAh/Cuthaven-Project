import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { CheckCircle2, Package } from "lucide-react";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { getOrderSummary } from "@/lib/api-client";
import { useCart } from "@/context/CartContext";

const searchSchema = z.object({
  orderId: z.string().optional(),
});

export const Route = createFileRoute("/order-confirmation")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Order Confirmed — CutHaven" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrderConfirmationPage,
});

function OrderConfirmationPage() {
  const { orderId } = useSearch({ from: "/order-confirmation" });
  const { clear } = useCart();

  // Clear the cart once — on mount after successful payment
  useEffect(() => { clear(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isLoading, isError } = useQuery({
    queryKey: ["order-summary", orderId],
    queryFn: () => getOrderSummary(orderId!),
    enabled: !!orderId,
  });

  // No orderId in URL — generic confirmation (shouldn't normally happen)
  if (!orderId) return <GenericConfirmation />;
  if (isLoading) return <div className="mx-auto max-w-2xl px-4 py-20 text-center text-text-secondary">Loading order…</div>;
  if (isError || !data) return <GenericConfirmation />;

  const { order, items } = data;
  const addr = order.shipping_address;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="text-center mb-10">
        <div className="h-20 w-20 rounded-full bg-success/10 grid place-items-center mx-auto mb-6">
          <CheckCircle2 className="h-10 w-10 text-success" />
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-bold">Thank You for Your Order!</h1>
        <p className="text-text-secondary mt-2">
          Order <span className="font-mono font-semibold">{order.order_number}</span>
        </p>
        <p className="text-text-secondary mt-3 max-w-md mx-auto text-sm">
          We've received your order and will begin processing it shortly.
          A confirmation email will be sent to{" "}
          <span className="font-semibold">{addr.email}</span>.
        </p>
        <p className="mt-3 text-sm">
          <span className="font-semibold">Estimated Delivery:</span> 5–8 business days
        </p>
      </div>

      <div className="card-surface p-6">
        <h3 className="font-display text-lg font-bold mb-4">Order Summary</h3>

        <div className="space-y-3 mb-4">
          {items.map((item) => (
            <div key={item.id} className="flex gap-3 items-center border-b border-border pb-3">
              {item.product_image ? (
                <img src={item.product_image} alt="" className="h-12 w-12 rounded object-cover shrink-0" />
              ) : (
                <div className="h-12 w-12 rounded bg-muted flex items-center justify-center shrink-0">
                  <Package className="h-5 w-5 text-text-secondary" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{item.product_name}</p>
                <p className="text-xs text-text-secondary">Qty {item.quantity}</p>
              </div>
              <p className="font-semibold text-sm shrink-0">${item.total_price.toFixed(2)}</p>
            </div>
          ))}
        </div>

        <div className="space-y-1.5 text-sm text-text-secondary border-b border-border pb-4">
          <div className="flex justify-between">
            <span>Subtotal</span><span>${order.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Shipping</span>
            <span className={order.shipping_cost === 0 ? "text-success font-semibold" : ""}>
              {order.shipping_cost === 0 ? "FREE" : `$${order.shipping_cost.toFixed(2)}`}
            </span>
          </div>
          {order.tax_amount > 0 && (
            <div className="flex justify-between"><span>Tax</span><span>${order.tax_amount.toFixed(2)}</span></div>
          )}
        </div>

        <div className="flex justify-between text-lg font-bold pt-4">
          <span>Total</span>
          <span className="text-accent">${order.total.toFixed(2)}</span>
        </div>

        <div className="mt-5 pt-4 border-t border-border text-sm">
          <p className="font-semibold mb-1">Shipping to</p>
          <p className="text-text-secondary">
            {addr.firstName} {addr.lastName}<br />
            {addr.address}, {addr.city}, {addr.state} {addr.zip}
          </p>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-3 justify-center">
        <Link to="/track-your-order" className="btn-primary">Track Your Order</Link>
        <Link to="/shop" className="btn-outline-primary">Continue Shopping</Link>
      </div>
    </div>
  );
}

function GenericConfirmation() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <div className="h-20 w-20 rounded-full bg-success/10 grid place-items-center mx-auto mb-6">
        <CheckCircle2 className="h-10 w-10 text-success" />
      </div>
      <h1 className="font-display text-3xl font-bold">Order Received!</h1>
      <p className="text-text-secondary mt-3 max-w-md mx-auto">
        Thank you for your purchase. You'll receive a confirmation email shortly.
      </p>
      <div className="mt-8 flex flex-wrap gap-3 justify-center">
        <Link to="/shop" className="btn-primary">Continue Shopping</Link>
      </div>
    </div>
  );
}
