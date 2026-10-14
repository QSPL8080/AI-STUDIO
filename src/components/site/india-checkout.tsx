import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, Clock, Lock, ShieldCheck, X } from "lucide-react";
import { createIndiaOrderFn } from "@/lib/checkout-actions";
import {
  INDIA_PACKS,
  INDIA_SERVICES,
  formatInr,
  isPackQty,
  quoteIndia,
  type IndiaPackQty,
  type IndiaServiceId,
} from "@/lib/india-pricing";
import { whatsAppNumber } from "./data";

// ---------------------------------------------------------------------------
// Open the checkout from anywhere: openBuyNow({ serviceId: "ai-avatar", qty: 5 })
// ---------------------------------------------------------------------------
export interface BuyNowOptions {
  serviceId?: IndiaServiceId;
  qty?: IndiaPackQty;
}

const OPEN_EVENT = "open-india-checkout";

export function openBuyNow(opts: BuyNowOptions = {}) {
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: opts }));
}

/** Solid white "Buy Now →" button used across the site. */
export function BuyNowButton({
  serviceId,
  qty,
  size = "md",
  label = "Buy Now",
  className = "",
}: BuyNowOptions & { size?: "xs" | "sm" | "md"; label?: string; className?: string }) {
  const sizing =
    size === "xs" ? "h-8 px-3.5 text-xs" : size === "sm" ? "h-9 px-4 text-xs" : "h-11 px-6 text-sm";
  return (
    <button
      type="button"
      onClick={() => openBuyNow({ ...(serviceId ? { serviceId } : {}), ...(qty ? { qty } : {}) })}
      className={`group inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-white font-semibold text-[#0b0717] shadow-[0_4px_18px_rgba(255,255,255,0.12)] transition-all duration-200 hover:bg-white/90 hover:shadow-[0_6px_24px_rgba(255,255,255,0.22)] active:scale-95 cursor-pointer ${sizing} ${className}`}
    >
      <span>{label}</span>
      <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-1">
        →
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Checkout modal
// ---------------------------------------------------------------------------
type Step = "form" | "redirecting" | "placed";

interface PlacedOrder {
  txnid: string;
  itemName: string;
  amount: number;
}

const inputCls =
  "mt-1.5 w-full rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors focus:border-[#a832e6] focus:outline-none focus:ring-2 focus:ring-[#a832e6]/15";
const selectCls =
  "w-full cursor-pointer appearance-none rounded-full border border-slate-200 bg-white py-2.5 pl-4 pr-10 text-sm font-medium text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] focus:border-[#a832e6] focus:outline-none focus:ring-2 focus:ring-[#a832e6]/15";
const labelCls = "block text-[13px] font-semibold text-slate-700";

export function IndiaCheckoutModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [serviceId, setServiceId] = useState<IndiaServiceId>("ai-ugc");
  const [qty, setQty] = useState<IndiaPackQty>(1);
  const [form, setForm] = useState({ name: "", phone: "", email: "", company: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);

  const quote = useMemo(() => quoteIndia(serviceId, qty), [serviceId, qty]);

  const close = useCallback(() => {
    if (step === "redirecting") return;
    setOpen(false);
  }, [step]);

  // Open from any Buy Now button
  useEffect(() => {
    const onOpen = (e: Event) => {
      const d = ((e as CustomEvent).detail || {}) as BuyNowOptions;
      if (d.serviceId && INDIA_SERVICES.some((s) => s.id === d.serviceId))
        setServiceId(d.serviceId);
      setQty(isPackQty(d.qty) ? d.qty : 1);
      setStep("form");
      setServerError("");
      setErrors({});
      setPlaced(null);
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  // Page behind stays still; Escape closes; the quote popup stays away while this is open.
  useEffect(() => {
    if (!open) return;
    document.body.dataset.checkoutOpen = "1";
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => {
      delete document.body.dataset.checkoutOpen;
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const set =
    (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [k]: e.target.value }));
      if (errors[k]) setErrors((x) => ({ ...x, [k]: "" }));
    };

  const validate = () => {
    const e: Record<string, string> = {};
    if (form.name.trim().length < 2) e.name = "Please enter your full name.";
    const digits = form.phone.replace(/[^\d]/g, "");
    if (digits.length < 10 || digits.length > 13) e.phone = "Enter a valid 10-digit mobile number.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim()))
      e.email = "Enter a valid email address.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setServerError("");
    if (!validate()) return;
    setBusy(true);
    try {
      const r: any = await createIndiaOrderFn({
        data: {
          serviceId,
          qty,
          name: form.name,
          email: form.email,
          phone: form.phone,
          company: form.company,
        },
      });
      if (!r?.ok) {
        setServerError(r?.error || "Something went wrong. Please try again.");
        return;
      }
      const order = { txnid: r.orderId, itemName: r.itemName, amount: r.amount };
      if (r.payment?.action) {
        // PayU connected: send the customer to the secure payment page.
        setStep("redirecting");
        const f = document.createElement("form");
        f.method = "POST";
        f.action = r.payment.action;
        for (const [k, v] of Object.entries(r.payment.fields as Record<string, string>)) {
          const i = document.createElement("input");
          i.type = "hidden";
          i.name = k;
          i.value = v;
          f.appendChild(i);
        }
        document.body.appendChild(f);
        f.submit();
        return;
      }
      // Gateway not connected yet: the order is saved and the team sends a payment link.
      setPlaced(order);
      setStep("placed");
    } catch {
      setServerError("We couldn't reach the server. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const waLink = (text: string) =>
    `https://wa.me/${whatsAppNumber}?text=${encodeURIComponent(text)}`;

  if (!open) return null;

  const isPack = qty > 1;
  const packLabel = INDIA_PACKS.find((p) => p.qty === qty)!.label;
  const title = isPack
    ? `${packLabel} — ${quote.service.name}`
    : `${quote.service.name} — Single Reel`;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/55 backdrop-blur-[3px] sm:items-center sm:p-4 animate-in fade-in duration-200"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
      role="dialog"
      aria-modal="true"
      aria-label="Order checkout"
    >
      <div className="relative flex max-h-[94dvh] w-full max-w-[640px] flex-col overflow-hidden rounded-t-[28px] bg-white text-slate-900 shadow-[0_30px_80px_rgba(15,23,42,0.35)] sm:rounded-[28px] animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300">
        <div className="h-1.5 w-full shrink-0 bg-gradient-to-r from-[#4f46e5] via-[#a832e6] to-[#e11d74]" />

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-7">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f5edff] text-[#9333ea]">
              <Lock className="h-[18px] w-[18px]" />
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight text-slate-900">
                {step === "placed" ? "Order Received" : "Order Checkout"}
              </h2>
              <p className="text-xs text-slate-500">Official Quickupp AI Studio Video Production</p>
            </div>
          </div>
          {step !== "redirecting" && (
            <button
              type="button"
              onClick={close}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close checkout"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="overflow-y-auto overscroll-contain">
          {step === "form" && (
            <form onSubmit={submit} noValidate className="px-5 py-5 sm:px-8 sm:py-7">
              {/* Order summary card */}
              <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white to-[#fbf7ff] p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-[#e9d5ff] bg-[#f5edff] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#9333ea]">
                        {isPack ? "Package Tier" : "Individual Service"}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                        <Clock className="h-3.5 w-3.5 text-[#9333ea]" />
                        48–72 Hrs per reel
                      </span>
                    </div>
                    <div className="mt-2 text-base font-bold text-slate-900 sm:text-lg">
                      {title}
                    </div>
                    {isPack && (
                      <div className="mt-0.5 text-xs text-slate-500">
                        {formatInr(quote.perReel)} per reel
                        {quote.saving > 0 && (
                          <span className="ml-1.5 font-semibold text-emerald-600">
                            · You save {formatInr(quote.saving)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-left sm:text-right">
                    <div className="bg-gradient-to-r from-[#7c3aed] to-[#c026d3] bg-clip-text text-[28px] font-extrabold leading-none tracking-tight text-transparent sm:text-[32px]">
                      {formatInr(quote.amount)} INR
                    </div>
                    <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      One-time payment • No subscription
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 border-t border-slate-200/70 pt-4 sm:grid-cols-2">
                  <label className="block">
                    <span className={labelCls}>Package Volume:</span>
                    <div className="relative mt-1.5">
                      <select
                        value={qty}
                        onChange={(e) => setQty(Number(e.target.value) as IndiaPackQty)}
                        className={selectCls}
                      >
                        {INDIA_PACKS.map((p) => (
                          <option key={p.qty} value={p.qty}>
                            {p.label} ({formatInr(quote.service.prices[p.qty])})
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-700" />
                    </div>
                  </label>
                  <label className="block">
                    <span className={labelCls}>Video Style:</span>
                    <div className="relative mt-1.5">
                      <select
                        id="co-service"
                        value={serviceId}
                        onChange={(e) => setServiceId(e.target.value as IndiaServiceId)}
                        className={selectCls}
                      >
                        {INDIA_SERVICES.map((sv) => (
                          <option key={sv.id} value={sv.id}>
                            {sv.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-700" />
                    </div>
                  </label>
                </div>
              </div>

              {/* Customer */}
              <div className="mt-6 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Customer Information{" "}
                <span className="ml-1 font-medium normal-case tracking-normal text-slate-400">
                  (required for project delivery)
                </span>
              </div>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <Field label="Full Name" required error={errors.name}>
                  <input
                    value={form.name}
                    onChange={set("name")}
                    autoComplete="name"
                    placeholder="e.g. Rahul Sharma"
                    className={inputCls}
                  />
                </Field>
                <Field label="Email Address" required error={errors.email}>
                  <input
                    value={form.email}
                    onChange={set("email")}
                    autoComplete="email"
                    inputMode="email"
                    placeholder="you@company.com"
                    className={inputCls}
                  />
                </Field>
                <Field label="Phone Number (WhatsApp)" required error={errors.phone}>
                  <input
                    value={form.phone}
                    onChange={set("phone")}
                    autoComplete="tel"
                    inputMode="tel"
                    placeholder="+91 98765 43210"
                    className={inputCls}
                  />
                </Field>
                <Field label="Company / Brand Name">
                  <input
                    value={form.company}
                    onChange={set("company")}
                    autoComplete="organization"
                    placeholder="e.g. Sharma Foods"
                    className={inputCls}
                  />
                </Field>
              </div>

              {serverError && (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
                  {serverError}
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="group mt-6 flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#4f46e5] via-[#9333ea] to-[#db2777] text-base font-semibold text-white shadow-[0_10px_30px_rgba(147,51,234,0.35)] transition-all hover:brightness-110 active:scale-[0.99] disabled:cursor-wait disabled:opacity-70"
              >
                {busy ? (
                  "Placing your order..."
                ) : (
                  <>
                    <span>Proceed to Payment</span>
                    <span aria-hidden className="transition-transform group-hover:translate-x-1">
                      →
                    </span>
                  </>
                )}
              </button>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-500">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                256-bit SSL encrypted • Secure checkout •{" "}
                <a
                  href="/terms"
                  target="_blank"
                  className="underline decoration-slate-300 underline-offset-2 hover:text-slate-700"
                >
                  Terms
                </a>
              </p>
            </form>
          )}

          {step === "redirecting" && (
            <div className="px-6 py-14 text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-[#9333ea]" />
              <p className="mt-5 text-sm font-semibold text-slate-900">
                Taking you to the secure payment page...
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Please don't close or refresh this window.
              </p>
            </div>
          )}

          {step === "placed" && placed && (
            <div className="px-5 py-7 text-center sm:px-8">
              <StatusMark tone="ok" />
              <h3 className="mt-4 text-xl font-bold text-slate-900">
                Thank you, {form.name.trim().split(" ")[0]}!
              </h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-600">
                Your order is reserved. Our team will send you a secure payment link on WhatsApp and
                email shortly to confirm it.
              </p>
              <OrderSummary order={placed} />
              <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
                <a
                  href={waLink(
                    `Hello Quickupp AI Studio, I placed an order on your website.\nOrder: ${placed.txnid}\nPackage: ${placed.itemName}\nAmount: ${formatInr(placed.amount)}\nPlease share the payment link.`,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-11 w-full shrink-0 items-center justify-center rounded-full bg-[#25D366] text-sm font-semibold text-white transition-transform hover:scale-[1.02] sm:w-auto sm:flex-1"
                >
                  Chat on WhatsApp
                </a>
                <button
                  type="button"
                  onClick={close}
                  className="flex h-11 w-full shrink-0 items-center justify-center rounded-full border border-slate-200 text-sm font-semibold text-slate-800 hover:bg-slate-50 sm:w-auto sm:flex-1"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string | undefined;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className={labelCls}>
        {label}
        {required ? (
          <span className="text-red-500"> *</span>
        ) : (
          <span className="font-normal text-slate-400"> (Optional)</span>
        )}
      </span>
      {children}
      {error ? <span className="mt-1 block pl-3 text-[11px] text-red-600">{error}</span> : null}
    </label>
  );
}

function OrderSummary({ order }: { order: PlacedOrder }) {
  return (
    <div className="mx-auto mt-5 max-w-sm rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left text-sm">
      <Row k="Order Number" v={order.txnid} mono />
      <Row k="Package" v={order.itemName} />
      <Row k="Amount" v={formatInr(order.amount)} strong />
    </div>
  );
}

function Row({ k, v, mono, strong }: { k: string; v: string; mono?: boolean; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-slate-500">{k}</span>
      <span
        className={`text-right ${mono ? "font-mono text-xs text-slate-800" : strong ? "font-bold text-slate-900" : "text-slate-800"}`}
      >
        {v}
      </span>
    </div>
  );
}

function StatusMark({ tone }: { tone: "ok" | "fail" | "wait" }) {
  const cls =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-600 ring-emerald-200"
      : tone === "wait"
        ? "bg-amber-50 text-amber-600 ring-amber-200"
        : "bg-red-50 text-red-600 ring-red-200";
  return (
    <div
      className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl font-bold ring-1 ${cls}`}
    >
      {tone === "ok" ? "✓" : tone === "wait" ? "…" : "!"}
    </div>
  );
}
