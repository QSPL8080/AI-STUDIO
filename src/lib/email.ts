import nodemailer from "nodemailer";
import type { IndiaLeadSource } from "./lead-source";

export interface LeadEmailPayload {
  source: IndiaLeadSource | string;
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

// New-lead notification emails go here. (Failed sign-in alerts go to the CRM "Login alert email", info@quickuppaistudio.in by default.)
const NOTIFICATION_EMAIL = process.env.LEAD_NOTIFICATION_EMAIL || "qsaistudio@gmail.com";

// ---------------------------------------------------------------------------
// Shared branded email layout (logo header, details table, buttons, footer).
// Inline styles only, so it renders the same in Gmail, Outlook and mobile apps.
// ---------------------------------------------------------------------------
const SITE_URL = (process.env.PUBLIC_SITE_URL || "https://quickuppaistudio.in").replace(/\/+$/, "");
const LOGO_URL = process.env.EMAIL_LOGO_URL || `${SITE_URL}/images/logo.png`;

export function escapeHtml(v: unknown) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function renderBrandedEmail(opts: {
  eyebrow: string;
  title: string;
  intro?: string;
  accent?: string;
  rows: [string, string][];
  /** Row labels whose values are already safe HTML (links). */
  htmlRows?: string[];
  buttons?: { label: string; href: string; color?: string }[];
  note?: string;
}) {
  const accent = opts.accent || "#7c3aed";
  const rowsHtml = opts.rows
    .map(
      ([k, v]) => `<tr>
        <td style="padding:11px 0;border-top:1px solid #eef0f3;color:#6b7280;font-size:13px;width:170px;vertical-align:top">${escapeHtml(k)}</td>
        <td style="padding:11px 0;border-top:1px solid #eef0f3;color:#111827;font-size:14px;font-weight:600;vertical-align:top;word-break:break-word">${
          opts.htmlRows?.includes(k) ? v : escapeHtml(v)
        }</td>
      </tr>`,
    )
    .join("");
  const buttonsHtml = (opts.buttons || [])
    .map(
      (b) =>
        `<a href="${escapeHtml(b.href)}" target="_blank" style="display:inline-block;margin:0 8px 8px 0;padding:11px 20px;border-radius:6px;background:${b.color || accent};color:#ffffff;font-size:13px;font-weight:700;text-decoration:none">${escapeHtml(b.label)}</a>`,
    )
    .join("");
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHtml(opts.title)}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6"><tr><td align="center" style="padding:28px 12px">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
    <tr><td style="background:#0b0f19;padding:20px 28px">
      <img src="${escapeHtml(LOGO_URL)}" alt="Quickupp AI Studio" height="30" style="display:block;height:30px;width:auto;border:0;color:#ffffff;font-size:18px;font-weight:700">
    </td></tr>
    <tr><td style="height:3px;line-height:3px;font-size:0;background:${accent}">&nbsp;</td></tr>
    <tr><td style="padding:26px 28px 6px">
      <div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${accent}">${escapeHtml(opts.eyebrow)}</div>
      <h1 style="margin:8px 0 0;font-size:21px;line-height:1.3;color:#111827">${escapeHtml(opts.title)}</h1>
      ${opts.intro ? `<p style="margin:10px 0 0;font-size:14px;line-height:1.55;color:#4b5563">${escapeHtml(opts.intro)}</p>` : ""}
    </td></tr>
    <tr><td style="padding:14px 28px 6px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowsHtml}</table></td></tr>
    ${buttonsHtml ? `<tr><td style="padding:16px 28px 8px">${buttonsHtml}</td></tr>` : ""}
    ${opts.note ? `<tr><td style="padding:8px 28px 20px"><div style="padding:12px 14px;border-radius:6px;background:#f9fafb;border:1px solid #eef0f3;font-size:12px;line-height:1.5;color:#6b7280">${escapeHtml(opts.note)}</div></td></tr>` : `<tr><td style="padding:6px"></td></tr>`}
    <tr><td style="padding:16px 28px;border-top:1px solid #eef0f3;background:#fafafa;font-size:12px;line-height:1.5;color:#9ca3af">
      Quickupp AI Studio &middot; AI STUDIO INDIA Enterprise CRM &middot; <a href="${escapeHtml(SITE_URL)}" style="color:#6b7280;text-decoration:none">${escapeHtml(SITE_URL.replace(/^https?:\/\//, ""))}</a><br>
      This is an automated message. &copy; ${new Date().getFullYear()} Quickupp AI Studio.
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

// ---------------------------------------------------------------------------
// Customer payment confirmation email (white, brand-styled, table layout with inline
// styles so it renders the same in Gmail, Outlook, Apple Mail and phones).
// ---------------------------------------------------------------------------
const EMAIL_LOGO_DARK_URL =
  process.env.EMAIL_LOGO_DARK_URL || `${SITE_URL}/images/logo-email.png`;
const EMAIL_LOGO_CID = "quickupp-ai-studio-logo";

function renderPaymentConfirmationEmail(o: {
  /** Image source for the logo: "cid:..." when embedded in the email, otherwise a URL. */
  logoSrc: string;
  firstName: string;
  name: string;
  email: string;
  company?: string | undefined;
  billingAddress?: string | undefined;
  orderNumber: string;
  service: string;
  pack: string;
  delivery?: string | undefined;
  amount: string;
  method: string;
  transactionId: string;
  paymentDate: string;
  paymentTime: string;
  confirmationUrl: string;
  receiptUrl: string;
  /** "full" (default), "advance" (50% paid, balance due) or "balance" (rest of an advance). */
  plan?: "full" | "advance" | "balance" | undefined;
  planLabel?: string | undefined;
  orderTotal?: string | undefined;
  paidBefore?: string | undefined;
  paidTotal?: string | undefined;
  balanceDue?: string | undefined;
  payBalanceUrl?: string | undefined;
  parentOrderNumber?: string | undefined;
  discountPercent?: number | undefined;
  discountAmount?: string | undefined;
  couponCode?: string | undefined;
  originalAmount?: string | undefined;
}) {
  const e = escapeHtml;
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const mono = "SFMono-Regular,Menlo,Consolas,'Courier New',monospace";
  const row = (k: string, v: string, opts: { strong?: boolean; mono?: boolean; last?: boolean; color?: string } = {}) => `
          <tr>
            <td style="padding:12px 0;${opts.last ? "" : "border-bottom:1px solid #eef0f4;"}font-family:${font};font-size:13px;color:#6b7280;width:46%;vertical-align:top">${e(k)}</td>
            <td align="right" style="padding:12px 0;${opts.last ? "" : "border-bottom:1px solid #eef0f4;"}font-family:${opts.mono ? mono : font};font-size:${opts.strong ? "16px" : "14px"};font-weight:${opts.strong ? "800" : "600"};color:${opts.color || (opts.strong ? "#111827" : "#1f2937")};vertical-align:top;${opts.mono ? "word-break:break-all" : "overflow-wrap:break-word"}">${e(v)}</td>
          </tr>`;
  const details: [string, string, { strong?: boolean; mono?: boolean; color?: string }?][] = [
    ["Order / Invoice No.", o.orderNumber, { mono: true }],
    ["Service", o.service],
    ["Package", o.pack],
    ...(o.delivery ? ([["Delivery", o.delivery]] as [string, string][]) : []),
    ...(o.originalAmount ? ([["Original Order Total", o.originalAmount]] as [string, string][]) : []),
    ...(o.discountPercent && o.discountPercent > 0
      ? ([
          [
            "Special Offer Discount",
            `-${o.discountAmount || ""} (${o.discountPercent}% OFF)`,
            { color: "#dc2626" },
          ],
        ] as [string, string, { strong?: boolean; mono?: boolean; color?: string }][])
      : []),
    ...((o.plan === "advance"
      ? [
          ["Order Total", o.orderTotal || o.amount],
          ["Amount Paid (50% Advance)", o.amount, { strong: true }],
          ["Balance Due", o.balanceDue || "-", { strong: true }],
        ]
      : o.plan === "balance"
        ? [
            ["Order Total", o.orderTotal || o.amount],
            ["Paid Earlier (50% Advance)", o.paidBefore || "-"],
            ["Amount Paid Now (Balance)", o.amount, { strong: true }],
            ["Balance Due", "Nil (Fully Paid)"],
          ]
        : [["Amount Paid", o.amount, { strong: true }]]) as [string, string, { strong?: boolean; mono?: boolean; color?: string }?][]),
    ["Payment Type", o.planLabel || "Full Payment"],
    ["Payment Date", o.paymentDate],
    ["Payment Time", o.paymentTime],
    ["Payment Method", o.method],
    ["Transaction ID", o.transactionId, { mono: true }],
  ];
  const detailsHtml = details
    .map(([k, v, opt], i) => row(k, v, { ...(opt || {}), last: i === details.length - 1 }))
    .join("");
  const billing: [string, string][] = [
    ["Name", o.name],
    ["Email", o.email],
    ...(o.company ? ([["Company", o.company]] as [string, string][]) : []),
    ...(o.billingAddress ? ([["Billing Address", o.billingAddress]] as [string, string][]) : []),
  ];
  const billingHtml = billing
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 0;font-family:${font};font-size:13px;color:#6b7280;width:120px;vertical-align:top">${e(k)}:</td><td style="padding:4px 0;font-family:${font};font-size:14px;color:#1f2937;font-weight:600;vertical-align:top;overflow-wrap:anywhere">${e(v)}</td></tr>`,
    )
    .join("");
  const sectionTitle = (t: string) =>
    `<div style="font-family:${font};font-size:11px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;color:#7c3aed;margin:0 0 10px">${e(t)}</div>`;
  const site = SITE_URL.replace(/^https?:\/\//, "");

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>Payment Confirmed — Order #${e(o.orderNumber)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f2fa;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">Your payment of ${e(o.amount)} for order #${e(o.orderNumber)} has been received. Receipt attached.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f2fa">
<tr><td align="center" style="padding:32px 12px">

  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e7e3f3">

    <!-- Brand bar -->
    <tr><td style="height:5px;line-height:5px;font-size:0;background-color:#a832e6;background-image:linear-gradient(90deg,#4f46e5,#a832e6,#e11d74)">&nbsp;</td></tr>

    <!-- Logo -->
    <tr><td align="center" bgcolor="#ffffff" style="padding:24px 32px;background:#ffffff;background-color:#ffffff;border-bottom:1px solid #f1f0f7">
      <a href="${e(SITE_URL)}" target="_blank" style="text-decoration:none">
        <img src="${e(o.logoSrc)}" alt="Quickupp AI Studio" width="220" style="display:block;width:220px;max-width:72%;height:auto;border:0;outline:none;font-family:${font};font-size:20px;font-weight:800;color:#111827">
      </a>
    </td></tr>

    <!-- Greeting -->
    <tr><td style="padding:30px 36px 6px;font-family:${font}">
      <p style="margin:0 0 14px;font-size:16px;line-height:1.5;color:#111827;font-weight:700">Hi ${e(o.firstName)},</p>
      <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#374151">Thank you for choosing <strong style="color:#111827">Quickupp AI Studio</strong>.</p>
      <p style="margin:0;font-size:15px;line-height:1.6;color:#374151">We’re pleased to confirm that your payment has been successfully received.</p>
    </td></tr>

    <!-- Payment confirmed -->
    <tr><td style="padding:22px 36px 4px;font-family:${font}">
      ${
        o.plan === "advance" && o.balanceDue
          ? `<div style="font-size:15px;font-weight:800;letter-spacing:1.5px;color:#b45309">ADVANCE PAYMENT CONFIRMED</div>
      <div style="margin-top:6px;font-size:14px;color:#374151">Status: <strong style="color:#b45309">ADVANCE PAID (50%)</strong> &middot; Balance due: <strong style="color:#b45309">${e(o.balanceDue)}</strong></div>`
          : `<div style="font-size:15px;font-weight:800;letter-spacing:1.5px;color:#15803d">PAYMENT CONFIRMED</div>
      <div style="margin-top:6px;font-size:14px;color:#374151">Status: <strong style="color:#15803d">${o.plan === "balance" ? "FULLY PAID" : "PAID"} &#10003;</strong></div>`
      }
    </td></tr>

    ${
      o.discountPercent && o.discountPercent > 0
        ? `<!-- Discount Offer Remark (Red) -->
    <tr><td style="padding:16px 36px 0;font-family:${font}">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fef2f2;border:1.5px dashed #ef4444;border-radius:10px">
        <tr><td style="padding:14px 18px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="vertical-align:top">
                <span style="display:inline-block;padding:3px 9px;border-radius:4px;background:#dc2626;color:#ffffff;font-size:11px;font-weight:900;letter-spacing:0.8px;text-transform:uppercase">Special Offer Applied</span>
                <div style="margin-top:6px;font-size:15px;font-weight:800;color:#991b1b">
                  ${e(o.discountPercent)}% DISCOUNT APPLIED
                  ${o.discountAmount ? `<span style="font-weight:700;color:#dc2626"> (Saved ${e(o.discountAmount)})</span>` : ""}
                </div>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </td></tr>`
        : ""
    }

    <!-- Order details -->
    <tr><td style="padding:26px 36px 4px">
      ${sectionTitle("Order Details")}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #eef0f4;border-radius:10px">
        <tr><td style="padding:4px 18px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${detailsHtml}
          </table>
        </td></tr>
      </table>
    </td></tr>

    <!-- Billing -->
    <tr><td style="padding:24px 36px 4px">
      ${sectionTitle("Billing Information")}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#faf9fd;border:1px solid #eeeaf7;border-radius:10px">
        <tr><td style="padding:12px 18px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${billingHtml}</table>
        </td></tr>
      </table>
    </td></tr>

    ${
      o.plan === "advance" && o.balanceDue && o.payBalanceUrl
        ? `<!-- Balance due -->
    <tr><td style="padding:24px 36px 4px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px">
        <tr><td align="center" style="padding:18px 20px;font-family:${font}">
          <div style="font-size:13px;font-weight:800;letter-spacing:1px;color:#b45309">BALANCE PENDING</div>
          <div style="margin-top:6px;font-size:22px;font-weight:800;color:#111827">${e(o.balanceDue)}</div>
          <p style="margin:6px 0 14px;font-size:13px;line-height:1.6;color:#6b7280">Pay the remaining balance anytime with the secure link below.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td align="center" style="border-radius:999px;background:#111827">
              <a href="${e(o.payBalanceUrl)}" target="_blank" style="display:inline-block;padding:12px 26px;font-family:${font};font-size:14px;font-weight:800;letter-spacing:.5px;color:#ffffff;text-decoration:none;border-radius:999px">PAY REMAINING BALANCE</a>
            </td>
          </tr></table>
        </td></tr>
      </table>
    </td></tr>
`
        : ""
    }
    <!-- Receipt -->
    <tr><td align="center" style="padding:26px 36px 6px;font-family:${font}">
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#4b5563">Your payment receipt/invoice is attached to this email as a PDF.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td align="center" style="border-radius:999px;background-color:#7c3aed;background-image:linear-gradient(90deg,#4f46e5,#a832e6,#e11d74)">
          <a href="${e(o.receiptUrl)}" target="_blank" style="display:inline-block;padding:14px 30px;font-family:${font};font-size:14px;font-weight:800;letter-spacing:.6px;color:#ffffff;text-decoration:none;border-radius:999px">DOWNLOAD PAYMENT RECEIPT</a>
        </td>
      </tr></table>
    </td></tr>

    <!-- What happens next -->
    <tr><td style="padding:24px 36px 4px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f3ff;border-left:4px solid #7c3aed;border-radius:8px">
        <tr><td style="padding:18px 20px;font-family:${font}">
          <div style="font-size:15px;font-weight:800;color:#111827;margin-bottom:8px">What Happens Next?</div>
          <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#374151">Our team will process your order and contact you with the next steps.</p>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#374151">If you purchased a video/creative service, please keep your order number handy when communicating with our team.</p>
          <div style="font-size:13px;color:#6b7280">Order Number: <span style="font-family:${mono};font-weight:700;color:#111827;background:#ffffff;border:1px solid #e4dcfb;border-radius:6px;padding:3px 8px">${e(o.orderNumber)}</span></div>
        </td></tr>
      </table>
    </td></tr>

    <!-- Contact & sign-off -->
    <tr><td style="padding:24px 36px 30px;font-family:${font}">
      <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#374151">If you have any questions, simply reply to this email or contact us at:</p>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#374151">
        Email: <a href="mailto:info@quickuppaistudio.in" style="color:#7c3aed;text-decoration:none;font-weight:600">info@quickuppaistudio.in</a><br>
        Website: <a href="${e(SITE_URL)}" target="_blank" style="color:#7c3aed;text-decoration:none;font-weight:600">${e(site)}</a>
      </p>
      <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#374151">Thank you for choosing Quickupp AI Studio.</p>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#374151">Best regards,<br>
        <strong style="color:#111827;font-size:15px">Quickupp AI Studio</strong><br>
        <span style="color:#7c3aed;font-weight:600">AI-Powered Creative &amp; Video Studio</span><br>
        <span style="color:#6b7280;font-size:13px">Operated by Quickupp Softech Private Limited</span>
      </p>
    </td></tr>

    <!-- Footer -->
    <tr><td align="center" style="padding:18px 32px;background:#0d091a;font-family:${font};font-size:12px;line-height:1.7;color:#a5a1b8">
      &copy; ${new Date().getFullYear()} Quickupp AI Studio<br>
      Quickupp Softech Private Limited, Pune, India
    </td></tr>
  </table>

  <div style="max-width:600px;padding:14px 12px 0;font-family:${font};font-size:11px;line-height:1.5;color:#9ca3af;text-align:center">
    You are receiving this email because you placed an order on ${e(site)}.
  </div>
</td></tr></table>
</body></html>`;
}

interface SmtpAccount {
  label: string;
  host: string;
  user: string;
  pass: string;
}

function isHostingerAccount(a: SmtpAccount): boolean {
  return (
    a.label === "Hostinger SMTP" ||
    a.host.toLowerCase().includes("hostinger") ||
    a.user.toLowerCase().includes("quickuppaistudio.in")
  );
}

/** SMTP accounts tried in order. Nothing is hard-coded: the passwords live only in the
 *  Hostinger environment variables.
 *   - Hostinger mailbox: info@quickuppaistudio.in via smtp.hostinger.com (Primary)
 *   - Gmail fallback: qsaistudio@gmail.com (Backup) */
function smtpAccounts(): { accounts: SmtpAccount[]; missing: string[] } {
  const accounts: SmtpAccount[] = [];
  const missing: string[] = [];
  const user = (process.env.SMTP_USER || process.env.EMAIL_USER || process.env.GMAIL_USER || "").trim();
  const pass = (process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");
  if (user && pass) {
    const host = (process.env.SMTP_HOST || "smtp.gmail.com").trim();
    const isH = host.toLowerCase().includes("hostinger") || user.toLowerCase().includes("quickuppaistudio.in");
    accounts.push({ label: isH ? "Hostinger SMTP" : "SMTP", host, user, pass });
  } else {
    missing.push("SMTP_USER / SMTP_PASS are not set in the Hostinger environment variables");
  }
  const hUser = (process.env.HOSTINGER_SMTP_USER || "").trim();
  const hPass = (process.env.HOSTINGER_SMTP_PASS || "").trim();
  if (hUser && hPass) {
    const hHost = (process.env.HOSTINGER_SMTP_HOST || "smtp.hostinger.com").trim();
    if (!accounts.some((a) => a.user.toLowerCase() === hUser.toLowerCase())) {
      accounts.push({ label: "Hostinger SMTP", host: hHost, user: hUser, pass: hPass });
    }
  }
  return { accounts, missing };
}

/** Sends the branded HTML email over SMTP. Each account is tried on port 465 (SSL), then 587 (STARTTLS). */
export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
  /** Set for images shown inside the email body (<img src="cid:...">). */
  cid?: string;
}

async function sendViaSmtp(mail: { to: string; subject: string; html: string; text: string; replyTo?: string | undefined; fromName: string; attachments?: MailAttachment[] | undefined; preferWebsiteMailbox?: boolean }) {
  const { accounts: all, missing } = smtpAccounts();
  // Always prioritize the official domain mailbox (info@quickuppaistudio.in via Hostinger SMTP)
  // so emails are sent reliably without personal Gmail security checkpoints.
  const accounts = [
    ...all.filter(isHostingerAccount),
    ...all.filter((a) => !isHostingerAccount(a)),
  ];
  const errors: string[] = [...missing];
  for (const acc of accounts) {
    for (const port of [465, 587]) {
      try {
        const isGmail = acc.host.includes("gmail") || acc.user.includes("@gmail.com");
        const transporter = nodemailer.createTransport(
          isGmail && port === 465
            ? {
                service: "gmail",
                auth: { user: acc.user, pass: acc.pass },
                connectionTimeout: 10000,
                greetingTimeout: 10000,
                socketTimeout: 15000,
                tls: { rejectUnauthorized: false },
              }
            : {
                host: acc.host,
                port,
                secure: port === 465,
                requireTLS: port === 587,
                auth: { user: acc.user, pass: acc.pass },
                connectionTimeout: 10000,
                greetingTimeout: 10000,
                socketTimeout: 15000,
                tls: { rejectUnauthorized: false },
              },
        );
        await transporter.sendMail({
          from: `"${mail.fromName}" <${acc.user}>`,
          to: mail.to,
          replyTo: mail.replyTo,
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
          ...(mail.attachments?.length ? { attachments: mail.attachments } : {}),
        });
        return { success: true as const, via: `${acc.host}:${port} (${acc.user})`, errors };
      } catch (e: any) {
        const msg = `${acc.host}:${port} (${acc.user}): ${e?.code ? e.code + " " : ""}${e?.message || e}`;
        errors.push(
          e?.code === "EAUTH"
            ? `${msg} — wrong email or password${acc.host.includes("gmail") ? " (Gmail needs a 16-letter App Password, not the normal password)" : ""}`
            : e?.code === "ETIMEDOUT" || e?.code === "ECONNECTION" || e?.code === "ESOCKET"
              ? `${msg} — the server could not reach the mail server on this port (blocked by the host?)`
              : msg,
        );
        if (e?.code === "EAUTH") break; // same password fails on the other port too
      }
    }
  }
  return { success: false as const, via: "", errors };
}

/** Optional HTTPS route (no SMTP ports needed): Resend, if RESEND_API_KEY is set. Sends the same branded HTML. */
async function sendViaResend(mail: { to: string; subject: string; html: string; text: string; replyTo?: string | undefined; from: string; attachments?: MailAttachment[] | undefined }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || mail.from,
        to: [mail.to],
        reply_to: mail.replyTo,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        ...(mail.attachments?.length ? { attachments: mail.attachments.map((a) => ({ filename: a.filename, content: a.content.toString("base64") })) } : {}),
      }),
    });
    if (res.ok) return { ok: true as const, error: "" };
    return { ok: false as const, error: `Resend: ${res.status} ${(await res.text()).slice(0, 200)}` };
  } catch (e: any) {
    return { ok: false as const, error: `Resend: ${e?.message || e}` };
  }
}

export async function sendLeadNotificationEmail(lead: LeadEmailPayload): Promise<{ success: boolean; via?: string; errors: string[]; error?: string }> {
  const timestamp = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  const subject = `New Lead: ${lead.name} - ${lead.videoType} (${lead.source})`;

  const cleanPhone = lead.phone.replace(/[^0-9+]/g, "");
  const waPhone = cleanPhone.startsWith("+") ? cleanPhone.replace("+", "") : cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

  const rows: [string, string][] = [
    ["Name", lead.name],
    ["Phone", `<a href="tel:${escapeHtml(cleanPhone)}" style="color:#111827;text-decoration:none">${escapeHtml(lead.phone)}</a>`],
    [
      "Email",
      lead.email
        ? `<a href="mailto:${escapeHtml(lead.email)}" style="color:#2563eb;text-decoration:none">${escapeHtml(lead.email)}</a>`
        : `<span style="color:#9ca3af;font-weight:400">Not provided</span>`,
    ],
    ["Service", lead.videoType],
    ["Business / Brand", lead.business],
  ];
  if (lead.industry) rows.push(["Industry", lead.industry]);
  if (lead.location) rows.push(["City / Location", lead.location]);
  if (lead.requirement) rows.push(["Requirement", lead.requirement]);
  if (lead.additional) rows.push(["Additional details", lead.additional]);
  rows.push(["Source", String(lead.source)], ["Received", `${timestamp} IST`]);

  const htmlContent = renderBrandedEmail({
    eyebrow: "New Lead",
    title: `${lead.name} is interested in ${lead.videoType}`,
    intro: "A new enquiry has been received and saved in the AI STUDIO INDIA CRM.",
    accent: "#7c3aed",
    rows,
    htmlRows: ["Phone", "Email"],
    buttons: [
      { label: "Reply on WhatsApp", href: `https://wa.me/${waPhone}`, color: "#16a34a" },
      { label: "Call Client", href: `tel:${cleanPhone}`, color: "#2563eb" },
      ...(lead.email ? [{ label: "Send Email", href: `mailto:${lead.email}`, color: "#374151" }] : []),
      { label: "Open CRM", href: `${SITE_URL}/crm`, color: "#7c3aed" },
    ],
  });

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

  // 1. Gmail SMTP (branded HTML email) — port 465, then 587
  const smtp = await sendViaSmtp({
    to: NOTIFICATION_EMAIL,
    subject,
    html: htmlContent,
    text: textContent,
    replyTo: lead.email || undefined,
    fromName: "Quickupp AI Studio",
  });
  if (smtp.success) return { success: true, via: smtp.via, errors: smtp.errors };
  const errors: string[] = [...smtp.errors];
  console.error("Lead email SMTP failed:", errors.join(" | "));

  // 2. Resend over HTTPS (only if RESEND_API_KEY is configured)
  const resend = await sendViaResend({ to: NOTIFICATION_EMAIL, subject, html: htmlContent, text: textContent, replyTo: lead.email || undefined, from: "Quickupp Leads <leads@quickuppaistudio.in>" });
  if (resend?.ok) return { success: true, via: "Resend", errors };
  if (resend) errors.push(resend.error);
  // No plain-text backup service: the lead is already saved in the CRM (and shows there as a
  // notification); the exact reason is recorded in Activity History so SMTP can be fixed.
  return { success: false, errors, error: errors.join(" | ") };
}


/** Security alert (failed CRM sign-ins, lockouts). Sent to the CRM alert address.
 *  Tries every SMTP account (port 465, then 587), then Resend if configured.
 *  Returns which route worked, or every error so it can be shown in the CRM. */
export async function sendSecurityAlertEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ success: boolean; via?: string; errors: string[] }> {
  const smtp = await sendViaSmtp({ ...opts, fromName: "Quickupp AI Studio CRM" });
  if (smtp.success) return { success: true, via: smtp.via, errors: smtp.errors };
  const errors: string[] = [...smtp.errors];

  const resend = await sendViaResend({ ...opts, from: "Quickupp CRM <crm@quickuppaistudio.in>" });
  if (resend?.ok) return { success: true, via: "Resend", errors };
  if (resend) errors.push(resend.error);
  return { success: false, errors };
}

/** PAID website order → the lead notification address (qsaistudio@gmail.com).
 *  Sent only after a successful payment: full, 50% advance, or the balance of an advance. */
export async function sendOrderNotificationEmail(o: {
  kind: "full" | "advance" | "balance";
  orderId: string;
  txnid: string;
  itemName: string;
  /** Paid in this payment. */
  amount: string;
  orderTotal: string;
  paidTotal: string;
  balanceDue?: string | undefined;
  name: string;
  email: string;
  phone: string;
  company?: string | undefined;
  notes?: string | undefined;
  paymentMode: string;
  paymentId: string;
  paidAt: string;
}): Promise<{ success: boolean; via?: string; errors: string[] }> {
  const cleanPhone = o.phone.replace(/[^0-9+]/g, "");
  const waPhone = cleanPhone.startsWith("+") ? cleanPhone.slice(1) : cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  const label = o.kind === "advance" ? "50% Advance Paid" : o.kind === "balance" ? "Fully Paid (Balance Received)" : "Full Payment";
  const rows: [string, string][] = [
    ["Package", o.itemName],
    ["Payment Type", label],
    [o.kind === "balance" ? "Balance Received" : "Amount Paid", o.amount],
    ["Order Total", o.orderTotal],
  ];
  if (o.kind !== "full") rows.push(["Total Paid", o.paidTotal]);
  if (o.balanceDue) rows.push(["Balance Pending", o.balanceDue]);
  rows.push(
    ["Payment Method", o.paymentMode],
    ["Payment ID", o.paymentId],
    ["Order ID", o.orderId],
    ["Transaction ID", o.txnid],
    ["Customer", o.name],
    ["Phone", o.phone],
    ["Email", o.email],
  );
  if (o.company) rows.push(["Company / Brand", o.company]);
  if (o.notes) rows.push(["Video brief", o.notes]);
  rows.push(["Paid On", o.paidAt]);
  const eyebrow = o.kind === "advance" ? "Advance Payment Received" : o.kind === "balance" ? "Balance Payment Received" : "Payment Received";
  const subject =
    o.kind === "advance"
      ? `Advance Paid: ${o.name} - ${o.itemName} (${o.amount} of ${o.orderTotal})`
      : o.kind === "balance"
        ? `Fully Paid: ${o.name} - ${o.itemName} (balance ${o.amount} received)`
        : `New Paid Order: ${o.name} - ${o.itemName} (${o.amount})`;
  const html = renderBrandedEmail({
    eyebrow,
    title:
      o.kind === "advance"
        ? `${o.name} paid a 50% advance for ${o.itemName}`
        : o.kind === "balance"
          ? `${o.name} paid the balance: order ${o.orderId} is fully paid`
          : `${o.name} paid for ${o.itemName}`,
    intro:
      o.kind === "advance"
        ? `The 50% advance is received. ${o.balanceDue ? `Balance pending: ${o.balanceDue}. ` : ""}See CRM > Orders & Payments > Balance Pending.`
        : o.kind === "balance"
          ? "The remaining balance is received and the order is now fully paid. The order row in CRM > Orders & Payments is updated."
          : "Payment is received in full. The order is in CRM > Orders & Payments.",
    accent: o.kind === "advance" ? "#d97706" : "#16a34a",
    rows,
    buttons: [
      { label: "Reply on WhatsApp", href: `https://wa.me/${waPhone}`, color: "#16a34a" },
      { label: "Call Customer", href: `tel:${cleanPhone}`, color: "#2563eb" },
      { label: "Open CRM", href: `${SITE_URL}/crm`, color: "#7c3aed" },
    ],
  });
  const text = [`Quickupp AI Studio - ${eyebrow}`, "", ...rows.map(([k, v]) => `${k}: ${v}`)].join("\n");
  const smtp = await sendViaSmtp({ to: NOTIFICATION_EMAIL, subject, html, text, replyTo: o.email, fromName: "Quickupp AI Studio" });
  if (smtp.success) return { success: true, via: smtp.via, errors: smtp.errors };
  const errors = [...smtp.errors];
  const resend = await sendViaResend({ to: NOTIFICATION_EMAIL, subject, html, text, replyTo: o.email, from: "Quickupp Orders <orders@quickuppaistudio.in>" });
  if (resend?.ok) return { success: true, via: "Resend", errors };
  if (resend) errors.push(resend.error);
  return { success: false, errors };
}


/** Customer payment confirmation with the PDF receipt attached. */
export async function sendPaymentReceiptEmail(o: {
  to: string;
  name: string;
  email: string;
  company?: string | undefined;
  billingAddress?: string | undefined;
  orderNumber: string;
  service: string;
  pack: string;
  delivery?: string | undefined;
  amount: string;
  method: string;
  transactionId: string;
  paymentDate: string;
  paymentTime: string;
  confirmationUrl: string;
  receiptUrl: string;
  /** "full" (default), "advance" (50% paid, balance due) or "balance" (rest of an advance). */
  plan?: "full" | "advance" | "balance" | undefined;
  planLabel?: string | undefined;
  orderTotal?: string | undefined;
  paidBefore?: string | undefined;
  paidTotal?: string | undefined;
  balanceDue?: string | undefined;
  payBalanceUrl?: string | undefined;
  parentOrderNumber?: string | undefined;
  discountPercent?: number | undefined;
  discountAmount?: string | undefined;
  couponCode?: string | undefined;
  originalAmount?: string | undefined;
  receipt?: MailAttachment | undefined;
}): Promise<{ success: boolean; via?: string; errors: string[] }> {
  const firstName = o.name.trim().split(/\s+/)[0] || "there";
  const subject =
    o.plan === "advance" && o.balanceDue
      ? `Advance Payment Confirmed — Quickupp AI Studio | Order #${o.orderNumber}`
      : o.plan === "balance"
        ? `Balance Payment Confirmed (Fully Paid) — Quickupp AI Studio | Order #${o.parentOrderNumber || o.orderNumber}`
        : `Payment Confirmed — Quickupp AI Studio | Order #${o.orderNumber}`;
  // Logo embedded inside the email (shows even when the email app blocks web images).
  let logo: MailAttachment | undefined;
  try {
    const { getCompanyLogoDarkBuffer } = await import("./receipt-assets");
    logo = {
      filename: "quickupp-ai-studio-logo.png",
      content: getCompanyLogoDarkBuffer(),
      contentType: "image/png",
      cid: EMAIL_LOGO_CID,
    };
  } catch (e) {
    console.error("Email logo not available", e);
  }
  const html = renderPaymentConfirmationEmail({
    ...o,
    firstName,
    logoSrc: logo ? `cid:${EMAIL_LOGO_CID}` : EMAIL_LOGO_DARK_URL,
  });
  // The HTTPS fallback (Resend) links the hosted logo instead of embedding it.
  const htmlLinkedLogo = renderPaymentConfirmationEmail({ ...o, firstName, logoSrc: EMAIL_LOGO_DARK_URL });
  const text = [
    `Hi ${firstName},`,
    "",
    "Thank you for choosing Quickupp AI Studio.",
    "We're pleased to confirm that your payment has been successfully received.",
    "",
    o.plan === "advance" && o.balanceDue
      ? `ADVANCE PAYMENT CONFIRMED - Status: ADVANCE PAID (50%) - Balance due: ${o.balanceDue}`
      : `PAYMENT CONFIRMED - Status: ${o.plan === "balance" ? "FULLY PAID" : "PAID"}`,
    "",
    "ORDER DETAILS",
    `Order / Invoice No.: ${o.orderNumber}`,
    `Service: ${o.service}`,
    `Package: ${o.pack}`,
    ...(o.delivery ? [`Delivery: ${o.delivery}`] : []),
    ...(o.plan === "advance"
      ? [`Order Total: ${o.orderTotal || o.amount}`, `Amount Paid (50% Advance): ${o.amount}`, `Balance Due: ${o.balanceDue || "-"}`]
      : o.plan === "balance"
        ? [
            `Order Total: ${o.orderTotal || o.amount}`,
            `Paid Earlier (50% Advance): ${o.paidBefore || "-"}`,
            `Amount Paid Now (Balance): ${o.amount}`,
            "Balance Due: Nil (Fully Paid)",
          ]
        : [`Amount Paid: ${o.amount}`]),
    `Payment Type: ${o.planLabel || "Full Payment"}`,
    `Payment Date: ${o.paymentDate}`,
    `Payment Time: ${o.paymentTime}`,
    `Payment Method: ${o.method}`,
    `Transaction ID: ${o.transactionId}`,
    "",
    "BILLING INFORMATION",
    `Name: ${o.name}`,
    `Email: ${o.email}`,
    ...(o.company ? [`Company: ${o.company}`] : []),
    ...(o.billingAddress ? [`Billing Address: ${o.billingAddress}`] : []),
    "",
    ...(o.plan === "advance" && o.balanceDue && o.payBalanceUrl
      ? ["BALANCE PENDING: " + o.balanceDue, `Pay the remaining balance: ${o.payBalanceUrl}`, ""]
      : []),
    "Your payment receipt/invoice is attached to this email as a PDF.",
    `Download payment receipt: ${o.receiptUrl}`,
    "",
    "WHAT HAPPENS NEXT?",
    "Our team will process your order and contact you with the next steps.",
    "If you purchased a video/creative service, please keep your order number handy when communicating with our team.",
    `Order Number: ${o.orderNumber}`,
    "",
    "If you have any questions, simply reply to this email or contact us at:",
    "Email: info@quickuppaistudio.in",
    "Website: quickuppaistudio.in",
    "",
    "Thank you for choosing Quickupp AI Studio.",
    "",
    "Best regards,",
    "Quickupp AI Studio",
    "AI-Powered Creative & Video Studio",
    "Operated by Quickupp Softech Private Limited",
  ].join("\n");
  const attachments = [...(logo ? [logo] : []), ...(o.receipt ? [o.receipt] : [])];
  const replyTo = process.env.SUPPORT_EMAIL || "info@quickuppaistudio.in";
  const smtp = await sendViaSmtp({ to: o.to, subject, html, text, replyTo, fromName: "Quickupp AI Studio", attachments, preferWebsiteMailbox: true });
  if (smtp.success) return { success: true, via: smtp.via, errors: smtp.errors };
  const errors = [...smtp.errors];
  const resend = await sendViaResend({ to: o.to, subject, html: htmlLinkedLogo, text, replyTo, from: "Quickupp AI Studio <orders@quickuppaistudio.in>", attachments: o.receipt ? [o.receipt] : undefined });
  if (resend?.ok) return { success: true, via: "Resend", errors };
  if (resend) errors.push(resend.error);
  return { success: false, errors };
}
