import { createFileRoute } from "@tanstack/react-router";
import { TermsPage } from "./terms";

export const Route = createFileRoute("/privacy-policy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy & Terms | Quickupp AI Studio" },
      {
        name: "description",
        content:
          "Official Privacy Policy and Terms for Quickupp AI Studio video production services.",
      },
    ],
  }),
  component: TermsPage,
});
