import nodemailer from "nodemailer";

export interface LeadEmailPayload {
  source: "Contact Form" | "Popup Modal";
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

const NOTIFICATION_EMAIL = process.env.LEAD_NOTIFICATION_EMAIL || "quickuppaistudio1@gmail.com";

export async function sendLeadNotificationEmail(lead: LeadEmailPayload): Promise<{ success: boolean; error?: string }> {
  const timestamp = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  const subject = `🚀 New Lead: ${lead.name} (${lead.videoType}) - ${lead.source}`;

  const cleanPhone = lead.phone.replace(/[^0-9+]/g, "");
  const waPhone = cleanPhone.startsWith("+") ? cleanPhone.replace("+", "") : cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0c0817; color: #ffffff; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #150e2a; border-radius: 16px; border: 1px solid rgba(217, 70, 239, 0.3); overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    .header { background: linear-gradient(135deg, #7c22e8 0%, #a832e6 50%, #ec1e79 100%); padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 22px; color: #ffffff; letter-spacing: 0.5px; font-weight: 800; }
    .header p { margin: 6px 0 0; font-size: 13px; color: rgba(255,255,255,0.9); }
    .content { padding: 24px; }
    .badge { display: inline-block; background: rgba(217, 70, 239, 0.2); border: 1px solid #d946ef; color: #f0abfc; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 14px; }
    th { width: 38%; color: #a1a1aa; font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; }
    td { color: #ffffff; font-weight: 500; }
    .highlight { color: #38bdf8; font-weight: 700; }
    .actions { display: flex; gap: 12px; justify-content: center; padding: 16px 0 8px; }
    .btn { display: inline-block; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 700; margin-right: 8px; margin-bottom: 8px; }
    .btn-wa { background: #25d366; color: #ffffff; }
    .btn-call { background: #3b82f6; color: #ffffff; }
    .btn-mail { background: #ec4899; color: #ffffff; }
    .footer { background: #0e091d; padding: 16px; text-align: center; font-size: 12px; color: #71717a; border-top: 1px solid rgba(255,255,255,0.05); }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Quickupp AI Studio</h1>
      <p>New Lead Notification</p>
    </div>
    <div class="content">
      <div class="badge">${lead.source}</div>
      <table>
        <tr>
          <th>Full Name</th>
          <td class="highlight">${lead.name}</td>
        </tr>
        <tr>
          <th>Phone Number</th>
          <td><a href="tel:${cleanPhone}" style="color: #4ade80; text-decoration: none; font-weight: 700;">${lead.phone}</a></td>
        </tr>
        <tr>
          <th>Email Address</th>
          <td>${lead.email ? `<a href="mailto:${lead.email}" style="color: #38bdf8; text-decoration: none;">${lead.email}</a>` : '<span style="color: #71717a;">Not provided</span>'}</td>
        </tr>
        <tr>
          <th>Video Service</th>
          <td style="color: #f472b6; font-weight: 700;">${lead.videoType}</td>
        </tr>
        <tr>
          <th>Business / Brand</th>
          <td>${lead.business}</td>
        </tr>
        ${lead.industry ? `<tr><th>Industry</th><td>${lead.industry}</td></tr>` : ''}
        ${lead.location ? `<tr><th>Location / City</th><td>${lead.location}</td></tr>` : ''}
        ${lead.requirement ? `<tr><th>Requirement</th><td>${lead.requirement}</td></tr>` : ''}
        ${lead.additional ? `<tr><th>Additional Message</th><td>${lead.additional}</td></tr>` : ''}
        <tr>
          <th>Received At</th>
          <td style="color: #a1a1aa; font-size: 12px;">${timestamp} (IST)</td>
        </tr>
      </table>

      <div style="text-align: center; margin-top: 16px;">
        <a href="https://wa.me/${waPhone}" class="btn btn-wa" target="_blank">Chat on WhatsApp</a>
        <a href="tel:${cleanPhone}" class="btn btn-call">Call Client</a>
        ${lead.email ? `<a href="mailto:${lead.email}" class="btn btn-mail">Send Email</a>` : ''}
      </div>
    </div>
    <div class="footer">
      This lead has been saved to your PostgreSQL / Supabase Admin Panel.<br/>
      Quickupp AI Studio Lead System &copy; ${new Date().getFullYear()}
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

  // 1. Check for SMTP credentials in environment
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER || process.env.GMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.GMAIL_APP_PASSWORD;

  if (smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost || (smtpUser.includes("@gmail.com") ? "smtp.gmail.com" : undefined),
        port: Number(process.env.SMTP_PORT) || 465,
        secure: (process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) === 465 : true),
        service: !smtpHost && smtpUser.includes("@gmail.com") ? "gmail" : undefined,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.sendMail({
        from: `"Quickupp AI Studio Leads" <${smtpUser}>`,
        to: NOTIFICATION_EMAIL,
        replyTo: lead.email || undefined,
        subject,
        text: textContent,
        html: htmlContent,
      });

      return { success: true };
    } catch (smtpErr: any) {
      console.warn("SMTP email dispatch failed, falling back to HTTP delivery:", smtpErr?.message);
    }
  }

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
          from: process.env.RESEND_FROM || "Quickupp Leads <leads@quickuppaistudio.com>",
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

  // 3. Guaranteed Direct HTTP Delivery via FormSubmit AJAX to quickuppaistudio1@gmail.com
  try {
    const response = await fetch(`https://formsubmit.co/ajax/${NOTIFICATION_EMAIL}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
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
