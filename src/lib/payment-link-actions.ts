// Server functions for Admin / Super Admin generated payment links. Thin wrappers — all logic,
// role checks and amount calculations live in ./payment-links.ts (loaded on the server only).
import { createServerFn } from "@tanstack/react-start";
import type { CreatePaymentLinkInput, EditPaymentLinkInput } from "./payment-links";

const srv = () => import("./payment-links");
const guarded = async <T>(fn: () => Promise<T>) => (await import("./crm-server")).guard(fn);

type Tok = { token: string };

// ---- CRM (session token + Admin / Super Admin role, checked on the server) ----
export const crmCreatePaymentLinkFn = createServerFn({ method: "POST" })
  .validator((d: Tok & { link: CreatePaymentLinkInput }) => d)
  .handler(async ({ data }) =>
    guarded(async () => (await srv()).createPaymentLink(data.token, data.link)),
  );

export const crmListPaymentLinksFn = createServerFn({ method: "POST" })
  .validator((d: Tok) => d)
  .handler(async ({ data }) => guarded(async () => (await srv()).listPaymentLinks(data.token)));

export const crmLeadPaymentLinksFn = createServerFn({ method: "POST" })
  .validator((d: Tok & { leadId: string }) => d)
  .handler(async ({ data }) =>
    guarded(async () => (await srv()).leadPaymentLinks(data.token, String(data.leadId || ""))),
  );

export const crmCancelPaymentLinkFn = createServerFn({ method: "POST" })
  .validator((d: Tok & { id: string }) => d)
  .handler(async ({ data }) =>
    guarded(async () => (await srv()).cancelPaymentLink(data.token, String(data.id || ""))),
  );

export const crmEditPaymentLinkFn = createServerFn({ method: "POST" })
  .validator((d: Tok & { id: string; link: EditPaymentLinkInput }) => d)
  .handler(async ({ data }) =>
    guarded(async () =>
      (await srv()).editPaymentLink(data.token, String(data.id || ""), data.link),
    ),
  );

export const crmDeletePaymentLinkFn = createServerFn({ method: "POST" })
  .validator((d: Tok & { id: string }) => d)
  .handler(async ({ data }) =>
    guarded(async () => (await srv()).deletePaymentLink(data.token, String(data.id || ""))),
  );

export const crmResendLinkReceiptFn = createServerFn({ method: "POST" })
  .validator((d: Tok & { rowId: string }) => d)
  .handler(async ({ data }) =>
    guarded(async () => (await srv()).resendLinkReceipt(data.token, String(data.rowId || ""))),
  );

// ---- Customer payment page (public: the signed link token is the only key) ----
// Only the token and the Full / Partial choice are read. Any other field (amount, coupon,
// service, quantity…) sent by a browser is ignored.
export const getPaymentLinkFn = createServerFn({ method: "POST" })
  .validator((d: { token: string }) => ({ token: String(d?.token || "").slice(0, 200) }))
  .handler(async ({ data }) => {
    try {
      return await (await srv()).getPaymentLinkForCustomer(data.token);
    } catch (e) {
      console.error("Payment link lookup failed", e);
      return {
        ok: false as const,
        error: "We couldn't load this payment link right now. Please refresh the page.",
      };
    }
  });

export const startPaymentLinkFn = createServerFn({ method: "POST" })
  .validator((d: { token: string; choice: string }) => ({
    token: String(d?.token || "").slice(0, 200),
    choice: String(d?.choice || "").slice(0, 16),
  }))
  .handler(async ({ data }) => {
    try {
      return await (await srv()).startPaymentLinkPayment(data.token, data.choice);
    } catch (e) {
      console.error("Payment link checkout failed", e);
      return {
        ok: false as const,
        error: "We couldn't start the payment right now. Please try again in a minute.",
      };
    }
  });
