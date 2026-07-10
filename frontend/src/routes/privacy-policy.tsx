import { createFileRoute } from "@tanstack/react-router";
import { PolicyLayout } from "@/components/ui/PolicyLayout";

export const Route = createFileRoute("/privacy-policy")({
  head: () => ({ meta: [{ title: "Privacy Policy — CutHaven" }, { name: "description", content: "How CutHaven collects, uses, and protects your information." }] }),
  component: () => (
    <PolicyLayout title="Privacy Policy" crumb="Privacy Policy">
      <p>At CutHaven, your privacy is our priority. This Privacy Policy outlines how we collect, use, disclose, and protect your information when you visit our website or purchase our products. We comply with applicable data protection laws, including the General Data Protection Regulation (GDPR) and the California Consumer Privacy Act (CCPA).</p>

      <h2>Information We Collect</h2>
      <p><strong>Personal Information:</strong> name, email, phone number, billing and shipping address, payment information (processed via secure third-party processors — we never store full card numbers).</p>
      <p><strong>Non-Personal Information:</strong> browser type, device type, IP address, pages visited, time and date of visits, referring website.</p>
      <p><strong>Cookies:</strong> we use cookies and similar technologies to enhance your experience. You can control cookies through your browser settings.</p>

      <h2>How We Use Your Information</h2>
      <ul>
        <li>To process and fulfill your orders.</li>
        <li>To communicate about your order status or customer service inquiries.</li>
        <li>To personalize your shopping experience.</li>
        <li>To send promotional materials (opt-out any time).</li>
        <li>To improve our website and services through analytics.</li>
        <li>To comply with legal obligations.</li>
      </ul>

      <h2>How We Share Your Information</h2>
      <p>We do <strong>not sell</strong> your personal information. We share it only with:</p>
      <ul>
        <li><strong>Service providers</strong> (payment processors, shipping carriers, marketing platforms) under strict confidentiality.</li>
        <li><strong>Legal compliance</strong> when required by law.</li>
        <li><strong>Business transfers</strong> in the event of a merger or acquisition.</li>
      </ul>

      <h2>Data Security</h2>
      <p>Our site uses <strong>SSL encryption</strong> for all data transmission. We implement reasonable technical and organizational measures to protect your personal information from unauthorized access, loss, or misuse. No internet transmission is 100% secure, but we work hard to safeguard your data.</p>

      <h2>Your Rights</h2>
      <ul>
        <li><strong>Access</strong> — request a copy of the information we hold about you.</li>
        <li><strong>Correction</strong> — request updates to inaccurate information.</li>
        <li><strong>Deletion</strong> — request deletion of your personal information.</li>
        <li><strong>Opt-out</strong> — unsubscribe from marketing communications at any time.</li>
      </ul>

      <h2>Third-Party Links</h2>
      <p>Our site may contain links to third-party sites. We are not responsible for their privacy practices — please review their policies.</p>

      <h2>Changes to This Policy</h2>
      <p>We may update this policy from time to time. Significant changes will be posted here with a new effective date.</p>

      <h2>Contact</h2>
      <p>Questions? Email <a href="mailto:support@cuthaven.com">support@cuthaven.com</a> or call +1 (406) 229-9045.</p>
    </PolicyLayout>
  ),
});
