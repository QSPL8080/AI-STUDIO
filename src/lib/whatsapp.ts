// Server-only: new-lead alerts on WhatsApp (in addition to the email to qsaistudio@gmail.com).
//
// HOW TO SWITCH IT ON — add these in Hostinger → Environment variables, then Redeploy:
//
//   Option A (recommended) — Meta WhatsApp Cloud API (official):
//     WHATSAPP_TOKEN            = permanent access token (Meta Business → System user)
//     WHATSAPP_PHONE_NUMBER_ID  = the sender number's "Phone number ID" (WhatsApp Manager)
//     WHATSAPP_TEMPLATE         = approved template name (default: new_lead_alert)
//     WHATSAPP_TEMPLATE_LANG    = template language code (default: en)
//
//   Option B (free, personal use) — CallMeBot:
//     CALLMEBOT_APIKEY          = the key the CallMeBot bot sends you
//
//   Who receives the alerts (default +91 80556 79162; several numbers can be comma-separated):
//     LEAD_WHATSAPP_TO          = 918055679162
//
// Nothing set = WhatsApp alerts are simply skipped (the email still goes out).

export interface LeadWhatsAppPayload {
  source: string;
  name: string;
  phone: string;
  email?: string | undefined;
  videoType: string;
  business: string;
  industry?: string | undefined;
  location?: string | undefined;
  requirement?: string | undefined;
  /** CRM lead id: used for the "View Lead in CRM" link. */
  leadId?: string | undefined;
}

const SITE_URL = (process.env.PUBLIC_SITE_URL || "https://quickuppaistudio.in").replace(/\/+$/, "");

function recipients() {
  return (process.env.LEAD_WHATSAPP_TO || "918055679162")
    .split(",")
    .map((n) => n.replace(/[^\d]/g, ""))
    .map((n) => (n.length === 10 ? `91${n}` : n))
    .filter((n) => n.length >= 11);
}

const one = (v: unknown, max = 200) =>
  String(v ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, max);

function receivedAt() {
  return (
    new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).replace(/\b(am|pm)\b/i, (m) => m.toUpperCase()) + " IST"
  );
}

/** Opens this lead's details in the CRM (after sign-in if needed). */
export function crmLeadLink(leadId?: string) {
  return leadId ? `${SITE_URL}/crm?lead=${encodeURIComponent(leadId)}` : `${SITE_URL}/crm`;
}

function waLink(phone: string) {
  const d = phone.replace(/[^\d]/g, "");
  return d.length === 10 ? `https://wa.me/91${d}` : d.length >= 11 ? `https://wa.me/${d}` : "";
}

/** The structured alert text (used as-is by CallMeBot, which can only send plain text). */
export function buildLeadWhatsAppText(l: LeadWhatsAppPayload) {
  const row = (label: string, value: string) => `*${label}:* ${value}`;
  const chat = waLink(l.phone);
  const lines = [
    "*QUICKUPP AI STUDIO*",
    "_New Lead Alert_",
    "",
    "*LEAD DETAILS*",
    row("Name", one(l.name)),
    row("Phone", one(l.phone, 40)),
    row("Email", one(l.email) || "Not provided"),
    "",
    "*REQUIREMENT*",
    row("Service", one(l.videoType)),
    row("Business", one(l.business) || "Not provided"),
    ...(l.industry ? [row("Industry", one(l.industry))] : []),
    ...(l.location ? [row("Location", one(l.location))] : []),
    ...(l.requirement ? [row("Details", one(l.requirement, 300))] : []),
    "",
    "*LEAD INFO*",
    row("Source", one(l.source)),
    row("Received", receivedAt()),
    "",
    "*QUICK LINKS*",
    `View lead in CRM: ${crmLeadLink(l.leadId)}`,
    ...(chat ? [`Chat with lead: ${chat}`] : []),
    `Website: ${SITE_URL}`,
    "",
    "_Quickupp AI Studio | AI Video Production_",
  ];
  return lines.join("\n");
}

async function sendViaMetaCloud(to: string, l: LeadWhatsAppPayload) {
  const token = (process.env.WHATSAPP_TOKEN || "").trim();
  const phoneId = (process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();
  const version = (process.env.WHATSAPP_API_VERSION || "v21.0").trim();
  const template = (process.env.WHATSAPP_TEMPLATE || "new_lead_alert").trim();
  const lang = (process.env.WHATSAPP_TEMPLATE_LANG || "en").trim();
  // Template variables {{1}}..{{7}} (WhatsApp does not allow line breaks inside a variable).
  const params = [
    one(l.name, 120) || "-",
    one(l.phone, 40) || "-",
    one(l.email, 120) || "Not provided",
    one(l.videoType, 120) || "-",
    one(l.business, 120) || "-",
    one(l.source, 120) || "-",
    receivedAt(),
  ].map((text) => ({ type: "text", text }));
  // Template layout (see the setup notes): IMAGE header (logo banner) + body {{1}}..{{7}}
  // + footer + 2 URL buttons: [0] "View Lead in CRM" (dynamic, ?lead={{1}}), [1] "Visit Website" (static).
  const headerImage = (process.env.WHATSAPP_HEADER_IMAGE || `${SITE_URL}/images/whatsapp-lead-header.jpg`).trim();
  const components: any[] = [
    { type: "header", parameters: [{ type: "image", image: { link: headerImage } }] },
    { type: "body", parameters: params },
    {
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: encodeURIComponent(l.leadId || "latest") }],
    },
  ];
  const res = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: { name: template, language: { code: lang }, components },
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const body: any = await res.json().catch(() => ({}));
    throw new Error(`Meta WhatsApp ${res.status}: ${body?.error?.message || res.statusText}`);
  }
}

async function sendViaCallMeBot(to: string, text: string) {
  const apikey = (process.env.CALLMEBOT_APIKEY || "").trim();
  const url = `https://api.callmebot.com/whatsapp.php?${new URLSearchParams({ phone: `+${to}`, text, apikey }).toString()}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  const body = await res.text().catch(() => "");
  if (!res.ok || /error|invalid|not\s+allowed/i.test(body.slice(0, 400)))
    throw new Error(`CallMeBot ${res.status}: ${body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 200)}`);
}

/**
 * Sends the new-lead alert to every LEAD_WHATSAPP_TO number.
 * Returns configured=false when no WhatsApp service is set up (nothing is sent).
 */
export async function sendLeadWhatsApp(
  l: LeadWhatsAppPayload,
): Promise<{ configured: boolean; success: boolean; via?: string; errors: string[] }> {
  const hasMeta = !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
  const hasCallMeBot = !!process.env.CALLMEBOT_APIKEY;
  if (!hasMeta && !hasCallMeBot) return { configured: false, success: false, errors: [] };

  const errors: string[] = [];
  let sent = 0;
  let via = "";
  const text = buildLeadWhatsAppText(l);
  for (const to of recipients()) {
    let ok = false;
    if (hasMeta) {
      try {
        await sendViaMetaCloud(to, l);
        ok = true;
        via = "Meta WhatsApp Cloud API";
      } catch (e: any) {
        errors.push(`${to}: ${e?.message || e}`);
      }
    }
    if (!ok && hasCallMeBot) {
      try {
        await sendViaCallMeBot(to, text);
        ok = true;
        via = via || "CallMeBot";
      } catch (e: any) {
        errors.push(`${to}: ${e?.message || e}`);
      }
    }
    if (ok) sent++;
  }
  return { configured: true, success: sent > 0, via, errors };
}

/** Sends the alert and records the result in CRM → Activity History. Never throws. */
export async function notifyLeadOnWhatsApp(l: LeadWhatsAppPayload, opts: { leadId?: string; actorEmail?: string } = {}) {
  try {
    const r = await sendLeadWhatsApp({ ...l, leadId: l.leadId || opts.leadId });
    if (!r.configured) return; // not set up yet: stay quiet
    const { logActivity } = await import("./crm-db");
    await logActivity({
      title: r.success ? "New-lead WhatsApp sent" : "New-lead WhatsApp FAILED",
      category: "LEADS",
      actorEmail: opts.actorEmail || "website",
      description: (r.success
        ? `Lead ${l.name}: WhatsApp alert sent via ${r.via}.${r.errors.length ? ` Issues: ${r.errors.join(" | ")}` : ""}`
        : `Lead ${l.name} is saved in the CRM, but the WhatsApp alert failed: ${r.errors.join(" | ")}`
      ).slice(0, 1200),
      ...(opts.leadId ? { leadId: opts.leadId } : {}),
    });
  } catch (e) {
    console.error("WhatsApp lead alert failed", e);
  }
}
