import { resend, FROM_EMAIL } from "../config/resend.js";
import { env } from "../config/env.js";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface EmailOrderItem {
  productName: string;
  productImage: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface OrderConfirmationData {
  to: string;
  orderNumber: string;
  orderId: string;
  items: EmailOrderItem[];
  subtotal: number;
  shippingCost: number;
  taxAmount: number;
  taxJurisdiction?: string;
  discountAmount?: number;
  couponCode?: string;
  total: number;
  shippingAddress: {
    firstName: string;
    lastName: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  estimatedDelivery?: string;
}

// ─── HTML template ─────────────────────────────────────────────────────────

function buildConfirmationHtml(d: OrderConfirmationData): string {
  const itemRows = d.items
    .map(
      (item) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #E5E7EB;vertical-align:top;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              ${
                item.productImage
                  ? `<td width="56" style="padding-right:12px;vertical-align:top;">
                      <img src="${item.productImage}" alt="${item.productName}"
                        width="56" height="56"
                        style="border-radius:6px;object-fit:cover;display:block;border:1px solid #E5E7EB;" />
                    </td>`
                  : ""
              }
              <td style="vertical-align:top;">
                <p style="margin:0;font-size:14px;font-weight:600;color:#111827;">${item.productName}</p>
                <p style="margin:4px 0 0;font-size:13px;color:#6B7280;">Qty: ${item.quantity}</p>
              </td>
              <td style="text-align:right;vertical-align:top;white-space:nowrap;">
                <p style="margin:0;font-size:14px;font-weight:600;color:#111827;">$${item.totalPrice.toFixed(2)}</p>
                <p style="margin:4px 0 0;font-size:12px;color:#6B7280;">$${item.unitPrice.toFixed(2)} each</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`,
    )
    .join("");

  const shippingLine =
    d.shippingCost === 0
      ? `<tr><td style="padding:4px 0;font-size:14px;color:#6B7280;">Shipping</td>
           <td style="text-align:right;font-size:14px;font-weight:600;color:#059669;">FREE</td></tr>`
      : `<tr><td style="padding:4px 0;font-size:14px;color:#6B7280;">Shipping</td>
           <td style="text-align:right;font-size:14px;color:#111827;">$${d.shippingCost.toFixed(2)}</td></tr>`;

  const taxLine =
    d.taxAmount > 0
      ? `<tr><td style="padding:4px 0;font-size:14px;color:#6B7280;">Tax${d.taxJurisdiction ? ` (${d.taxJurisdiction})` : ""}</td>
           <td style="text-align:right;font-size:14px;color:#111827;">$${d.taxAmount.toFixed(2)}</td></tr>`
      : "";

  const discountLine =
    d.discountAmount && d.discountAmount > 0
      ? `<tr><td style="padding:4px 0;font-size:14px;color:#059669;">Coupon${d.couponCode ? ` (${d.couponCode})` : ""}</td>
           <td style="text-align:right;font-size:14px;font-weight:600;color:#059669;">−$${d.discountAmount.toFixed(2)}</td></tr>`
      : "";

  const addr = d.shippingAddress;
  const shopUrl = env.FRONTEND_ORIGIN;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>Order Confirmed — CutHaven</title>
</head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F3F4F6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" border="0" width="600"
          style="max-width:600px;background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#1B4332;padding:28px 32px;text-align:center;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#FFFFFF;letter-spacing:-0.5px;">
                ✂ CutHaven
              </p>
              <p style="margin:6px 0 0;font-size:13px;color:#86EFAC;letter-spacing:0.05em;text-transform:uppercase;">
                Order Confirmed
              </p>
            </td>
          </tr>

          <!-- Hero confirmation -->
          <tr>
            <td style="padding:32px 32px 24px;text-align:center;border-bottom:1px solid #E5E7EB;">
              <div style="width:56px;height:56px;background:#DCFCE7;border-radius:50%;margin:0 auto 16px;
                          display:flex;align-items:center;justify-content:center;font-size:26px;line-height:56px;">
                ✓
              </div>
              <h1 style="margin:0;font-size:22px;font-weight:700;color:#111827;">
                Thank you for your order!
              </h1>
              <p style="margin:8px 0 0;font-size:14px;color:#6B7280;">
                Order <strong style="color:#111827;font-family:monospace;">${d.orderNumber}</strong>
                has been confirmed and is being prepared.
              </p>
              ${
                d.estimatedDelivery
                  ? `<p style="margin:12px 0 0;display:inline-block;background:#F0FDF4;border:1px solid #BBF7D0;
                               border-radius:6px;padding:6px 14px;font-size:13px;color:#166534;">
                       📦 Estimated delivery: <strong>${d.estimatedDelivery}</strong>
                     </p>`
                  : ""
              }
            </td>
          </tr>

          <!-- Order items -->
          <tr>
            <td style="padding:24px 32px;">
              <h2 style="margin:0 0 16px;font-size:16px;font-weight:600;color:#111827;">Order Summary</h2>
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                ${itemRows}
              </table>

              <!-- Totals -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%"
                style="margin-top:16px;border-top:1px solid #E5E7EB;padding-top:12px;">
                <tr>
                  <td style="padding:4px 0;font-size:14px;color:#6B7280;">Subtotal</td>
                  <td style="text-align:right;font-size:14px;color:#111827;">$${d.subtotal.toFixed(2)}</td>
                </tr>
                ${shippingLine}
                ${discountLine}
                ${taxLine}
                <tr>
                  <td style="padding:10px 0 4px;font-size:16px;font-weight:700;color:#111827;
                             border-top:2px solid #E5E7EB;">Total</td>
                  <td style="text-align:right;padding:10px 0 4px;font-size:18px;font-weight:700;
                             color:#E07B1A;border-top:2px solid #E5E7EB;">
                    $${d.total.toFixed(2)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Shipping address -->
          <tr>
            <td style="padding:0 32px 24px;">
              <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:16px;">
                <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#374151;
                           text-transform:uppercase;letter-spacing:0.05em;">
                  Shipping To
                </p>
                <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">
                  ${addr.firstName} ${addr.lastName}<br />
                  ${addr.address}<br />
                  ${addr.city}, ${addr.state} ${addr.zip}<br />
                  ${addr.country}
                </p>
              </div>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:0 32px 32px;text-align:center;">
              <a href="${shopUrl}/account/dashboard"
                style="display:inline-block;background:#1B4332;color:#FFFFFF;
                       text-decoration:none;font-size:14px;font-weight:600;
                       padding:12px 28px;border-radius:9999px;">
                View My Orders →
              </a>
              <p style="margin:16px 0 0;font-size:13px;color:#9CA3AF;">
                Questions? Email us at
                <a href="mailto:support@cuthaven.com" style="color:#1B4332;">support@cuthaven.com</a>
                or call <a href="tel:+14062299045" style="color:#1B4332;">+1 (406) 229-9045</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F9FAFB;border-top:1px solid #E5E7EB;padding:20px 32px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9CA3AF;">
                © ${new Date().getFullYear()} CutHaven · 1633 S Industrial Way, Palmer, AK 99645
              </p>
              <p style="margin:6px 0 0;font-size:12px;color:#9CA3AF;">
                <a href="${shopUrl}/privacy-policy" style="color:#9CA3AF;">Privacy Policy</a>
                &nbsp;·&nbsp;
                <a href="${shopUrl}/returns-refund-policy" style="color:#9CA3AF;">Returns Policy</a>
                &nbsp;·&nbsp;
                <a href="${shopUrl}/shipping-policy" style="color:#9CA3AF;">Shipping Policy</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Plain-text fallback ────────────────────────────────────────────────────

function buildConfirmationText(d: OrderConfirmationData): string {
  const addr = d.shippingAddress;
  const itemLines = d.items
    .map((i) => `  - ${i.productName} × ${i.quantity}  $${i.totalPrice.toFixed(2)}`)
    .join("\n");

  return `
CutHaven — Order Confirmed
==========================

Hi there,

Your order ${d.orderNumber} has been confirmed. Thank you for shopping with CutHaven!

ORDER SUMMARY
${itemLines}

Subtotal:  $${d.subtotal.toFixed(2)}
Shipping:  ${d.shippingCost === 0 ? "FREE" : `$${d.shippingCost.toFixed(2)}`}${d.discountAmount && d.discountAmount > 0 ? `\nDiscount:  -$${d.discountAmount.toFixed(2)}${d.couponCode ? ` (${d.couponCode})` : ""}` : ""}${d.taxAmount > 0 ? `\nTax:       $${d.taxAmount.toFixed(2)}${d.taxJurisdiction ? ` (${d.taxJurisdiction})` : ""}` : ""}
──────────────────
Total:     $${d.total.toFixed(2)}

SHIPPING TO
${addr.firstName} ${addr.lastName}
${addr.address}
${addr.city}, ${addr.state} ${addr.zip}
${addr.country}
${d.estimatedDelivery ? `\nEstimated Delivery: ${d.estimatedDelivery}` : ""}

Track your order: ${env.FRONTEND_ORIGIN}/track-your-order
View your account: ${env.FRONTEND_ORIGIN}/account/dashboard

Questions? support@cuthaven.com | +1 (406) 229-9045

© ${new Date().getFullYear()} CutHaven · 1633 S Industrial Way, Palmer, AK 99645
`.trim();
}

// ─── Send function ──────────────────────────────────────────────────────────

export async function sendOrderConfirmationEmail(data: OrderConfirmationData): Promise<void> {
  if (!env.RESEND_API_KEY) {
    // Dev fallback — log to console so developers can see what would be sent
    console.log(
      `[EMAIL SKIPPED — no RESEND_API_KEY] Would send order confirmation to ${data.to} for order ${data.orderNumber}`,
    );
    return;
  }

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: data.to,
    subject: `Order Confirmed — ${data.orderNumber} | CutHaven`,
    html: buildConfirmationHtml(data),
    text: buildConfirmationText(data),
  });

  if (error) {
    // Log but don't throw — a failed email should never crash the webhook handler
    // or cause Stripe to retry (which could double-confirm orders)
    console.error(`[EMAIL ERROR] Failed to send order confirmation for ${data.orderNumber}:`, error);
  } else {
    console.log(`[EMAIL] Order confirmation sent to ${data.to} for ${data.orderNumber}`);
  }
}
