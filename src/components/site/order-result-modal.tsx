import { useEffect, useState } from "react";
import { AlertCircle, Check, Clock, Lock, Sparkles, X } from "lucide-react";
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
      <div className="relative w-full max-w-2xl rounded-[28px] border border-white/10 bg-[#0d091a] text-white shadow-[0_30px_90px_rgba(0,0,0,0.7),0_0_80px_rgba(168,50,230,0.22)] animate-in fade-in zoom-in-95 duration-300 overflow-hidden">
        <div className="h-1.5 w-full bg-gradient-to-r from-[#4f46e5] via-[#a832e6] to-[#e11d74]" />

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-white/[0.07] px-5 py-3.5 sm:px-6">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#a832e6]/30 bg-[#a832e6]/10 text-[#d8a8ff]">
            <Lock className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-bold leading-tight">
              {paid ? "Order Confirmed" : pending ? "Payment Processing" : failed ? "Payment Not Completed" : "Your Order"}
            </p>
            <p className="truncate text-xs text-white/55">Official Quickupp AI Studio Video Production</p>
          </div>
          <button
            type="button"
            onClick={() => close()}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Loading / error */}
        {!order && !error && (
          <div className="px-6 py-12 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-[#c084fc]" />
            <p className="mt-4 text-sm text-white/70">Confirming your payment...</p>
          </div>
        )}
        {error && (
          <div className="px-6 py-8 text-center">
            <StatusIcon tone="fail" />
            <p className="mt-4 text-lg font-bold">Order not found</p>
            <p className="mt-1 text-sm text-white/60">{error}</p>
            <PrimaryButton onClick={() => close()}>Close</PrimaryButton>
          </div>
        )}

        {order && (
          <div className="p-5 sm:p-6">
            <div className="sm:grid sm:grid-cols-12 sm:gap-6 items-start">
              {/* Left Column: Status, Message, Balance card, Next steps */}
              <div className="sm:col-span-5 text-center sm:text-left flex flex-col justify-between h-full">
                <div>
                  <div className="sm:flex sm:items-center sm:gap-3">
                    <StatusIcon tone={paid ? "ok" : pending ? "wait" : "fail"} />
                    <div className="mt-2 sm:mt-0">
                      <h2 id="order-result-title" className="text-xl sm:text-xl font-extrabold tracking-tight">
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
                      <p className="mt-1 text-xs text-white/65 leading-relaxed">
                        {paid ? (
                          <>
                            Thank you, <span className="font-semibold text-white">{order.name}</span>.
                          </>
                        ) : pending ? (
                          "Your bank is still confirming this payment."
                        ) : (
                          "Your payment didn't go through. Please try again."
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Balance still to pay (50% advance orders) */}
                  {paid && order.balanceDue > 0 && order.payBalanceUrl && (
                    <div className="mt-3.5 rounded-2xl border border-amber-400/30 bg-amber-400/[0.08] p-3 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300">Balance Pending</p>
                      <p className="mt-0.5 text-lg font-extrabold text-white">{formatInr(order.balanceDue)} INR</p>
                      <p className="text-[11px] text-white/55">Pay now or anytime later from your email.</p>
                      <a
                        href={order.payBalanceUrl}
                        className="mt-2 inline-flex h-8 items-center justify-center rounded-full bg-white px-4 text-xs font-bold text-[#0d091a] transition-transform hover:scale-[1.02]"
                      >
                        Pay Remaining Balance
                      </a>
                    </div>
                  )}

                  {/* Next step note */}
                  {paid && (
                    <div className="mt-3.5 flex gap-2.5 rounded-2xl border border-[#a832e6]/25 bg-[#a832e6]/[0.08] p-3">
                      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#c084fc]" />
                      <p className="text-xs leading-relaxed text-[#e9d5ff]">
                        Our creative team has received your order and will contact you via email shortly.
                        <span className="mt-1 block text-[11px] text-white/50">
                          Receipt sent to <span className="break-all font-semibold text-white/75">{order.email}</span>
                        </span>
                      </p>
                    </div>
                  )}

                  {failed && order.failureReason && (
                    <p className="mt-3 text-xs text-white/45">Reason: {order.failureReason}</p>
                  )}
                </div>
              </div>

              {/* Right Column: Order Details Table & Action Button */}
              <div className="mt-5 sm:mt-0 sm:col-span-7 flex flex-col justify-between">
                <div className="divide-y divide-white/[0.06] rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-1">
                  <Row label="Service / Package:" value={`${order.service} · ${order.pack}`} bold />

                  {order.discountPercent && order.discountPercent > 0 ? (
                    <>
                      {order.originalAmount && (
                        <Row label="Original Price:" value={`${formatInr(order.originalAmount)} INR`} />
                      )}
                      <div className="py-2">
                        <div className="flex items-center justify-between rounded-xl bg-red-500/10 border border-red-500/25 px-3 py-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">
                              Special Offer
                            </span>
                            <span className="font-semibold text-red-200">
                              Discount ({order.discountPercent}% OFF)
                            </span>
                          </div>
                          <span className="font-bold text-red-400">
                            -{formatInr(order.discountAmount)} INR
                          </span>
                        </div>
                      </div>
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

                <div className="mt-3.5">
                  {failed ? (
                    <PrimaryButton onClick={() => close("#pricing")}>Try Again</PrimaryButton>
                  ) : (
                    <PrimaryButton onClick={() => close()}>Done</PrimaryButton>
                  )}
                  <p className="mt-2 text-center text-[11px] text-white/40">
                    Need help?{" "}
                    <a href="mailto:info@quickuppaistudio.in" className="text-[#d8a8ff] hover:underline">
                      info@quickuppaistudio.in
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, mono, bold, accent, warn }: { label: string; value: string; mono?: boolean; bold?: boolean; accent?: boolean; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="shrink-0 text-xs text-white/50">{label}</span>
      <span
        className={`min-w-0 text-right ${
          warn
            ? "text-xs font-bold text-amber-300"
            : accent
            ? "bg-gradient-to-r from-[#c084fc] to-[#f472b6] bg-clip-text text-base font-extrabold text-transparent"
            : mono
              ? "font-mono text-xs text-white/85"
              : bold
                ? "text-xs font-bold text-white"
                : "text-xs text-white/85"
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
      ? "bg-emerald-500/10 shadow-[0_0_30px_rgba(16,185,129,0.3)]"
      : tone === "wait"
        ? "bg-amber-500/10 shadow-[0_0_30px_rgba(245,158,11,0.25)]"
        : "bg-red-500/10 shadow-[0_0_30px_rgba(239,68,68,0.25)]";
  const inner =
    tone === "ok"
      ? "border-emerald-400 text-emerald-400 bg-emerald-500/15"
      : tone === "wait"
        ? "border-amber-400 text-amber-300 bg-amber-500/15"
        : "border-red-400 text-red-400 bg-red-500/15";
  const Icon = tone === "ok" ? Check : tone === "wait" ? Clock : AlertCircle;
  return (
    <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full mx-auto sm:mx-0 ${ring}`}>
      <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${inner}`}>
        <Icon className={`h-5 w-5 ${tone === "wait" ? "animate-pulse" : ""}`} strokeWidth={3} />
      </div>
    </div>
  );
}

function PrimaryButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 w-full items-center justify-center rounded-full bg-gradient-to-r from-[#4f46e5] via-[#9333ea] to-[#db2777] text-sm font-bold text-white shadow-[0_8px_20px_rgba(147,51,234,0.3)] transition-all hover:brightness-110 active:scale-[0.99] cursor-pointer"
    >
      {children}
    </button>
  );
}
