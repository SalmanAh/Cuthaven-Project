import { createFileRoute } from "@tanstack/react-router";
import { PolicyLayout } from "@/components/ui/PolicyLayout";

export const Route = createFileRoute("/shipping-policy")({
  head: () => ({
    meta: [
      { title: "Shipping Policy — CutHaven" },
      {
        name: "description",
        content: "Free shipping across the US. Processing and delivery details.",
      },
    ],
  }),
  component: () => (
    <PolicyLayout title="Shipping Policy" crumb="Shipping">
      <h2>Free Shipping</h2>
      <p>
        We offer <strong>free standard shipping on all orders over $350</strong>. A flat shipping
        rate is calculated at checkout for orders below that threshold.
      </p>

      <h2>Processing Time</h2>
      <p>
        Orders are processed within <strong>1–3 business days</strong> (Mon–Fri, excluding
        holidays). You'll receive an email with tracking as soon as your package ships.
      </p>

      <h2>Delivery Time</h2>
      <p>
        Standard delivery is <strong>5–8 business days</strong> after processing. Express options
        are available at checkout for faster delivery.
      </p>

      <h2>Shipping Carriers</h2>
      <p>We ship via USPS, UPS, and FedEx depending on the destination and product size.</p>

      <h2>Shipping Regions</h2>
      <p>
        We currently ship within the <strong>United States</strong> only, including Alaska and
        Hawaii.
      </p>

      <h2>Order Tracking</h2>
      <p>
        Once your order ships you'll get an email with tracking. You can also track anytime from our{" "}
        <a href="/track-your-order">Track Your Order</a> page.
      </p>

      <h2>Delivery Address</h2>
      <p>
        For fraud prevention, the delivery address must match the billing address on file. If you
        need a different ship-to, contact support before we ship.
      </p>

      <h2>Lost or Damaged Packages</h2>
      <p>
        Contact us within <strong>7 days</strong> of the expected delivery date so we can file a
        claim and get a replacement out to you.
      </p>
    </PolicyLayout>
  ),
});
