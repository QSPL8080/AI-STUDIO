import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Lock,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import { getPaymentLinkFn, startPaymentLinkFn } from "@/lib/payment-link-actions";
import { formatInr } from "@/lib/india-pricing";

// Customer payment page for an Admin / Super Admin generated payment link:
//   https://quickuppaistudio.in/pay/<token>
// No account, no order form, no coupon. The customer only chooses Full or Partial payment;
// the amount is worked out on the server and the payment runs through PayU.
export const Route = createFileRoute("/pay/$token")({
  head: () => ({
    meta: [
      { title: "Secure Payment | Quickupp AI Studio" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: PayLinkPage,
});

const SUPPORT_EMAIL = "info@quickuppaistudio.in";
const SUPPORT_WHATSAPP = "918055679162";

type Choice = "full" | "partial";
type View = {
  ok: true;
  state: "active" | "processing" | "used" | "expired" | "cancelled";
  message: string;
  customerName: string;
  service: string;
  quantity: string;
  total: number;
  orderId: string;
  expiresAt: string;
  options: {
    full: { payNow: number; balance: number };
    partial: { payNow: number; balance: number } | null;
  };
  paidTotal: number;
  balanceDue: number;
  payBalanceUrl: string;
  confirmationUrl: string;
};

const inr = (n: number) => formatInr(Math.round(n * 100) / 100);
const istTime = (iso: string) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }) + " IST"
    : "";

function PayLinkPage() {
  const { token } = Route.useParams();
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState("");
  const [choice, setChoice] = useState<Choice | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [redirecting, setRedirecting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [payu, setPayu] = useState<{ action: string; fields: Record<string, string> } | null>(null);

  const load = useCallback(async () => {
    try {
      const r: any = await getPaymentLinkFn({ data: { token } });
      if (r?.ok) {
        setView(r as View);
        setError("");
      } else setError(r?.error || "This payment link is not valid.");
    } catch {
      setError(
        "We couldn't load this payment link right now. Please check your internet and refresh the page.",
      );
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  // A payment being confirmed by the bank: check again every 10 seconds (up to 5 minutes).
  useEffect(() => {
    if (view?.state !== "processing") return;
    let n = 0;
    const id = setInterval(() => {
      if (++n > 30) return clearInterval(id);
      void load();
    }, 10000);
    return () => clearInterval(id);
  }, [view?.state, load]);

  // Send the browser to PayU once the server has prepared the payment.
  useEffect(() => {
    if (payu && formRef.current) formRef.current.submit();
  }, [payu]);

  const proceed = async () => {
    if (!choice || busy) return;
    setBusy(true);
    setNotice("");
    try {
      const r: any = await startPaymentLinkFn({ data: { token, choice } });
      if (r?.ok && r.form?.action) {
        setRedirecting(true);
        setPayu(r.form);
        return;
      }
      setNotice(r?.error || "We couldn't start the payment. Please try again.");
      if (r?.paid || r?.expired || r?.processing) void load();
    } catch {
      setNotice("We couldn't start the payment. Please check your internet and try again.");
    } finally {
      setBusy(false);
    }
  };

  const selected =
    view && choice ? (choice === "full" ? view.options.full : view.options.partial) : null;

  return (
    <div className="min-h-screen w-full bg-[#07050f] text-white [font-family:-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,Arial,sans-serif]">
      <div className="h-1.5 w-full bg-gradient-to-r from-[#4f46e5] via-[#a832e6] to-[#e11d74]" />
      <main className="mx-auto w-full max-w-lg px-4 pb-14 pt-6 sm:pt-10">
        <header className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <img src="/images/logo.png" alt="Quickupp AI Studio" className="h-9 w-auto shrink-0" />
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[13px] font-semibold text-emerald-300">
            <Lock className="h-3.5 w-3.5" /> Secure Payment
          </div>
        </header>

        <h1 className="text-[22px] font-bold leading-tight sm:text-2xl">
          Quickupp AI Studio — Secure Payment
        </h1>

        {!view && !error && (
          <Card>
            <div className="flex flex-col items-center py-10 text-white/70">
              <Loader2 className="mb-3 h-8 w-8 animate-spin text-[#c084fc]" />
              <p className="text-base">Loading your payment details…</p>
            </div>
          </Card>
        )}

        {error && (
          <Card>
            <StateBox
              icon={<AlertCircle className="h-10 w-10 text-rose-400" />}
              title="We couldn't open this payment"
              text={error}
            />
            <Help />
          </Card>
        )}

        {view && (
          <Card>
            <p className="text-base text-white/80">
              Hello <span className="font-semibold text-white">{view.customerName}</span>,
            </p>
            <p className="mt-1 text-[15px] text-white/60">
              {view.state === "active"
                ? "Please check your order and choose how you would like to pay."
                : "Here are your order details."}
            </p>

            <dl className="mt-5 divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/[0.03]">
              <Row label="Customer Name" value={view.customerName} />
              <Row label="Service" value={view.service} />
              <Row label="Quantity" value={view.quantity} />
              <Row
                label="Order ID"
                value={<span className="font-mono text-[14px]">{view.orderId}</span>}
              />
              <div className="flex items-center justify-between gap-3 px-4 py-4">
                <dt className="text-[15px] font-semibold text-white/80">Total Amount</dt>
                <dd className="text-2xl font-extrabold tracking-tight">{inr(view.total)}</dd>
              </div>
            </dl>

            {view.state === "active" && (
              <>
                <h2 className="mt-7 text-[13px] font-bold uppercase tracking-wider text-white/50">
                  Payment Options
                </h2>
                <div className="mt-3 grid gap-3" role="radiogroup" aria-label="Payment option">
                  <Option
                    active={choice === "full"}
                    onClick={() => setChoice("full")}
                    title="Pay Full Amount"
                    amount={view.options.full.payNow}
                    note="Pay the whole amount now. Nothing left to pay later."
                  />
                  {view.options.partial ? (
                    <Option
                      active={choice === "partial"}
                      onClick={() => setChoice("partial")}
                      title="Pay Partial Amount"
                      amount={view.options.partial.payNow}
                      note={`Pay 50% now. The remaining ${inr(view.options.partial.balance)} can be paid later using a secure link we email you.`}
                    />
                  ) : (
                    <p className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-[14px] text-white/50">
                      Partial payment isn't available for this amount.
                    </p>
                  )}
                </div>

                {selected && (
                  <div className="mt-5 rounded-2xl border border-[#a832e6]/40 bg-[#a832e6]/[0.08] px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[15px] text-white/80">Amount payable now</span>
                      <span className="text-xl font-extrabold">{inr(selected.payNow)}</span>
                    </div>
                    {selected.balance > 0 && (
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <span className="text-[15px] text-white/60">
                          Remaining balance (pay later)
                        </span>
                        <span className="text-[17px] font-bold text-amber-300">
                          {inr(selected.balance)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {notice && (
                  <div
                    role="alert"
                    className="mt-4 flex gap-2.5 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-[15px] leading-snug text-amber-100"
                  >
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" /> {notice}
                  </div>
                )}

                <button
                  type="button"
                  onClick={proceed}
                  disabled={!choice || busy || redirecting}
                  className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#4f46e5] via-[#9333ea] to-[#db2777] text-[17px] font-bold text-white shadow-lg shadow-purple-900/40 transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy || redirecting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />{" "}
                      {redirecting ? "Opening secure payment page…" : "Please wait…"}
                    </>
                  ) : choice ? (
                    <>
                      <ShieldCheck className="h-5 w-5" /> Proceed to Secure Payment
                    </>
                  ) : (
                    "Choose a payment option above"
                  )}
                </button>
                <p className="mt-3 text-center text-[13px] leading-relaxed text-white/45">
                  Pay with UPI, card, net banking or wallet — processed securely by PayU.
                  {view.expiresAt && <> This link is valid until {istTime(view.expiresAt)}.</>}
                </p>
              </>
            )}

            {view.state === "processing" && (
              <StateBox
                icon={<Clock className="h-10 w-10 text-amber-300" />}
                title="Payment being confirmed"
                text={view.message}
              />
            )}

            {view.state === "used" && (
              <>
                <StateBox
                  icon={<CheckCircle2 className="h-10 w-10 text-emerald-400" />}
                  title="Payment received"
                  text={view.message}
                />
                <dl className="mt-1 divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/[0.03]">
                  <Row label="Total paid" value={inr(view.paidTotal)} />
                  <Row
                    label="Remaining balance"
                    value={
                      view.balanceDue > 0 ? (
                        <span className="text-amber-300">{inr(view.balanceDue)}</span>
                      ) : (
                        "₹0 — fully paid"
                      )
                    }
                  />
                </dl>
                {view.payBalanceUrl && (
                  <a
                    href={view.payBalanceUrl}
                    className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#4f46e5] via-[#9333ea] to-[#db2777] text-[17px] font-bold text-white"
                  >
                    <ShieldCheck className="h-5 w-5" /> Pay remaining {inr(view.balanceDue)}
                  </a>
                )}
                {view.confirmationUrl && (
                  <a
                    href={view.confirmationUrl}
                    className="mt-3 block text-center text-[15px] font-semibold text-[#d8a8ff] underline underline-offset-4"
                  >
                    View order confirmation &amp; receipt
                  </a>
                )}
              </>
            )}

            {(view.state === "expired" || view.state === "cancelled") && (
              <>
                <StateBox
                  icon={<Clock className="h-10 w-10 text-rose-400" />}
                  title={view.state === "expired" ? "Link expired" : "Link not active"}
                  text={view.message}
                />
                <Help />
              </>
            )}
          </Card>
        )}

        {view?.state === "active" && <Help subtle />}

        {payu && (
          <form ref={formRef} method="POST" action={payu.action} className="hidden">
            {Object.entries(payu.fields).map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
          </form>
        )}
      </main>
    </div>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <section className="mt-4 rounded-3xl border border-white/10 bg-[#0d091a] p-5 shadow-2xl sm:p-6">
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <dt className="shrink-0 text-[15px] text-white/55">{label}</dt>
      <dd className="text-right text-[16px] font-semibold text-white">{value}</dd>
    </div>
  );
}

function Option({
  active,
  onClick,
  title,
  amount,
  note,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  amount: number;
  note: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`flex w-full items-start gap-3.5 rounded-2xl border p-4 text-left transition-colors ${
        active
          ? "border-[#a832e6] bg-[#a832e6]/[0.14] shadow-[0_0_0_1px_rgba(168,50,230,0.5)]"
          : "border-white/15 bg-white/[0.03] hover:border-white/30"
      }`}
    >
      <span
        className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${active ? "border-[#c084fc]" : "border-white/35"}`}
      >
        {active && <span className="h-3 w-3 rounded-full bg-[#c084fc]" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="text-[17px] font-bold text-white">{title}</span>
          <span className="text-[18px] font-extrabold text-white">{inr(amount)}</span>
        </span>
        <span className="mt-1 block text-[14px] leading-snug text-white/60">{note}</span>
      </span>
    </button>
  );
}

function StateBox({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="flex flex-col items-center px-2 py-6 text-center">
      {icon}
      <h2 className="mt-3 text-xl font-bold">{title}</h2>
      <p className="mt-2 text-[16px] leading-relaxed text-white/70">{text}</p>
    </div>
  );
}

function Help({ subtle }: { subtle?: boolean }) {
  return (
    <div className={`${subtle ? "mt-5" : "mt-2"} text-center text-[14px] text-white/55`}>
      Need help?{" "}
      <a
        href={`https://wa.me/${SUPPORT_WHATSAPP}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 font-semibold text-emerald-300"
      >
        <MessageCircle className="h-4 w-4" /> WhatsApp us
      </a>{" "}
      or email{" "}
      <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-[#d8a8ff]">
        {SUPPORT_EMAIL}
      </a>
    </div>
  );
}
