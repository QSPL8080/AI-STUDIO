import React, { useState, useEffect } from "react";
import { useLightCrmPage } from "@/lib/crm-theme";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Eye, EyeOff, Lock, Mail, ArrowLeft, ShieldCheck } from "lucide-react";
import { crmLoginFn } from "@/lib/crm-actions";
import {
  setStoredCrmUser,
  getStoredCrmUser,
  getRememberedEmail,
  setRememberedEmail,
} from "@/lib/crm-auth";

export const Route = createFileRoute("/crm/login")({
  head: () => ({
    meta: [
      { title: "Enterprise CRM Login | Quickupp AI Studio" },
      { name: "description", content: "Quickupp AI Studio Enterprise CRM Login Portal" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CrmLoginPage,
});

function CrmLoginPage() {
  const navigate = useNavigate();
  useLightCrmPage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Check if already logged in or has remembered email
  useEffect(() => {
    const existingUser = getStoredCrmUser();
    if (existingUser) {
      navigate({ to: "/crm" });
      return;
    }
    try {
      const reason = sessionStorage.getItem("quickupp_crm_logout_reason");
      if (reason) {
        setErrorMessage(reason);
        sessionStorage.removeItem("quickupp_crm_logout_reason");
      }
    } catch {
      /* ignore */
    }
    const rem = getRememberedEmail();
    if (rem) {
      setEmail(rem);
      setRememberEmail(true);
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setIsLoading(true);
    try {
      const res: any = await crmLoginFn({ data: { email: email.trim(), password } });
      if (res?.ok && res.token && res.user) {
        setRememberedEmail(rememberEmail ? email.trim() : "");
        setStoredCrmUser(
          {
            id: res.user.id,
            name: res.user.name,
            email: res.user.email,
            role: res.user.role,
            token: res.token,
          },
          false,
        );
        navigate({ to: "/crm" });
        return;
      }
      setErrorMessage(res?.error || "Authentication failed. Please verify your credentials.");
    } catch (err: any) {
      setErrorMessage("Could not reach the CRM server. Please try again.");
      console.error(err);
    }
    setIsLoading(false);
  };

  return (
    <div className="relative min-h-screen w-full bg-[#f4f5f9] flex items-center justify-center p-4 sm:p-6 text-slate-900 antialiased [color-scheme:light] selection:bg-purple-200 selection:text-purple-900 overflow-hidden">
      {/* Soft brand background */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden select-none">
        <div className="absolute -top-48 left-1/2 -translate-x-1/2 w-[720px] h-[480px] rounded-full bg-gradient-to-b from-purple-300/45 via-fuchsia-200/30 to-transparent blur-[110px]" />
        <div className="absolute -bottom-48 left-1/2 -translate-x-1/2 w-[620px] h-[380px] rounded-full bg-gradient-to-t from-blue-300/35 via-cyan-200/20 to-transparent blur-[110px]" />
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage: "radial-gradient(rgba(15, 23, 42, 0.07) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
            maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-[440px]">
        <div className="relative rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-10 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_24px_60px_-20px_rgba(76,29,149,0.22)] overflow-hidden">
          {/* Brand accent line */}
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[#4f46e5] via-[#a832e6] to-[#e11d74]" />

          {/* Brand header */}
          <div className="text-center">
            <Link to="/" className="inline-block transition-opacity hover:opacity-80">
              <img src="/images/logo-dark.png" alt="Quickupp AI Studio" className="h-9 w-auto mx-auto object-contain" />
            </Link>

            <div className="mt-5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-[11px] font-semibold uppercase tracking-widest">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Enterprise Portal</span>
            </div>

            <h1 className="mt-3 text-2xl sm:text-[26px] font-bold tracking-tight text-slate-900 font-heading">Admin Sign In</h1>
            <p className="mt-1.5 text-sm text-slate-500">Sign in with your authorized credentials</p>
          </div>

          {/* Error message */}
          {errorMessage && (
            <div
              role="alert"
              className="mt-5 p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm flex items-center gap-2.5 animate-in fade-in slide-in-from-top-1"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
              <span className="leading-snug">{errorMessage}</span>
            </div>
          )}

          {/* Login form */}
          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            <div>
              <label htmlFor="crm-email" className="block text-sm font-semibold text-slate-700 mb-2">
                Admin Email
              </label>
              <div className="relative">
                <Mail className="w-[18px] h-[18px] absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  id="crm-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@aistudio.in"
                  className="w-full pl-11 pr-4 h-12 rounded-lg border border-slate-300 bg-white text-[15px] text-slate-900 placeholder-slate-400 shadow-sm focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/15 transition-all"
                />
              </div>
            </div>

            <div>
              <label htmlFor="crm-password" className="block text-sm font-semibold text-slate-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="w-[18px] h-[18px] absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  id="crm-password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-11 pr-11 h-12 rounded-lg border border-slate-300 bg-white text-[15px] text-slate-900 placeholder-slate-400 shadow-sm focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/15 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer p-1"
                >
                  {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                </button>
              </div>
            </div>

            {/* Remember email */}
            <div className="pt-1 flex items-center justify-between">
              <label className="flex items-center gap-2.5 text-sm text-slate-600 cursor-pointer select-none group">
                <input
                  type="checkbox"
                  checked={rememberEmail}
                  onChange={(e) => setRememberEmail(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 cursor-pointer accent-purple-600"
                />
                <span className="group-hover:text-slate-900 transition-colors">Remember email</span>
              </label>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 w-full h-12 px-4 rounded-lg bg-gradient-to-r from-[#4f46e5] via-[#9333ea] to-[#db2777] text-white text-[15px] font-bold tracking-wide shadow-[0_10px_24px_-8px_rgba(147,51,234,0.55)] hover:shadow-[0_14px_30px_-8px_rgba(147,51,234,0.65)] hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed font-heading"
            >
              {isLoading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <span>Sign In to Dashboard</span>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-purple-700 transition-colors py-1">
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Quickupp AI Studio</span>
            </Link>
          </div>
        </div>
        <p className="mt-5 text-center text-xs text-slate-400">Authorized personnel only · Activity is logged</p>
      </div>
    </div>
  );
}
