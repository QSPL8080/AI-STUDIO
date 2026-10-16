import { createFileRoute } from "@tanstack/react-router";

// "Pay remaining balance" link (from the payment email / success popup):
//   /api/pay-balance?txn=QAS...&t=<signature>
// Creates the balance order and sends the customer straight to PayU.
const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function page(title: string, body: string, status = 200) {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)} | Quickupp AI Studio</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#07050f;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;padding:20px}
.c{max-width:440px;width:100%;background:#0d091a;border:1px solid rgba(255,255,255,.1);border-radius:24px;overflow:hidden;text-align:center}
.b{height:6px;background:linear-gradient(90deg,#4f46e5,#a832e6,#e11d74)}.i{padding:34px 28px}
h1{font-size:20px;margin:0 0 8px}p{color:rgba(255,255,255,.65);font-size:14px;line-height:1.6;margin:0}
a.btn{display:inline-block;margin-top:22px;padding:12px 26px;border-radius:999px;background:linear-gradient(90deg,#4f46e5,#9333ea,#db2777);color:#fff;text-decoration:none;font-weight:700;font-size:14px}
.s{width:40px;height:40px;margin:0 auto 18px;border:3px solid rgba(255,255,255,.15);border-top-color:#c084fc;border-radius:50%;animation:r 1s linear infinite}@keyframes r{to{transform:rotate(360deg)}}</style></head>
<body><div class="c"><div class="b"></div><div class="i">${body}</div></div></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );
}

export const Route = createFileRoute("/api/pay-balance")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        try {
          const { createBalancePayment } = await import("@/lib/checkout-server");
          const r: any = await createBalancePayment(url.searchParams.get("txn") || "", url.searchParams.get("t") || "");
          if (!r.ok || !r.form) {
            return page(
              r.paid ? "Already paid" : "Payment link",
              `<h1>${esc(r.paid ? "Order fully paid" : "We couldn't open this payment")}</h1><p>${esc(r.error || "Please try again.")}</p>
               <p style="margin-top:10px">Need help? <a href="mailto:info@quickuppaistudio.in" style="color:#d8a8ff">info@quickuppaistudio.in</a></p>
               <a class="btn" href="/">Back to Quickupp AI Studio</a>`,
              r.paid ? 200 : 400,
            );
          }
          const inputs = Object.entries(r.form.fields as Record<string, string>)
            .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`)
            .join("");
          return page(
            "Pay balance",
            `<div class="s"></div><h1>Taking you to the secure payment page...</h1><p>Paying the remaining balance of your order.</p>
             <form id="f" method="POST" action="${esc(r.form.action)}">${inputs}<noscript><button class="btn" type="submit">Continue to payment</button></noscript></form>
             <script>document.getElementById("f").submit();</script>`,
          );
        } catch (e) {
          console.error("Pay balance failed", e);
          return page("Payment link", `<h1>Something went wrong</h1><p>Please try again in a minute, or contact info@quickuppaistudio.in.</p><a class="btn" href="/">Back to Quickupp AI Studio</a>`, 500);
        }
      },
    },
  },
});
