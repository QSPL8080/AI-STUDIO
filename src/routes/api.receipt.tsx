import { createFileRoute } from "@tanstack/react-router";

// PDF payment receipt download: /api/receipt?txn=QAS...&t=<signature>
// The signed link is in the customer's payment confirmation email. Paid orders only.
export const Route = createFileRoute("/api/receipt")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const { getReceiptPdf } = await import("@/lib/checkout-server");
          const r = await getReceiptPdf(
            url.searchParams.get("txn") || "",
            url.searchParams.get("t") || "",
          );
          if (!r) return new Response("Receipt not found", { status: 404 });
          return new Response(new Uint8Array(r.pdf), {
            status: 200,
            headers: {
              // Always a file download (never opened as a web page).
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename="${r.filename}"; filename*=UTF-8''${encodeURIComponent(r.filename)}`,
              "Content-Length": String(r.pdf.length),
              "X-Content-Type-Options": "nosniff",
              "Cache-Control": "private, no-store",
            },
          });
        } catch (e) {
          console.error("Receipt download failed", e);
          return new Response("Receipt not available right now", { status: 500 });
        }
      },
    },
  },
});
