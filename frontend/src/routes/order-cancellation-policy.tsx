import { createFileRoute } from "@tanstack/react-router";
import { PolicyLayout } from "@/components/ui/PolicyLayout";

export const Route = createFileRoute("/order-cancellation-policy")({
  head: () => ({ meta: [{ title: "Order Cancellation Policy — CutHaven" }, { name: "description", content: "How to cancel an order at CutHaven." }] }),
  component: () => (
    <PolicyLayout title="Order Cancellation Policy" crumb="Order Cancellation">
      <p>Orders can be cancelled at no cost within <strong>24 hours</strong> of placement.</p>
      <h2>After 24 Hours</h2>
      <p>Once the 24-hour window closes we may have already prepared or shipped your order. Cancellation is not guaranteed — contact us at <a href="mailto:support@cuthaven.com">support@cuthaven.com</a> as soon as possible.</p>
      <h2>Refunds on Cancellation</h2>
      <p>Full refunds are issued to the original payment method within 5 business days once the cancellation is confirmed.</p>
      <h2>Shipped Orders</h2>
      <p>If the order has already shipped, follow our <a href="/returns-refund-policy">Returns & Refund Policy</a> to send it back.</p>
    </PolicyLayout>
  ),
});
