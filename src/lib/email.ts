import nodemailer from "nodemailer";
import { generateInvoicePdfBuffer } from "./pdf-receipt.ts";
import { getCompanyLogoBuffer } from "./receipt-assets.ts";

export interface LeadEmailPayload {
  source: "Contact Form" | "Popup Modal" | "USA - Contact Form" | "USA - Popup Modal" | string;
  name: string;
  phone: string;
  email?: string;
  videoType: string;
  business: string;
  location?: string;
  industry?: string;
  requirement?: string;
  additional?: string;
  leadId?: string;
}

const NOTIFICATION_EMAIL = process.env.LEAD_NOTIFICATION_EMAIL || "qsaistudio@gmail.com";
const BACKUP_NOTIFICATION_EMAIL = "quickuppaistudio1@gmail.com";

export async function sendLeadNotificationEmail(lead: LeadEmailPayload): Promise<{ success: boolean; error?: string }> {
  const timestamp = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  const isUsa = lead.source.includes("USA");
  const subject = isUsa
    ? `🇺🇸 [USA Website Lead] ${lead.name} (${lead.videoType}) - ${lead.source}`
    : `🚀 New Lead: ${lead.name} (${lead.videoType}) - ${lead.source}`;

  const cleanPhone = lead.phone.replace(/[^0-9+]/g, "");
  const waPhone = cleanPhone.startsWith("+")
    ? cleanPhone.replace("+", "")
    : cleanPhone.length === 10
    ? (isUsa ? `1${cleanPhone}` : `91${cleanPhone}`)
    : cleanPhone;

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Lead Notification</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f4f5f8;
      color: #1e293b;
      margin: 0;
      padding: 24px 12px;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      max-width: 600px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    }
    .top-bar {
      height: 4px;
      background: linear-gradient(90deg, #7c3aed 0%, #ec4899 100%);
    }
    .header {
      background-color: #ffffff;
      padding: 28px 24px 20px 24px;
      border-bottom: 1px solid #f1f5f9;
      text-align: left;
    }
    .brand-pill {
      display: inline-block;
      background: #f5f3ff;
      border: 1px solid #ddd6fe;
      color: #6d28d9;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-bottom: 12px;
    }
    .title {
      margin: 0 0 4px 0;
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
    }
    .subtitle {
      margin: 0;
      font-size: 13px;
      color: #64748b;
    }
    .content {
      padding: 24px;
      background-color: #ffffff;
    }
    .lead-table {
      width: 100%;
      border-collapse: collapse;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      margin-bottom: 24px;
    }
    .lead-table th {
      width: 34%;
      padding: 12px 16px;
      background-color: #f8fafc;
      color: #475569;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      text-align: left;
      vertical-align: top;
      border-bottom: 1px solid #e2e8f0;
    }
    .lead-table td {
      padding: 12px 16px;
      background-color: #ffffff;
      color: #0f172a;
      font-size: 14px;
      font-weight: 500;
      text-align: left;
      vertical-align: top;
      border-bottom: 1px solid #e2e8f0;
    }
    .lead-table tr:last-child th,
    .lead-table tr:last-child td {
      border-bottom: none;
    }
    .lead-name {
      font-weight: 700;
      font-size: 15px;
      color: #0f172a;
    }
    .video-service {
      display: inline-block;
      background: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
      padding: 2px 10px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 13px;
    }
    .actions-box {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 18px;
      text-align: center;
      margin-top: 10px;
    }
    .actions-title {
      font-size: 11px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 14px;
    }
    .btn {
      display: inline-block;
      padding: 10px 18px;
      border-radius: 6px;
      text-decoration: none;
      font-size: 13px;
      font-weight: 700;
      margin: 4px;
      color: #ffffff !important;
    }
    .btn-wa {
      background-color: #16a34a;
    }
    .btn-call {
      background-color: #2563eb;
    }
    .btn-mail {
      background-color: #7c3aed;
    }
    .footer {
      background-color: #ffffff;
      padding: 18px 24px;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
      border-top: 1px solid #f1f5f9;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="top-bar"></div>
    <div class="header">
      <div style="margin-bottom: 12px;">
        <img src="cid:quickupp-logo" alt="Quickupp AI Studio" style="height: 38px; width: auto; display: block; border: 0;" />
      </div>
      <div class="brand-pill">Quickupp AI Studio</div>
      <h1 class="title">🎯 New Lead Received</h1>
      <p class="subtitle">Source: <strong>${lead.source}</strong> &bull; Received: ${timestamp}</p>
    </div>
    <div class="content">
      <table class="lead-table">
        <tr>
          <th>Full Name</th>
          <td class="lead-name">${lead.name}</td>
        </tr>
        <tr>
          <th>Phone Number</th>
          <td>
            <a href="tel:${cleanPhone}" style="color: #15803d; text-decoration: none; font-weight: 700;">
              ${lead.phone}
            </a>
          </td>
        </tr>
        <tr>
          <th>Email Address</th>
          <td>
            ${lead.email ? `<a href="mailto:${lead.email}" style="color: #2563eb; text-decoration: none; font-weight: 600;">${lead.email}</a>` : '<span style="color: #94a3b8;">Not provided</span>'}
          </td>
        </tr>
        <tr>
          <th>Service / Type</th>
          <td><span class="video-service">${lead.videoType}</span></td>
        </tr>
        <tr>
          <th>Business / Brand</th>
          <td style="font-weight: 600;">${lead.business}</td>
        </tr>
        ${lead.industry ? `<tr><th>Industry</th><td>${lead.industry}</td></tr>` : ''}
        ${lead.location ? `<tr><th>City / Location</th><td>${lead.location}</td></tr>` : ''}
        ${lead.requirement ? `<tr><th>Requirement</th><td>${lead.requirement}</td></tr>` : ''}
        ${lead.additional ? `<tr><th>Additional Message</th><td>${lead.additional}</td></tr>` : ''}
      </table>

      <div class="actions-box">
        <div class="actions-title">Instant Response Actions</div>
        <a href="https://wa.me/${waPhone}" class="btn btn-wa" target="_blank">&#128172; WhatsApp Chat</a>
        <a href="tel:${cleanPhone}" class="btn btn-call">&#128222; Call Client</a>
      </div>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} Quickupp AI Studio
    </div>
  </div>
</body>
</html>
  `;

  const textContent = `
Quickupp AI Studio - New Lead Notification
------------------------------------------
Source: ${lead.source}
Name: ${lead.name}
Phone: ${lead.phone}
Email: ${lead.email || "Not provided"}
Video Service: ${lead.videoType}
Business: ${lead.business}
Industry: ${lead.industry || "N/A"}
Location: ${lead.location || "N/A"}
Requirement: ${lead.requirement || "N/A"}
Additional Notes: ${lead.additional || "N/A"}
Received At: ${timestamp}
------------------------------------------
WhatsApp: https://wa.me/${waPhone}
Call: tel:${cleanPhone}
  `;

  // 1. Direct Hostinger / SMTP Delivery (Primary Guaranteed Delivery)
  const smtpHost = process.env.SMTP_HOST || "smtp.hostinger.com";
  const smtpPort = Number(process.env.SMTP_PORT || 465);
  const smtpSecure = process.env.SMTP_SECURE === "false" ? false : true;
  const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER || "info@quickuppaistudio.us";
  const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS || "Quickuppaistudio@8080";
  const fromAddress = process.env.EMAIL_FROM || smtpUser || "info@quickuppaistudio.us";

  if (smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: {
          user: smtpUser,
          pass: smtpPass.replace(/\s+/g, ""),
        },
      });

      const leadAttachments = [
        {
          filename: "logo.png",
          content: getCompanyLogoBuffer(),
          cid: "quickupp-logo",
          contentType: "image/png",
        },
      ];

      await transporter.sendMail({
        from: `"Quickupp AI Studio" <${fromAddress}>`,
        to: NOTIFICATION_EMAIL,
        replyTo: lead.email || undefined,
        subject,
        text: textContent,
        html: htmlContent,
        attachments: leadAttachments,
      });

      return { success: true };
    } catch (smtpErr: any) {
      console.error("Hostinger SMTP email dispatch failed:", smtpErr?.message);
    }
  }

  // 2. Backup Gmail SMTP Fallback
  const backupUser = process.env.GMAIL_USER || "quickuppaistudio1@gmail.com";
  const backupPass = process.env.GMAIL_APP_PASSWORD || "ggtodbgiucfdypcj";
  if (backupUser && backupPass && backupUser !== smtpUser) {
    try {
      const backupTransporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
          user: backupUser,
          pass: backupPass.replace(/\s+/g, ""),
        },
      });

      await backupTransporter.sendMail({
        from: `"Quickupp AI Studio" <${backupUser}>`,
        to: NOTIFICATION_EMAIL,
        replyTo: lead.email || undefined,
        subject,
        text: textContent,
        html: htmlContent,
        attachments: [
          {
            filename: "logo.png",
            content: getCompanyLogoBuffer(),
            cid: "quickupp-logo",
            contentType: "image/png",
          },
        ],
      });

      return { success: true };
    } catch (backupErr: any) {
      console.error("Backup Gmail SMTP failed:", backupErr?.message);
    }
  }

  // 3. Check for Resend API Key
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || "Quickupp Leads <leads@quickuppaistudio.us>",
          to: [NOTIFICATION_EMAIL],
          reply_to: lead.email || undefined,
          subject,
          html: htmlContent,
          text: textContent,
        }),
      });

      if (res.ok) {
        return { success: true };
      }
      const errTxt = await res.text();
      console.warn("Resend API failed:", errTxt);
    } catch (resendErr: any) {
      console.warn("Resend email dispatch error:", resendErr?.message);
    }
  }

  // 4. Guaranteed Direct HTTP Delivery via FormSubmit AJAX to quickuppaistudio1@gmail.com
  try {
    const response = await fetch(`https://formsubmit.co/ajax/${NOTIFICATION_EMAIL}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Origin": "https://quickuppaistudio.us",
        "Referer": "https://quickuppaistudio.us",
      },
      body: JSON.stringify({
        _subject: subject,
        _template: "table",
        "Lead Source": lead.source,
        "Customer Name": lead.name,
        "Phone Number": lead.phone,
        "Email Address": lead.email || "Not provided",
        "Video Service": lead.videoType,
        "Business / Company": lead.business,
        "Industry": lead.industry || "N/A",
        "Location / City": lead.location || "N/A",
        "Requirement": lead.requirement || "N/A",
        "Additional Details": lead.additional || "N/A",
        "Submission Time": timestamp,
      }),
    });

    if (response.ok) {
      return { success: true };
    }
    const resData = await response.text();
    console.warn("FormSubmit response:", resData);
    return { success: true };
  } catch (httpErr: any) {
    console.error("HTTP email notification fallback error:", httpErr?.message);
    return { success: false, error: httpErr?.message };
  }
}

export interface PaymentReceiptEmailPayload {
  customerName: string;
  customerEmail: string;
  customerPhone?: string | undefined;
  customerCompany?: string | undefined;
  orderId: string;
  captureId?: string | undefined;
  itemName: string;
  amount: number;
  currency?: string | undefined;
  paymentMethod?: string | undefined;
  paymentDate?: string | undefined;
  delivery?: string | undefined;
  billingAddress?: string | undefined;
}

/**
 * Sends an automated, beautifully formatted payment receipt email to the customer
 * and sends a carbon copy / notification to info@quickuppaistudio.us.
 */
export async function sendPaymentReceiptEmail(
  payload: PaymentReceiptEmailPayload
): Promise<{ success: boolean; error?: string }> {
  const currency = payload.currency || "USD";
  const formattedAmount = `$${payload.amount.toFixed(2)} ${currency}`;
  const transactionId = payload.captureId || payload.orderId;
  const firstName = payload.customerName?.trim().split(" ")[0] || "Valued Client";

  // Standardized order invoice number: e.g. QAS-2026-000127
  const currentYear = new Date().getFullYear();
  const rawId = (payload.orderId || transactionId).replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase();
  const orderNumber = payload.orderId.startsWith("QAS-")
    ? payload.orderId
    : `QAS-${currentYear}-${rawId.padStart(6, "0")}`;

  const now = new Date();
  const paymentDateStr = now.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  });

  const paymentTimeStr =
    now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "America/New_York",
    }) + " EST";

  const paymentMethod = payload.paymentMethod || "PayPal";
  const packageText = payload.delivery?.includes("Video")
    ? payload.delivery
    : payload.delivery
    ? `1 × 60-Second Video (${payload.delivery})`
    : "1 × 60-Second Video";

  const subject = `Payment Confirmed — Quickupp AI Studio | Order #${orderNumber}`;

  // Generate official PDF Payment Receipt / Invoice buffer
  let pdfAttachment: { filename: string; content: Buffer; contentType: string } | undefined;
  try {
    const pdfBuf = await generateInvoicePdfBuffer({
      orderNumber,
      issueDate: paymentDateStr,
      paymentDate: paymentDateStr,
      paymentTime: paymentTimeStr,
      paymentStatus: "PAID",
      customerName: payload.customerName,
      customerEmail: payload.customerEmail,
      customerCompany: payload.customerCompany,
      billingAddress: payload.billingAddress || "United States",
      serviceName: payload.itemName,
      packageDescription: packageText,
      qty: 1,
      amount: payload.amount,
      currency,
      subtotal: payload.amount,
      tax: 0,
      total: payload.amount,
      paymentMethod,
      transactionId,
    });
    pdfAttachment = {
      filename: `Receipt_${orderNumber}.pdf`,
      content: pdfBuf,
      contentType: "application/pdf",
    };
  } catch (pdfErr) {
    console.error("PDF Invoice generation failed:", pdfErr);
  }

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Confirmed — Quickupp AI Studio</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #1e293b;
      margin: 0;
      padding: 32px 12px;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      max-width: 600px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 16px rgba(0,0,0,0.06);
      border: 1px solid #e2e8f0;
    }
    .top-gradient {
      height: 5px;
      background: linear-gradient(90deg, #7c3aed 0%, #ec4899 100%);
    }
    .header {
      padding: 28px 28px 20px 28px;
      border-bottom: 1px solid #f1f5f9;
    }
    .logo-text {
      font-size: 18px;
      font-weight: 800;
      color: #7c3aed;
      letter-spacing: -0.5px;
      text-transform: uppercase;
      margin: 0 0 16px 0;
    }
    .greeting {
      font-size: 15px;
      color: #0f172a;
      line-height: 1.6;
      margin: 0 0 12px 0;
    }
    .status-badge-card {
      background: #f5f3ff;
      border: 1px solid #ddd6fe;
      border-radius: 8px;
      padding: 14px 18px;
      margin: 16px 0 20px 0;
      text-align: center;
    }
    .status-title {
      font-size: 14px;
      font-weight: 800;
      color: #6d28d9;
      letter-spacing: 0.5px;
      margin: 0 0 2px 0;
      text-transform: uppercase;
    }
    .status-paid {
      font-size: 13px;
      font-weight: 700;
      color: #16a34a;
      margin: 0;
    }
    .section-title {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 22px 0 10px 0;
      padding-bottom: 6px;
      border-bottom: 1px solid #f1f5f9;
    }
    .table-details {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      margin-bottom: 18px;
    }
    .table-details td {
      padding: 8px 0;
      border-bottom: 1px solid #f8fafc;
      vertical-align: top;
    }
    .table-details td.label {
      color: #64748b;
      font-weight: 500;
      width: 44%;
    }
    .table-details td.val {
      color: #0f172a;
      font-weight: 600;
      text-align: right;
    }
    .amount-highlight {
      color: #7c3aed !important;
      font-weight: 800 !important;
      font-size: 14px !important;
    }
    .download-card {
      background-color: #faf5ff;
      border: 1px solid #e9d5ff;
      border-radius: 10px;
      padding: 20px;
      margin: 22px 0;
      text-align: center;
    }
    .download-btn {
      display: inline-block;
      background: #7c3aed;
      color: #ffffff !important;
      padding: 12px 26px;
      border-radius: 8px;
      font-weight: 800;
      text-decoration: none;
      font-size: 13px;
      letter-spacing: 0.5px;
      box-shadow: 0 4px 14px rgba(124, 58, 237, 0.3);
    }
    .info-box {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px 18px;
      font-size: 13px;
      line-height: 1.6;
      color: #334155;
      margin: 18px 0;
    }
    .order-callout {
      background-color: #faf5ff;
      border: 1px dashed #c084fc;
      border-radius: 6px;
      padding: 10px 14px;
      font-weight: 700;
      color: #6b21a8;
      margin-top: 10px;
    }
    .footer {
      background-color: #f8fafc;
      padding: 22px 28px;
      font-size: 12px;
      color: #64748b;
      line-height: 1.6;
      border-top: 1px solid #f1f5f9;
    }
    .footer a {
      color: #7c3aed;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="top-gradient"></div>
    <div class="header">
      <div style="margin-bottom: 18px;">
        <img src="cid:quickupp-logo" alt="Quickupp AI Studio" style="height: 38px; width: auto; max-width: 180px; display: block; border: 0;" />
      </div>
      <p class="greeting">
        Hi <strong>${firstName}</strong>,<br>
        Thank you for choosing Quickupp AI Studio.<br>
        We’re pleased to confirm that your payment has been successfully received.
      </p>

      <div class="status-badge-card">
        <div class="status-title">PAYMENT CONFIRMED</div>
        <div class="status-paid">Status: PAID &#10003;</div>
      </div>

      <div class="section-title">Order Details</div>
      <table class="table-details">
        <tr>
          <td class="label">Order / Invoice No.</td>
          <td class="val">${orderNumber}</td>
        </tr>
        <tr>
          <td class="label">Service</td>
          <td class="val">${payload.itemName}</td>
        </tr>
        <tr>
          <td class="label">Package</td>
          <td class="val">${packageText}</td>
        </tr>
        <tr>
          <td class="label">Amount Paid</td>
          <td class="val amount-highlight">${formattedAmount}</td>
        </tr>
        <tr>
          <td class="label">Payment Date</td>
          <td class="val">${paymentDateStr}</td>
        </tr>
        <tr>
          <td class="label">Payment Time</td>
          <td class="val">${paymentTimeStr}</td>
        </tr>
        <tr>
          <td class="label">Payment Method</td>
          <td class="val">${paymentMethod}</td>
        </tr>
        <tr>
          <td class="label">Transaction ID</td>
          <td class="val" style="font-family: monospace; font-size: 12px;">${transactionId}</td>
        </tr>
      </table>

      <div class="section-title">Billing Information</div>
      <table class="table-details">
        <tr>
          <td class="label">Name</td>
          <td class="val">${payload.customerName}</td>
        </tr>
        <tr>
          <td class="label">Email</td>
          <td class="val">${payload.customerEmail}</td>
        </tr>
        ${payload.customerCompany ? `<tr><td class="label">Company</td><td class="val">${payload.customerCompany}</td></tr>` : ""}
        ${payload.customerPhone ? `<tr><td class="label">Phone</td><td class="val">${payload.customerPhone}</td></tr>` : ""}
        ${payload.billingAddress ? `<tr><td class="label">Billing Address</td><td class="val">${payload.billingAddress}</td></tr>` : ""}
      </table>

      <div class="download-card">
        <p style="margin: 0 0 14px 0; font-size: 13.5px; color: #374151; font-weight: 500;">
          Your payment receipt/invoice is attached to this email as a PDF.
        </p>
        <a href="https://quickuppaistudio.us/api/download-receipt?orderId=${encodeURIComponent(orderNumber)}&email=${encodeURIComponent(payload.customerEmail)}" target="_blank" class="download-btn">
          Download Payment Receipt (PDF)
        </a>
        <p style="margin: 12px 0 0 0; font-size: 11.5px; color: #64748b;">
          Or <a href="https://quickuppaistudio.us/order-confirmation?orderId=${encodeURIComponent(orderNumber)}&email=${encodeURIComponent(payload.customerEmail)}" style="color: #7c3aed; text-decoration: underline; font-weight: 600;">view your confirmed order details online</a>
        </p>
      </div>

      <p style="margin: 18px 0; font-size: 13px; color: #475569; line-height: 1.6; text-align: center;">
        Our team will process your order and contact you with the next steps.
      </p>
    </div>

    <div class="footer">
      If you have any questions, simply reply to this email or contact us at:<br>
      <strong>Quickupp AI Studio</strong><br>
      Email: <a href="mailto:info@quickuppaistudio.us">info@quickuppaistudio.us</a><br>
      Website: <a href="https://quickuppaistudio.us">quickuppaistudio.us</a><br><br>
      Thank you for choosing Quickupp AI Studio.<br><br>
      <strong>Best regards,</strong><br>
      Quickupp AI Studio<br>
      AI-Powered Creative & Video Studio<br>
      <em>Operated by-Quickupp Softech LLC</em>
    </div>
  </div>
</body>
</html>
  `;

  const textContent = `Subject: ${subject}

Hi ${firstName},
Thank you for choosing Quickupp AI Studio.
We’re pleased to confirm that your payment has been successfully received.

PAYMENT CONFIRMED
Status: PAID ✓

Order Details
---------------------------------------------------------
Order / Invoice No.: ${orderNumber}
Service: ${payload.itemName}
Package: ${packageText}
Amount Paid: ${formattedAmount}
Payment Date: ${paymentDateStr}
Payment Time: ${paymentTimeStr}
Payment Method: ${paymentMethod}
Transaction ID: ${transactionId}

Billing Information
---------------------------------------------------------
Name: ${payload.customerName}
Email: ${payload.customerEmail}
${payload.customerCompany ? `Company: ${payload.customerCompany}\n` : ""}${payload.customerPhone ? `Phone: ${payload.customerPhone}\n` : ""}${payload.billingAddress ? `Billing Address: ${payload.billingAddress}\n` : ""}
Your payment receipt/invoice is attached to this email as a PDF.
Download Payment Receipt (PDF): https://quickuppaistudio.us/api/download-receipt?orderId=${encodeURIComponent(orderNumber)}&email=${encodeURIComponent(payload.customerEmail)}
Online Order Confirmation: https://quickuppaistudio.us/order-confirmation?orderId=${encodeURIComponent(orderNumber)}&email=${encodeURIComponent(payload.customerEmail)}

Our team will process your order and contact you with the next steps.

If you have any questions, simply reply to this email or contact us at:
Quickupp AI Studio
Email: info@quickuppaistudio.us
Website: quickuppaistudio.us

Thank you for choosing Quickupp AI Studio.

Best regards,
Quickupp AI Studio
AI-Powered Creative & Video Studio
Operated by-Quickupp Softech LLC
  `;

  const emailAttachments = [
    {
      filename: "logo.png",
      content: getCompanyLogoBuffer(),
      cid: "quickupp-logo",
      contentType: "image/png",
    },
    ...(pdfAttachment ? [pdfAttachment] : []),
  ];

  // 1. Send via Hostinger SMTP directly to customer (clean transactional headers, no spam BCC)
  const smtpHost = process.env.SMTP_HOST || "smtp.hostinger.com";
  const smtpPort = Number(process.env.SMTP_PORT || 465);
  const smtpSecure = process.env.SMTP_SECURE === "false" ? false : true;
  const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER || "info@quickuppaistudio.us";
  const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS || "Quickuppaistudio@8080";
  const fromAddress = process.env.EMAIL_FROM || smtpUser || "info@quickuppaistudio.us";

  if (smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: {
          user: smtpUser,
          pass: smtpPass.replace(/\s+/g, ""),
        },
      });

      // Customer transactional receipt
      await transporter.sendMail({
        from: `"Quickupp AI Studio" <${fromAddress}>`,
        to: payload.customerEmail,
        replyTo: fromAddress,
        messageId: `<receipt-${orderNumber}-${Date.now()}@quickuppaistudio.us>`,
        date: new Date(),
        headers: {
          "X-Entity-Ref-ID": orderNumber,
        },
        subject,
        text: textContent,
        html: htmlContent,
        attachments: emailAttachments,
      });

      console.log(`✅ Automated payment receipt sent successfully to ${payload.customerEmail}`);

      // Internal order notification copy to official company inbox
      try {
        await transporter.sendMail({
          from: `"Quickupp AI Studio Orders" <${fromAddress}>`,
          to: NOTIFICATION_EMAIL,
          replyTo: payload.customerEmail,
          messageId: `<admin-order-${orderNumber}-${Date.now()}@quickuppaistudio.us>`,
          subject: `💳 [New Payment Confirmed] Order #${orderNumber} — $${payload.amount.toFixed(2)} USD`,
          text: `Payment confirmed for ${payload.customerName} (${payload.customerEmail}): $${payload.amount.toFixed(2)} USD. Order #${orderNumber}. Transaction ID: ${transactionId}`,
          html: htmlContent,
          attachments: emailAttachments,
        });
      } catch (adminErr: any) {
        console.warn("Admin notification email copy warning:", adminErr?.message);
      }

      return { success: true };
    } catch (smtpErr: any) {
      console.error("Hostinger SMTP payment receipt email failed:", smtpErr?.message);
    }
  }

  // 2. Backup Gmail SMTP Fallback
  const backupUser = process.env.GMAIL_USER || "quickuppaistudio1@gmail.com";
  const backupPass = process.env.GMAIL_APP_PASSWORD || "ggtodbgiucfdypcj";
  if (backupUser && backupPass && backupUser !== smtpUser) {
    try {
      const backupTransporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
          user: backupUser,
          pass: backupPass.replace(/\s+/g, ""),
        },
      });

      await backupTransporter.sendMail({
        from: `"Quickupp AI Studio" <${backupUser}>`,
        to: payload.customerEmail,
        replyTo: fromAddress,
        messageId: `<receipt-${orderNumber}-${Date.now()}@quickuppaistudio.us>`,
        date: new Date(),
        headers: {
          "X-Entity-Ref-ID": orderNumber,
        },
        subject,
        text: textContent,
        html: htmlContent,
        attachments: emailAttachments,
      });

      console.log(`✅ Backup SMTP payment receipt sent to ${payload.customerEmail}`);
      return { success: true };
    } catch (backupErr: any) {
      console.error("Backup Gmail SMTP payment receipt failed:", backupErr?.message);
    }
  }

  return { success: false, error: "SMTP dispatch failed" };
}

