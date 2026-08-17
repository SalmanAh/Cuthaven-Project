import { createFileRoute } from "@tanstack/react-router";
import { PolicyLayout } from "@/components/ui/PolicyLayout";

export const Route = createFileRoute("/returns-refund-policy")({
  head: () => ({
    meta: [
      { title: "Returns & Refund Policy — CutHaven" },
      {
        name: "description",
        content: "40-day return window on all CutHaven orders. Full policy details.",
      },
    ],
  }),
  component: () => (
    <PolicyLayout title="Returns & Refund Policy" crumb="Returns & Refunds">
      <p>
        Our returns and refund policy lasts <strong>40 days</strong> from the delivery date. If more
        than 40 days have passed since delivery, we can't offer a refund or exchange.
      </p>
      <p>
        To be eligible, items must be unused, in the same condition you received them, and in the
        original packaging with proof of purchase.
      </p>

      <h2>Eligibility for Returns</h2>
      <ul>
        <li>
          <strong>Damaged or defective items:</strong> contact us within 40 days of delivery for a
          full replacement or refund.
        </li>
        <li>
          <strong>Incorrect items:</strong> if you receive an item that doesn't match your order,
          we'll cover return shipping and send the correct product.
        </li>
        <li>
          <strong>Change of mind:</strong> allowed within 40 days; customer covers return shipping.
        </li>
      </ul>

      <h2>Return Process</h2>
      <ol>
        <li>
          Email <a href="mailto:support@cuthaven.com">support@cuthaven.com</a> with your order
          number to request an RMA.
        </li>
        <li>We'll provide a return authorization number and instructions.</li>
        <li>Ship the item back using a trackable service and retain proof of postage.</li>
        <li>
          Upon receipt we inspect the item (typically within 3 business days) and process your
          refund or exchange.
        </li>
      </ol>

      <h2>Refunds</h2>
      <p>
        Approved refunds are issued to the <strong>original payment method</strong>, typically
        within 5–10 business days after we receive and inspect the return.
      </p>

      <h2>Non-Returnable Items</h2>
      <ul>
        <li>Used or damaged items (unless damaged in transit).</li>
        <li>Personalized or customized products.</li>
        <li>Sale/clearance items marked "final sale".</li>
      </ul>

      <h2>Damaged in Transit</h2>
      <p>
        If your order arrives damaged, contact us within 7 days of delivery with photos. We'll cover
        full replacement and return shipping.
      </p>

      <h2>Contact</h2>
      <p>
        Email <a href="mailto:support@cuthaven.com">support@cuthaven.com</a> or call +1 (406)
        229-9045.
      </p>
    </PolicyLayout>
  ),
});
