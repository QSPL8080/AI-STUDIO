import { createFileRoute } from "@tanstack/react-router";

// PayU sends the customer's browser here (POST) after payment — used for both surl and furl.
// The result is verified on the server, the order is updated, and the customer is redirected
// to the order confirmation page (/payment/confirmation).
export const Route = createFileRoute("/api/payu/callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let result: { status: string; txnid: string } = { status: "failed", txnid: "" };
        try {
          const form = await request.formData();
          const params: Record<string, string> = {};
          form.forEach((v, k) => (params[k] = String(v)));
          const { handlePayUCallback } = await import("@/lib/checkout-server");
          result = await handlePayUCallback(params);
        } catch (e) {
          console.error("PayU callback failed", e);
        }
        let location = "/";
        if (result.txnid) {
          const { confirmationPath } = await import("@/lib/checkout-server");
          location = confirmationPath(result.txnid);
        }
        return new Response(null, { status: 303, headers: { Location: location } });
      },
      GET: async () => new Response(null, { status: 303, headers: { Location: "/" } }),
    },
  },
});
