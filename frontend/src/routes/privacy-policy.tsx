import { createFileRoute } from "@tanstack/react-router";
import { PolicyLayout } from "@/components/ui/PolicyLayout";

export const Route = createFileRoute("/privacy-policy")({
  head: () => ({ meta: [{ title: "Privacy Policy — CutHaven" }, { name: "description", content: "How CutHaven collects, uses, and protects your information." }] }),
  component: () => (
    <PolicyLayout title="Privacy Policy" crumb="Privacy Policy">
      <p className="text-sm text-text-secondary mb-6"><strong>Effective Date:</strong> August 3, 2026 | <strong>Last Updated:</strong> August 3, 2026</p>

      <p>At CutHaven, your privacy is our priority. This Privacy Policy outlines how we collect, use, disclose, and protect your information when you visit our website or purchase our products. By using our website, you agree to the practices described in this policy.</p>
      
      <p>We comply with applicable data protection laws, including the General Data Protection Regulation (GDPR), the UK GDPR, the California Consumer Privacy Act (CCPA), and the Children's Online Privacy Protection Act (COPPA).</p>

      <h2>1. Information We Collect</h2>
      <p>We collect the following categories of information:</p>
      <p><strong>Personal Information:</strong> name, email address, phone number, billing and shipping address, and payment information. Payment data is processed via secure, PCI-compliant third-party processors — we never store full card numbers on our servers.</p>
      <p><strong>Non-Personal Information:</strong> browser type, device type, IP address, pages visited, time and date of visits, and referring website.</p>
      <p><strong>Cookies & Tracking Technologies:</strong> we use cookies, web beacons, and similar technologies to enhance your experience, remember your preferences, and analyze site traffic. You can control cookie settings through your browser at any time.</p>

      <h2>2. How We Use Your Information</h2>
      <p>We use the information we collect to:</p>
      <ul>
        <li>Process and fulfill your orders and transactions.</li>
        <li>Communicate with you about your order status, shipping updates, and customer service inquiries.</li>
        <li>Personalize your shopping experience and recommend relevant products.</li>
        <li>Send promotional materials, newsletters, and marketing communications (you may opt out at any time).</li>
        <li>Improve our website, services, and product offerings through analytics and research.</li>
        <li>Comply with applicable legal obligations and enforce our terms.</li>
        <li>Prevent fraud, unauthorized access, and other illegal activities.</li>
      </ul>

      <h2>3. How We Share Your Information</h2>
      <p>We do <strong>not sell, rent, or trade</strong> your personal information to third parties. We share your data only in the following limited circumstances:</p>
      <ul>
        <li><strong>Service Providers:</strong> trusted third parties who help us operate our business (e.g., payment processors, shipping carriers, email marketing platforms, analytics providers). All service providers are bound by strict confidentiality obligations and are not permitted to use your data for their own purposes.</li>
        <li><strong>Legal Compliance:</strong> when required by law, court order, or government authority, or to protect the rights and safety of CutHaven, our users, or the public.</li>
        <li><strong>Business Transfers:</strong> in the event of a merger, acquisition, or sale of assets, your personal information may be transferred to the successor entity, subject to the same privacy protections.</li>
      </ul>

      <h2>4. Cookies & Consent</h2>
      <p>We use the following categories of cookies:</p>
      <ul>
        <li><strong>Strictly Necessary Cookies:</strong> required for the website to function — cannot be disabled.</li>
        <li><strong>Analytics Cookies:</strong> help us understand how visitors interact with our site (e.g., Google Analytics).</li>
        <li><strong>Marketing Cookies:</strong> used to deliver relevant advertisements and track campaign performance.</li>
      </ul>
      <p>Upon your first visit, you will be presented with a cookie consent banner. You may accept all cookies, customize your preferences, or reject non-essential cookies. You can update your preferences at any time via the Cookie Settings link in our website footer.</p>

      <h2>5. Data Retention</h2>
      <p>We retain your personal information only for as long as necessary to fulfil the purposes for which it was collected, including for legal, accounting, or reporting requirements. Specifically:</p>
      <ul>
        <li><strong>Order and transaction data:</strong> retained for 7 years to comply with tax and accounting obligations.</li>
        <li><strong>Account information:</strong> retained for the duration of your account and up to 3 years after your last activity.</li>
        <li><strong>Marketing data:</strong> retained until you opt out or withdraw consent.</li>
        <li><strong>Cookie data:</strong> retained per the individual cookie's lifespan (ranging from session to 2 years).</li>
      </ul>
      <p>Upon expiry of the applicable retention period, your data is securely deleted or anonymized.</p>

      <h2>6. Data Security</h2>
      <p>We implement reasonable and appropriate technical and organizational measures to protect your personal information from unauthorized access, loss, alteration, or misuse. These include:</p>
      <ul>
        <li>SSL/TLS encryption for all data transmitted through our website.</li>
        <li>Access controls and authentication requirements for internal systems.</li>
        <li>Regular security assessments and vulnerability monitoring.</li>
      </ul>
      <p>Please note that no method of internet transmission or electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your data, we cannot guarantee absolute security.</p>

      <h2>7. International Data Transfers</h2>
      <p>CutHaven is operated from the United States. If you are located in the European Economic Area (EEA), the United Kingdom, or another region with data protection laws, please be aware that your personal information may be transferred to and processed in the United States, which may not provide the same level of data protection as your home jurisdiction.</p>
      <p>Where required, we ensure that international transfers of personal data are protected by appropriate safeguards, including:</p>
      <ul>
        <li>Standard Contractual Clauses (SCCs) approved by the European Commission.</li>
        <li>Adequacy decisions where applicable.</li>
      </ul>
      <p>By using our website, you consent to this transfer, processing, and storage of your information in the United States.</p>

      <h2>8. Your Rights</h2>
      <p>Depending on your location, you may have the following rights regarding your personal data:</p>
      <ul>
        <li><strong>Access:</strong> request a copy of the personal information we hold about you.</li>
        <li><strong>Correction:</strong> request that we update or correct inaccurate information.</li>
        <li><strong>Deletion:</strong> request that we delete your personal information, subject to certain legal exceptions.</li>
        <li><strong>Restriction:</strong> request that we limit how we process your data in certain circumstances.</li>
        <li><strong>Portability:</strong> request that we transfer your data to another service provider in a structured, machine-readable format.</li>
        <li><strong>Objection:</strong> object to our processing of your data based on legitimate interests or for direct marketing purposes.</li>
        <li><strong>Opt-Out of Marketing:</strong> unsubscribe from marketing communications at any time via the unsubscribe link in our emails or by contacting us directly.</li>
      </ul>
      <p>To exercise any of these rights, please contact us at <a href="mailto:support@cuthaven.com">support@cuthaven.com</a>. We will respond to your request within 30 days.</p>

      <h2>9. Do Not Sell or Share My Personal Information (CCPA)</h2>
      <p>Under the California Consumer Privacy Act (CCPA) and the California Privacy Rights Act (CPRA), California residents have the right to:</p>
      <ul>
        <li>Know what personal information is collected, used, shared, or sold.</li>
        <li>Delete personal information held by businesses.</li>
        <li>Opt out of the sale or sharing of personal information.</li>
        <li>Non-discrimination for exercising their CCPA rights.</li>
      </ul>
      <p><strong>We do not sell your personal information.</strong> However, if you wish to exercise your rights under the CCPA or submit a "Do Not Sell or Share My Personal Information" request, please contact us at <a href="mailto:support@cuthaven.com">support@cuthaven.com</a> or call <a href="tel:+14062299045">+1 (406) 229-9045</a>.</p>
      <p>California residents may also designate an authorized agent to submit requests on their behalf.</p>

      <h2>10. Children's Privacy (COPPA)</h2>
      <p>Our website is not directed to children under the age of 13, and we do not knowingly collect personal information from children under 13. If we become aware that a child under 13 has provided us with personal information without verifiable parental consent, we will take immediate steps to delete such information from our records.</p>
      <p>If you believe we have inadvertently collected information from a child under 13, please contact us immediately at <a href="mailto:support@cuthaven.com">support@cuthaven.com</a>.</p>

      <h2>11. Supervisory Authority & Complaints (GDPR)</h2>
      <p>If you are located in the EEA or the United Kingdom and believe that we have not complied with applicable data protection laws, you have the right to lodge a complaint with your local data protection supervisory authority. A list of EU supervisory authorities is available at: <a href="https://edpb.europa.eu/about-edpb/about-edpb/members_en" target="_blank" rel="noopener noreferrer">https://edpb.europa.eu/about-edpb/about-edpb/members_en</a></p>
      <p>For UK residents, complaints may be submitted to the Information Commissioner's Office (ICO) at: <a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noopener noreferrer">https://ico.org.uk/make-a-complaint/</a></p>
      <p>We encourage you to contact us first so we can try to resolve your concern directly.</p>

      <h2>12. Third-Party Links</h2>
      <p>Our website may contain links to third-party websites or services. We are not responsible for the privacy practices or content of those sites. We encourage you to review the privacy policies of any third-party sites you visit.</p>

      <h2>13. Changes to This Policy</h2>
      <p>We may update this Privacy Policy from time to time to reflect changes in our practices, technology, or legal requirements. When we make significant changes, we will post the updated policy on this page with a new effective date and, where appropriate, notify you by email.</p>
      <p>We encourage you to review this policy periodically to stay informed about how we protect your information.</p>

      <h2>14. Contact Us</h2>
      <p>If you have any questions, concerns, or requests regarding this Privacy Policy or your personal data, please contact us:</p>
      <ul>
        <li><strong>Email:</strong> <a href="mailto:support@cuthaven.com">support@cuthaven.com</a></li>
        <li><strong>Phone:</strong> <a href="tel:+14062299045">+1 (406) 229-9045</a></li>
        <li><strong>Address:</strong> CutHaven, 1633 S Industrial Way, Palmer, AK 99645, United States</li>
      </ul>
      <p>We are committed to working with you to resolve any concerns about your privacy in a fair and transparent manner.</p>

      <p className="text-sm text-text-secondary mt-8">© 2026 CutHaven. All rights reserved.</p>
    </PolicyLayout>
  ),
});
