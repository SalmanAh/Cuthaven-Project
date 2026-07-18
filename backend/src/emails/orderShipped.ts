import { resend, FROM_EMAIL } from "../config/resend.js";
import { env } from "../config/env.js";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface OrderShippedData {
  to: string;
  orderNumber: string;
  trackingNumber?: string;
  carrier?: string;
  trackingUrl?: string;
  estimatedDelivery?: string;
  shippingAddress: {
    firstName: string;
    lastName: string;
    address: string;
    city: string;
    state: string;
    zip: string;
  };
}

// ─── HTML template ─────────────────────────────────────────────────────────

function buildShippedHtml(d: OrderShippedData): string {
  const shopUrl = env.FRONTEND_ORIGIN;

  const trackingBlock =
    d.trackingNumber
      ? `
        <div style="margin:20px 0;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:16px;text-align:center;">
          <p style="margin:0;font-size:13px;font-weight:600;color:#1D4ED8;text-transform:uppercase;letter-spacing:0.05em;">
            Tracking Number
          </p>
          <p style="margin:8px 0;font-size:20px;font-weight:700;color:#1E40AF;font-family:monospace;">
            ${d.trackingNumber}
          </p>
          ${d.carrier ? `<p style="margin:0;font-size:13px;color:#6B7280;">Carrier: ${d.carrier}</p>` : ""}
          ${
            d.trackingUrl
              ? `<a href="${d.trackingUrl}" style="display:inline-block;margin-top:12px;background:#1D4ED8;
                   color:#FFFFFF;text-decoration:none;font-size:13px;font-weight:600;
                   padding:8px 20px;border-radius:9999px;">
                   Track Package →
                 </a>`
              : ""
          }
        </div>`
      : "";

  const addr = d.shippingAddress;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>Your Order Has Shipped — CutHaven</title>
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
                Your Order Is On Its Way
              </p>
            </td>
          </tr>

          <!-- Hero -->
          <tr>
            <td style="padding:32px 32px 24px;text-align:center;border-bottom:1px solid #E5E7EB;">
              <div style="font-size:40px;margin-bottom:12px;">🚚</div>
              <h1 style="margin:0;font-size:22px;font-weight:700;color:#111827;">
                Your package is on its way!
              </h1>
              <p style="margin:8px 0 0;font-size:14px;color:#6B7280;">
                Order <strong style="color:#111827;font-family:monospace;">${d.orderNumber}</strong>
                has been shipped.
              </p>
              ${
                d.estimatedDelivery
                  ? `<p style="margin:12px 0 0;display:inline-block;background:#F0FDF4;border:1px solid #BBF7D0;
                               border-radius:6px;padding:6px 14px;font-size:13px;color:#166534;">
                       📅 Estimated delivery: <strong>${d.estimatedDelivery}</strong>
                     </p>`
                  : ""
              }
            </td>
          </tr>

          <!-- Tracking -->
          <tr>
            <td style="padding:24px 32px;">
              ${trackingBlock}

              <!-- Shipping address -->
              <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:16px;margin-top:8px;">
                <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#374151;
                           text-transform:uppercase;letter-spacing:0.05em;">
                  Delivering To
                </p>
                <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">
                  ${addr.firstName} ${addr.lastName}<br />
                  ${addr.address}<br />
                  ${addr.city}, ${addr.state} ${addr.zip}
                </p>
              </div>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:0 32px 32px;text-align:center;">
              <a href="${shopUrl}/track-your-order"
                style="display:inline-block;background:#1B4332;color:#FFFFFF;
                       text-decoration:none;font-size:14px;font-weight:600;
                       padding:12px 28px;border-radius:9999px;">
                Track Your Order →
              </a>
              <p style="margin:16px 0 0;font-size:13px;color:#9CA3AF;">
                Questions? <a href="mailto:support@cuthaven.com" style="color:#1B4332;">support@cuthaven.com</a>
                | <a href="tel:+14062299045" style="color:#1B4332;">+1 (406) 229-9045</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F9FAFB;border-top:1px solid #E5E7EB;padding:20px 32px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9CA3AF;">
                © ${new Date().getFullYear()} CutHaven · 1633 S Industrial Way, Palmer, AK 99645
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

function buildShippedText(d: OrderShippedData): string {
  const addr = d.shippingAddress;
  return `
CutHaven — Your Order Has Shipped!
===================================

Your order ${d.orderNumber} is on its way.
${d.estimatedDelivery ? `\nEstimated Delivery: ${d.estimatedDelivery}` : ""}
${d.trackingNumber ? `\nTracking Number: ${d.trackingNumber}` : ""}
${d.carrier ? `Carrier: ${d.carrier}` : ""}
${d.trackingUrl ? `Track your package: ${d.trackingUrl}` : ""}

DELIVERING TO
${addr.firstName} ${addr.lastName}
${addr.address}
${addr.city}, ${addr.state} ${addr.zip}

Track order: ${env.FRONTEND_ORIGIN}/track-your-order
View account: ${env.FRONTEND_ORIGIN}/account/dashboard

Questions? support@cuthaven.com | +1 (406) 229-9045

© ${new Date().getFullYear()} CutHaven
`.trim();
}

// ─── Send function ──────────────────────────────────────────────────────────

export async function sendOrderShippedEmail(data: OrderShippedData): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.log(
      `[EMAIL SKIPPED — no RESEND_API_KEY] Would send shipped notification to ${data.to} for order ${data.orderNumber}`,
    );
    return;
  }

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: data.to,
    subject: `Your Order Has Shipped — ${data.orderNumber} | CutHaven`,
    html: buildShippedHtml(data),
    text: buildShippedText(data),
  });

  if (error) {
    console.error(`[EMAIL ERROR] Failed to send shipped notification for ${data.orderNumber}:`, error);
  } else {
    console.log(`[EMAIL] Shipped notification sent to ${data.to} for ${data.orderNumber}`);
  }
}
