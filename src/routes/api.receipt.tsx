import { createFileRoute } from "@tanstack/react-router";

// Retired: receipts are emailed as a PDF attachment. Safe to delete this file.
export const Route = createFileRoute("/api/receipt")({
  server: {
    handlers: {
      GET: () => new Response("Not found", { status: 404 }),
    },
  },
});
