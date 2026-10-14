import { createFileRoute } from "@tanstack/react-router";

// PDF payment receipt: /api/receipt?txn=QAS...&t=<signed token>. Paid orders only.
export const Route = createFileRoute("/api/receipt")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const { getReceiptPdf } = await import("@/lib/checkout-server");
        const r = await getReceiptPdf(
          url.searchParams.get("txn") || "",
          url.searchParams.get("t") || "",
        ).catch(() => null);
        if (!r)
          return new Response("Receipt not available.", {
            status: 404,
            headers: { "Content-Type": "text/plain" },
          });
        return new Response(new Uint8Array(r.pdf), {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${r.filename}"`,
            "Cache-Control": "private, no-store",
          },
        });
      },
    },
  },
});
