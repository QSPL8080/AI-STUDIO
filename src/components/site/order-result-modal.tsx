import { useEffect, useState } from "react";
import { AlertCircle, Check, Clock, Download, Lock, Sparkles, X } from "lucide-react";
import { getConfirmationFn } from "@/lib/checkout-actions";
import { formatInr } from "@/lib/india-pricing";
import type { OrderView } from "@/lib/checkout-server";

/**
 * "Order Confirmed" popup shown on the homepage when the customer comes back from PayU
 * (/?order=QAS...&ot=<signature>). Dark theme, matches the site. While the bank is still
 * confirming (common with UPI) it re-checks every 10 seconds for up to 5 minutes.
 */
export function OrderResultModal() {
  const [params, setParams] = useState<{ txn: string; t: string } | null>(null);
  const [order, setOrder] = useState<OrderView | null>(null);
  const [error, setError] = useState("");

  // Read the signed order link from the URL (client only).
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const txn = sp.get("order") || "";
    const t = sp.get("ot") || "";
    if (txn && t) setParams({ txn, t });
  }, []);

  // Load the order, then keep checking while it is still pending.
  useEffect(() => {
    if (!params) return;
    let cancelled = false;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () =>
      getConfirmationFn({ data: { txn: params.txn, t: params.t } })
        .then((r: any) => {
          if (cancelled) return;
          if (r?.ok) {
            setOrder(r.order);
            if (r.order.status === "PENDING" && ++tries <= 30) timer = setTimeout(load, 10000);
          } else setError(r?.error || "We couldn't load this order.");
        })
        .catch(() => {
          if (!cancelled) setError("We couldn't load your order right now. Please refresh the page.");
        });
    load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [params]);

  const open = !!params;

  // Lock page scroll + close on Escape while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = (hash = "") => {
    setParams(null);
    window.history.replaceState(null, "", `/${hash}`);
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth" });
  };

  if (!open) return null;

  const paid = order?.status === "COMPLETED";
  const pending = order?.status === "PENDING";
  const failed = !!order && !paid && !pending;
  const firstName = order?.name.trim().split(/\s+/)[0] || "";

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/70 p-3 backdrop-blur-md sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-result-title"
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <div className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-[28px] border border-white/10 bg-[#0d091a] text-white shadow-[0_30px_90px_rgba(0,0,0,0.7),0_0_80px_rgba(168,50,230,0.22)] animate-in fade-in zoom-in-95 duration-300">
        <div className="h-1.5 w-full bg-gradient-to-r from-[#4f46e5] via-[#a832e6] to-[#e11d74]" />

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-white/[0.07] px-5 py-4 sm:px-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#a832e6]/30 bg-[#a832e6]/10 text-[#d8a8ff]">
            <Lock className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-bold leading-tight">
              {paid ? "Order Confirmed" : pending ? "Payment Processing" : failed ? "Payment Not Completed" : "Your Order"}
            </p>
            <p className="truncate text-xs text-white/55">Official Quickupp AI Studio Video Production</p>
          </div>
          <button
            type="button"
            onClick={() => close()}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Loading / error */}
        {!order && !error && (
          <div className="px-6 py-14 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-[#c084fc]" />
            <p className="mt-4 text-sm text-white/70">Confirming your payment...</p>
          </div>
        )}
        {error && (
          <div className="px-6 py-10 text-center">
            <StatusIcon tone="fail" />
            <p className="mt-4 text-lg font-bold">Order not found</p>
            <p className="mt-1 text-sm text-white/60">{error}</p>
            <PrimaryButton onClick={() => close()}>Close</PrimaryButton>
          </div>
        )}

        {order && (
          <div className="px-5 pb-6 pt-6 sm:px-6">
            {/* Status */}
            <div className="text-center">
              <StatusIcon tone={paid ? "ok" : pending ? "wait" : "fail"} />
              <h2 id="order-result-title" className="mt-4 text-2xl font-extrabold tracking-tight">
                {paid
                  ? order.plan === "advance" && order.balanceDue > 0
                    ? "Advance Payment Successful!"
                    : order.plan === "balance"
                      ? "Balance Paid. Order Complete!"
                      : "Payment Successful!"
                  : pending
                    ? "Confirming Payment..."
                    : "Payment Failed"}
              </h2>
              <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-white/65">
                {paid ? (
                  <>
                    Thank you for your purchase, <span className="font-semibold text-white">{order.name}</span>.
                  </>
                ) : pending ? (
                  "Your bank is still confirming this payment. Please don't pay again — this updates automatically."
                ) : (
                  "Your payment didn't go through and no money was taken. You can try again."
                )}
              </p>
            </div>

            {/* Red Special Offer Banner */}
            {order.discountPercent && order.discountPercent > 0 ? (
              <div className="mx-auto mt-4 max-w-sm rounded-2xl border-2 border-dashed border-red-500/80 bg-red-500/10 p-3 text-center shadow-[0_0_25px_rgba(239,68,68,0.2)]">
                <span className="inline-block rounded-full bg-red-600 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-white shadow-sm">
                  Special Offer Applied
                </span>
                <div className="mt-1.5 text-sm font-extrabold text-red-400">
                  {order.discountPercent}% DISCOUNT APPLIED
                  {order.discountAmount ? ` · Saved ${formatInr(order.discountAmount)}` : ""}
                </div>
                {order.couponCode && (
                  <div className="mt-0.5 font-mono text-xs font-semibold text-red-300">
                    Coupon Code: <span className="underline decoration-red-400/60">{order.couponCode}</span>
                  </div>
                )}
              </div>
            ) : null}

            {/* Details */}
            <div className="mt-5 divide-y divide-white/[0.07] rounded-2xl border border-white/10 bg-white/[0.03] px-4">
              <Row label="Service / Package:" value={`${order.service} · ${order.pack}`} bold />
              {order.discountPercent && order.discountPercent > 0 ? (
                <>
                  {order.originalAmount && (
                    <Row label="Original Price:" value={`${formatInr(order.originalAmount)} INR`} />
                  )}
                  <Row
                    label="Special Offer Discount:"
                    value={`-${formatInr(order.discountAmount)} (${order.discountPercent}% OFF)${order.couponCode ? ` · ${order.couponCode}` : ""}`}
                    warn
                    bold
                  />
                </>
              ) : null}
              {order.plan !== "full" && (
                <Row label="Order Total:" value={`${formatInr(order.orderTotal)} INR`} />
              )}
              {order.plan === "balance" && (
                <Row label="Paid Earlier (50%):" value={`${formatInr(order.paidBefore)} INR`} />
              )}
              <Row
                label={
                  !paid
                    ? "Amount:"
                    : order.plan === "advance"
                      ? "Amount Paid (50%):"
                      : order.plan === "balance"
                        ? "Balance Paid:"
                        : "Amount Paid:"
                }
                value={`${formatInr(order.amount)} INR`}
                accent
              />
              {paid && order.plan !== "full" && (
                <Row
                  label="Balance Due:"
                  value={order.balanceDue > 0 ? `${formatInr(order.balanceDue)} INR` : "Nil (Fully Paid)"}
                  warn={order.balanceDue > 0}
                  bold
                />
              )}
              <Row label="Order ID:" value={order.orderNumber} mono />
              <Row label="Transaction ID:" value={order.transactionId} mono />
            </div>

            {/* Balance still to pay (50% advance orders) */}
            {paid && order.balanceDue > 0 && order.payBalanceUrl && (
              <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-400/[0.08] p-4 text-center">
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300">Balance Pending</p>
                <p className="mt-1 text-xl font-extrabold text-white">{formatInr(order.balanceDue)} INR</p>
                <p className="mt-1 text-xs text-white/55">Pay it now, or anytime later from the link in your email.</p>
                <a
                  href={order.payBalanceUrl}
                  className="mt-3 inline-flex h-10 items-center justify-center rounded-full bg-white px-5 text-sm font-bold text-[#0d091a] transition-transform hover:scale-[1.02]"
                >
                  Pay Remaining Balance
                </a>
              </div>
            )}

            {/* Next step note */}
            {paid && (
              <div className="mt-4 flex gap-3 rounded-2xl border border-[#a832e6]/25 bg-[#a832e6]/[0.08] p-4">
                <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[#c084fc]" />
                <p className="text-sm leading-relaxed text-[#e9d5ff]">
                  Our creative team has received your order and will contact you via email shortly to begin your AI video production script and assets.
                  <span className="mt-1.5 block text-xs text-white/50">
                    Receipt sent to <span className="break-all font-semibold text-white/75">{order.email}</span>
                  </span>
                </p>
              </div>
            )}
            {failed && order.failureReason && (
              <p className="mt-3 text-center text-xs text-white/45">Reason: {order.failureReason}</p>
            )}

            {paid && order.receiptUrl && (
              <a
                href={order.receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[#a832e6]/50 bg-gradient-to-r from-[#4f46e5]/40 via-[#a832e6]/40 to-[#e11d74]/40 px-5 text-sm font-bold text-white shadow-lg shadow-purple-900/30 transition-all hover:scale-[1.02] hover:border-[#a832e6]"
              >
                <Download className="h-4 w-4 text-[#d8a8ff]" />
                Download Payment Receipt (PDF)
              </a>
            )}

            {failed ? (
              <PrimaryButton onClick={() => close("#pricing")}>Try Again</PrimaryButton>
            ) : (
              <PrimaryButton onClick={() => close()}>Done</PrimaryButton>
            )}
            <p className="mt-3 text-center text-xs text-white/40">
              Need help?{" "}
              <a href="mailto:info@quickuppaistudio.in" className="text-[#d8a8ff] hover:underline">
                info@quickuppaistudio.in
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, mono, bold, accent, warn }: { label: string; value: string; mono?: boolean; bold?: boolean; accent?: boolean; warn?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <span className="shrink-0 text-sm text-white/50">{label}</span>
      <span
        className={`min-w-0 break-all text-right ${
          warn
            ? "text-sm font-bold text-amber-300"
            : accent
            ? "bg-gradient-to-r from-[#c084fc] to-[#f472b6] bg-clip-text text-lg font-extrabold text-transparent"
            : mono
              ? "font-mono text-[13px] text-white/85"
              : bold
                ? "text-sm font-bold text-white"
                : "text-sm text-white/85"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function StatusIcon({ tone }: { tone: "ok" | "wait" | "fail" }) {
  const ring =
    tone === "ok"
      ? "bg-emerald-500/10 shadow-[0_0_50px_rgba(16,185,129,0.35)]"
      : tone === "wait"
        ? "bg-amber-500/10 shadow-[0_0_50px_rgba(245,158,11,0.3)]"
        : "bg-red-500/10 shadow-[0_0_50px_rgba(239,68,68,0.3)]";
  const inner =
    tone === "ok"
      ? "border-emerald-400 text-emerald-400 bg-emerald-500/15"
      : tone === "wait"
        ? "border-amber-400 text-amber-300 bg-amber-500/15"
        : "border-red-400 text-red-400 bg-red-500/15";
  const Icon = tone === "ok" ? Check : tone === "wait" ? Clock : AlertCircle;
  return (
    <div className={`mx-auto flex h-24 w-24 items-center justify-center rounded-full ${ring}`}>
      <div className={`flex h-16 w-16 items-center justify-center rounded-full border-[3px] ${inner}`}>
        <Icon className={`h-8 w-8 ${tone === "wait" ? "animate-pulse" : ""}`} strokeWidth={3} />
      </div>
    </div>
  );
}

function PrimaryButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-6 flex h-12 w-full items-center justify-center rounded-full bg-gradient-to-r from-[#4f46e5] via-[#9333ea] to-[#db2777] text-[15px] font-bold text-white shadow-[0_10px_30px_rgba(147,51,234,0.35)] transition-all hover:brightness-110 active:scale-[0.99]"
    >
      {children}
    </button>
  );
}
