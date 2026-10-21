// India price list — the single source of truth for the website pricing table,
// the service cards and the checkout. The server re-calculates every amount from
// this list, so a customer can never change the price from the browser.

export type IndiaServiceId =
  "ai-ugc" | "ai-cartoon" | "ai-avatar" | "hyper-realistic" | "digital-twin";
export type IndiaPackQty = 1 | 5 | 10 | 15;

export interface IndiaService {
  id: IndiaServiceId;
  /** Short name used in the pricing table and checkout. */
  name: string;
  /** Price in rupees for 1, 5, 10 and 15 reels. */
  prices: Record<IndiaPackQty, number>;
}

export const INDIA_SERVICES: IndiaService[] = [
  { id: "ai-ugc", name: "AI UGC Video", prices: { 1: 10, 5: 8999, 10: 16999, 15: 23999 } },
  {
    id: "ai-cartoon",
    name: "AI Cartoon Animation",
    prices: { 1: 1999, 5: 8999, 10: 16999, 15: 23999 },
  },
  { id: "ai-avatar", name: "AI Avatar Video", prices: { 1: 1999, 5: 8999, 10: 16999, 15: 23999 } },
  {
    id: "hyper-realistic",
    name: "Hyper-Realistic AI Video",
    prices: { 1: 2999, 5: 13999, 10: 25499, 15: 35999 },
  },
  {
    id: "digital-twin",
    name: "AI Digital Twin / Clone",
    prices: { 1: 4999, 5: 22999, 10: 42499, 15: 59999 },
  },
];

// delivery = turnaround after script approval and receipt of the required materials.
export const INDIA_PACKS: { qty: IndiaPackQty; label: string; delivery: string; deliveryShort: string }[] = [
  { qty: 1, label: "Single Reel", delivery: "Within 48–72 Hrs Delivery", deliveryShort: "48–72 Hrs" },
  { qty: 5, label: "5 Reels", delivery: "Within 5 Days Delivery", deliveryShort: "5 Days" },
  { qty: 10, label: "10 Reels", delivery: "Within 10 Days Delivery", deliveryShort: "10 Days" },
  { qty: 15, label: "15 Reels", delivery: "Within 15 Days Delivery", deliveryShort: "15 Days" },
];

/** Delivery promise for a pack size (or the twin setup). */
export function deliveryFor(id: string, qty: number) {
  if (id === "digital-twin-setup") return "Within 7 Days Delivery";
  return (INDIA_PACKS.find((p) => p.qty === qty) || INDIA_PACKS[0]!).delivery;
}

export function formatInr(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function getIndiaService(id: string): IndiaService | undefined {
  return INDIA_SERVICES.find((s) => s.id === id);
}

export function isPackQty(n: unknown): n is IndiaPackQty {
  return n === 1 || n === 5 || n === 10 || n === 15;
}

/** Price, per-reel price and saving compared with buying single reels. */
export function quoteIndia(serviceId: IndiaServiceId, qty: IndiaPackQty) {
  const service = getIndiaService(serviceId) || INDIA_SERVICES[0]!;
  const amount = service.prices[qty];
  const fullPrice = service.prices[1] * qty;
  const pack = INDIA_PACKS.find((p) => p.qty === qty)!;
  return {
    service,
    qty,
    amount,
    perReel: Math.round(amount / qty),
    saving: Math.max(0, fullPrice - amount),
    itemName: `${service.name} - ${pack.label}`,
  };
}

// One-time AI Digital Twin setup (the "Build Your AI Digital Twin Once" section).
export const TWIN_SETUP_ID = "digital-twin-setup" as const;
export const TWIN_SETUP = {
  id: TWIN_SETUP_ID,
  name: "AI Digital Twin Setup",
  price: 15000,
  delivery: "Within 7 Days Delivery",
  includes: [
    "Face / avatar training",
    "Voice clone setup",
    "AI speaking & lip-sync model",
    "Testing & optimization",
  ],
};
export type CheckoutItemId = IndiaServiceId | typeof TWIN_SETUP_ID;

/** Any checkout item: a reel service + package, or the one-time twin setup. */
export function quoteItem(id: string, qty: number) {
  if (id === TWIN_SETUP_ID)
    return {
      kind: "setup" as const,
      id: TWIN_SETUP_ID as CheckoutItemId,
      serviceName: TWIN_SETUP.name,
      packLabel: "One-Time Setup",
      qty: 1 as IndiaPackQty,
      amount: TWIN_SETUP.price,
      perReel: TWIN_SETUP.price,
      saving: 0,
      delivery: TWIN_SETUP.delivery,
      itemName: `${TWIN_SETUP.name} (One-Time)`,
    };
  const q = quoteIndia(
    (getIndiaService(id)?.id || "ai-ugc") as IndiaServiceId,
    isPackQty(qty) ? qty : 1,
  );
  return {
    kind: "reels" as const,
    id: q.service.id as CheckoutItemId,
    serviceName: q.service.name,
    packLabel: INDIA_PACKS.find((p) => p.qty === q.qty)!.label,
    qty: q.qty,
    amount: q.amount,
    perReel: q.perReel,
    saving: q.saving,
    delivery: deliveryFor(q.service.id, q.qty),
    itemName: q.itemName,
  };
}

// ---------------------------------------------------------------------------
// Payment plans: pay in full, or pay 50% now and the balance later.
// ---------------------------------------------------------------------------
export type PaymentPlan = "full" | "advance";
export const ADVANCE_PERCENT = 50;

/** What the customer pays now and what stays due, for an order total in rupees. */
export function splitPayment(total: number, plan: PaymentPlan) {
  if (plan !== "advance") return { plan: "full" as PaymentPlan, payNow: total, balance: 0 };
  const payNow = Math.ceil((total * ADVANCE_PERCENT) / 100);
  const balance = total - payNow;
  // Very small totals (e.g. a ₹1 test price) can't be split: charge in full.
  if (balance <= 0) return { plan: "full" as PaymentPlan, payNow: total, balance: 0 };
  return { plan: "advance" as PaymentPlan, payNow, balance };
}
