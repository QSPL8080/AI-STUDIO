import { createServerFn } from "@tanstack/react-start";
import type { CheckoutInput } from "./checkout-server";

const srv = () => import("./checkout-server");

export const createIndiaOrderFn = createServerFn({ method: "POST" })
  .validator((d: CheckoutInput) => d)
  .handler(async ({ data }) => {
    try {
      return await (await srv()).createIndiaOrder(data);
    } catch (e: any) {
      console.error("Checkout failed", e);
      return {
        ok: false as const,
        error:
          "We couldn't place your order right now. Please try again or chat with us on WhatsApp.",
      };
    }
  });

export const getConfirmationFn = createServerFn({ method: "POST" })
  .validator((d: { txn: string; t: string }) => d)
  .handler(async ({ data }) => {
    try {
      return await (await srv()).getConfirmation(String(data.txn || ""), String(data.t || ""));
    } catch (e) {
      console.error("Confirmation lookup failed", e);
      return {
        ok: false as const,
        error: "We couldn't load your order right now. Please refresh the page.",
      };
    }
  });
