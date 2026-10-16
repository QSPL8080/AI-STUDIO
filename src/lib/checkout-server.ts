// Server-only: website checkout (India). Orders go to ind_orders and show up in
// CRM → Orders & Payments. Payment runs through PayU once PAYU_KEY / PAYU_SALT are set (see payu.ts).
import { createHmac, timingSafeEqual } from "node:crypto";
import { dbInsert, dbSelect, dbUpdate, logActivity } from "./crm-db";
import { ORDERS_TABLE } from "./db-tables";
import {
  formatInr,
  getIndiaService,
  isPackQty,
  quoteItem,
  TWIN_SETUP,
  TWIN_SETUP_ID,
  deliveryFor,
} from "./india-pricing";
import {
  buildPayUForm,
  fetchPayUStatus,
  getPayUConfig,
  siteUrl,
  verifyPayUResponse,
  type PayUTxnStatus,
} from "./payu";

// ---------------------------------------------------------------------------
// Order numbers: QAS-2026-000127 (year + running number). Stored as the order id.
// ---------------------------------------------------------------------------
async function nextOrderNumber() {
  const year = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", year: "numeric" });
  const prefix = `QAS-${year}-`;
  const rows = await dbSelect<{ id: string }>(ORDERS_TABLE, { columns: ["id"] });
  let max = 0;
  for (const r of rows) {
    if (String(r.id).startsWith(prefix))
      max = Math.max(max, parseInt(String(r.id).slice(prefix.length), 10) || 0);
  }
  return (offset: number) => `${prefix}${String(max + 1 + offset).padStart(6, "0")}`;
}

// ---------------------------------------------------------------------------
// Signed confirmation links: only the customer who paid (or whoever has the emailed
// link) can open the confirmation page and download the receipt.
// ---------------------------------------------------------------------------
function linkSecret() {
  return (
    process.env.CRM_SESSION_SECRET ||
    process.env.PAYU_SALT ||
    process.env.IND_SUPABASE_SERVICE_KEY ||
    process.env.DATABASE_URL ||
    "quickupp-order-links"
  );
}
export function signTxn(txnid: string) {
  return createHmac("sha256", `order-link|${linkSecret()}`)
    .update(txnid)
    .digest("base64url")
    .slice(0, 32);
}
function validTxnToken(txnid: string, token: string) {
  if (!/^QAS\d{10,22}$/.test(txnid || "") || !token) return false;
  const a = Buffer.from(signTxn(txnid));
  const b = Buffer.from(String(token));
  return a.length === b.length && timingSafeEqual(a, b);
}
/** Homepage with the "Order Confirmed" popup (where PayU sends the customer back). */
export function orderPopupPath(txnid: string) {
  return `/?${new URLSearchParams({ order: txnid, ot: signTxn(txnid) }).toString()}`;
}
export function receiptPath(txnid: string) {
  return `/api/receipt?${new URLSearchParams({ txn: txnid, t: signTxn(txnid) }).toString()}`;
}
export function confirmationPath(txnid: string) {
  return `/payment/confirmation?${new URLSearchParams({ txn: txnid, t: signTxn(txnid) }).toString()}`;
}

const PAY_MODES: Record<string, string> = {
  UPI: "UPI",
  CC: "Credit Card",
  DC: "Debit Card",
  NB: "Net Banking",
  CASH: "Wallet",
  EMI: "EMI",
  BNPL: "Pay Later",
  SODEXO: "Sodexo",
};
function paymentMethodLabel(details: any) {
  const mode = String(details?.payu?.mode || "").toUpperCase();
  return PAY_MODES[mode] || (mode ? mode : "Online payment (PayU)");
}
function parseDetails(o: any): Record<string, any> {
  try {
    return JSON.parse(o.raw_details || "{}");
  } catch {
    return {};
  }
}
function orderView(o: any) {
  const d = parseDetails(o);
  const svc = getIndiaService(d.serviceId);
  const qty = Number(d.qty) || 1;
  const isSetup = d.serviceId === TWIN_SETUP_ID;
  const paidAt = o.payment_status === "COMPLETED" ? d.paidAt || o.updated_at : null;
  return {
    orderNumber: String(o.id),
    txnid: String(o.paypal_order_id),
    service: isSetup
      ? TWIN_SETUP.name
      : svc?.name || String(o.item_name).split(" - ")[0] || String(o.item_name),
    pack: isSetup ? "One-Time Setup" : qty === 1 ? "Single Reel" : `${qty} Reels`,
    delivery: deliveryFor(isSetup ? TWIN_SETUP_ID : String(d.serviceId || ""), qty),
    itemName: String(o.item_name),
    amount: Number(o.amount),
    status: String(o.payment_status),
    method: paymentMethodLabel(d),
    transactionId: String(d.payu?.mihpayid || o.paypal_capture_id || o.paypal_order_id),
    name: String(o.customer_name),
    email: String(o.customer_email),
    company: String(o.customer_company || ""),
    paidAt: paidAt ? new Date(paidAt).toISOString() : null,
    receiptEmail: (d.receiptEmail as "sent" | "failed" | undefined) || null,
    failureReason: o.payment_status === "FAILED" ? String(d.payu?.error_Message || "") : "",
  };
}
export type OrderView = ReturnType<typeof orderView>;

async function findByTxn(txnid: string) {
  const rows = await dbSelect(ORDERS_TABLE, {
    filters: [{ col: "paypal_order_id", op: "eq", value: txnid }],
  });
  return (rows[0] as any) || null;
}

/** PDF receipt for a paid order. */
export async function buildReceiptPdf(o: any) {
  const v = orderView(o);
  const { generateInvoicePdfBuffer } = await import("./pdf-receipt");
  const paid = v.paidAt ? new Date(v.paidAt) : new Date();
  return generateInvoicePdfBuffer({
    orderNumber: v.orderNumber,
    paymentStatus: "PAID",
    paymentDate: paid.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "long" }),
    paymentTime:
      paid.toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).toUpperCase() + " IST",
    customerName: v.name,
    customerEmail: v.email,
    customerCompany: v.company || undefined,
    billingAddress: "India",
    serviceName: v.service,
    packageDescription: v.pack,
    qty: 1,
    amount: v.amount,
    currency: "INR",
    paymentMethod: `PayU / ${v.method}`,
    transactionId: v.transactionId,
  });
}

/** Customer receipt email (with PDF) — sent once, in the background, after a successful payment. */
async function sendReceipt(orderId: string) {
  const rows = await dbSelect(ORDERS_TABLE, { filters: [{ col: "id", op: "eq", value: orderId }] });
  const o: any = rows[0];
  if (!o || o.payment_status !== "COMPLETED") return;
  if (parseDetails(o).receiptEmail === "sent") return; // already emailed
  const v = orderView(o);
  let receipt;
  try {
    receipt = {
      filename: `Receipt-${v.orderNumber}.pdf`,
      content: await buildReceiptPdf(o),
      contentType: "application/pdf",
    };
  } catch (e) {
    console.error("Receipt PDF failed", e);
  }
  const { sendPaymentReceiptEmail } = await import("./email");
  const paid = v.paidAt ? new Date(v.paidAt) : new Date();
  const r = await sendPaymentReceiptEmail({
    to: v.email,
    name: v.name,
    email: v.email,
    company: v.company || undefined,
    orderNumber: v.orderNumber,
    service: v.service,
    pack: v.pack,
    delivery: v.delivery,
    amount: `${formatInr(v.amount)} INR`,
    method: `${v.method} (via PayU)`,
    transactionId: v.transactionId,
    paymentDate: paid.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "long" }),
    paymentTime:
      paid.toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).toUpperCase() + " IST",
    confirmationUrl: `${siteUrl()}${confirmationPath(v.txnid)}`,
    receiptUrl: `${siteUrl()}${receiptPath(v.txnid)}`,
    receipt,
  });
  await dbUpdate(ORDERS_TABLE, [{ col: "id", op: "eq", value: orderId }], {
    raw_details: JSON.stringify({
      ...parseDetails(o),
      receiptEmail: r.success ? "sent" : "failed",
    }),
  });
  await logActivity({
    title: r.success ? "Receipt email sent" : "Receipt email FAILED",
    category: "ORDERS",
    actorEmail: v.email,
    description: (r.success
      ? `Payment receipt for ${v.orderNumber} emailed to ${v.email} via ${r.via}.`
      : `Could not email the receipt for ${v.orderNumber} to ${v.email}: ${r.errors.join(" | ")}`
    ).slice(0, 1200),
  });
}

export interface CheckoutInput {
  serviceId: string;
  qty: number;
  name: string;
  email: string;
  phone: string;
  company?: string;
  notes?: string;
}

const clean = (v: unknown, max: number) =>
  String(v ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

export async function createIndiaOrder(input: CheckoutInput) {
  const isSetup = input.serviceId === TWIN_SETUP_ID;
  if ((!isSetup && !getIndiaService(input.serviceId)) || (!isSetup && !isPackQty(input.qty)))
    return { ok: false as const, error: "Please choose a service and package." };
  const name = clean(input.name, 120);
  const email = clean(input.email, 160).toLowerCase();
  const phoneDigits = String(input.phone || "").replace(/[^\d]/g, "");
  const company = clean(input.company, 160);
  const notes = String(input.notes ?? "")
    .trim()
    .slice(0, 1000);
  if (name.length < 2) return { ok: false as const, error: "Please enter your full name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
    return { ok: false as const, error: "Please enter a valid email address." };
  if (phoneDigits.length < 10 || phoneDigits.length > 13)
    return { ok: false as const, error: "Please enter a valid mobile number." };
  const phone = phoneDigits.length === 10 ? `+91 ${phoneDigits}` : `+${phoneDigits}`;

  const q = quoteItem(input.serviceId, input.qty);
  const payu = getPayUConfig();
  const makeNumber = await nextOrderNumber();
  let orderId = makeNumber(0);
  const txnid = `QAS${Date.now()}${Math.floor(Math.random() * 900 + 100)}`; // PayU: max 25 chars, unique
  const now = new Date().toISOString();

  const row = {
    paypal_order_id: txnid, // gateway transaction id (column name kept from the original schema)
    customer_name: name,
    customer_email: email,
    customer_phone: phone,
    customer_company: company || null,
    item_type: q.kind === "setup" ? "setup" : q.qty === 1 ? "individual" : "package",
    item_id: q.kind === "setup" ? q.id : `${q.id}-${q.qty}`,
    item_name: q.itemName,
    amount: q.amount,
    currency: "INR",
    payment_status: "PENDING",
    paypal_status: payu ? "PAYU_INITIATED" : "AWAITING_PAYMENT_LINK",
    raw_details: JSON.stringify({
      gateway: "payu",
      gatewayConnected: !!payu,
      serviceId: q.id,
      qty: q.qty,
      perReel: q.perReel,
      notes,
    }),
    created_at: now,
    updated_at: now,
  };
  // Two customers at the same second could pick the same number: retry with the next one.
  for (let attempt = 0; ; attempt++) {
    try {
      await dbInsert(ORDERS_TABLE, { id: orderId, ...row });
      break;
    } catch (e) {
      if (attempt >= 4) throw e;
      orderId = makeNumber(attempt + 1);
    }
  }

  await logActivity({
    title: "New website order",
    category: "ORDERS",
    actorEmail: email,
    description: `${name} ordered ${q.itemName} for ${formatInr(q.amount)} (order ${orderId}, txn ${txnid}). ${payu ? "Sent to PayU for payment." : "Payment gateway not connected yet: send the customer a payment link."}`,
  });

  // Team email in the background (doesn't slow the checkout down).
  void (async () => {
    try {
      const { sendOrderNotificationEmail } = await import("./email");
      const r = await sendOrderNotificationEmail({
        orderId,
        txnid,
        itemName: q.itemName,
        amount: formatInr(q.amount),
        name,
        email,
        phone,
        company: company || undefined,
        notes: notes || undefined,
        paymentMode: payu
          ? "PayU (customer sent to the payment page)"
          : "Pending: send the customer a payment link",
      });
      await logActivity({
        title: r.success ? "Order email sent" : "Order email FAILED",
        category: "ORDERS",
        actorEmail: "website",
        description: (r.success
          ? `Order ${txnid}: emailed via ${r.via}.`
          : `Order ${txnid}: ${r.errors.join(" | ")}`
        ).slice(0, 1200),
      });
    } catch (e) {
      console.error("Order email failed", e);
    }
  })();

  const form = buildPayUForm({
    txnid,
    amount: q.amount.toFixed(2),
    productinfo: q.itemName.slice(0, 100),
    firstname: name.split(" ")[0]!.slice(0, 60),
    email,
    phone: phoneDigits.slice(-10),
    udf1: orderId,
  });

  return {
    ok: true as const,
    orderId,
    txnid,
    itemName: q.itemName,
    amount: q.amount,
    payment: form, // null until PayU is configured
  };
}

/** PayU posts the payment result here (surl / furl). Returns where to send the customer. */
export async function handlePayUCallback(p: Record<string, string>) {
  const txnid = p.txnid || "";
  const rows = txnid
    ? await dbSelect(ORDERS_TABLE, {
        filters: [{ col: "paypal_order_id", op: "eq", value: txnid }],
      })
    : [];
  const order: any = rows[0];
  if (!order) return { status: "failed" as const, txnid: "" };

  const verified = verifyPayUResponse(p);
  const amountOk = Math.abs(Number(p.amount) - Number(order.amount)) < 0.01;
  const toResult = (s: string) =>
    s === "COMPLETED"
      ? ("success" as const)
      : s === "PENDING"
        ? ("pending" as const)
        : ("failed" as const);

  // Unsigned / tampered post, or wrong amount: leave the order exactly as it is.
  if (!verified || !amountOk) {
    await logActivity({
      title: "Payment callback rejected",
      category: "ORDERS",
      actorEmail: order.customer_email,
      description: `Txn ${txnid}: ${!verified ? "PayU signature did not match" : `amount ${p.amount} does not match ${order.amount}`}. Order left as ${order.payment_status}.`,
    });
    // No signed confirmation link for an unverified post.
    return { status: toResult(order.payment_status), txnid: "" };
  }
  // A paid order never goes back to failed / pending.
  if (order.payment_status === "COMPLETED") return { status: "success" as const, txnid };

  const status = await applyPayUResult(order, {
    status: p.status || "",
    amount: p.amount || "",
    mihpayid: p.mihpayid,
    mode: p.mode,
    bank_ref_num: p.bank_ref_num,
    error_Message: p.error_Message,
  });
  return { status: toResult(status), txnid };
}

/** Maps PayU's status words to our order status. Unknown / in-progress states stay PENDING. */
function mapPayUStatus(raw: string) {
  const gw = String(raw || "").toLowerCase();
  if (gw === "success") return "COMPLETED";
  if (["failure", "failed", "dropped", "bounced", "usercancelled", "cancelled"].includes(gw))
    return "FAILED";
  return "PENDING";
}

/**
 * Writes a verified PayU result onto the order (from the browser callback, the webhook, or a
 * server-to-server status check). A paid order never goes back to pending / failed.
 */
async function applyPayUResult(order: any, r: PayUTxnStatus) {
  if (order.payment_status === "COMPLETED") return "COMPLETED";
  const gw = String(r.status || "").toLowerCase();
  const status = mapPayUStatus(gw);
  const gwLabel = `PAYU_${gw.toUpperCase().replace(/\s+/g, "_") || "UNKNOWN"}`;
  // Nothing new (e.g. still pending on a re-check): don't rewrite the row or spam the log.
  if (status === order.payment_status && gwLabel === order.paypal_status) return status;

  let details: Record<string, unknown> = {};
  try {
    details = JSON.parse(order.raw_details || "{}");
  } catch {
    /* ignore */
  }
  // Only update if nobody else changed the order meanwhile (the browser callback and PayU's
  // webhook can arrive at the same moment): this way the receipt email is sent exactly once.
  const updated = await dbUpdate(ORDERS_TABLE, [
    { col: "id", op: "eq", value: order.id },
    { col: "payment_status", op: "eq", value: order.payment_status },
  ], {
    payment_status: status,
    paypal_status: gwLabel,
    paypal_capture_id: r.mihpayid || order.paypal_capture_id || null,
    raw_details: JSON.stringify({
      ...details,
      ...(status === "COMPLETED" ? { paidAt: new Date().toISOString() } : {}),
      payu: {
        status: r.status,
        mihpayid: r.mihpayid,
        mode: r.mode,
        bank_ref_num: r.bank_ref_num,
        error_Message: r.error_Message,
      },
    }),
    updated_at: new Date().toISOString(),
  });
  if (!updated.length) {
    const fresh = await findByTxn(String(order.paypal_order_id));
    return String(fresh?.payment_status || order.payment_status);
  }
  await logActivity({
    title:
      status === "COMPLETED"
        ? "Payment received"
        : status === "PENDING"
          ? "Payment pending"
          : "Payment failed",
    category: "ORDERS",
    actorEmail: order.customer_email,
    description: `${order.customer_name} - ${order.item_name} (${formatInr(Number(order.amount))}), txn ${order.paypal_order_id}${r.mode ? `, ${r.mode}` : ""}${r.error_Message && status !== "COMPLETED" ? ` - ${r.error_Message}` : ""}.`,
  });
  if (status === "COMPLETED")
    void sendReceipt(order.id).catch((e) => console.error("Receipt email failed", e));
  return status;
}

/**
 * For an order still PENDING, asks PayU for the latest status and updates the order.
 * Returns the (possibly refreshed) order row.
 */
async function refreshPendingOrder(order: any) {
  if (!order || order.payment_status !== "PENDING" || !getPayUConfig()) return order;
  if (!String(order.paypal_status || "").startsWith("PAYU_")) return order;
  const r = await fetchPayUStatus(String(order.paypal_order_id));
  if (!r) return order;
  if (Math.abs(Number(r.amount) - Number(order.amount)) >= 0.01) {
    console.error(`PayU status check: amount mismatch for ${order.paypal_order_id}`);
    return order;
  }
  await applyPayUResult(order, r);
  return (await findByTxn(String(order.paypal_order_id))) || order;
}

/** CRM / admin: re-check every pending PayU order. Returns how many changed. */
export async function syncPendingPayUOrders() {
  const rows = await dbSelect(ORDERS_TABLE, {
    filters: [{ col: "payment_status", op: "eq", value: "PENDING" }],
  });
  // Only recent orders: PayU settles pending payments within hours, not weeks.
  const cutoff = Date.now() - 3 * 24 * 60 * 60 * 1000;
  const recent = (rows as any[]).filter((o) => new Date(o.created_at).getTime() >= cutoff);
  let changed = 0;
  for (const o of recent) {
    const after = await refreshPendingOrder(o);
    if (after?.payment_status !== o.payment_status) changed++;
  }
  return { checked: recent.length, changed };
}

/** Order confirmation page data (signed link only). */
export async function getConfirmation(txnid: string, token: string) {
  if (!validTxnToken(txnid, token))
    return { ok: false as const, error: "This confirmation link is not valid." };
  let o = await findByTxn(txnid);
  if (!o) return { ok: false as const, error: "We couldn't find this order." };
  if (o.payment_status === "PENDING") o = await refreshPendingOrder(o);
  return { ok: true as const, order: orderView(o) };
}

/** Signed receipt download (link in the confirmation email). Paid orders only. */
export async function getReceiptPdf(txnid: string, token: string) {
  if (!validTxnToken(txnid, token)) return null;
  const o = await findByTxn(txnid);
  if (!o || o.payment_status !== "COMPLETED") return null;
  return { filename: `Receipt-${String(o.id)}.pdf`, pdf: await buildReceiptPdf(o) };
}
