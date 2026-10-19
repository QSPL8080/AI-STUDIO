import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, ChevronDown, Clock, Lock, Tag, X } from "lucide-react";
import { createIndiaOrderFn, validateCouponFn } from "@/lib/checkout-actions";
import {
  INDIA_PACKS,
  INDIA_SERVICES,
  formatInr,
  isPackQty,
  quoteItem,
  TWIN_SETUP,
  TWIN_SETUP_ID,
  type IndiaPackQty,
  type IndiaServiceId,
  splitPayment,
  type PaymentPlan,
} from "@/lib/india-pricing";
import { whatsAppNumber } from "./data";

// ---------------------------------------------------------------------------
// Open the checkout from anywhere: openBuyNow({ serviceId: "ai-avatar", qty: 5 })
// ---------------------------------------------------------------------------
export interface BuyNowOptions {
  serviceId?: IndiaServiceId;
  qty?: IndiaPackQty;
  /** "twin-setup" opens the one-time AI Digital Twin setup (₹15,000). */
  product?: "twin-setup";
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
  product,
  size = "md",
  label = "Buy Now",
  className = "",
}: BuyNowOptions & { size?: "xs" | "sm" | "md"; label?: string; className?: string }) {
  const sizing =
    size === "xs" ? "h-8 px-3.5 text-xs" : size === "sm" ? "h-9 px-4 text-xs" : "h-11 px-6 text-sm";
  return (
    <button
      type="button"
      onClick={() =>
        openBuyNow({
          ...(serviceId ? { serviceId } : {}),
          ...(qty ? { qty } : {}),
          ...(product ? { product } : {}),
        })
      }
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
  "mt-1.5 w-full rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-white/35 transition-colors focus:border-[#a832e6] focus:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-[#a832e6]/25";
const selectCls =
  "w-full cursor-pointer appearance-none rounded-full border border-white/10 bg-white/[0.04] py-2.5 pl-4 pr-10 text-sm font-medium text-white [color-scheme:dark] focus:border-[#a832e6] focus:outline-none focus:ring-2 focus:ring-[#a832e6]/25";
const labelCls = "block text-[13px] font-semibold text-white/80";

export function IndiaCheckoutModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [serviceId, setServiceId] = useState<IndiaServiceId>("ai-ugc");
  const [qty, setQty] = useState<IndiaPackQty>(1);
  const [isSetup, setIsSetup] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", company: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);
  const [plan, setPlan] = useState<PaymentPlan>("full");

  // Coupon state
  const [couponCode, setCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountPercent: number;
  } | null>(null);

  const quote = useMemo(
    () => quoteItem(isSetup ? TWIN_SETUP_ID : serviceId, qty),
    [isSetup, serviceId, qty],
  );

  const discountAmount = appliedCoupon
    ? Math.round((quote.amount * appliedCoupon.discountPercent) / 100)
    : 0;
  const discountedTotal = Math.max(0, quote.amount - discountAmount);

  const reelService = INDIA_SERVICES.find((x) => x.id === serviceId) || INDIA_SERVICES[0]!;
  const advanceSplit = useMemo(() => splitPayment(discountedTotal, "advance"), [discountedTotal]);
  const canAdvance = advanceSplit.plan === "advance";
  const effectivePlan: PaymentPlan = canAdvance ? plan : "full";
  const payNow = effectivePlan === "advance" ? advanceSplit.payNow : discountedTotal;

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
      setIsSetup(d.product === "twin-setup");
      setStep("form");
      setPlan("full");
      setServerError("");
      setErrors({});
      setPlaced(null);
      setCouponCode("");
      setCouponError("");
      setAppliedCoupon(null);
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  const applyCoupon = async () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) {
      setCouponError("Please enter a coupon code.");
      return;
    }
    setCouponLoading(true);
    setCouponError("");
    try {
      const res: any = await validateCouponFn({ data: { code } });
      if (res?.valid) {
        setAppliedCoupon({
          code: res.code,
          discountPercent: res.discountPercent,
        });
        setCouponError("");
      } else {
        setCouponError(res?.error || "Invalid or expired coupon code.");
        setAppliedCoupon(null);
      }
    } catch {
      setCouponError("Could not validate coupon. Please try again.");
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponError("");
  };

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
          serviceId: isSetup ? TWIN_SETUP_ID : serviceId,
          qty: isSetup ? 1 : qty,
          name: form.name,
          email: form.email,
          phone: form.phone,
          company: form.company,
          paymentPlan: effectivePlan,
          couponCode: appliedCoupon ? appliedCoupon.code : undefined,
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

  const isPack = !isSetup && qty > 1;
  const title = isSetup
    ? `${TWIN_SETUP.name} (One-Time)`
    : isPack
      ? `${quote.packLabel} — ${quote.serviceName}`
      : `${quote.serviceName} — Single Reel`;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/75 backdrop-blur-[4px] sm:items-center sm:p-4 animate-in fade-in duration-200"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
      role="dialog"
      aria-modal="true"
      aria-label="Order checkout"
    >
      <div className="relative flex max-h-[94dvh] w-full max-w-[640px] flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-[#0d091a] text-white shadow-[0_30px_80px_rgba(0,0,0,0.6),0_0_70px_rgba(168,50,230,0.18)] sm:rounded-[28px] animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300">
        <div className="h-1.5 w-full shrink-0 bg-gradient-to-r from-[#4f46e5] via-[#a832e6] to-[#e11d74]" />

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-4 sm:px-7">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#a832e6]/15 text-[#d8a8ff] ring-1 ring-[#a832e6]/30">
              <Lock className="h-[18px] w-[18px]" />
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight text-white">
                {step === "placed" ? "Order Received" : "Order Checkout"}
              </h2>
              <p className="text-xs text-white/50">Official Quickupp AI Studio Video Production</p>
            </div>
          </div>
          {step !== "redirecting" && (
            <button
              type="button"
              onClick={close}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/10 hover:text-white"
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
              <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-[#a832e6]/[0.07] p-4 sm:p-5">
                <div className="flex flex-nowrap items-start justify-between gap-3 sm:gap-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-[#a832e6]/35 bg-[#a832e6]/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#e2b8ff]">
                        {isSetup
                          ? "One-Time Setup"
                          : isPack
                            ? "Package Tier"
                            : "Individual Service"}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-white/50">
                        <Clock className="h-3.5 w-3.5 text-[#d8a8ff]" />
                        {quote.delivery}
                      </span>
                    </div>
                    <div className="mt-2 text-base font-bold text-white sm:text-lg">{title}</div>
                    {isPack && (
                      <div className="mt-0.5 text-xs text-white/50">
                        {formatInr(quote.perReel)} per reel
                        {quote.saving > 0 && (
                          <span className="ml-1.5 font-semibold text-emerald-400">
                            · You save {formatInr(quote.saving)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    {appliedCoupon ? (
                      <>
                        <div className="text-xs text-white/40 line-through">
                          {formatInr(quote.amount)} INR
                        </div>
                        <div className="inline-block whitespace-nowrap bg-gradient-to-r from-[#34d399] via-[#10b981] to-[#059669] bg-clip-text text-[22px] font-extrabold leading-none tracking-tight text-transparent sm:text-[30px]">
                          {formatInr(discountedTotal)} INR
                        </div>
                        <div className="mt-1 text-[11px] font-bold text-emerald-400">
                          {appliedCoupon.discountPercent}% OFF applied
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="inline-block whitespace-nowrap bg-gradient-to-r from-[#a78bfa] via-[#e879f9] to-[#f472b6] bg-clip-text text-[22px] font-extrabold leading-none tracking-tight text-transparent sm:text-[30px]">
                          {formatInr(quote.amount)} INR
                        </div>
                        <div className="mt-1.5 text-[9px] font-semibold uppercase leading-snug tracking-wider text-white/40 sm:text-[10px]">
                          <span className="block sm:inline">One-time payment</span>
                          <span className="hidden sm:inline"> • </span>
                          <span className="block sm:inline">No subscription</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {isSetup ? (
                  <div className="mt-4 border-t border-white/10 pt-4">
                    <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
                      {TWIN_SETUP.includes.map((t) => (
                        <span key={t} className="text-[13px] text-white/80">
                          <span className="mr-1.5 text-[#c084fc]">✓</span>
                          {t}
                        </span>
                      ))}
                    </div>
                    <p className="mt-3 text-[11px] leading-relaxed text-white/50">
                      Digital twin and voice cloning require your authorization and consent.
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2">
                    <label className="block">
                      <span className={labelCls}>Package Volume:</span>
                      <div className="relative mt-1.5">
                        <select
                          value={qty}
                          onChange={(e) => setQty(Number(e.target.value) as IndiaPackQty)}
                          className={selectCls}
                        >
                          {INDIA_PACKS.map((p) => (
                            <option key={p.qty} value={p.qty} className="bg-[#0d091a] text-white">
                              {p.label} ({formatInr(reelService.prices[p.qty])})
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" />
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
                            <option key={sv.id} value={sv.id} className="bg-[#0d091a] text-white">
                              {sv.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" />
                      </div>
                    </label>
                  </div>
                )}
              </div>

              {/* Coupon Code Section */}
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-3.5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white/70">
                    <Tag className="h-3.5 w-3.5 text-[#c084fc]" />
                    <span>Have a Coupon Code?</span>
                  </div>
                  {appliedCoupon && (
                    <span className="text-xs font-bold text-emerald-400">
                      Savings: {formatInr(discountAmount)}
                    </span>
                  )}
                </div>

                {appliedCoupon ? (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                        <Check className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 text-left">
                        <div className="font-mono text-sm font-bold text-emerald-300">
                          {appliedCoupon.code}
                        </div>
                        <div className="text-[11px] text-emerald-400/80">
                          {appliedCoupon.discountPercent}% single-use discount applied
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={removeCoupon}
                      className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium text-white/60 hover:bg-white/10 hover:text-white"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex gap-2">
                      <input
                        value={couponCode}
                        onChange={(e) => {
                          setCouponCode(e.target.value.toUpperCase());
                          if (couponError) setCouponError("");
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            applyCoupon();
                          }
                        }}
                        placeholder="e.g. QAS10-XXXX"
                        className="flex-1 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 font-mono text-sm uppercase text-white placeholder:font-sans placeholder:normal-case placeholder:text-white/35 focus:border-[#a832e6] focus:outline-none focus:ring-2 focus:ring-[#a832e6]/25"
                      />
                      <button
                        type="button"
                        onClick={applyCoupon}
                        disabled={couponLoading || !couponCode.trim()}
                        className="shrink-0 rounded-full bg-white/10 px-5 py-2 text-xs font-semibold text-white transition-all hover:bg-white/20 active:scale-95 disabled:opacity-40 cursor-pointer"
                      >
                        {couponLoading ? "Checking..." : "Apply"}
                      </button>
                    </div>
                    {couponError && (
                      <p className="mt-1.5 px-2 text-xs text-rose-400">
                        {couponError}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Payment option: pay in full, or 50% now and the balance later */}
              {canAdvance && (
                <>
                  <div className="mt-6 text-xs font-semibold uppercase tracking-wide text-white/50">
                    Payment Option
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Payment option">
                    {(
                      [
                        {
                          id: "full" as PaymentPlan,
                          title: "Pay in Full",
                          amount: discountedTotal,
                          note: "Pay the full amount now",
                        },
                        {
                          id: "advance" as PaymentPlan,
                          title: "Pay 50% Advance",
                          amount: advanceSplit.payNow,
                          note: `Balance ${formatInr(advanceSplit.balance)} payable later`,
                        },
                      ]
                    ).map((opt) => {
                      const active = effectivePlan === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setPlan(opt.id)}
                          className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${
                            active
                              ? "border-[#a832e6] bg-[#a832e6]/[0.12] shadow-[0_0_0_1px_rgba(168,50,230,0.4)]"
                              : "border-white/10 bg-white/[0.03] hover:border-white/25"
                          }`}
                        >
                          <span
                            className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 ${
                              active ? "border-[#c084fc]" : "border-white/30"
                            }`}
                          >
                            {active && <span className="h-2 w-2 rounded-full bg-[#c084fc]" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline justify-between gap-2">
                              <span className="text-sm font-semibold text-white">{opt.title}</span>
                              <span className="whitespace-nowrap text-sm font-bold text-white">
                                {formatInr(opt.amount)}
                              </span>
                            </span>
                            <span className="mt-0.5 block text-xs text-white/50">{opt.note}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {effectivePlan === "advance" && (
                    <p className="mt-2.5 text-[11px] leading-relaxed text-white/50">
                      You pay {formatInr(advanceSplit.payNow)} now. The balance of {formatInr(advanceSplit.balance)} can be
                      paid anytime using the secure link in your payment confirmation email.
                    </p>
                  )}
                </>
              )}

              {/* Customer */}
              <div className="mt-6 text-xs font-semibold uppercase tracking-wide text-white/50">
                Customer Information{" "}
                <span className="ml-1 font-medium normal-case tracking-normal text-white/40">
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
                <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
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
                    <span>Proceed to Pay {formatInr(payNow)}</span>
                    <span aria-hidden className="transition-transform group-hover:translate-x-1">
                      →
                    </span>
                  </>
                )}
              </button>
            </form>
          )}

          {step === "redirecting" && (
            <div className="px-6 py-14 text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-[#c084fc]" />
              <p className="mt-5 text-sm font-semibold text-white">
                Taking you to the secure payment page...
              </p>
              <p className="mt-1 text-xs text-white/50">
                Please don't close or refresh this window.
              </p>
            </div>
          )}

          {step === "placed" && placed && (
            <div className="px-5 py-7 text-center sm:px-8">
              <StatusMark tone="ok" />
              <h3 className="mt-4 text-xl font-bold text-white">
                Thank you, {form.name.trim().split(" ")[0]}!
              </h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-white/65">
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
                  className="flex h-11 w-full shrink-0 items-center justify-center rounded-full border border-white/15 text-sm font-semibold text-white hover:bg-white/5 sm:w-auto sm:flex-1"
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
          <span className="text-pink-400"> *</span>
        ) : (
          <span className="font-normal text-white/40"> (Optional)</span>
        )}
      </span>
      {children}
      {error ? <span className="mt-1 block pl-3 text-[11px] text-red-400">{error}</span> : null}
    </label>
  );
}

function OrderSummary({ order }: { order: PlacedOrder }) {
  return (
    <div className="mx-auto mt-5 max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left text-sm">
      <Row k="Order Number" v={order.txnid} mono />
      <Row k="Package" v={order.itemName} />
      <Row k="Amount" v={formatInr(order.amount)} strong />
    </div>
  );
}

function Row({ k, v, mono, strong }: { k: string; v: string; mono?: boolean; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-white/50">{k}</span>
      <span
        className={`text-right ${mono ? "font-mono text-xs text-white/85" : strong ? "font-bold text-white" : "text-white/85"}`}
      >
        {v}
      </span>
    </div>
  );
}

function StatusMark({ tone }: { tone: "ok" | "fail" | "wait" }) {
  const cls =
    tone === "ok"
      ? "bg-emerald-500/15 text-emerald-400 ring-emerald-500/40"
      : tone === "wait"
        ? "bg-amber-500/15 text-amber-300 ring-amber-500/40"
        : "bg-red-500/15 text-red-400 ring-red-500/40";
  return (
    <div
      className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl font-bold ring-1 ${cls}`}
    >
      {tone === "ok" ? "✓" : tone === "wait" ? "…" : "!"}
    </div>
  );
}
