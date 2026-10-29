// Server-only: Admin / Super Admin generated customer payment links.
//
// An Admin or Super Admin enters the customer, the video service + quantity (the same list as
// the website checkout) and a custom order total. The customer opens a simple secure page and
// chooses Full Payment or Partial Payment (the website's existing 50% advance rule), then pays
// through the existing PayU integration.
//
// Design (additive — the website checkout is not changed):
//   • The order is a normal ind_orders row (same columns, numbering and raw_details shape as a
//     website order, plus source = "payment_link"). So it shows in CRM → Orders & Payments, and
//     receipts, emails, the PayU callback / webhook / status checks and the 50% balance flow
//     all work exactly as they do for website orders.
//   • crm_payment_links tracks the link itself: who generated it, when it expires (24 hours),
//     when it was used, and which lead it belongs to.
//   • The amount charged is always worked out on the server from the stored custom total and
//     the customer's Full / Partial choice. Nothing the browser sends can change it, and no
//     coupon is accepted on this flow.
//   • Only one PayU attempt per link is live at a time. Before a retry replaces an unfinished
//     attempt, PayU is asked about it; a payment that already went through (or is still
//     confirming at the bank) blocks the retry, so the customer is never charged twice.
//   • The order row only moves to COMPLETED through the existing verified PayU path, whose
//     conditional update makes that happen exactly once — that is what "uses up" the link.
import { CrmAuthError, requireSession, type SessionContext } from "./crm-server-auth";
import { dbDelete, dbInsert, dbSelect, dbUpdate, logActivity } from "./crm-db";
import { LEADS_TABLE, ORDERS_TABLE } from "./db-tables";
import {
  formatInr,
  getIndiaService,
  INDIA_PACKS,
  isPackQty,
  quoteItem,
  splitPayment,
  TWIN_SETUP_ID,
  type PaymentPlan,
} from "./india-pricing";
import { paymentSummary } from "./payment-plan";
import { buildPayUForm, getPayUConfig, siteUrl, verifyPayUResponse } from "./payu";
import {
  checkPayUAttempt,
  confirmationPath,
  nextOrderNumber,
  orderView,
  payBalancePath,
  receiptPath,
  sendReceipt,
} from "./checkout-server";
import {
  newPaymentLinkId,
  PAYMENT_LINK_VALIDITY_MS,
  paymentLinkUrl,
  readPaymentLinkToken,
} from "./payment-link-token";

const LINKS = "crm_payment_links";
const AWAITING = "LINK_AWAITING_CUSTOMER";
/** A new attempt may not replace one started less than this long ago (unless PayU says it failed). */
const RETRY_COOLDOWN_SEC = 60;
const MAX_AMOUNT = 10_000_000; // ₹1 crore (ind_orders.amount is NUMERIC(10,2))

export type LinkStatus = "ACTIVE" | "PAYMENT_PENDING" | "USED" | "EXPIRED" | "CANCELLED";
export type LinkLeadSource = "Manual" | "Meta";

const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => {
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? round2(n) : 0;
};
const clean = (v: unknown, max: number) =>
  String(v ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : "");
const last10 = (phone: unknown) =>
  String(phone || "")
    .replace(/[^\d]/g, "")
    .slice(-10);

function details(row: any): any {
  try {
    return JSON.parse(row?.raw_details || "{}");
  } catch {
    return {};
  }
}

/** The order total that this link charges, split by the website's partial-payment rule. */
export function splitLinkAmount(total: number, plan: PaymentPlan) {
  const s = splitPayment(total, plan);
  return { plan: s.plan, payNow: round2(s.payNow), balance: round2(total - s.payNow) };
}

async function requireLinkAdmin(token: string): Promise<SessionContext> {
  const ctx = await requireSession(token);
  if (ctx.user.role !== "SUPER_ADMIN" && ctx.user.role !== "ADMIN")
    throw new CrmAuthError("FORBIDDEN", "Only Admin and Super Admin can manage payment links.");
  return ctx;
}

async function ensureLinksTable() {
  try {
    await dbSelect(LINKS, { columns: ["id"], limit: 1 });
  } catch (e) {
    console.error("crm_payment_links not available", e);
    throw new Error(
      "Payment links are not set up in the database yet: run the new 'payment links' part of supabase-update.sql in Supabase → SQL Editor, then try again.",
    );
  }
}

async function orderById(id: string) {
  return (
    ((await dbSelect(ORDERS_TABLE, { filters: [{ col: "id", op: "eq", value: id }] }))[0] as any) ||
    null
  );
}
async function linkById(id: string) {
  return (
    ((await dbSelect(LINKS, { filters: [{ col: "id", op: "eq", value: id }] }))[0] as any) || null
  );
}

const inProgress = (o: any) =>
  !!o && o.payment_status === "PENDING" && String(o.paypal_status || "").startsWith("PAYU_");
const isPaid = (o: any) =>
  !!o && (o.payment_status === "COMPLETED" || o.payment_status === "REFUNDED");

/** The link's real status, worked out from the link row and its order (always current). */
export function effectiveLinkStatus(link: any, order: any, now = Date.now()): LinkStatus {
  if (isPaid(order)) return "USED";
  if (link.status === "CANCELLED" || !order) return "CANCELLED";
  if (link.used_at) return "USED";
  if (inProgress(order)) return "PAYMENT_PENDING"; // started before expiry: still honoured
  if (now >= new Date(link.expires_at).getTime()) return "EXPIRED";
  return "ACTIVE";
}

function paymentStatusLabel(order: any) {
  if (!order) return "Not Paid";
  if (order.payment_status === "REFUNDED") return "Refunded";
  if (order.payment_status === "COMPLETED")
    return paymentSummary(order).balanceDue > 0 ? "Partially Paid" : "Fully Paid";
  if (inProgress(order)) return "Payment Pending";
  return "Not Paid";
}

/** Every successful (and in-progress) payment on a link order: the first payment + balance payments. */
function transactionsFor(order: any, children: any[]) {
  if (!order) return [];
  const total = paymentSummary(order).orderTotal;
  const rows = [order, ...children]
    .filter((r) => isPaid(r) || inProgress(r))
    .map((r) => ({ r, v: orderView(r), d: details(r) }))
    .sort((a, b) =>
      String(a.v.paidAt || a.r.created_at).localeCompare(String(b.v.paidAt || b.r.created_at)),
    );
  let cumulative = 0;
  return rows.map(({ r, v, d }) => {
    const paid = isPaid(r);
    if (paid) cumulative = round2(cumulative + Number(r.amount));
    const plan =
      d.paymentPlan === "balance" ? "balance" : d.paymentPlan === "advance" ? "advance" : "full";
    return {
      rowId: String(r.id),
      orderId: String(order.id),
      txnid: String(r.paypal_order_id),
      kind: plan === "balance" ? ("balance" as const) : ("initial" as const),
      planLabel:
        plan === "balance"
          ? "Balance payment"
          : plan === "advance"
            ? "Partial payment (50% advance)"
            : "Full payment",
      orderTotal: total,
      amount: Number(r.amount),
      cumulativePaid: paid ? cumulative : null,
      remaining: paid ? Math.max(0, round2(total - cumulative)) : null,
      status: paid ? (r.payment_status === "REFUNDED" ? "Refunded" : "Paid") : "Pending",
      method: paid ? `PayU / ${v.method}` : "PayU",
      payuRef: String(d.payu?.mihpayid || r.paypal_capture_id || ""),
      bankRef: String(d.payu?.bank_ref_num || ""),
      paidAt: v.paidAt,
      receiptUrl: paid ? `${siteUrl()}${receiptPath(String(r.paypal_order_id))}` : "",
      receiptEmail: (d.receiptEmail as string) || (paid ? "not sent" : ""),
    };
  });
}

function mapLink(link: any, order: any, children: any[] = []) {
  const status = effectiveLinkStatus(link, order);
  const ps = order ? paymentSummary(order) : null;
  const paid = isPaid(order);
  const d = details(order);
  const svc = link.service_id === TWIN_SETUP_ID ? null : getIndiaService(link.service_id);
  const total = num(link.total_amount);
  return {
    id: String(link.id),
    url: status === "ACTIVE" || status === "PAYMENT_PENDING" ? paymentLinkUrl(String(link.id)) : "",
    leadId: String(link.lead_id),
    leadSource: String(link.lead_source) as LinkLeadSource,
    orderId: String(link.order_id),
    orderStatus: String(order?.payment_status || "DELETED"),
    customerName: String(link.customer_name),
    customerEmail: String(link.customer_email),
    customerPhone: String(link.customer_phone),
    customerCompany: String(link.customer_company || ""),
    serviceId: String(link.service_id),
    serviceName:
      svc?.name ||
      (link.service_id === TWIN_SETUP_ID ? "AI Digital Twin Setup" : String(link.item_name)),
    qty: Number(link.qty),
    itemName: String(link.item_name),
    totalAmount: total,
    createdById: String(link.created_by_id || ""),
    createdByName: String(link.created_by_name || ""),
    createdByEmail: String(link.created_by_email || ""),
    createdAt: iso(link.created_at),
    expiresAt: iso(link.expires_at),
    usedAt: iso(link.used_at) || (paid ? iso(d.paidAt || order.updated_at) : ""),
    cancelledAt: iso(link.cancelled_at),
    cancelledBy: String(link.cancelled_by || ""),
    status,
    /** Can still be edited: active and the customer hasn't started paying. */
    editable:
      status === "ACTIVE" &&
      !!order &&
      order.payment_status === "PENDING" &&
      order.paypal_status === AWAITING &&
      !(Array.isArray(d.previousAttempts) && d.previousAttempts.length),
    paymentStatus: paymentStatusLabel(order),
    paidPlan: paid ? (ps!.plan === "advance" ? "advance" : "full") : "",
    paidTotal: paid ? ps!.paidTotal : 0,
    balanceDue: paid ? ps!.balanceDue : total,
    payBalanceUrl:
      order && paid && ps!.plan === "advance" && ps!.balanceDue > 0
        ? `${siteUrl()}${payBalancePath(String(order.paypal_order_id))}`
        : "",
    transactions: transactionsFor(order, children),
  };
}
export type PaymentLinkView = ReturnType<typeof mapLink>;

async function loadOrdersFor(links: any[]) {
  const ids = new Set(links.map((l) => String(l.order_id)));
  if (!ids.size) return { byId: new Map<string, any>(), children: new Map<string, any[]>() };
  // Balance payments are separate rows named <order>-B<n>, so the order list is read once.
  const rows = await dbSelect<any>(ORDERS_TABLE, {});
  const byId = new Map<string, any>();
  const children = new Map<string, any[]>();
  for (const r of rows) {
    const id = String(r.id);
    if (ids.has(id)) byId.set(id, r);
    const m = /^(.*)-B\d+$/.exec(id);
    if (m && ids.has(m[1]!)) children.set(m[1]!, [...(children.get(m[1]!) || []), r]);
  }
  return { byId, children };
}

/** Closes expired links (and their never-started orders) so they stop showing as pending. */
export async function sweepExpiredPaymentLinks() {
  let rows: any[] = [];
  try {
    rows = await dbSelect(LINKS, {
      filters: [{ col: "status", op: "in", value: ["ACTIVE", "PAYMENT_PENDING"] }],
    });
  } catch {
    return 0; // table not set up yet
  }
  let n = 0;
  const now = Date.now();
  for (const link of rows.filter((l) => new Date(l.expires_at).getTime() <= now)) {
    const order = await orderById(String(link.order_id));
    if (isPaid(order) || inProgress(order)) continue; // paid, or a payment started before expiry
    if (order && order.payment_status === "PENDING" && order.paypal_status === AWAITING) {
      await dbUpdate(
        ORDERS_TABLE,
        [
          { col: "id", op: "eq", value: order.id },
          { col: "payment_status", op: "eq", value: "PENDING" },
          { col: "paypal_status", op: "eq", value: AWAITING },
        ],
        {
          payment_status: "CANCELLED",
          paypal_status: "LINK_EXPIRED",
          updated_at: new Date().toISOString(),
        },
      );
    }
    const done = await dbUpdate(
      LINKS,
      [
        { col: "id", op: "eq", value: link.id },
        { col: "status", op: "eq", value: link.status },
      ],
      { status: "EXPIRED", updated_at: new Date().toISOString() },
    );
    if (done.length) {
      n++;
      await logActivity({
        title: "Payment link expired",
        category: "ORDERS",
        actorEmail: "system",
        description: `Payment link for ${link.customer_name} (${formatInr(num(link.total_amount))}, order ${link.order_id}) expired unpaid 24 hours after it was generated.`,
        leadId: String(link.lead_id),
      });
    }
  }
  return n;
}

/** Payment-link money per lead (for the lead table, lead popup and Edit Lead). Read from the
 *  real PayU orders, never copied into the lead's manual payment fields (no double counting). */
export type LeadLinkPayment = {
  count: number;
  total: number;
  paid: number;
  due: number;
  status: "Fully Paid" | "Partially Paid" | "Payment Pending" | "Not Paid";
  orderIds: string[];
};
export function linkPaymentsByLead(orderRows: any[]) {
  const out = new Map<string, LeadLinkPayment>();
  const now = Date.now();
  for (const r of orderRows) {
    const d = details(r);
    if (d.source !== "payment_link" || !d.leadId) continue; // balance rows are counted on their order
    const paid = isPaid(r);
    const busy = inProgress(r);
    const stillOpen =
      r.payment_status === "PENDING" ||
      (r.payment_status === "FAILED" &&
        (!d.linkExpiresAt || now < new Date(d.linkExpiresAt).getTime()));
    if (!paid && !busy && !stillOpen) continue; // expired / cancelled / deleted unpaid links
    const ps = paymentSummary(r);
    const total = ps.orderTotal;
    const got = paid ? ps.paidTotal : 0;
    const cur = out.get(String(d.leadId)) || {
      count: 0,
      total: 0,
      paid: 0,
      due: 0,
      status: "Not Paid" as LeadLinkPayment["status"],
      orderIds: [] as string[],
    };
    cur.count++;
    cur.total = round2(cur.total + total);
    cur.paid = round2(cur.paid + got);
    cur.due = round2(cur.due + Math.max(0, total - got));
    cur.orderIds.push(String(r.id));
    if (busy) cur.status = "Payment Pending";
    out.set(String(d.leadId), cur);
  }
  for (const v of out.values()) {
    if (v.paid > 0 && v.due <= 0) v.status = "Fully Paid";
    else if (v.paid > 0) v.status = "Partially Paid";
    else if (v.status !== "Payment Pending") v.status = "Not Paid";
  }
  return out;
}

// ---------------------------------------------------------------------------
// CRM (Admin / Super Admin)
// ---------------------------------------------------------------------------
export interface CreatePaymentLinkInput {
  leadSource: LinkLeadSource;
  name: string;
  email: string;
  phone: string;
  company?: string | undefined;
  notes?: string | undefined;
  serviceId: string;
  qty: number;
  /** Custom order total in rupees, as typed by the admin (e.g. "6000" or "6000.50"). */
  totalAmount: string | number;
  /** Attach to this existing lead instead of creating a new one. */
  leadId?: string | undefined;
  /** Create a new lead even though leads with the same phone / email exist. */
  createNewLead?: boolean | undefined;
}

function isMetaLead(r: any) {
  const src = String(r.source || "").toLowerCase();
  return src.includes("meta") || r.channel === "Facebook" || r.channel === "Instagram";
}

/** Existing (not deleted) leads for the same customer: same mobile number or same email. */
async function matchingLeads(ctx: SessionContext, phone: string, email: string) {
  const rows = await dbSelect<any>(LEADS_TABLE, {
    filters: [{ col: "deleted_at", op: "is_null" }],
    order: { col: "created_at", desc: true },
  });
  const p10 = last10(phone);
  const em = email.toLowerCase();
  return rows
    .filter((r) => (isMetaLead(r) ? ctx.perms.meta : ctx.perms.leads))
    .filter(
      (r) =>
        (p10.length === 10 && last10(r.phone) === p10) ||
        (!!em && String(r.email || "").toLowerCase() === em),
    )
    .slice(0, 10)
    .map((r) => ({
      id: String(r.id),
      name: String(r.name),
      phone: String(r.phone || ""),
      email: String(r.email || ""),
      source: String(r.source || ""),
      status: String(r.status || ""),
      createdAt: iso(r.created_at),
    }));
}

function parseAmount(v: unknown) {
  const s = String(v ?? "").replace(/[,\s₹]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const n = round2(parseFloat(s));
  return n >= 1 && n <= MAX_AMOUNT ? n : null;
}

/** Customer + order fields shared by "generate" and "edit" (same rules as the website checkout). */
function validateLinkFields(input: {
  name: string;
  email: string;
  phone: string;
  company?: string | undefined;
  notes?: string | undefined;
  serviceId: string;
  qty: number;
  totalAmount: string | number;
}) {
  const isSetup = input.serviceId === TWIN_SETUP_ID;
  const qty = isSetup ? 1 : Number(input.qty);
  if ((!isSetup && !getIndiaService(input.serviceId)) || !isPackQty(qty))
    throw new Error("Choose a video type and quantity.");
  const name = clean(input.name, 120);
  const email = clean(input.email, 160).toLowerCase();
  const phoneDigits = String(input.phone || "").replace(/[^\d]/g, "");
  const company = clean(input.company, 160);
  const notes = String(input.notes ?? "")
    .trim()
    .slice(0, 1000);
  if (name.length < 2) throw new Error("Enter the customer's full name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
    throw new Error("Enter a valid customer email address.");
  if (phoneDigits.length < 10 || phoneDigits.length > 13)
    throw new Error("Enter a valid customer mobile number.");
  const phone = phoneDigits.length === 10 ? `+91 ${phoneDigits}` : `+${phoneDigits}`;
  const total = parseAmount(input.totalAmount);
  if (total === null)
    throw new Error(
      `Enter the total amount in rupees (₹1 to ${formatInr(MAX_AMOUNT)}, up to 2 decimals).`,
    );
  const q = quoteItem(isSetup ? TWIN_SETUP_ID : input.serviceId, qty);
  return { name, email, phone, company, notes, total, q, qty };
}

export async function createPaymentLink(token: string, input: CreatePaymentLinkInput) {
  const ctx = await requireLinkAdmin(token);

  // ---- Validate everything before anything is saved ----
  const leadSource: LinkLeadSource | null =
    input.leadSource === "Manual" || input.leadSource === "Meta" ? input.leadSource : null;
  if (!leadSource) throw new Error("Choose the lead source: Manual or Meta.");
  const { name, email, phone, company, notes, total, q, qty } = validateLinkFields(input);

  await ensureLinksTable();

  // ---- Lead: reuse the chosen existing lead, or create one with the normal CRM process ----
  let leadId = "";
  if (input.leadId) {
    const row: any = (
      await dbSelect(LEADS_TABLE, {
        filters: [{ col: "id", op: "eq", value: String(input.leadId) }],
      })
    )[0];
    if (!row || row.deleted_at)
      throw new Error("The selected lead was not found (it may have been deleted).");
    if (isMetaLead(row) ? !ctx.perms.meta : !ctx.perms.leads)
      throw new CrmAuthError("FORBIDDEN", "You don't have access to that lead.");
    leadId = String(row.id);
  } else {
    if (!input.createNewLead) {
      const matches = await matchingLeads(ctx, phone, email);
      if (matches.length)
        return {
          ok: false as const,
          code: "LEAD_MATCH" as const,
          error:
            "This customer already has a lead. Choose the lead to attach the payment link to, or create a new lead.",
          matches,
        };
    }
    const { createLead } = await import("./crm-server");
    const created = await createLead(token, {
      kind: leadSource === "Meta" ? "meta" : "website",
      source: leadSource === "Meta" ? "Meta Ads" : "Manual",
      ...(leadSource === "Meta" ? { channel: "Facebook" } : {}),
      clientName: name,
      business: company || name,
      phone,
      email,
      videoScope: q.serviceName,
      quantity: qty === 1 ? "1 Video" : `${qty} Videos`,
      notes: [
        `Payment link generated by ${ctx.user.name}: ${q.itemName}, total ${formatInr(total)}.`,
        notes,
      ]
        .filter(Boolean)
        .join("\n"),
    });
    leadId = String(created.lead.id);
  }

  // ---- Order (same shape as a website order; amount = custom total until the customer chooses) ----
  const linkId = newPaymentLinkId();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + PAYMENT_LINK_VALIDITY_MS);
  const makeNumber = await nextOrderNumber();
  let orderId = makeNumber(0);
  const txnid = `QAS${Date.now()}${Math.floor(Math.random() * 900 + 100)}`;
  const row = {
    paypal_order_id: txnid, // replaced by a fresh PayU transaction id on every payment attempt
    customer_name: name,
    customer_email: email,
    customer_phone: phone,
    customer_company: company || null,
    item_type: q.kind === "setup" ? "setup" : q.qty === 1 ? "individual" : "package",
    item_id: q.kind === "setup" ? q.id : `${q.id}-${q.qty}`,
    item_name: q.itemName,
    amount: total,
    currency: "INR",
    payment_status: "PENDING",
    paypal_status: AWAITING,
    raw_details: JSON.stringify({
      gateway: "payu",
      gatewayConnected: !!getPayUConfig(),
      serviceId: q.id,
      qty: q.qty,
      perReel: round2(total / q.qty),
      notes,
      paymentPlan: "full", // set to the customer's choice when they pay
      orderTotal: total,
      balanceAfterPayment: 0,
      coupon: null,
      source: "payment_link",
      paymentLinkId: linkId,
      leadId,
      leadSource,
      customAmount: true,
      couponsAllowed: false,
      createdBy: ctx.user.email,
      linkExpiresAt: expiresAt.toISOString(),
    }),
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
  for (let attempt = 0; ; attempt++) {
    try {
      await dbInsert(ORDERS_TABLE, { id: orderId, ...row });
      break;
    } catch (e) {
      if (attempt >= 4) throw e;
      orderId = makeNumber(attempt + 1);
    }
  }
  try {
    await dbInsert(LINKS, {
      id: linkId,
      lead_id: leadId,
      order_id: orderId,
      lead_source: leadSource,
      service_id: q.id,
      qty: q.qty,
      item_name: q.itemName,
      total_amount: total,
      customer_name: name,
      customer_email: email,
      customer_phone: phone,
      customer_company: company || null,
      status: "ACTIVE",
      attempts: "0",
      created_by_id: ctx.user.id,
      created_by_name: ctx.user.name,
      created_by_email: ctx.user.email,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      updated_at: now.toISOString(),
    });
  } catch (e) {
    // Never leave an order that no link can pay.
    await dbUpdate(ORDERS_TABLE, [{ col: "id", op: "eq", value: orderId }], {
      payment_status: "CANCELLED",
      paypal_status: "LINK_NOT_CREATED",
    }).catch(() => null);
    throw e;
  }

  const expiresIst = expiresAt.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
  await logActivity({
    title: "Payment link generated",
    category: "ORDERS",
    actorEmail: ctx.user.email,
    description: `${ctx.user.name} generated a payment link for ${name}: ${q.itemName}, total ${formatInr(total)} (order ${orderId}, source ${leadSource}). Valid until ${expiresIst} IST.`,
    leadId,
  });

  const order = await orderById(orderId);
  const link = await linkById(linkId);
  return { ok: true as const, link: mapLink(link, order) };
}

export async function listPaymentLinks(token: string) {
  await requireLinkAdmin(token);
  try {
    await ensureLinksTable();
  } catch {
    return { ok: true as const, links: [] as PaymentLinkView[], setupNeeded: true };
  }
  await sweepExpiredPaymentLinks();
  let links = await dbSelect<any>(LINKS, { order: { col: "created_at", desc: true } });
  let { byId, children } = await loadOrdersFor(links);
  // Re-check unfinished PayU attempts so "Payment Pending" is current (a few at a time).
  const pending = links
    .map((l) => byId.get(String(l.order_id)))
    .filter(inProgress)
    .slice(0, 10);
  if (pending.length) {
    for (const o of pending) await checkPayUAttempt(o).catch(() => null);
    links = await dbSelect<any>(LINKS, { order: { col: "created_at", desc: true } });
    ({ byId, children } = await loadOrdersFor(links));
  }
  return {
    ok: true as const,
    links: links.map((l) =>
      mapLink(l, byId.get(String(l.order_id)), children.get(String(l.order_id)) || []),
    ),
    setupNeeded: false,
  };
}

/** Payment links, orders and payments of one lead (lead details popup). */
export async function leadPaymentLinks(token: string, leadId: string) {
  const ctx = await requireLinkAdmin(token);
  const lead: any = (
    await dbSelect(LEADS_TABLE, { filters: [{ col: "id", op: "eq", value: String(leadId) }] })
  )[0];
  if (!lead) throw new Error("Lead not found.");
  if (isMetaLead(lead) ? !ctx.perms.meta : !ctx.perms.leads)
    throw new CrmAuthError("FORBIDDEN", "You don't have access to this lead.");
  let links: any[] = [];
  try {
    links = await dbSelect<any>(LINKS, {
      filters: [{ col: "lead_id", op: "eq", value: String(leadId) }],
      order: { col: "created_at", desc: true },
    });
  } catch {
    return { ok: true as const, links: [], setupNeeded: true };
  }
  const { byId, children } = await loadOrdersFor(links);
  return {
    ok: true as const,
    links: links.map((l) =>
      mapLink(l, byId.get(String(l.order_id)), children.get(String(l.order_id)) || []),
    ),
    setupNeeded: false,
  };
}

export async function cancelPaymentLink(token: string, linkId: string) {
  const ctx = await requireLinkAdmin(token);
  const link = await linkById(String(linkId));
  if (!link) throw new Error("Payment link not found.");
  const order = await orderById(String(link.order_id));
  const st = effectiveLinkStatus(link, order);
  if (st === "USED") throw new Error("This link has already been paid, so it can't be cancelled.");
  if (st === "CANCELLED") return { ok: true as const };
  const now = new Date().toISOString();
  const done = await dbUpdate(
    LINKS,
    [
      { col: "id", op: "eq", value: link.id },
      { col: "status", op: "eq", value: link.status },
      { col: "used_at", op: "is_null" },
    ],
    { status: "CANCELLED", cancelled_at: now, cancelled_by: ctx.user.email, updated_at: now },
  );
  if (!done.length) throw new Error("The link changed just now. Refresh and try again.");
  // A payment already in progress at PayU is still honoured if it succeeds; otherwise the
  // never-paid order is closed so it no longer shows as pending.
  if (order && order.payment_status !== "COMPLETED" && !inProgress(order)) {
    await dbUpdate(
      ORDERS_TABLE,
      [
        { col: "id", op: "eq", value: order.id },
        { col: "payment_status", op: "eq", value: order.payment_status },
      ],
      { payment_status: "CANCELLED", paypal_status: "LINK_CANCELLED", updated_at: now },
    );
  }
  await logActivity({
    title: "Payment link cancelled",
    category: "ORDERS",
    actorEmail: ctx.user.email,
    description: `${ctx.user.name} cancelled the payment link for ${link.customer_name} (${formatInr(num(link.total_amount))}, order ${link.order_id}).`,
    leadId: String(link.lead_id),
  });
  return { ok: true as const };
}

export interface EditPaymentLinkInput {
  name: string;
  email: string;
  phone: string;
  company?: string | undefined;
  notes?: string | undefined;
  serviceId: string;
  qty: number;
  totalAmount: string | number;
}

/**
 * Edit a link (customer details, video type, quantity, custom total) while the customer has not
 * started paying yet. The 24-hour expiry is not extended. The lead itself is not changed.
 */
export async function editPaymentLink(token: string, linkId: string, input: EditPaymentLinkInput) {
  const ctx = await requireLinkAdmin(token);
  const link = await linkById(String(linkId));
  if (!link) throw new Error("Payment link not found.");
  const order = await orderById(String(link.order_id));
  const st = effectiveLinkStatus(link, order);
  const d = details(order);
  if (
    st !== "ACTIVE" ||
    !order ||
    order.payment_status !== "PENDING" ||
    order.paypal_status !== AWAITING ||
    (Array.isArray(d.previousAttempts) && d.previousAttempts.length)
  )
    throw new Error(
      st === "ACTIVE"
        ? "The customer has already started paying with this link, so it can't be edited. Cancel or delete it and generate a new link."
        : `This link is ${st.toLowerCase().replace("_", " ")} and can't be edited. Generate a new link instead.`,
    );
  const v = validateLinkFields(input);
  const now = new Date().toISOString();
  // Only while the order is still untouched by PayU (atomic check).
  const done = await dbUpdate(
    ORDERS_TABLE,
    [
      { col: "id", op: "eq", value: order.id },
      { col: "payment_status", op: "eq", value: "PENDING" },
      { col: "paypal_status", op: "eq", value: AWAITING },
    ],
    {
      customer_name: v.name,
      customer_email: v.email,
      customer_phone: v.phone,
      customer_company: v.company || null,
      item_type: v.q.kind === "setup" ? "setup" : v.q.qty === 1 ? "individual" : "package",
      item_id: v.q.kind === "setup" ? v.q.id : `${v.q.id}-${v.q.qty}`,
      item_name: v.q.itemName,
      amount: v.total,
      raw_details: JSON.stringify({
        ...d,
        serviceId: v.q.id,
        qty: v.q.qty,
        perReel: round2(v.total / v.q.qty),
        notes: v.notes,
        orderTotal: v.total,
        balanceAfterPayment: 0,
        paymentPlan: "full",
        editedBy: ctx.user.email,
        editedAt: now,
      }),
      updated_at: now,
    },
  );
  if (!done.length)
    throw new Error("The customer has just started paying, so the link can't be edited now.");
  await dbUpdate(LINKS, [{ col: "id", op: "eq", value: link.id }], {
    service_id: v.q.id,
    qty: v.q.qty,
    item_name: v.q.itemName,
    total_amount: v.total,
    customer_name: v.name,
    customer_email: v.email,
    customer_phone: v.phone,
    customer_company: v.company || null,
    updated_at: now,
  });
  const changes = [
    num(link.total_amount) !== v.total
      ? `amount ${formatInr(num(link.total_amount))} → ${formatInr(v.total)}`
      : "",
    link.item_name !== v.q.itemName ? `item ${link.item_name} → ${v.q.itemName}` : "",
    link.customer_name !== v.name ? `name → ${v.name}` : "",
    link.customer_email !== v.email ? `email → ${v.email}` : "",
    link.customer_phone !== v.phone ? `phone → ${v.phone}` : "",
  ].filter(Boolean);
  await logActivity({
    title: "Payment link edited",
    category: "ORDERS",
    actorEmail: ctx.user.email,
    description: `${ctx.user.name} edited the payment link for order ${order.id}${changes.length ? `: ${changes.join("; ")}` : " (no changes)"}.`,
    leadId: String(link.lead_id),
  });
  const fresh = await linkById(String(link.id));
  return { ok: true as const, link: mapLink(fresh, await orderById(String(order.id))) };
}

/**
 * Delete a payment link (Admin / Super Admin). Money is never deleted: a paid order and its
 * payments stay in Orders & Payments, and a payment already in progress at PayU is still
 * recorded if it succeeds. A never-paid order is closed so it no longer shows as pending.
 */
export async function deletePaymentLink(token: string, linkId: string) {
  const ctx = await requireLinkAdmin(token);
  return deleteOneLink(ctx, linkId);
}

/** Bulk delete (Admin / Super Admin): same rules as a single delete, link by link. */
export async function deletePaymentLinks(token: string, linkIds: string[]) {
  const ctx = await requireLinkAdmin(token);
  const ids = [
    ...new Set((Array.isArray(linkIds) ? linkIds : []).map(String).filter(Boolean)),
  ].slice(0, 500);
  let deleted = 0;
  let keptOrders = 0;
  const failed: string[] = [];
  for (const id of ids) {
    try {
      const r = await deleteOneLink(ctx, id);
      deleted++;
      if (r.keptOrder) keptOrders++;
    } catch (e) {
      console.error("Bulk delete: payment link failed", id, e);
      failed.push(id);
    }
  }
  return { ok: true as const, deleted, keptOrders, failed };
}

async function deleteOneLink(ctx: SessionContext, linkId: string) {
  const link = await linkById(String(linkId));
  if (!link) return { ok: true as const, keptOrder: false };
  const order = await orderById(String(link.order_id));
  const paid = isPaid(order);
  const busy = inProgress(order);
  const now = new Date().toISOString();
  if (order && !paid && !busy) {
    await dbUpdate(
      ORDERS_TABLE,
      [
        { col: "id", op: "eq", value: order.id },
        { col: "payment_status", op: "eq", value: String(order.payment_status) },
      ],
      { payment_status: "CANCELLED", paypal_status: "LINK_DELETED", updated_at: now },
    );
  }
  await dbDelete(LINKS, [{ col: "id", op: "eq", value: link.id }]);
  await logActivity({
    title: "Payment link deleted",
    category: "ORDERS",
    actorEmail: ctx.user.email,
    description: `${ctx.user.name} deleted the payment link for ${link.customer_name} (${formatInr(num(link.total_amount))}, order ${link.order_id}). ${
      paid
        ? "The order was already paid: its order and payment records are kept."
        : busy
          ? "A payment was in progress: it will still be recorded on the order if it succeeds."
          : "The unpaid order was closed."
    }`,
    leadId: String(link.lead_id),
  });
  return { ok: true as const, keptOrder: paid || busy };
}

/** Safe retry of a receipt email that failed (never sends a second copy of one that went out). */
export async function resendLinkReceipt(token: string, rowId: string) {
  const ctx = await requireLinkAdmin(token);
  const row = await orderById(String(rowId));
  const d = details(row);
  if (!row || (d.source !== "payment_link" && d.parentSource !== "payment_link"))
    throw new Error("Receipts can be re-sent here only for payment-link orders.");
  if (row.payment_status !== "COMPLETED")
    throw new Error("A receipt is sent only after a verified payment.");
  if (d.receiptEmail === "sent") return { ok: true as const, receiptEmail: "sent", already: true };
  await sendReceipt(String(row.id));
  const after = details(await orderById(String(row.id)));
  await logActivity({
    title: "Receipt email re-sent",
    category: "ORDERS",
    actorEmail: ctx.user.email,
    description: `${ctx.user.name} retried the receipt email for ${row.id}: ${after.receiptEmail === "sent" ? "sent" : "failed again"}.`,
    leadId: String(d.leadId || ""),
  });
  return {
    ok: true as const,
    receiptEmail: String(after.receiptEmail || "failed"),
    already: false,
  };
}

// ---------------------------------------------------------------------------
// Customer payment page (public, token only)
// ---------------------------------------------------------------------------
const maskEmail = (e: string) => e.replace(/^(.{2})[^@]*(@.*)$/, (_m, a, b) => `${a}•••${b}`);

function customerView(link: any, order: any, state: string, message = "") {
  const total = num(link.total_amount);
  const adv = splitLinkAmount(total, "advance");
  const paid = isPaid(order);
  const ps = order ? paymentSummary(order) : null;
  const svc = link.service_id === TWIN_SETUP_ID ? null : getIndiaService(link.service_id);
  const pack = INDIA_PACKS.find((p) => p.qty === Number(link.qty));
  return {
    ok: true as const,
    state: state as "active" | "processing" | "used" | "expired" | "cancelled",
    message,
    customerName: String(link.customer_name),
    customerEmail: maskEmail(String(link.customer_email)),
    service:
      svc?.name ||
      (link.service_id === TWIN_SETUP_ID ? "AI Digital Twin Setup" : String(link.item_name)),
    quantity:
      link.service_id === TWIN_SETUP_ID
        ? "One-Time Setup"
        : Number(link.qty) === 1
          ? "1 Reel"
          : `${Number(link.qty)} Reels`,
    packLabel: pack?.label || "",
    total,
    orderId: String(link.order_id),
    expiresAt: iso(link.expires_at),
    options: {
      full: { payNow: total, balance: 0 },
      partial: adv.plan === "advance" ? { payNow: adv.payNow, balance: adv.balance } : null,
    },
    paidTotal: paid ? ps!.paidTotal : 0,
    balanceDue: paid ? ps!.balanceDue : total,
    payBalanceUrl:
      paid && ps!.plan === "advance" && ps!.balanceDue > 0
        ? payBalancePath(String(order.paypal_order_id))
        : "",
    confirmationUrl: paid ? confirmationPath(String(order.paypal_order_id)) : "",
  };
}

/** What the customer sees when they open the link. Never starts a payment. */
export async function getPaymentLinkForCustomer(token: string) {
  const id = readPaymentLinkToken(token);
  if (!id)
    return {
      ok: false as const,
      error: "This payment link is not valid. Please check the link or contact our team.",
    };
  let link: any;
  try {
    link = await linkById(id);
  } catch {
    link = null;
  }
  if (!link)
    return {
      ok: false as const,
      error: "This payment link is not valid. Please check the link or contact our team.",
    };
  let order = await orderById(String(link.order_id));
  if (!order)
    return customerView(
      link,
      order,
      "cancelled",
      "This payment link is no longer active. Please contact our team for a new payment link.",
    );
  if (inProgress(order)) {
    const st = await checkPayUAttempt(order);
    order = (await orderById(String(link.order_id))) || order;
    if (st === "PENDING" && !isPaid(order))
      return customerView(
        link,
        order,
        "processing",
        "Your payment is being confirmed by your bank. This usually takes a few minutes — please don't pay again.",
      );
  }
  if (isPaid(order))
    return customerView(
      link,
      order,
      "used",
      "This payment link has already been used. Thank you for your payment!",
    );
  if (link.status === "CANCELLED")
    return customerView(
      link,
      order,
      "cancelled",
      "This payment link is no longer active. Please contact our team for a new payment link.",
    );
  if (Date.now() >= new Date(link.expires_at).getTime()) {
    await sweepExpiredPaymentLinks().catch(() => null);
    return customerView(
      link,
      order,
      "expired",
      "This payment link has expired. Please contact our team for a new payment link.",
    );
  }
  return customerView(link, order, "active");
}

/**
 * Customer pressed "Proceed to Secure Payment". The only input that matters is the token and
 * the Full / Partial choice: the amount comes from the stored custom total. Returns the
 * auto-submitted PayU form, exactly like the website checkout.
 */
export async function startPaymentLinkPayment(token: string, choice: string) {
  const plan: PaymentPlan | null =
    choice === "full" ? "full" : choice === "partial" || choice === "advance" ? "advance" : null;
  if (!plan) return { ok: false as const, error: "Please choose Full Payment or Partial Payment." };
  const id = readPaymentLinkToken(token);
  const link = id ? await linkById(id).catch(() => null) : null;
  if (!link)
    return {
      ok: false as const,
      error: "This payment link is not valid. Please contact our team.",
    };
  let order = await orderById(String(link.order_id));
  if (!order)
    return {
      ok: false as const,
      error:
        "This payment link is no longer active. Please contact our team for a new payment link.",
    };
  if (isPaid(order))
    return {
      ok: false as const,
      paid: true as const,
      error: "This payment link has already been used. Thank you for your payment!",
    };

  // An earlier attempt that may still be live at PayU: find out what happened to it first.
  if (inProgress(order)) {
    const st = await checkPayUAttempt(order);
    order = (await orderById(String(link.order_id))) || order;
    if (isPaid(order) || st === "COMPLETED")
      return {
        ok: false as const,
        paid: true as const,
        error: "This payment link has already been used. Thank you for your payment!",
      };
    if (st === "PENDING")
      return {
        ok: false as const,
        processing: true as const,
        error:
          "Your previous payment is still being confirmed by your bank. Please don't pay again — check back in a few minutes.",
      };
    const startedAt = new Date(details(order).attemptStartedAt || order.updated_at).getTime();
    if (st !== "FAILED" && (Date.now() - startedAt) / 1000 < RETRY_COOLDOWN_SEC)
      return {
        ok: false as const,
        error:
          "We're still checking your previous payment attempt. Please try again in about a minute.",
      };
  }
  if (link.status === "CANCELLED")
    return {
      ok: false as const,
      error:
        "This payment link is no longer active. Please contact our team for a new payment link.",
    };
  if (Date.now() >= new Date(link.expires_at).getTime())
    return {
      ok: false as const,
      expired: true as const,
      error: "This payment link has expired. Please contact our team for a new payment link.",
    };
  if (!getPayUConfig())
    return {
      ok: false as const,
      error: "Online payment is not available right now. Please contact our team.",
    };

  const total = num(link.total_amount);
  const d = details(order);
  if (Math.abs(num(d.orderTotal) - total) >= 0.01) {
    console.error(
      `Payment link ${link.id}: order total ${d.orderTotal} does not match link total ${total}`,
    );
    return {
      ok: false as const,
      error: "This payment link can't be used. Please contact our team.",
    };
  }
  const split = splitLinkAmount(total, plan);
  const advance = split.plan === "advance";
  const newTxn = `QAS${Date.now()}${Math.floor(Math.random() * 900 + 100)}`;
  const nowIso = new Date().toISOString();
  const wasSentToPayU = String(order.paypal_status || "").startsWith("PAYU_");
  const previousAttempts = Array.isArray(d.previousAttempts) ? d.previousAttempts.slice(-20) : [];
  if (wasSentToPayU)
    previousAttempts.push({
      txnid: String(order.paypal_order_id),
      amount: Number(order.amount),
      plan: d.paymentPlan === "advance" ? "advance" : "full",
      balance: num(d.balanceAfterPayment),
      startedAt: d.attemptStartedAt || order.updated_at,
      endedAs: String(order.payment_status),
    });
  // Atomic: only the request that still sees the same transaction + status wins. A double
  // click or a second tab gets "already started" instead of a second live attempt.
  const updated = await dbUpdate(
    ORDERS_TABLE,
    [
      { col: "id", op: "eq", value: order.id },
      { col: "paypal_order_id", op: "eq", value: String(order.paypal_order_id) },
      { col: "payment_status", op: "eq", value: String(order.payment_status) },
    ],
    {
      paypal_order_id: newTxn,
      amount: split.payNow,
      payment_status: "PENDING",
      paypal_status: "PAYU_INITIATED",
      raw_details: JSON.stringify({
        ...d,
        gatewayConnected: true,
        paymentPlan: split.plan,
        orderTotal: total,
        balanceAfterPayment: split.balance,
        attemptStartedAt: nowIso,
        previousAttempts,
      }),
      updated_at: nowIso,
    },
  );
  if (!updated.length)
    return {
      ok: false as const,
      error: "A payment for this link was just started. Please refresh this page in a moment.",
    };
  await dbUpdate(
    LINKS,
    [
      { col: "id", op: "eq", value: link.id },
      { col: "used_at", op: "is_null" },
    ],
    {
      status: "PAYMENT_PENDING",
      attempts: String((parseInt(String(link.attempts || "0"), 10) || 0) + 1),
      updated_at: nowIso,
    },
  ).catch(() => null);
  await logActivity({
    title: "Payment link checkout started",
    category: "ORDERS",
    actorEmail: String(link.customer_email),
    description: `${link.customer_name} chose ${advance ? `Partial Payment (50% advance ${formatInr(split.payNow)}, balance ${formatInr(split.balance)})` : `Full Payment (${formatInr(split.payNow)})`} on the payment link for order ${order.id} (txn ${newTxn}).`,
    leadId: String(link.lead_id),
  });
  const form = buildPayUForm({
    txnid: newTxn,
    amount: split.payNow.toFixed(2),
    productinfo: (advance
      ? `${order.item_name} | 50% Advance of INR ${total} | Payment Link`
      : `${order.item_name} | Full Payment | Payment Link`
    ).slice(0, 100),
    firstname: String(order.customer_name).split(" ")[0]!.slice(0, 60),
    email: String(order.customer_email),
    phone: last10(order.customer_phone),
    udf1: String(order.id),
    udf2: advance ? "ADVANCE_50" : "FULL",
    udf3: String(total),
    udf4: String(split.balance),
    udf5: "PAYMENT_LINK",
  });
  if (!form)
    return {
      ok: false as const,
      error: "Online payment is not available right now. Please contact our team.",
    };
  return { ok: true as const, form };
}

// ---------------------------------------------------------------------------
// Hooks called from the existing PayU flow (checkout-server.ts)
// ---------------------------------------------------------------------------

/** After a verified successful payment on a payment-link order (first payment or balance). */
export async function onPaymentLinkOrderPaid(orderId: string, balanceRowId: string) {
  const links = await dbSelect<any>(LINKS, {
    filters: [{ col: "order_id", op: "eq", value: orderId }],
  });
  const link = links[0];
  if (!link) return;
  const order = await orderById(orderId);
  if (!order) return;
  const ps = paymentSummary(order);
  if (!balanceRowId) {
    const now = new Date().toISOString();
    const done = await dbUpdate(
      LINKS,
      [
        { col: "id", op: "eq", value: link.id },
        { col: "used_at", op: "is_null" },
      ],
      {
        status: "USED",
        used_at: now,
        paid_plan: ps.plan === "advance" ? "advance" : "full",
        updated_at: now,
      },
    );
    if (done.length)
      await logActivity({
        title: "Payment link paid",
        category: "ORDERS",
        actorEmail: String(order.customer_email),
        description:
          ps.plan === "advance"
            ? `${order.customer_name} paid ${formatInr(Number(order.amount))} (Partial Payment, 50% advance) for order ${order.id}. Remaining ${formatInr(ps.balanceDue)}: balance link sent by email.`
            : `${order.customer_name} paid the full ${formatInr(Number(order.amount))} for order ${order.id}. Order fully paid.`,
        leadId: String(link.lead_id),
      });
  } else {
    const bal = await orderById(balanceRowId);
    await logActivity({
      title: "Payment link balance paid",
      category: "ORDERS",
      actorEmail: String(order.customer_email),
      description: `${order.customer_name} paid the remaining ${formatInr(Number(bal?.amount || 0))} for order ${order.id} (balance ${balanceRowId}). Order is now ${ps.balanceDue <= 0 ? "FULLY PAID" : `partially paid, ${formatInr(ps.balanceDue)} due`}.`,
      leadId: String(link.lead_id),
    });
  }
}

/**
 * PayU reported on a transaction id that no order has any more: it may be an earlier attempt
 * on a payment link that a retry replaced. A verified success is never lost:
 *   • order not paid yet → it is switched back to that attempt and completed normally;
 *   • order already paid by another attempt → recorded as a DUPLICATE payment for refund.
 * Returns null when the transaction isn't a payment-link attempt (normal behaviour continues).
 */
export type CallbackResult = { status: "success" | "pending" | "failed"; txnid: string };
export async function recoverSupersededLinkTxn(
  p: Record<string, string>,
): Promise<CallbackResult | null> {
  const txnid = String(p["txnid"] || "");
  if (!/^QAS\d{10,22}$/.test(txnid)) return null;
  const rows = await dbSelect<any>(ORDERS_TABLE, { columns: ["id", "raw_details"] });
  const hit = rows.find((r) => {
    const d = details(r);
    return (
      d.source === "payment_link" &&
      Array.isArray(d.previousAttempts) &&
      d.previousAttempts.some((a: any) => a?.txnid === txnid)
    );
  });
  if (!hit) return null;
  if (!verifyPayUResponse(p)) {
    await logActivity({
      title: "Payment callback rejected",
      category: "ORDERS",
      actorEmail: "payu",
      description: `Txn ${txnid} (earlier attempt on payment-link order ${hit.id}): PayU signature did not match. Nothing changed.`,
    });
    return { status: "failed" as const, txnid: "" };
  }
  const order = await orderById(String(hit.id));
  if (!order) return null;
  const d = details(order);
  const attempt = (d.previousAttempts as any[]).find((a) => a?.txnid === txnid);
  const success = String(p["status"] || "").toLowerCase() === "success";
  if (!success) return { status: "failed" as const, txnid: "" }; // an old attempt that failed: nothing to do
  if (Math.abs(Number(p["amount"]) - Number(attempt?.amount)) >= 0.01) {
    await logActivity({
      title: "Payment callback rejected",
      category: "ORDERS",
      actorEmail: order.customer_email,
      description: `Txn ${txnid} (earlier attempt on order ${order.id}): amount ${p["amount"]} does not match ${attempt?.amount}. Please check this payment in the PayU dashboard.`,
    });
    return { status: "failed" as const, txnid: "" };
  }
  const { handlePayUCallback } = await import("./checkout-server");
  if (isPaid(order)) {
    const dupes = Array.isArray(d.duplicatePayments) ? d.duplicatePayments : [];
    if (!dupes.some((x: any) => x?.txnid === txnid)) {
      await dbUpdate(ORDERS_TABLE, [{ col: "id", op: "eq", value: order.id }], {
        raw_details: JSON.stringify({
          ...d,
          duplicatePayments: [
            ...dupes,
            {
              txnid,
              amount: Number(p["amount"]),
              mihpayid: p["mihpayid"] || "",
              at: new Date().toISOString(),
            },
          ],
        }),
      });
      await logActivity({
        title: "DUPLICATE payment received — refund needed",
        category: "ORDERS",
        actorEmail: order.customer_email,
        description: `${order.customer_name} paid ${formatInr(Number(p["amount"]))} again on an earlier attempt (txn ${txnid}, PayU ${p["mihpayid"] || "-"}) for order ${order.id}, which was already paid. Refund this payment from the PayU dashboard.`,
        leadId: String(d.leadId || ""),
      });
    }
    return { status: "success" as const, txnid: String(order.paypal_order_id) };
  }
  // Not paid yet: make that attempt the order's transaction again, then finish it normally.
  const keep = (d.previousAttempts as any[]).filter((a) => a?.txnid !== txnid);
  if (String(order.paypal_status || "").startsWith("PAYU_"))
    keep.push({
      txnid: String(order.paypal_order_id),
      amount: Number(order.amount),
      plan: d.paymentPlan === "advance" ? "advance" : "full",
      balance: num(d.balanceAfterPayment),
      startedAt: d.attemptStartedAt || order.updated_at,
      endedAs: String(order.payment_status),
    });
  await dbUpdate(
    ORDERS_TABLE,
    [
      { col: "id", op: "eq", value: order.id },
      { col: "paypal_order_id", op: "eq", value: String(order.paypal_order_id) },
      { col: "payment_status", op: "eq", value: String(order.payment_status) },
    ],
    {
      paypal_order_id: txnid,
      amount: Number(attempt.amount),
      payment_status: "PENDING",
      paypal_status: "PAYU_INITIATED",
      raw_details: JSON.stringify({
        ...d,
        paymentPlan: attempt.plan === "advance" ? "advance" : "full",
        balanceAfterPayment: num(attempt.balance),
        attemptStartedAt: attempt.startedAt,
        previousAttempts: keep,
      }),
      updated_at: new Date().toISOString(),
    },
  );
  // Whoever won the switch (this request or a simultaneous webhook), the order now carries this
  // transaction id, so the normal verified path records it exactly once.
  const now = (
    await dbSelect<any>(ORDERS_TABLE, {
      filters: [{ col: "paypal_order_id", op: "eq", value: txnid }],
    })
  )[0];
  if (!now) return { status: "failed" as const, txnid: "" };
  return (await handlePayUCallback(p)) as CallbackResult;
}
