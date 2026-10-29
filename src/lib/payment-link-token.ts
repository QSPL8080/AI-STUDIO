// Server-only: tokens for Admin / Super Admin generated customer payment links.
//
// A link looks like  https://quickuppaistudio.in/pay/pl3f9c…e1.Xk2…Q
//   • "pl…" is a random 96-bit link id (the database key, not guessable)
//   • after the dot is an HMAC-SHA256 signature of that id with the server secret
// Nothing secret is stored in the database: the signature is re-computed on the server to
// check a link (and to show "Copy link" in the CRM again later). Without the server secret a
// valid link can't be made or guessed. Single use and expiry are enforced from the link row.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { siteUrl } from "./payu";

/** Initial payment links are valid for exactly 24 hours from the moment they are generated. */
export const PAYMENT_LINK_VALIDITY_MS = 24 * 60 * 60 * 1000;

const ID_RE = /^pl[0-9a-f]{24}$/;
const TOKEN_RE = /^(pl[0-9a-f]{24})\.([A-Za-z0-9_-]{32})$/;

function secret() {
  // Same secret chain as the signed order / receipt links (checkout-server.ts), with its own
  // purpose prefix so a signature for one kind of link is never valid for another.
  return (
    process.env["CRM_SESSION_SECRET"] ||
    process.env["PAYU_SALT"] ||
    process.env["IND_SUPABASE_SERVICE_KEY"] ||
    process.env["DATABASE_URL"] ||
    "quickupp-order-links"
  );
}

function sign(id: string) {
  return createHmac("sha256", `payment-link|${secret()}`)
    .update(id)
    .digest("base64url")
    .slice(0, 32);
}

export function newPaymentLinkId() {
  return `pl${randomBytes(12).toString("hex")}`;
}

export function paymentLinkToken(id: string) {
  return `${id}.${sign(id)}`;
}

export function paymentLinkPath(id: string) {
  return `/pay/${paymentLinkToken(id)}`;
}

export function paymentLinkUrl(id: string) {
  return `${siteUrl()}${paymentLinkPath(id)}`;
}

/** Returns the link id when the token is genuine, otherwise null (constant-time compare). */
export function readPaymentLinkToken(token: string): string | null {
  const m = TOKEN_RE.exec(String(token || "").trim());
  if (!m) return null;
  const id = m[1]!;
  if (!ID_RE.test(id)) return null;
  const a = Buffer.from(sign(id));
  const b = Buffer.from(m[2]!);
  return a.length === b.length && timingSafeEqual(a, b) ? id : null;
}
