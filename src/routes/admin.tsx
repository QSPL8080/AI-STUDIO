import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, ArrowRight, Lock } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin Portal Migrated • Quickupp AI Studio" }],
  }),
  component: AdminRedirectPage,
});

function AdminRedirectPage() {
  const US_ADMIN_URL = "https://quickuppaistudio.us/admin";

  useEffect(() => {
    if (typeof window !== "undefined") {
      // Automatic immediate redirect to US Admin Portal
      window.location.replace(US_ADMIN_URL);
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-8 text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 shadow-xs">
          <ShieldCheck className="h-8 w-8" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-bold text-blue-700">
            <Lock className="h-3.5 w-3.5" />
            <span>Centralized Admin Security</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">
            Admin Portal Shifted
          </h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            All administrative, CRM, Calendly, and Meta Lead management operations have been shifted to the official US platform:
          </p>
          <p className="text-xs font-mono font-bold text-blue-600 bg-blue-50/60 py-1.5 px-2 rounded-lg border border-blue-100">
            quickuppaistudio.us/admin
          </p>
        </div>

        <div className="pt-2">
          <a
            href={US_ADMIN_URL}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition-all cursor-pointer"
          >
            <span>Proceed to US Admin Portal</span>
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        <p className="text-[11px] text-slate-400">
          Redirecting automatically in a moment... If you are not redirected, click the button above.
        </p>
      </div>
    </div>
  );
}

