import { createFileRoute } from "@tanstack/react-router";
import { PolicyLayout } from "@/components/ui/PolicyLayout";

export const Route = createFileRoute("/billing-terms-conditions")({
  head: () => ({
    meta: [
      { title: "Billing Terms — CutHaven" },
      { name: "description", content: "Billing terms and accepted payment methods at CutHaven." },
    ],
  }),
  component: () => (
    <PolicyLayout title="Billing Terms & Conditions" crumb="Billing">
      <h2>When You're Charged</h2>
      <p>Payment is charged in full at the time you place the order.</p>

      <h2>Accepted Payment Methods</h2>
      <p>Visa, Mastercard, American Express, Discover, and PayPal.</p>

      <h2>Currency</h2>
      <p>
        All prices are listed in <strong>US Dollars (USD)</strong>.
      </p>

      <h2>Sales Tax</h2>
      <p>
        Sales tax is applied where required by law and is displayed at checkout before you complete
        your order.
      </p>

      <h2>Secure Checkout</h2>
      <p>
        Checkout is secured with <strong>SSL encryption</strong>. Card details are handled by
        PCI-compliant payment processors and are never stored on our servers.
      </p>

      <h2>No Hidden Fees</h2>
      <p>
        The price shown at checkout is your final price. Shipping is free on orders over $350; a
        flat rate applies to orders below that threshold.
      </p>

      <h2>Subscription Billing</h2>
      <p>We do not offer subscriptions or recurring billing — all purchases are one-time.</p>

      <h2>Chargebacks & Disputes</h2>
      <p>
        If there's an issue with your order, please contact{" "}
        <a href="mailto:support@cuthaven.com">support@cuthaven.com</a> first — most disputes are
        resolved within a business day.
      </p>
    </PolicyLayout>
  ),
});
