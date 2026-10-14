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

interface SmtpAccount {
  label: string;
  host: string;
  user: string;
  pass: string;
}

/** SMTP accounts tried in order. Nothing is hard-coded: the passwords live only in the
 *  Hostinger environment variables.
 *   1. SMTP_HOST / SMTP_USER / SMTP_PASS          (Gmail: qsaistudio@gmail.com + app password)
 *   2. HOSTINGER_SMTP_USER / HOSTINGER_SMTP_PASS  (Hostinger mailbox, e.g. info@quickuppaistudio.in) */
function smtpAccounts(): { accounts: SmtpAccount[]; missing: string[] } {
  const accounts: SmtpAccount[] = [];
  const missing: string[] = [];
  const user = (process.env.SMTP_USER || process.env.EMAIL_USER || process.env.GMAIL_USER || "").trim();
  const pass = (process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");
  if (user && pass) accounts.push({ label: "SMTP", host: (process.env.SMTP_HOST || "smtp.gmail.com").trim(), user, pass });
  else missing.push("SMTP_USER / SMTP_PASS are not set in the Hostinger environment variables");
  const hUser = (process.env.HOSTINGER_SMTP_USER || "").trim();
  const hPass = (process.env.HOSTINGER_SMTP_PASS || "").trim();
  if (hUser && hPass) accounts.push({ label: "Hostinger SMTP", host: (process.env.HOSTINGER_SMTP_HOST || "smtp.hostinger.com").trim(), user: hUser, pass: hPass });
  return { accounts, missing };
}

/** Sends the branded HTML email over SMTP. Each account is tried on port 465 (SSL), then 587 (STARTTLS). */
export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

async function sendViaSmtp(mail: { to: string; subject: string; html: string; text: string; replyTo?: string | undefined; fromName: string; attachments?: MailAttachment[] | undefined }) {
  const { accounts, missing } = smtpAccounts();
  const errors: string[] = [...missing];
  for (const acc of accounts) {
    for (const port of [465, 587]) {
      try {
        const transporter = nodemailer.createTransport({
          host: acc.host,
          port,
          secure: port === 465,
          requireTLS: port === 587,
          auth: { user: acc.user, pass: acc.pass },
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 15000,
        });
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

/** New website order (checkout) → the lead notification address. */
export async function sendOrderNotificationEmail(o: {
  orderId: string;
  txnid: string;
  itemName: string;
  amount: string;
  name: string;
  email: string;
  phone: string;
  company?: string | undefined;
  notes?: string | undefined;
  paymentMode: string;
}): Promise<{ success: boolean; via?: string; errors: string[] }> {
  const when = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) + " IST";
  const cleanPhone = o.phone.replace(/[^0-9+]/g, "");
  const waPhone = cleanPhone.startsWith("+") ? cleanPhone.slice(1) : cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  const rows: [string, string][] = [
    ["Package", o.itemName],
    ["Amount", o.amount],
    ["Payment", o.paymentMode],
    ["Order ID", o.orderId],
    ["Transaction ID", o.txnid],
    ["Customer", o.name],
    ["Phone", o.phone],
    ["Email", o.email],
  ];
  if (o.company) rows.push(["Company / Brand", o.company]);
  if (o.notes) rows.push(["Video brief", o.notes]);
  rows.push(["Placed", when]);
  const subject = `New Order: ${o.name} - ${o.itemName} (${o.amount})`;
  const html = renderBrandedEmail({
    eyebrow: "New Order",
    title: `${o.name} ordered ${o.itemName}`,
    intro: "A customer placed an order from the website checkout. It is saved in CRM > Orders & Payments.",
    accent: "#7c3aed",
    rows,
    buttons: [
      { label: "Reply on WhatsApp", href: `https://wa.me/${waPhone}`, color: "#16a34a" },
      { label: "Call Customer", href: `tel:${cleanPhone}`, color: "#2563eb" },
      { label: "Open CRM", href: `${SITE_URL}/crm`, color: "#7c3aed" },
    ],
  });
  const text = ["Quickupp AI Studio - New Order", "", ...rows.map(([k, v]) => `${k}: ${v}`)].join("\n");
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
  orderNumber: string;
  service: string;
  pack: string;
  amount: string;
  method: string;
  transactionId: string;
  paidAt: string;
  confirmationUrl: string;
  receipt?: MailAttachment | undefined;
}): Promise<{ success: boolean; via?: string; errors: string[] }> {
  const rows: [string, string][] = [
    ["Order Number", o.orderNumber],
    ["Service", o.service],
    ["Package", o.pack],
    ["Amount Paid", o.amount],
    ["Payment Method", o.method],
    ["Transaction ID", o.transactionId],
    ["Paid On", o.paidAt],
    ["Status", "PAID"],
  ];
  const subject = `Payment Confirmed - Order ${o.orderNumber} | Quickupp AI Studio`;
  const html = renderBrandedEmail({
    eyebrow: "Payment Confirmed",
    title: `Thank you for your order, ${o.name.split(" ")[0]}`,
    intro: "Your payment has been received successfully and your order is now confirmed. Your PDF receipt is attached to this email.",
    accent: "#16a34a",
    rows,
    buttons: [
      { label: "View Order Confirmation", href: o.confirmationUrl, color: "#7c3aed" },
      { label: "Chat on WhatsApp", href: "https://wa.me/918055679162", color: "#16a34a" },
    ],
    note: "What's next: our team will review your order and contact you with the next steps. Need help? Reply to this email or write to info@quickuppaistudio.in.",
  });
  const text = [
    "Quickupp AI Studio - Payment Confirmed",
    "",
    `Hi ${o.name},`,
    "Your payment has been received successfully and your order is now confirmed.",
    "",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    "",
    "What's next: our team will review your order and contact you with the next steps.",
    "Need help? info@quickuppaistudio.in",
  ].join("\n");
  const attachments = o.receipt ? [o.receipt] : undefined;
  const replyTo = process.env.SUPPORT_EMAIL || "info@quickuppaistudio.in";
  const smtp = await sendViaSmtp({ to: o.to, subject, html, text, replyTo, fromName: "Quickupp AI Studio", attachments });
  if (smtp.success) return { success: true, via: smtp.via, errors: smtp.errors };
  const errors = [...smtp.errors];
  const resend = await sendViaResend({ to: o.to, subject, html, text, replyTo, from: "Quickupp AI Studio <orders@quickuppaistudio.in>", attachments });
  if (resend?.ok) return { success: true, via: "Resend", errors };
  if (resend) errors.push(resend.error);
  return { success: false, errors };
}
