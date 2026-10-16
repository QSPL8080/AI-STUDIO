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
import { buildPayUForm, getPayUConfig, siteUrl, verifyPayUResponse } from "./payu";

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
      }) + " IST",
    customerName: v.name,
    customerEmail: v.email,
    customerCompany: v.company || undefined,
    billingAddress: "India",
    serviceName: v.service,
    packageDescription: v.pack,
    qty: 1,
    amount: v.amount,
    currency: "INR",
    paymentMethod: `${v.method} (PayU)`,
    transactionId: v.transactionId,
  });
}

/** Customer receipt email (with PDF) — sent once, in the background, after a successful payment. */
async function sendReceipt(orderId: string) {
  const rows = await dbSelect(ORDERS_TABLE, { filters: [{ col: "id", op: "eq", value: orderId }] });
  const o: any = rows[0];
  if (!o || o.payment_status !== "COMPLETED") return;
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
    orderNumber: v.orderNumber,
    service: v.service,
    pack: v.pack,
    delivery: v.delivery,
    amount: formatInr(v.amount),
    method: v.method,
    transactionId: v.transactionId,
    paidAt:
      paid.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      }) + " IST",
    confirmationUrl: `${siteUrl()}${confirmationPath(v.txnid)}`,
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

  const gw = String(p.status || "").toLowerCase();
  const status = gw === "success" ? "COMPLETED" : gw === "pending" ? "PENDING" : "FAILED";
  let details: Record<string, unknown> = {};
  try {
    details = JSON.parse(order.raw_details || "{}");
  } catch {
    /* ignore */
  }
  await dbUpdate(ORDERS_TABLE, [{ col: "id", op: "eq", value: order.id }], {
    payment_status: status,
    paypal_status: `PAYU_${gw.toUpperCase() || "UNKNOWN"}`,
    paypal_capture_id: p.mihpayid || null,
    raw_details: JSON.stringify({
      ...details,
      ...(status === "COMPLETED" ? { paidAt: new Date().toISOString() } : {}),
      payu: {
        status: p.status,
        mihpayid: p.mihpayid,
        mode: p.mode,
        bank_ref_num: p.bank_ref_num,
        error_Message: p.error_Message,
      },
    }),
    updated_at: new Date().toISOString(),
  });
  await logActivity({
    title:
      status === "COMPLETED"
        ? "Payment received"
        : status === "PENDING"
          ? "Payment pending"
          : "Payment failed",
    category: "ORDERS",
    actorEmail: order.customer_email,
    description: `${order.customer_name} - ${order.item_name} (${formatInr(Number(order.amount))}), txn ${txnid}${p.mode ? `, ${p.mode}` : ""}${p.error_Message && status !== "COMPLETED" ? ` - ${p.error_Message}` : ""}.`,
  });
  if (status === "COMPLETED")
    void sendReceipt(order.id).catch((e) => console.error("Receipt email failed", e));
  return { status: toResult(status), txnid };
}

/** Order confirmation page data (signed link only). */
export async function getConfirmation(txnid: string, token: string) {
  if (!validTxnToken(txnid, token))
    return { ok: false as const, error: "This confirmation link is not valid." };
  const o = await findByTxn(txnid);
  if (!o) return { ok: false as const, error: "We couldn't find this order." };
  return { ok: true as const, order: orderView(o) };
}
