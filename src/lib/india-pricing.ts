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
  { id: "ai-ugc", name: "AI UGC Video", prices: { 1: 1999, 5: 8999, 10: 16999, 15: 23999 } },
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

export const INDIA_PACKS: { qty: IndiaPackQty; label: string }[] = [
  { qty: 1, label: "Single Reel" },
  { qty: 5, label: "5 Reels" },
  { qty: 10, label: "10 Reels" },
  { qty: 15, label: "15 Reels" },
];

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
