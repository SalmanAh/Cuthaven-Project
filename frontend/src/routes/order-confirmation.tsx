import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { CheckCircle2, Package } from "lucide-react";
import { useEffect, useLayoutEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { getOrderSummary } from "@/lib/api-client";
import { useCart } from "@/context/CartContext";

const searchSchema = z.object({
  orderId: z.string().uuid().optional(),
  token: z.string().min(32).optional(),
});

export const Route = createFileRoute("/order-confirmation")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Order Confirmed — CutHaven" },
      { name: "robots", content: "noindex" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: OrderConfirmationPage,
});

function OrderConfirmationPage() {
  const { orderId, token } = useSearch({ from: "/order-confirmation" });
  const { clear } = useCart();
  const pollDeadline = useRef(Date.now() + 60_000);
  const cartCleared = useRef(false);
  const tokenKey = orderId ? `ch-order-confirmation:${orderId}` : null;
  const confirmationToken =
    token ??
    (tokenKey && typeof window !== "undefined"
      ? (sessionStorage.getItem(tokenKey) ?? undefined)
      : undefined);

  useLayoutEffect(() => {
    if (!orderId || !token || !tokenKey) return;
    sessionStorage.setItem(tokenKey, token);
    const url = new URL(window.location.href);
    url.searchParams.delete("token");
    window.history.replaceState(window.history.state, "", url);
  }, [orderId, token, tokenKey]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["order-summary", orderId],
    queryFn: () => getOrderSummary(orderId!, confirmationToken),
    enabled: !!orderId,
    refetchInterval: (query) => {
      const current = query.state.data;
      const complete =
        current?.order.status === "confirmed" && current.order.payment_status === "paid";
      return !complete && Date.now() < pollDeadline.current ? 2_000 : false;
    },
  });

  const isConfirmed = data?.order.status === "confirmed" && data.order.payment_status === "paid";
  useEffect(() => {
    if (isConfirmed && !cartCleared.current) {
      cartCleared.current = true;
      clear();
    }
  }, [clear, isConfirmed]);

  if (!orderId) return <ConfirmationUnavailable />;
  if (isLoading)
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center text-text-secondary">
        Loading order…
      </div>
    );
  if (isError || !data) return <ConfirmationUnavailable />;

  if (!isConfirmed) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="font-display text-3xl font-bold">Confirming your payment…</h1>
        <p className="text-text-secondary mt-3">
          Your order is safely recorded. Please keep this page open while payment confirmation
          arrives.
        </p>
        <p className="font-mono text-sm mt-4">Order {data.order.order_number}</p>
      </div>
    );
  }

  const { order, items } = data;
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
          We've received your order and will begin processing it shortly. A confirmation email will
          be sent to the address used during checkout.
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
                <img
                  src={item.product_image}
                  alt=""
                  className="h-12 w-12 rounded object-cover shrink-0"
                />
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
            <span>Subtotal</span>
            <span>${order.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Shipping</span>
            <span className={order.shipping_cost === 0 ? "text-success font-semibold" : ""}>
              {order.shipping_cost === 0 ? "FREE" : `$${order.shipping_cost.toFixed(2)}`}
            </span>
          </div>
          {order.tax_amount > 0 && (
            <div className="flex justify-between">
              <span>Tax</span>
              <span>${order.tax_amount.toFixed(2)}</span>
            </div>
          )}
        </div>

        <div className="flex justify-between text-lg font-bold pt-4">
          <span>Total</span>
          <span className="text-accent">${order.total.toFixed(2)}</span>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-3 justify-center">
        <Link to="/track-your-order" className="btn-primary">
          Track Your Order
        </Link>
        <Link to="/shop" className="btn-outline-primary">
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}

function ConfirmationUnavailable() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <div className="h-20 w-20 rounded-full bg-success/10 grid place-items-center mx-auto mb-6">
        <CheckCircle2 className="h-10 w-10 text-success" />
      </div>
      <h1 className="font-display text-3xl font-bold">Confirmation unavailable</h1>
      <p className="text-text-secondary mt-3 max-w-md mx-auto">
        We could not verify this order link. Your cart has not been cleared; please retry or contact
        support.
      </p>
      <div className="mt-8 flex flex-wrap gap-3 justify-center">
        <Link to="/shop" className="btn-primary">
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
