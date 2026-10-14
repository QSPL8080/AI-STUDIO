import React, { useState, useEffect } from "react";
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
            loginTime: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }),
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
    <div className="relative min-h-screen w-full bg-[#05040a] flex items-center justify-center p-4 sm:p-6 text-foreground antialiased selection:bg-purple-900 selection:text-white overflow-hidden">
      {/* Dynamic Ambient Background Elements */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden select-none"
      >
        {/* Top subtle spotlight glow */}
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[650px] h-[450px] bg-gradient-to-b from-purple-600/20 via-fuchsia-600/10 to-transparent blur-[120px] rounded-full" />

        {/* Bottom subtle blue glow */}
        <div className="absolute -bottom-40 left-1/2 -translate-x-1/2 w-[550px] h-[350px] bg-gradient-to-t from-blue-600/15 via-cyan-600/5 to-transparent blur-[120px] rounded-full" />

        {/* Minimal grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.4) 1px, transparent 1px)`,
            backgroundSize: "28px 28px",
          }}
        />
      </div>

      {/* Main Luxury Auth Card */}
      <div className="relative z-10 w-full max-w-[460px]">
        <div className="relative rounded-xl border border-white/10 bg-[#0c0919]/90 backdrop-blur-2xl p-6 sm:p-10 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.9),0_0_50px_-10px_rgba(168,85,247,0.18)] overflow-hidden">
          {/* Subtle top accent gradient line */}
          <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-purple-500/80 to-transparent" />

          {/* Brand Header */}
          <div className="text-center">
            <Link to="/" className="inline-block transition-transform hover:scale-105">
              <img
                src="/images/logo.png"
                alt="Quickupp AI Studio"
                className="h-10 w-auto mx-auto object-contain drop-shadow-[0_0_20px_rgba(200,80,255,0.35)]"
              />
            </Link>

            <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-purple-500/10 border border-purple-500/25 text-purple-300 text-[11px] font-semibold uppercase tracking-widest">
              <ShieldCheck className="w-3 h-3 text-purple-400" />
              <span>Enterprise Portal</span>
            </div>

            <h1 className="mt-3 text-2xl sm:text-[26px] font-bold tracking-tight text-white font-heading">
              Admin Sign In
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Sign in with your authorized credentials
            </p>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="mt-5 p-3 rounded-md border border-red-500/30 bg-red-950/40 text-red-300 text-sm flex items-center gap-2.5 animate-in fade-in slide-in-from-top-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              <span className="leading-snug">{errorMessage}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Admin Email
              </label>
              <div className="relative">
                <Mail className="w-[18px] h-[18px] absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@aistudio.in"
                  className="w-full pl-11 pr-4 h-12 rounded-md border border-white/10 bg-black/40 text-[15px] text-white placeholder-slate-500 focus:outline-none focus:border-neon focus:ring-1 focus:ring-neon/30 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="w-[18px] h-[18px] absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-11 pr-11 h-12 rounded-md border border-white/10 bg-black/40 text-[15px] text-white placeholder-slate-500 focus:outline-none focus:border-neon focus:ring-1 focus:ring-neon/30 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer p-1"
                >
                  {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                </button>
              </div>
            </div>

            {/* Remember Email Option */}
            <div className="pt-1 flex items-center justify-between">
              <label className="flex items-center gap-2.5 text-sm text-slate-300 cursor-pointer select-none group">
                <input
                  type="checkbox"
                  checked={rememberEmail}
                  onChange={(e) => setRememberEmail(e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-black/50 text-neon focus:ring-0 focus:ring-offset-0 cursor-pointer accent-purple-600"
                />
                <span className="group-hover:text-white transition-colors">
                  Remember email
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 w-full h-12 px-4 rounded-md bg-gradient-brand text-neon-foreground text-[15px] font-bold tracking-wide shadow-[0_0_25px_rgba(200,80,255,0.35)] hover:shadow-[0_0_35px_rgba(200,80,255,0.55)] hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed font-heading"
            >
              {isLoading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <span>Sign In to Dashboard</span>
              )}
            </button>
          </form>

          {/* Minimal Return Home Link */}
          <div className="mt-6 text-center">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors py-1"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Quickupp AI Studio</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
