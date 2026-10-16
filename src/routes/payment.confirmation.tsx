import { useEffect, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Footer, Header } from "@/components/site/sections";
import { getConfirmationFn } from "@/lib/checkout-actions";
import { formatInr } from "@/lib/india-pricing";
import type { OrderView } from "@/lib/checkout-server";

// Order confirmation page. PayU sends the customer back here (via /api/payu/callback)
// with a signed link: /payment/confirmation?txn=QAS...&t=...
export const Route = createFileRoute("/payment/confirmation")({
  validateSearch: (s: Record<string, unknown>) => ({
    txn: typeof s.txn === "string" ? s.txn : "",
    t: typeof s.t === "string" ? s.t : "",
  }),
  head: () => ({
    meta: [
      { title: "Order Confirmation | Quickupp AI Studio" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ConfirmationPage,
});

const SUPPORT_EMAIL = "info@quickuppaistudio.in";
const SITE = "https://quickuppaistudio.in";

function ConfirmationPage() {
  const { txn, t } = Route.useSearch();
  const [order, setOrder] = useState<OrderView | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      getConfirmationFn({ data: { txn, t } })
        .then((r: any) => {
          if (cancelled) return;
          if (r?.ok) setOrder(r.order);
          else setError(r?.error || "We couldn't load this order.");
        })
        .catch(
          () =>
            !cancelled &&
            setError("We couldn't load your order right now. Please refresh the page."),
        );
    load();
    return () => {
      cancelled = true;
    };
  }, [txn, t]);

  // While the bank is still confirming (common with UPI), re-check every 10 seconds for
  // up to 5 minutes. The server asks PayU for the latest status on each check.
  const isPending = order?.status === "PENDING";
  useEffect(() => {
    if (!isPending) return;
    let tries = 0;
    const id = setInterval(() => {
      if (++tries > 30) return clearInterval(id);
      getConfirmationFn({ data: { txn, t } })
        .then((r: any) => {
          if (r?.ok && r.order?.status !== "PENDING") {
            setOrder(r.order);
            clearInterval(id);
          }
        })
        .catch(() => {});
    }, 10000);
    return () => clearInterval(id);
  }, [isPending, txn, t]);

  return (
    <div className="min-h-screen w-full overflow-x-clip bg-background text-foreground">
      <Header />
      <main className="px-4 pb-16 pt-24 sm:px-6 sm:pt-28 md:pt-32">
        <div className="mx-auto w-full max-w-2xl">
          {!order && !error && <LoadingCard />}
          {error && <ErrorCard message={error} />}
          {order && <OrderCard order={order} token={t} />}
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#0d091a] text-white shadow-[0_30px_80px_rgba(0,0,0,0.55),0_0_70px_rgba(168,50,230,0.15)]">
      <div className="h-1.5 w-full bg-gradient-to-r from-[#4f46e5] via-[#a832e6] to-[#e11d74]" />
      {children}
    </div>
  );
}

function LoadingCard() {
  return (
    <Card>
      <div className="px-6 py-16 text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-[#c084fc]" />
        <p className="mt-5 text-sm font-semibold text-white/85">
          Loading your order confirmation...
        </p>
      </div>
    </Card>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <Card>
      <div className="px-6 py-12 text-center sm:px-10">
        <StatusMark tone="fail" />
        <h1 className="mt-5 text-2xl font-bold">Order not found</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-white/65">
          {message} If you have paid, your receipt email has the correct link, or write to us at{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="font-semibold text-[#d8a8ff] underline underline-offset-2"
          >
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
        <BackButton />
      </div>
    </Card>
  );
}

function OrderCard({ order, token }: { order: OrderView; token: string }) {
  const paid = order.status === "COMPLETED";
  const pending = order.status === "PENDING";

  return (
    <Card>
      {/* Status */}
      <div className="px-6 pb-6 pt-9 text-center sm:px-10">
        <StatusMark tone={paid ? "ok" : pending ? "wait" : "fail"} />
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight sm:text-[28px]">
          {paid
            ? "Payment Successful! 🎉"
            : pending
              ? "Payment Processing"
              : "Payment Not Completed"}
        </h1>
        {paid ? (
          <>
            <p className="mt-2 text-base font-semibold text-white/85">Thank you for your order.</p>
            <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-white/65">
              Your payment has been received successfully and your order is now confirmed.
            </p>
          </>
        ) : pending ? (
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-white/65">
            Your bank is still confirming this payment. You don't need to pay again: we'll email you
            as soon as it is confirmed.
          </p>
        ) : (
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-white/65">
            Your payment didn't go through and no money was taken. You can try again, or contact us
            and we'll help you complete the order.
            {order.failureReason ? (
              <span className="mt-1 block text-xs text-white/50">
                Reason: {order.failureReason}
              </span>
            ) : null}
          </p>
        )}
      </div>

      {/* Payment details */}
      <div className="px-5 sm:px-10">
        <SectionTitle>Payment Details</SectionTitle>
        <div className="mt-3 divide-y divide-white/[0.06] rounded-2xl border border-white/10 bg-white/[0.03] px-4 sm:px-5">
          <DetailRow label="Order Number" value={order.orderNumber} mono />
          <DetailRow label="Service" value={order.service} />
          <DetailRow label="Package" value={order.pack} />
          {order.delivery && <DetailRow label="Delivery" value={order.delivery} />}
          {order.plan !== "full" && <DetailRow label="Order Total" value={formatInr(order.orderTotal)} />}
          {order.plan === "balance" && <DetailRow label="Paid Earlier (50% Advance)" value={formatInr(order.paidBefore)} />}
          <DetailRow
            label={
              !paid
                ? "Amount"
                : order.plan === "advance"
                  ? "Amount Paid (50% Advance)"
                  : order.plan === "balance"
                    ? "Balance Paid"
                    : "Amount Paid"
            }
            value={formatInr(order.amount)}
            strong
          />
          {paid && order.plan !== "full" && (
            <DetailRow
              label="Balance Due"
              value={order.balanceDue > 0 ? formatInr(order.balanceDue) : "Nil (Fully Paid)"}
              strong
            />
          )}
          {paid && order.balanceDue > 0 && order.payBalanceUrl && (
            <div className="py-3 text-center">
              <a
                href={order.payBalanceUrl}
                className="inline-flex h-10 items-center justify-center rounded-full bg-white px-5 text-sm font-bold text-[#0d091a]"
              >
                Pay Remaining Balance ({formatInr(order.balanceDue)})
              </a>
            </div>
          )}
          {paid && <DetailRow label="Payment Method" value={order.method} />}
          <DetailRow label="Transaction ID" value={order.transactionId} mono />
          {order.paidAt && (
            <DetailRow
              label="Paid On"
              value={
                new Date(order.paidAt).toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                  dateStyle: "medium",
                  timeStyle: "short",
                }) + " IST"
              }
            />
          )}
          <div className="flex items-center justify-between gap-4 py-3">
            <span className="text-sm text-white/50">Status</span>
            {paid ? (
              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-300">
                ✓ PAID
              </span>
            ) : pending ? (
              <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-300">
                PROCESSING
              </span>
            ) : (
              <span className="rounded-full border border-red-500/40 bg-red-500/15 px-3 py-1 text-xs font-bold text-red-300">
                NOT PAID
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Receipt */}
      {paid && (
        <div className="px-5 pt-6 sm:px-10">
          <div className="rounded-2xl border border-[#a832e6]/30 bg-[#a832e6]/[0.08] p-4 sm:p-5">
            <h2 className="text-base font-bold text-white">Your Receipt Has Been Emailed</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-white/65">
              A payment confirmation and PDF receipt have been sent to:
            </p>
            <a
              href={`mailto:${order.email}`}
              className="mt-1 block break-all text-sm font-semibold text-[#d8a8ff]"
            >
              {order.email}
            </a>
            <p className="mt-2 text-xs leading-relaxed text-white/50">
              Please check your inbox, and your spam/junk folder if you don't see it shortly.
            </p>
            <a
              href={`/api/receipt?${new URLSearchParams({ txn: order.txnid, t: token }).toString()}`}
              className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-5 text-sm font-semibold text-white transition-colors hover:bg-white/[0.1]"
            >
              ⤓ Download Receipt (PDF)
            </a>
          </div>
        </div>
      )}

      {/* Next steps + help */}
      <div className="grid gap-4 px-5 pt-6 sm:grid-cols-2 sm:px-10">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <h2 className="text-sm font-bold text-white">What's Next?</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-white/65">
            {paid
              ? "Our team will review your order and contact you with the next steps."
              : pending
                ? "Once your bank confirms the payment, our team will contact you with the next steps."
                : "Go back to the website to place the order again, or message us and we'll send you a payment link."}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <h2 className="text-sm font-bold text-white">Need help?</h2>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="mt-1.5 block text-sm font-semibold text-[#d8a8ff] hover:underline"
          >
            {SUPPORT_EMAIL}
          </a>
          <a
            href={`https://wa.me/918055679162?text=${encodeURIComponent(`Hello Quickupp AI Studio, about my order ${order.orderNumber}.`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 block text-sm text-white/65 hover:text-white"
          >
            WhatsApp: +91 80556 79162
          </a>
        </div>
      </div>

      <div className="px-5 pb-9 pt-7 text-center sm:px-10">
        <BackButton
          label={paid || pending ? "Back to Quickupp AI Studio" : "Try Again"}
          href={paid || pending ? "/" : "/#pricing"}
        />
        <a href={SITE} className="mt-3 block text-xs text-white/50 hover:text-white">
          quickuppaistudio.in
        </a>
      </div>
    </Card>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-xs font-bold uppercase tracking-wider text-white/50">{children}</h2>;
}

function DetailRow({
  label,
  value,
  mono,
  strong,
}: {
  label: string;
  value: string;
  mono?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <span className="shrink-0 text-sm text-white/50">{label}</span>
      <span
        className={`min-w-0 break-all text-right ${
          mono
            ? "font-mono text-[13px] text-white/85"
            : strong
              ? "text-base font-bold text-white"
              : "text-sm font-medium text-white/85"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function BackButton({
  label = "Back to Quickupp AI Studio",
  href = "/",
}: {
  label?: string;
  href?: string;
}) {
  return (
    <a
      href={href}
      className="group mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#4f46e5] via-[#9333ea] to-[#db2777] px-8 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(147,51,234,0.35)] transition-all hover:brightness-110"
    >
      <span>{label}</span>
      <span aria-hidden className="transition-transform group-hover:translate-x-1">
        →
      </span>
    </a>
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
      className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full text-3xl font-bold ring-1 ${cls}`}
    >
      {tone === "ok" ? "✓" : tone === "wait" ? "…" : "!"}
    </div>
  );
}
