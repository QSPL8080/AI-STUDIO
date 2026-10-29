// CRM UI for Admin / Super Admin generated customer payment links:
//   • PaymentLinksTab          — "Payment Links" tab: list, status, copy / share, cancel
//   • GeneratePaymentLinkModal — the form (customer, video type, quantity, custom total, source)
//   • LeadPaymentLinksCard     — lead details popup: the lead's Orders and Payments
// All rules (roles, amounts, expiry, single use) are enforced on the server (lib/payment-links.ts).
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Copy,
  ExternalLink,
  Link2,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Share2,
  X,
} from "lucide-react";
import {
  INDIA_PACKS,
  INDIA_SERVICES,
  TWIN_SETUP,
  TWIN_SETUP_ID,
  quoteItem,
  splitPayment,
} from "@/lib/india-pricing";
import {
  crmCancelPaymentLinkFn,
  crmCreatePaymentLinkFn,
  crmLeadPaymentLinksFn,
  crmListPaymentLinksFn,
  crmResendLinkReceiptFn,
} from "@/lib/payment-link-actions";
import type { PaymentLinkView } from "@/lib/payment-links";
import type { LeadItem } from "./crm-types";

type Call = (p: Promise<unknown>) => Promise<any | null>;
type Toast = (text: string, kind?: "success" | "error" | "info") => void;
export type PayLinkPrefill = {
  leadId?: string;
  leadSource?: "Manual" | "Meta";
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
};

const card = "rounded-lg border border-slate-200 bg-white";
const btnGhost =
  "inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-md border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-100 text-[13px] font-medium transition-colors disabled:opacity-50";
const btnPrimary =
  "inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-md bg-purple-600 hover:bg-purple-500 text-white text-[13px] font-semibold shadow-sm transition-all active:scale-[0.98] disabled:opacity-50";
const btnSm =
  "h-8 px-2.5 rounded-md border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-50";
const inputCls =
  "w-full h-9 px-3 rounded-md border border-slate-200 bg-white text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500";
const labelCls = "block text-[12px] font-semibold text-slate-700 mb-1";

const inr = (n: number) => `₹${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString("en-IN")}`;
const fmtIst = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : "—";
const last10 = (p: string) =>
  String(p || "")
    .replace(/[^\d]/g, "")
    .slice(-10);
const waNumber = (p: string) => {
  const d = String(p || "").replace(/[^\d]/g, "");
  return d.length === 10 ? `91${d}` : d;
};
const AMOUNT_RE = /^\d+(\.\d{1,2})?$/;

const LINK_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  PAYMENT_PENDING: "Payment Pending",
  USED: "Used",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};
const LINK_STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-300",
  PAYMENT_PENDING: "bg-amber-50 text-amber-700 border-amber-300",
  USED: "bg-purple-50 text-purple-700 border-purple-300",
  EXPIRED: "bg-slate-100 text-slate-600 border-slate-300",
  CANCELLED: "bg-red-50 text-red-700 border-red-300",
};
const PAY_STATUS_STYLE: Record<string, string> = {
  "Fully Paid": "text-emerald-700",
  "Partially Paid": "text-orange-600",
  "Payment Pending": "text-amber-600",
  "Not Paid": "text-slate-500",
  Refunded: "text-slate-500",
};
const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: "Awaiting payment",
  COMPLETED: "Paid",
  FAILED: "Last attempt failed",
  CANCELLED: "Closed (not paid)",
  REFUNDED: "Refunded",
  DELETED: "Order deleted",
};

function StatusChip({ status }: { status: string }) {
  return (
    <span
      className={`inline-block whitespace-nowrap px-2 py-0.5 rounded-md border text-[11px] font-semibold ${LINK_STATUS_STYLE[status] || LINK_STATUS_STYLE["EXPIRED"]}`}
    >
      {LINK_STATUS_LABEL[status] || status}
    </span>
  );
}

function copyText(text: string, toast: Toast, what = "Link") {
  navigator.clipboard
    ?.writeText(text)
    .then(() => toast(`${what} copied to clipboard.`))
    .catch(() => toast("Could not copy automatically — select the link and copy it.", "error"));
}

function shareMessage(
  l: { customerName: string; itemName: string; totalAmount: number; expiresAt: string },
  url: string,
) {
  const first = l.customerName.split(" ")[0];
  return `Hello ${first}, here is your secure payment link from Quickupp AI Studio for ${l.itemName} (total ${inr(l.totalAmount)}).\n\nYou can pay the full amount or a part of it — just open the link and choose:\n${url}\n\nThe link is valid until ${fmtIst(l.expiresAt)} IST. No forms or account needed.`;
}
function balanceMessage(
  l: { customerName: string; orderId: string; balanceDue: number },
  url: string,
) {
  return `Hello ${l.customerName.split(" ")[0]}, thank you for your payment for order ${l.orderId}. The remaining balance of ${inr(l.balanceDue)} can be paid securely here: ${url}`;
}

// ===========================================================================
// Generate Payment Link modal
// ===========================================================================
export function GeneratePaymentLinkModal({
  token,
  toast,
  onAuthError,
  leads,
  prefill,
  onClose,
  onCreated,
}: {
  token: () => string;
  toast: Toast;
  onAuthError: (msg?: string) => void;
  leads: LeadItem[];
  prefill: PayLinkPrefill | null;
  onClose: () => void;
  onCreated: (link: PaymentLinkView) => void;
}) {
  const blank = useCallback(
    () => ({
      leadSource: (prefill?.leadSource || "") as "" | "Manual" | "Meta",
      name: prefill?.name || "",
      email: prefill?.email || "",
      phone: prefill?.phone || "",
      company: prefill?.company || "",
      serviceId: INDIA_SERVICES[0]!.id as string,
      qty: 1,
      totalAmount: "",
      notes: "",
    }),
    [prefill],
  );
  const [f, setF] = useState(blank);
  // "" = not chosen yet, "new" = create a new lead, otherwise an existing lead id
  const [leadChoice, setLeadChoice] = useState<string>(prefill?.leadId || "");
  const [serverMatches, setServerMatches] = useState<
    | {
        id: string;
        name: string;
        phone: string;
        email: string;
        source: string;
        createdAt: string;
      }[]
    | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<PaymentLinkView | null>(null);

  const isSetup = f.serviceId === TWIN_SETUP_ID;
  const set =
    (k: keyof ReturnType<typeof blank>) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setF((x) => ({ ...x, [k]: k === "qty" ? Number(e.target.value) : e.target.value }));

  // Existing leads for the same customer (same mobile or email), from the leads already loaded.
  const localMatches = useMemo(() => {
    if (prefill?.leadId) return [];
    const p = last10(f.phone);
    const em = f.email.trim().toLowerCase();
    if (p.length < 10 && !/@.+\./.test(em)) return [];
    return leads
      .filter(
        (l) =>
          !l.deletedAt &&
          ((p.length === 10 && last10(l.phone) === p) ||
            (!!em && (l.email || "").toLowerCase() === em)),
      )
      .slice(0, 6)
      .map((l) => ({
        id: l.id,
        name: l.clientName,
        phone: l.phone,
        email: l.email,
        source: l.source,
        createdAt: l.createdAt,
      }));
  }, [leads, f.phone, f.email, prefill?.leadId]);
  const matches = serverMatches || localMatches;
  const prefillLead = prefill?.leadId ? leads.find((l) => l.id === prefill.leadId) : null;
  useEffect(() => {
    // A choice that no longer matches the typed customer is cleared.
    if (prefill?.leadId) return;
    if (leadChoice && leadChoice !== "new" && !matches.some((m) => m.id === leadChoice))
      setLeadChoice("");
  }, [matches, leadChoice, prefill?.leadId]);

  const quote = useMemo(
    () => quoteItem(f.serviceId, isSetup ? 1 : f.qty),
    [f.serviceId, f.qty, isSetup],
  );
  const amountOk =
    AMOUNT_RE.test(f.totalAmount.replace(/[,\s₹]/g, "")) &&
    Number(f.totalAmount.replace(/[,\s₹]/g, "")) >= 1;
  const total = amountOk ? Number(f.totalAmount.replace(/[,\s₹]/g, "")) : 0;
  const preview = amountOk ? splitPayment(total, "advance") : null;
  const needsLeadChoice = !prefill?.leadId && matches.length > 0 && !leadChoice;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!f.leadSource) return setError("Choose the lead source: Manual or Meta.");
    if (f.name.trim().length < 2) return setError("Enter the customer's full name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim()))
      return setError("Enter a valid customer email address.");
    const digits = f.phone.replace(/[^\d]/g, "");
    if (digits.length < 10 || digits.length > 13)
      return setError("Enter a valid 10-digit mobile number.");
    if (!amountOk) return setError("Enter the custom total amount in rupees, e.g. 6000.");
    if (needsLeadChoice)
      return setError(
        "This customer already has a lead: choose which lead to use, or create a new one.",
      );
    setBusy(true);
    try {
      const r: any = await crmCreatePaymentLinkFn({
        data: {
          token: token(),
          link: {
            leadSource: f.leadSource,
            name: f.name,
            email: f.email,
            phone: f.phone,
            company: f.company,
            notes: f.notes,
            serviceId: f.serviceId,
            qty: isSetup ? 1 : f.qty,
            totalAmount: f.totalAmount,
            ...(leadChoice && leadChoice !== "new" ? { leadId: leadChoice } : {}),
            ...(leadChoice === "new" ? { createNewLead: true } : {}),
          },
        },
      });
      if (r?.ok) {
        setCreated(r.link);
        onCreated(r.link);
        toast("Payment link generated.");
      } else if (r?.code === "LEAD_MATCH") {
        setServerMatches(r.matches || []);
        setLeadChoice("");
        setError(r.error);
      } else if (r?.code === "UNAUTHENTICATED") onAuthError(r.error);
      else setError(r?.error || "Could not generate the link.");
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-3 sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-lg border border-slate-200 bg-white p-5 sm:p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-600 hover:text-slate-900"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3 mb-5 pr-6">
          <div className="p-2.5 rounded-md bg-purple-50 text-purple-600 border border-purple-200 shrink-0">
            {created ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <Link2 className="w-5 h-5" />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900">
              {created ? "Payment link ready" : "Generate Payment Link"}
            </h3>
            <p className="text-[13px] text-slate-600">
              {created
                ? "Share it with the customer. They choose Full or Partial payment themselves."
                : "The customer pays this custom total through PayU. Valid for 24 hours, single use, no coupons."}
            </p>
          </div>
        </div>

        {created ? (
          <CreatedLink
            link={created}
            toast={toast}
            onDone={onClose}
            onAnother={() => {
              setCreated(null);
              setF(blank());
              setLeadChoice(prefill?.leadId || "");
              setServerMatches(null);
            }}
          />
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <span className={labelCls}>Lead source *</span>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Lead source">
                {(["Manual", "Meta"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={f.leadSource === s}
                    onClick={() => setF((x) => ({ ...x, leadSource: s }))}
                    className={`h-10 rounded-md border text-[13px] font-semibold ${f.leadSource === s ? "border-purple-500 bg-purple-50 text-purple-800" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
                  >
                    {s === "Manual" ? "Manual" : "Meta (Facebook / Instagram)"}
                  </button>
                ))}
              </div>
              {(prefill?.leadId || (leadChoice && leadChoice !== "new")) && (
                <p className="mt-1 text-[11px] text-slate-500">
                  The existing lead keeps its original source; this choice is recorded on the
                  payment link.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className={labelCls}>Customer full name *</span>
                <input
                  value={f.name}
                  onChange={set("name")}
                  className={inputCls}
                  placeholder="e.g. Rahul Sharma"
                  autoComplete="off"
                />
              </label>
              <label className="block">
                <span className={labelCls}>Mobile number (WhatsApp) *</span>
                <input
                  value={f.phone}
                  onChange={(e) => {
                    set("phone")(e);
                    setServerMatches(null);
                  }}
                  className={inputCls}
                  placeholder="+91 98765 43210"
                  inputMode="tel"
                  autoComplete="off"
                />
              </label>
              <label className="block">
                <span className={labelCls}>Email address *</span>
                <input
                  value={f.email}
                  onChange={(e) => {
                    set("email")(e);
                    setServerMatches(null);
                  }}
                  className={inputCls}
                  placeholder="customer@company.com"
                  inputMode="email"
                  autoComplete="off"
                />
              </label>
              <label className="block">
                <span className={labelCls}>Company / brand name</span>
                <input
                  value={f.company}
                  onChange={set("company")}
                  className={inputCls}
                  placeholder="Optional — customer name is used if blank"
                  autoComplete="off"
                />
              </label>
            </div>

            {prefillLead && (
              <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-[12px] text-sky-800">
                Attached to lead <b>{prefillLead.clientName}</b> ({prefillLead.source}).
              </div>
            )}
            {!prefill?.leadId && matches.length > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
                <div className="flex items-center gap-1.5 text-[12px] font-bold text-amber-800">
                  <AlertTriangle className="w-4 h-4" /> This customer already has{" "}
                  {matches.length === 1 ? "a lead" : `${matches.length} leads`} — choose one
                </div>
                <div className="mt-2 space-y-1.5">
                  {matches.map((m) => (
                    <label
                      key={m.id}
                      className="flex items-start gap-2 text-[12px] text-slate-800 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="leadChoice"
                        checked={leadChoice === m.id}
                        onChange={() => setLeadChoice(m.id)}
                        className="mt-0.5 accent-purple-600"
                      />
                      <span>
                        Use existing lead: <b>{m.name}</b> · {m.phone}
                        {m.email ? ` · ${m.email}` : ""} · {m.source} · {fmtIst(m.createdAt)}
                      </span>
                    </label>
                  ))}
                  <label className="flex items-start gap-2 text-[12px] text-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      name="leadChoice"
                      checked={leadChoice === "new"}
                      onChange={() => setLeadChoice("new")}
                      className="mt-0.5 accent-purple-600"
                    />
                    <span>Create a new lead (a different order / opportunity)</span>
                  </label>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className={labelCls}>Video type *</span>
                <select value={f.serviceId} onChange={set("serviceId")} className={inputCls}>
                  {INDIA_SERVICES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                  <option value={TWIN_SETUP_ID}>{TWIN_SETUP.name} (One-Time)</option>
                </select>
              </label>
              <label className="block">
                <span className={labelCls}>Quantity *</span>
                <select
                  value={isSetup ? 1 : f.qty}
                  onChange={set("qty")}
                  disabled={isSetup}
                  className={inputCls}
                >
                  {isSetup ? (
                    <option value={1}>One-Time Setup</option>
                  ) : (
                    INDIA_PACKS.map((p) => (
                      <option key={p.qty} value={p.qty}>
                        {p.label}
                      </option>
                    ))
                  )}
                </select>
              </label>
            </div>

            <div>
              <label className="block">
                <span className={labelCls}>Custom total amount (₹) *</span>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-[13px] font-semibold">
                    ₹
                  </span>
                  <input
                    value={f.totalAmount}
                    onChange={set("totalAmount")}
                    className={`${inputCls} pl-7 text-[15px] font-bold`}
                    placeholder="e.g. 6000"
                    inputMode="decimal"
                    autoComplete="off"
                  />
                </div>
              </label>
              <p className="mt-1 text-[11px] text-slate-500">
                Website price for reference: {inr(quote.amount)} ({quote.itemName}). The customer
                will pay exactly the amount you enter.
                {preview &&
                  (preview.plan === "advance"
                    ? ` If they choose Partial, they pay ${inr(preview.payNow)} now and ${inr(total - preview.payNow)} later (existing 50% rule).`
                    : " This amount is too small to split, so only Full Payment will be offered.")}
              </p>
            </div>

            <label className="block">
              <span className={labelCls}>Notes for the team (not shown to the customer)</span>
              <textarea
                value={f.notes}
                onChange={set("notes")}
                rows={2}
                className={`${inputCls} h-auto py-2`}
                placeholder="Optional"
              />
            </label>

            {error && (
              <div
                role="alert"
                className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700"
              >
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button type="button" onClick={onClose} className={btnGhost} disabled={busy}>
                Cancel
              </button>
              <button type="submit" disabled={busy} className={btnPrimary}>
                {busy
                  ? "Generating…"
                  : needsLeadChoice
                    ? "Choose a lead option"
                    : "Generate Payment Link"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function CreatedLink({
  link,
  toast,
  onDone,
  onAnother,
}: {
  link: PaymentLinkView;
  toast: Toast;
  onDone: () => void;
  onAnother: () => void;
}) {
  const msg = shareMessage(link, link.url);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-[12px]">
        <div>
          <div className="text-slate-500">Customer</div>
          <div className="font-semibold text-slate-900">{link.customerName}</div>
        </div>
        <div>
          <div className="text-slate-500">Service</div>
          <div className="font-semibold text-slate-900">{link.itemName}</div>
        </div>
        <div>
          <div className="text-slate-500">Total</div>
          <div className="font-bold text-slate-900">{inr(link.totalAmount)}</div>
        </div>
        <div>
          <div className="text-slate-500">Valid until</div>
          <div className="font-semibold text-slate-900">{fmtIst(link.expiresAt)}</div>
        </div>
      </div>
      <div>
        <span className={labelCls}>Customer payment link</span>
        <div className="flex gap-2">
          <input
            readOnly
            value={link.url}
            onFocus={(e) => e.currentTarget.select()}
            className={`${inputCls} font-mono text-[12px]`}
          />
          <button type="button" onClick={() => copyText(link.url, toast)} className={btnPrimary}>
            <Copy className="w-4 h-4" /> Copy Link
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <a
          href={`https://wa.me/${waNumber(link.customerPhone)}?text=${encodeURIComponent(msg)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-semibold"
        >
          <Share2 className="w-4 h-4" /> WhatsApp
        </a>
        <a
          href={`sms:${link.customerPhone.replace(/\s/g, "")}?body=${encodeURIComponent(msg)}`}
          className={btnGhost}
        >
          SMS
        </a>
        <a
          href={`mailto:${link.customerEmail}?subject=${encodeURIComponent("Your secure payment link — Quickupp AI Studio")}&body=${encodeURIComponent(msg)}`}
          className={btnGhost}
        >
          <Mail className="w-4 h-4" /> Email
        </a>
        <button type="button" onClick={() => copyText(msg, toast, "Message")} className={btnGhost}>
          <Copy className="w-4 h-4" /> Copy message
        </button>
      </div>
      <p className="text-[12px] text-slate-500">
        Lead and order <span className="font-mono">{link.orderId}</span> are already in the CRM. The
        link stops working after the first successful payment or after 24 hours.
      </p>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onAnother} className={btnGhost}>
          <Plus className="w-4 h-4" /> Generate another
        </button>
        <button type="button" onClick={onDone} className={btnPrimary}>
          Done
        </button>
      </div>
    </div>
  );
}

// ===========================================================================
// Orders & Payments of payment links (used in the lead popup and the tab's Details)
// ===========================================================================
function LinkOrdersPayments({
  links,
  token,
  call,
  toast,
  canSeePayments,
  onChanged,
}: {
  links: PaymentLinkView[];
  token: () => string;
  call: Call;
  toast: Toast;
  canSeePayments: boolean;
  onChanged: () => void;
}) {
  const [view, setView] = useState<"orders" | "payments">("orders");
  const [busy, setBusy] = useState("");
  const txns = links.flatMap((l) => l.transactions.map((t) => ({ t, l })));
  const resend = async (rowId: string) => {
    setBusy(rowId);
    const r = await call(crmResendLinkReceiptFn({ data: { token: token(), rowId } }));
    setBusy("");
    if (r?.ok) {
      toast(
        r.receiptEmail === "sent"
          ? r.already
            ? "Receipt was already sent."
            : "Receipt email sent."
          : "Receipt email failed again — check the email settings.",
        r.receiptEmail === "sent" ? "success" : "error",
      );
      onChanged();
    }
  };
  return (
    <div>
      <div className="inline-flex rounded-md border border-slate-200 p-0.5 mb-3" role="tablist">
        {(["orders", "payments"] as const).map((v) => (
          <button
            key={v}
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={`h-8 px-3.5 rounded text-[12px] font-semibold ${view === v ? "bg-purple-600 text-white" : "text-slate-600 hover:text-slate-900"}`}
          >
            {v === "orders"
              ? `Orders (${links.length})`
              : `Payments (${txns.filter((x) => x.t.status !== "Pending").length})`}
          </button>
        ))}
      </div>

      {view === "orders" ? (
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="w-full min-w-[1100px] text-left text-[12px]">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600">
              <tr>
                {[
                  "Order ID",
                  "Customer",
                  "Video type",
                  "Qty",
                  "Total",
                  "Paid",
                  "Remaining",
                  "Payment status",
                  "Order status",
                  "Link",
                  "Created",
                  "Source",
                  "",
                ].map((h) => (
                  <th key={h} className="px-2.5 py-2.5 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {links.map((l) => (
                <tr key={l.id} className="align-top">
                  <td className="px-2.5 py-2.5 font-mono whitespace-nowrap">{l.orderId}</td>
                  <td className="px-2.5 py-2.5">
                    <div className="font-semibold text-slate-900">{l.customerName}</div>
                    <div className="text-slate-500">{l.customerPhone}</div>
                  </td>
                  <td className="px-2.5 py-2.5">{l.serviceName}</td>
                  <td className="px-2.5 py-2.5">
                    {l.serviceId === TWIN_SETUP_ID ? "Setup" : l.qty}
                  </td>
                  <td className="px-2.5 py-2.5 font-bold whitespace-nowrap">
                    {inr(l.totalAmount)}
                  </td>
                  <td className="px-2.5 py-2.5 text-emerald-700 font-semibold whitespace-nowrap">
                    {inr(l.paidTotal)}
                  </td>
                  <td className="px-2.5 py-2.5 font-semibold whitespace-nowrap">
                    {l.balanceDue > 0 ? (
                      <span className="text-orange-600">{inr(l.balanceDue)}</span>
                    ) : (
                      "₹0"
                    )}
                  </td>
                  <td
                    className={`px-2.5 py-2.5 font-semibold whitespace-nowrap ${PAY_STATUS_STYLE[l.paymentStatus] || ""}`}
                  >
                    {l.paymentStatus}
                  </td>
                  <td className="px-2.5 py-2.5 whitespace-nowrap">
                    {ORDER_STATUS_LABEL[l.orderStatus] || l.orderStatus}
                  </td>
                  <td className="px-2.5 py-2.5">
                    <StatusChip status={l.status} />
                  </td>
                  <td className="px-2.5 py-2.5 whitespace-nowrap">{fmtIst(l.createdAt)}</td>
                  <td className="px-2.5 py-2.5">{l.leadSource}</td>
                  <td className="px-2.5 py-2.5">
                    <div className="flex flex-col gap-1 items-end">
                      {l.url && (
                        <button className={btnSm} onClick={() => copyText(l.url, toast)}>
                          <Copy className="w-3.5 h-3.5" /> Link
                        </button>
                      )}
                      {l.payBalanceUrl && (
                        <button
                          className={`${btnSm} border-orange-200 text-orange-700 bg-orange-50`}
                          onClick={() => copyText(l.payBalanceUrl, toast, "Balance link")}
                        >
                          <Copy className="w-3.5 h-3.5" /> Balance link
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !canSeePayments ? (
        <p className="text-[12px] text-slate-500">
          Transaction details need the Orders &amp; Payments permission.
        </p>
      ) : txns.length === 0 ? (
        <p className="text-[12px] text-slate-500">
          No payments yet. Successful PayU payments appear here automatically.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="w-full min-w-[1250px] text-left text-[12px]">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600">
              <tr>
                {[
                  "Transaction ID",
                  "Order ID",
                  "Type",
                  "Method",
                  "Order total",
                  "Paid (this txn)",
                  "Paid so far",
                  "Remaining",
                  "Status",
                  "Date / time",
                  "PayU ref",
                  "Receipt",
                  "Outstanding link",
                ].map((h) => (
                  <th key={h} className="px-2.5 py-2.5 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {txns.map(({ t, l }, i) => {
                const lastPaidOfOrder =
                  t.status === "Paid" &&
                  !txns.slice(i + 1).some((x) => x.l.id === l.id && x.t.status === "Paid");
                return (
                  <tr key={t.rowId + t.txnid} className="align-top">
                    <td className="px-2.5 py-2.5 font-mono whitespace-nowrap">{t.txnid}</td>
                    <td className="px-2.5 py-2.5 font-mono whitespace-nowrap">{t.orderId}</td>
                    <td className="px-2.5 py-2.5 whitespace-nowrap">{t.planLabel}</td>
                    <td className="px-2.5 py-2.5 whitespace-nowrap">{t.method} · Payment link</td>
                    <td className="px-2.5 py-2.5 whitespace-nowrap">{inr(t.orderTotal)}</td>
                    <td className="px-2.5 py-2.5 font-bold whitespace-nowrap">{inr(t.amount)}</td>
                    <td className="px-2.5 py-2.5 whitespace-nowrap">
                      {t.cumulativePaid === null ? "—" : inr(t.cumulativePaid)}
                    </td>
                    <td className="px-2.5 py-2.5 whitespace-nowrap">
                      {t.remaining === null ? (
                        "—"
                      ) : t.remaining > 0 ? (
                        <span className="text-orange-600 font-semibold">{inr(t.remaining)}</span>
                      ) : (
                        "₹0"
                      )}
                    </td>
                    <td
                      className={`px-2.5 py-2.5 font-semibold whitespace-nowrap ${t.status === "Paid" ? (t.remaining ? "text-orange-600" : "text-emerald-700") : "text-amber-600"}`}
                    >
                      {t.status === "Paid"
                        ? t.remaining
                          ? "Partially Paid"
                          : "Fully Paid"
                        : t.status}
                    </td>
                    <td className="px-2.5 py-2.5 whitespace-nowrap">{fmtIst(t.paidAt)}</td>
                    <td className="px-2.5 py-2.5 font-mono whitespace-nowrap">
                      {t.payuRef || "—"}
                      {t.bankRef && <div className="text-slate-500">Bank {t.bankRef}</div>}
                    </td>
                    <td className="px-2.5 py-2.5 whitespace-nowrap">
                      {t.receiptUrl ? (
                        <div className="flex flex-col gap-1">
                          <a
                            href={t.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-purple-700 hover:underline"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> PDF
                          </a>
                          <span
                            className={
                              t.receiptEmail === "sent" ? "text-emerald-700" : "text-red-600"
                            }
                          >
                            Email: {t.receiptEmail}
                          </span>
                          {t.receiptEmail !== "sent" && (
                            <button
                              className={btnSm}
                              disabled={busy === t.rowId}
                              onClick={() => resend(t.rowId)}
                            >
                              <RefreshCw className="w-3.5 h-3.5" /> Retry email
                            </button>
                          )}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-2.5 py-2.5">
                      {lastPaidOfOrder && l.payBalanceUrl ? (
                        <button
                          className={`${btnSm} border-orange-200 text-orange-700 bg-orange-50`}
                          onClick={() => copyText(l.payBalanceUrl, toast, "Balance link")}
                        >
                          <Copy className="w-3.5 h-3.5" /> Copy {inr(l.balanceDue)} link
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// Lead details popup card
// ===========================================================================
export function LeadPaymentLinksCard({
  lead,
  token,
  call,
  toast,
  canSeePayments,
  onGenerate,
  refreshKey,
}: {
  lead: LeadItem;
  token: () => string;
  call: Call;
  toast: Toast;
  canSeePayments: boolean;
  onGenerate: (p: PayLinkPrefill) => void;
  refreshKey: number;
}) {
  const [links, setLinks] = useState<PaymentLinkView[] | null>(null);
  const [setupNeeded, setSetupNeeded] = useState(false);
  // The CRM re-renders every second (sync countdown) and passes new token/call functions each
  // time: keep them in refs so the data loads only when the lead or refreshKey changes.
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const callRef = useRef(call);
  callRef.current = call;
  const load = useCallback(async () => {
    const r = await callRef.current(
      crmLeadPaymentLinksFn({ data: { token: tokenRef.current(), leadId: lead.id } }),
    );
    setLinks(r?.ok ? r.links : []);
    setSetupNeeded(!!r?.setupNeeded);
  }, [lead.id]);
  useEffect(() => {
    setLinks(null);
    void load();
  }, [load, refreshKey]);
  return (
    <div className={`${card} overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-slate-800">
          <Link2 className="w-4 h-4 text-purple-600" /> Payment Links · Orders &amp; Payments
        </div>
        <div className="flex items-center gap-2">
          <button className={btnGhost} onClick={() => void load()} title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
          {!lead.deletedAt && (
            <button
              className={btnPrimary}
              onClick={() =>
                onGenerate({
                  leadId: lead.id,
                  leadSource: lead.kind === "meta" ? "Meta" : "Manual",
                  name: lead.clientName,
                  email: lead.email,
                  phone: lead.phone,
                  company:
                    lead.companyName && lead.companyName !== lead.clientName
                      ? lead.companyName
                      : "",
                })
              }
            >
              <Plus className="w-4 h-4" /> Generate Payment Link
            </button>
          )}
        </div>
      </div>
      <div className="p-4">
        {links === null ? (
          <p className="text-[13px] text-slate-500">Loading…</p>
        ) : setupNeeded ? (
          <p className="text-[13px] text-amber-700">
            Payment links are not set up in the database yet — run the new part of
            supabase-update.sql.
          </p>
        ) : links.length === 0 ? (
          <p className="text-[13px] text-slate-500">No payment links for this lead yet.</p>
        ) : (
          <LinkOrdersPayments
            links={links}
            token={token}
            call={call}
            toast={toast}
            canSeePayments={canSeePayments}
            onChanged={load}
          />
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// "Payment Links" tab
// ===========================================================================
const FILTERS = [
  { id: "ALL", label: "All" },
  { id: "ACTIVE", label: "Active" },
  { id: "PAYMENT_PENDING", label: "Payment Pending" },
  { id: "USED", label: "Used" },
  { id: "EXPIRED", label: "Expired" },
  { id: "CANCELLED", label: "Cancelled" },
] as const;

export function PaymentLinksTab({
  token,
  call,
  toast,
  canSeePayments,
  onGenerate,
  onOpenLead,
  refreshKey,
}: {
  token: () => string;
  call: Call;
  toast: Toast;
  canSeePayments: boolean;
  onGenerate: () => void;
  onOpenLead: (leadId: string) => void;
  refreshKey: number;
}) {
  const [links, setLinks] = useState<PaymentLinkView[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>("ALL");
  const [q, setQ] = useState("");
  const [details, setDetails] = useState<PaymentLinkView | null>(null);
  const [busy, setBusy] = useState("");
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const callRef = useRef(call);
  callRef.current = call;
  const [setupNeeded, setSetupNeeded] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    const r = await callRef.current(crmListPaymentLinksFn({ data: { token: tokenRef.current() } }));
    setLoading(false);
    setSetupNeeded(!!r?.setupNeeded);
    if (r?.ok) setLinks(r.links);
    else setLinks((x) => x || []);
  }, []);
  useEffect(() => {
    void load();
  }, [load, refreshKey]);
  useEffect(() => {
    if (details && links) setDetails(links.find((l) => l.id === details.id) || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [links]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (links || []).filter(
      (l) =>
        (filter === "ALL" || l.status === filter) &&
        (!s ||
          [
            l.customerName,
            l.customerEmail,
            l.customerPhone,
            l.orderId,
            l.itemName,
            l.createdByName,
          ].some((v) => String(v).toLowerCase().includes(s))),
    );
  }, [links, filter, q]);
  const cancel = async (l: PaymentLinkView) => {
    if (
      !window.confirm(
        `Cancel the payment link for ${l.customerName} (${inr(l.totalAmount)})? The customer will no longer be able to pay with it.`,
      )
    )
      return;
    setBusy(l.id);
    const r = await call(crmCancelPaymentLinkFn({ data: { token: token(), id: l.id } }));
    setBusy("");
    if (r?.ok) {
      toast("Payment link cancelled.");
      void load();
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        className={`${card} p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4`}
      >
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-900 flex flex-wrap items-center gap-2.5">
            <Link2 className="w-5 h-5 text-purple-600" /> Payment Links
            {links && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-700 border border-purple-200">
                {links.length} links
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Customer payment links generated by Admins and the Super Admin · valid 24 hours · single
            use
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button className={btnGhost} onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button className={btnPrimary} onClick={onGenerate}>
            <Plus className="w-4 h-4" /> Generate Payment Link
          </button>
        </div>
      </div>

      <div className={`${card} p-3 flex flex-col lg:flex-row gap-3 lg:items-center`}>
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search customer, phone, order ID, generated by…"
            className={`${inputCls} pl-9`}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`h-8 px-3 rounded-md text-[12px] font-medium ${filter === f.id ? "bg-purple-600 text-white" : "border border-slate-200 text-slate-600 hover:text-slate-900"}`}
            >
              {f.label} (
              {f.id === "ALL"
                ? (links || []).length
                : (links || []).filter((l) => l.status === f.id).length}
              )
            </button>
          ))}
        </div>
      </div>

      <div className={`${card} overflow-hidden`}>
        {setupNeeded ? (
          <div className="p-8 text-center text-[13px] text-amber-700">
            Payment links are not set up in the database yet. Run the payment-links part of
            supabase-update.sql in Supabase → SQL Editor, then press Refresh.
          </div>
        ) : links === null ? (
          <div className="p-8 text-center text-[13px] text-slate-500">Loading payment links…</div>
        ) : shown.length === 0 ? (
          <div className="p-10 text-center">
            <Link2 className="w-8 h-8 mx-auto text-slate-300" />
            <div className="mt-2 text-sm font-semibold text-slate-800">
              {links.length ? "No links match this filter" : "No payment links yet"}
            </div>
            <div className="text-[13px] text-slate-500">
              Generate a link for a customer who can't use the website checkout.
            </div>
          </div>
        ) : (
          <div className="overflow-auto max-h-[70vh]">
            <table className="w-full min-w-[1020px] text-left text-[13px]">
              <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-600">
                <tr>
                  {[
                    "Customer & lead",
                    "Video / Total",
                    "Payment",
                    "Link status",
                    "Generated · Expires",
                    "",
                  ].map((h) => (
                    <th key={h} className="p-3 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shown.map((l) => (
                  <tr key={l.id} className="align-top hover:bg-slate-50">
                    <td className="p-3 max-w-[260px]">
                      <div className="font-bold text-slate-900">{l.customerName}</div>
                      <div className="text-xs text-slate-600">{l.customerPhone}</div>
                      <div className="text-xs text-slate-500 truncate" title={l.customerEmail}>
                        {l.customerEmail}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${l.leadSource === "Meta" ? "bg-sky-50 text-sky-700" : "bg-slate-100 text-slate-700"}`}
                        >
                          {l.leadSource}
                        </span>
                        <button
                          onClick={() => onOpenLead(l.leadId)}
                          className="text-xs font-semibold text-purple-700 hover:underline"
                        >
                          Open lead
                        </button>
                        <span className="text-[11px] text-slate-500 font-mono">{l.orderId}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-900">{l.serviceName}</div>
                      <div className="text-xs text-slate-600">
                        {l.serviceId === TWIN_SETUP_ID
                          ? "One-Time Setup"
                          : `${l.qty} reel${l.qty === 1 ? "" : "s"}`}
                      </div>
                      <div className="mt-0.5 font-bold whitespace-nowrap">{inr(l.totalAmount)}</div>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <div className={`font-semibold ${PAY_STATUS_STYLE[l.paymentStatus] || ""}`}>
                        {l.paymentStatus}
                      </div>
                      {l.paidTotal > 0 && (
                        <div className="text-xs text-slate-600">Paid {inr(l.paidTotal)}</div>
                      )}
                      {l.paidTotal > 0 && l.balanceDue > 0 && (
                        <div className="text-xs font-semibold text-orange-600">
                          Due {inr(l.balanceDue)}
                        </div>
                      )}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <StatusChip status={l.status} />
                      {l.usedAt && l.status === "USED" && (
                        <div className="text-[11px] text-slate-500 mt-1">
                          Paid {fmtIst(l.usedAt)}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-xs whitespace-nowrap">
                      <div className="font-semibold text-slate-800" title={l.createdByEmail}>
                        {l.createdByName || "—"}
                      </div>
                      <div className="text-slate-500">{fmtIst(l.createdAt)}</div>
                      <div className="text-slate-500">Expires {fmtIst(l.expiresAt)}</div>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap justify-end gap-1.5 min-w-[200px]">
                        {l.url && (
                          <>
                            <button
                              className={`${btnSm} border-purple-200 bg-purple-50 text-purple-700`}
                              onClick={() => copyText(l.url, toast)}
                            >
                              <Copy className="w-3.5 h-3.5" /> Copy Link
                            </button>
                            <a
                              className={`${btnSm} border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700`}
                              href={`https://wa.me/${waNumber(l.customerPhone)}?text=${encodeURIComponent(shareMessage(l, l.url))}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Share2 className="w-3.5 h-3.5" /> WhatsApp
                            </a>
                          </>
                        )}
                        {l.payBalanceUrl && (
                          <>
                            <button
                              className={`${btnSm} border-orange-200 bg-orange-50 text-orange-700`}
                              onClick={() => copyText(l.payBalanceUrl, toast, "Balance link")}
                            >
                              <Copy className="w-3.5 h-3.5" /> Balance Link
                            </button>
                            <a
                              className={`${btnSm} border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700`}
                              href={`https://wa.me/${waNumber(l.customerPhone)}?text=${encodeURIComponent(balanceMessage(l, l.payBalanceUrl))}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Share2 className="w-3.5 h-3.5" /> WhatsApp
                            </a>
                          </>
                        )}
                        <button className={btnSm} onClick={() => setDetails(l)}>
                          Details
                        </button>
                        {l.status === "ACTIVE" && (
                          <button
                            className={`${btnSm} border-red-200 text-red-600 hover:bg-red-50`}
                            disabled={busy === l.id}
                            onClick={() => cancel(l)}
                            title="Cancel this link"
                          >
                            <Ban className="w-3.5 h-3.5" /> Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {details && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-3 sm:p-6"
          onMouseDown={(e) => e.target === e.currentTarget && setDetails(null)}
        >
          <div className="w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-lg border border-slate-200 bg-white p-5 shadow-2xl relative">
            <button
              onClick={() => setDetails(null)}
              className="absolute top-4 right-4 text-slate-600 hover:text-slate-900"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-base font-bold text-slate-900 pr-8">
              {details.customerName} · {details.itemName} · {inr(details.totalAmount)}
            </h3>
            <p className="text-[12px] text-slate-500 mb-4">
              Generated by {details.createdByName} on {fmtIst(details.createdAt)} · expires{" "}
              {fmtIst(details.expiresAt)}
              {details.cancelledAt
                ? ` · cancelled ${fmtIst(details.cancelledAt)} by ${details.cancelledBy}`
                : ""}
            </p>
            <LinkOrdersPayments
              links={[details]}
              token={token}
              call={call}
              toast={toast}
              canSeePayments={canSeePayments}
              onChanged={load}
            />
          </div>
        </div>
      )}
    </div>
  );
}
