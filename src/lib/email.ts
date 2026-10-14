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

/** Gmail SMTP with automatic port fallback (465 SSL, then 587 STARTTLS). */
async function sendViaSmtp(mail: { to: string; subject: string; html: string; text: string; replyTo?: string | undefined; fromName: string }) {
  const errors: string[] = [];
  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER || process.env.GMAIL_USER || "quickuppaistudio1@gmail.com";
  const smtpPass = (process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.GMAIL_APP_PASSWORD || "ggtodbgiucfdypcj").replace(/\s+/g, "");
  for (const port of [465, 587]) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port,
        secure: port === 465,
        requireTLS: port === 587,
        auth: { user: smtpUser, pass: smtpPass },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      });
      await transporter.sendMail({
        from: `"${mail.fromName}" <${smtpUser}>`,
        to: mail.to,
        replyTo: mail.replyTo,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      });
      return { success: true as const, via: `Gmail SMTP ${port} (${smtpUser})`, errors };
    } catch (e: any) {
      errors.push(`SMTP ${port}: ${e?.code ? e.code + " " : ""}${e?.message || e}`);
      if (e?.code === "EAUTH" || /Invalid login|Username and Password not accepted/i.test(String(e?.message))) break;
    }
  }
  return { success: false as const, via: "", errors };
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
  if (smtp.success) return { success: true, via: smtp.via, errors: [] };
  const errors: string[] = [...smtp.errors];
  console.error("Lead email SMTP failed:", errors.join(" | "));

  // 2. Check for Resend API Key
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
          from: process.env.RESEND_FROM || "Quickupp Leads <leads@quickuppaistudio.in>",
          to: [NOTIFICATION_EMAIL],
          reply_to: lead.email || undefined,
          subject,
          html: htmlContent,
          text: textContent,
        }),
      });

      if (res.ok) {
        return { success: true, via: "Resend", errors };
      }
      errors.push(`Resend: ${res.status} ${await res.text()}`);
    } catch (resendErr: any) {
      errors.push(`Resend: ${resendErr?.message}`);
    }
  }

  // 3. Fallback HTTP delivery via FormSubmit AJAX to the lead notification address
  try {
    const response = await fetch(`https://formsubmit.co/ajax/${NOTIFICATION_EMAIL}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Origin": "https://quickuppaistudio.in",
        "Referer": "https://quickuppaistudio.in",
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

    const resData = await response.text();
    if (response.ok && !/"success":\s*"?false/i.test(resData)) {
      return { success: true, via: "FormSubmit backup (plain layout — Gmail SMTP failed)", errors };
    }
    errors.push(`FormSubmit: ${response.status} ${resData.slice(0, 200)}`);
    return { success: false, errors, error: errors.join(" | ") };
  } catch (httpErr: any) {
    errors.push(`FormSubmit: ${httpErr?.message}`);
    return { success: false, errors, error: errors.join(" | ") };
  }
}


/** Security alert (failed CRM sign-ins, lockouts). Sent to the CRM alert address.
 *  Tries Gmail SMTP on port 465, then 587 (some hosts block one of them), then Resend,
 *  then FormSubmit. Returns which route worked, or every error so it can be shown in the CRM. */
export async function sendSecurityAlertEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ success: boolean; via?: string; errors: string[] }> {
  const smtp = await sendViaSmtp({ ...opts, fromName: "Quickupp AI Studio CRM" });
  if (smtp.success) return { success: true, via: smtp.via, errors: [] };
  const errors: string[] = [...smtp.errors];

  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || "Quickupp CRM <crm@quickuppaistudio.in>",
          to: [opts.to],
          subject: opts.subject,
          html: opts.html,
          text: opts.text,
        }),
      });
      if (res.ok) return { success: true, via: "Resend", errors };
      errors.push(`Resend: ${res.status} ${await res.text()}`);
    } catch (e: any) {
      errors.push(`Resend: ${e?.message || e}`);
    }
  }

  // Last resort: FormSubmit (the first message to a new address asks that inbox to confirm once).
  try {
    const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(opts.to)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", Origin: "https://quickuppaistudio.in", Referer: "https://quickuppaistudio.in" },
      body: JSON.stringify({ _subject: opts.subject, _template: "box", message: opts.text }),
    });
    const body = await res.text();
    if (res.ok && !/"success":\s*"?false/i.test(body)) return { success: true, via: "FormSubmit", errors };
    errors.push(`FormSubmit: ${res.status} ${body.slice(0, 200)}`);
  } catch (e: any) {
    errors.push(`FormSubmit: ${e?.message || e}`);
  }
  return { success: false, errors };
}
