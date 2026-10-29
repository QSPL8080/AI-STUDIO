// Shared (no server imports): reads an order row and works out the payment picture
// for full payments, 50% advances and balance payments. Used by the website,
// the receipts/emails and the CRM.

export type OrderPlan = "full" | "advance" | "balance";

function details(row: any): Record<string, any> {
  if (row?.raw_details && typeof row.raw_details === "object") return row.raw_details;
  try {
    return JSON.parse(row?.raw_details || "{}");
  } catch {
    return {};
  }
}

const money = (v: unknown) => {
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

export function paymentSummary(row: any) {
  const d = details(row);
  const plan: OrderPlan = d["paymentPlan"] === "advance" || d["paymentPlan"] === "balance" ? d["paymentPlan"] : "full";
  const amount = money(row?.amount); // what THIS transaction charges
  const paid = row?.payment_status === "COMPLETED";
  const orderTotal = money(d["orderTotal"]) || amount;
  const paidBefore = plan === "balance" ? money(d["paidBefore"]) : 0;
  const balanceLater = plan === "advance" && d["balancePaid"] ? money(d["balanceAmount"]) : 0;
  const paidNow = paid ? amount : 0;
  const paidTotal = Math.min(orderTotal, paidBefore + paidNow + balanceLater);
  const balanceDue = Math.max(0, Math.round((orderTotal - paidTotal) * 100) / 100);
  const fullyPaid = paid && balanceDue <= 0;
  const planLabel =
    plan === "advance"
      ? d["balancePaid"]
        ? "50% Advance + Balance"
        : "50% Advance"
      : plan === "balance"
        ? "Balance Payment"
        : "Full Payment";
  return {
    plan,
    planLabel,
    orderTotal,
    amountThisPayment: amount,
    paidBefore,
    paidTotal,
    balanceDue,
    fullyPaid,
    balancePaid: !!d["balancePaid"],
    parentOrderId: plan === "balance" ? String(d["parentOrderId"] || "") : "",
    balanceOrderId: plan === "advance" ? String(d["balanceOrderId"] || "") : "",
  };
}
export type PaymentSummary = ReturnType<typeof paymentSummary>;
