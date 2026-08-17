import { createFileRoute } from "@tanstack/react-router";
import { PolicyLayout } from "@/components/ui/PolicyLayout";

export const Route = createFileRoute("/terms-of-service")({
  head: () => ({
    meta: [
      { title: "Terms of Service — CutHaven" },
      { name: "description", content: "Terms of service for using cuthaven.com." },
    ],
  }),
  component: () => (
    <PolicyLayout title="Terms of Service" crumb="Terms">
      <h2>1. Acceptance of Terms</h2>
      <p>By using cuthaven.com you agree to these Terms of Service.</p>
      <h2>2. Use of Website</h2>
      <p>You agree to use the site for lawful purposes only and not to disrupt its operation.</p>
      <h2>3. Products and Pricing</h2>
      <p>We strive for accuracy but reserve the right to correct pricing or listing errors.</p>
      <h2>4. Orders and Payment</h2>
      <p>
        All orders are subject to acceptance and availability. We may refuse or cancel an order at
        our discretion.
      </p>
      <h2>5. Shipping and Delivery</h2>
      <p>
        See our <a href="/shipping-policy">Shipping Policy</a> for details.
      </p>
      <h2>6. Returns and Refunds</h2>
      <p>
        See our <a href="/returns-refund-policy">Returns & Refund Policy</a>.
      </p>
      <h2>7. Intellectual Property</h2>
      <p>All content on this site is the property of CutHaven or its licensors.</p>
      <h2>8. Limitation of Liability</h2>
      <p>
        To the fullest extent permitted by law, CutHaven is not liable for indirect or consequential
        damages.
      </p>
      <h2>9. Governing Law</h2>
      <p>These terms are governed by the laws of the State of California, USA.</p>
      <h2>10. Contact</h2>
      <p>
        <a href="mailto:support@cuthaven.com">support@cuthaven.com</a> · +1 (406) 229-9045
      </p>
    </PolicyLayout>
  ),
});
