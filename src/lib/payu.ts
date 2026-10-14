// Server-only: PayU India hosted checkout.
//
// HOW TO SWITCH ON PAYU (no code changes needed) — add these in Hostinger → Environment variables:
//   PAYU_KEY   = your merchant key        (PayU dashboard → Developers → API keys)
//   PAYU_SALT  = your merchant salt (v1)
//   PAYU_MODE  = test | live              (default: test)
//   PUBLIC_SITE_URL = https://quickuppaistudio.in
// Until PAYU_KEY and PAYU_SALT are set, checkout still records the order (status PENDING)
// and tells the customer the team will send a secure payment link.
//
// Flow: browser form-POSTs the fields below to PayU → customer pays → PayU POSTs the result
// to /api/payu/callback (surl/furl) → the hash is verified → order marked COMPLETED / FAILED.
import { createHash } from "node:crypto";

export function getPayUConfig() {
  const key = (process.env.PAYU_KEY || process.env.PAYU_MERCHANT_KEY || "").trim();
  const salt = (process.env.PAYU_SALT || process.env.PAYU_MERCHANT_SALT || "").trim();
  if (!key || !salt) return null;
  const live = (process.env.PAYU_MODE || "test").toLowerCase() === "live";
  return {
    key,
    salt,
    live,
    action: live ? "https://secure.payu.in/_payment" : "https://test.payu.in/_payment",
  };
}

export function siteUrl() {
  return (process.env.PUBLIC_SITE_URL || "https://quickuppaistudio.in").replace(/\/+$/, "");
}

const sha512 = (s: string) => createHash("sha512").update(s).digest("hex");

export interface PayUPaymentInput {
  txnid: string;
  amount: string; // "8999.00" — the exact string is part of the hash
  productinfo: string;
  firstname: string;
  email: string;
  phone: string;
  udf1?: string; // our order id
}

/** Fields for the auto-submitted form that sends the customer to PayU. */
export function buildPayUForm(input: PayUPaymentInput) {
  const cfg = getPayUConfig();
  if (!cfg) return null;
  const udf = [input.udf1 || "", "", "", "", ""];
  // key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT
  const hash = sha512(
    [
      cfg.key,
      input.txnid,
      input.amount,
      input.productinfo,
      input.firstname,
      input.email,
      ...udf,
      "",
      "",
      "",
      "",
      "",
      cfg.salt,
    ].join("|"),
  );
  const callback = `${siteUrl()}/api/payu/callback`;
  return {
    action: cfg.action,
    fields: {
      key: cfg.key,
      txnid: input.txnid,
      amount: input.amount,
      productinfo: input.productinfo,
      firstname: input.firstname,
      email: input.email,
      phone: input.phone,
      udf1: udf[0]!,
      surl: callback,
      furl: callback,
      hash,
    } as Record<string, string>,
  };
}

/** Verifies the reverse hash PayU sends back, so a forged "success" post is rejected. */
export function verifyPayUResponse(p: Record<string, string>) {
  const cfg = getPayUConfig();
  if (!cfg) return false;
  // [additionalCharges|]SALT|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key
  const parts = [
    cfg.salt,
    p.status || "",
    "",
    "",
    "",
    "",
    "",
    p.udf5 || "",
    p.udf4 || "",
    p.udf3 || "",
    p.udf2 || "",
    p.udf1 || "",
    p.email || "",
    p.firstname || "",
    p.productinfo || "",
    p.amount || "",
    p.txnid || "",
    cfg.key,
  ];
  if (p.additionalCharges) parts.unshift(p.additionalCharges);
  const expected = sha512(parts.join("|"));
  return !!p.hash && expected.toLowerCase() === String(p.hash).toLowerCase();
}
