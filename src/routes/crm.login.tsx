import React, { useState, useEffect } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Eye, EyeOff, Lock, Mail, ArrowLeft, Shield, CheckCircle } from "lucide-react";
import {
  validateCrmLogin,
  setStoredCrmUser,
  getStoredCrmUser,
  getRememberedEmail,
  setRememberedEmail,
} from "@/lib/crm-auth";

export const Route = createFileRoute("/crm/login")({
  head: () => ({
    meta: [
      { title: "Login | AI STUDIO INDIA - Enterprise CRM" },
      { name: "description", content: "Quickupp AI Studio India Enterprise CRM Login Portal" },
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
  const [rememberEmail, setRememberEmail] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Check if already logged in or has remembered email
  useEffect(() => {
    const existingUser = getStoredCrmUser();
    if (existingUser) {
      navigate({ to: "/crm" });
      return;
    }
    const rem = getRememberedEmail();
    if (rem) {
      setEmail(rem);
    }
  }, [navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setIsLoading(true);

    // Simulate location & security credential verification matching screenshot
    setTimeout(() => {
      const res = validateCrmLogin(email, password);
      if (res.success && res.user) {
        if (rememberEmail) {
          setRememberEmail(email);
        }
        setStoredCrmUser(res.user, rememberEmail);
        navigate({ to: "/crm" });
      } else {
        setIsLoading(false);
        setErrorMessage(res.error || "Authentication failed.");
      }
    }, 700);
  };

  const handleFillSuperAdmin = () => {
    setEmail("sa@aistudo.in");
    setPassword("Anay@8080");
    setErrorMessage("");
  };

  const handleFillTestAdmin = () => {
    setEmail("test@aistudio.in");
    setPassword("test@123");
    setErrorMessage("");
  };

  return (
    <div className="min-h-screen w-full bg-[#07090e] flex flex-col justify-between p-4 sm:p-6 text-slate-100 antialiased selection:bg-purple-900 selection:text-white">
      {/* Top back link */}
      <div className="w-full max-w-6xl mx-auto flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Quickupp AI Studio
        </Link>
        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
          <Shield className="w-3.5 h-3.5 text-purple-400" />
          <span>India CRM Node • Secure TLS</span>
        </div>
      </div>

      {/* Main Login Card */}
      <div className="flex items-center justify-center my-auto py-8">
        <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0c101c]/95 backdrop-blur-xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          {/* Subtle top ambient glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent"></div>

          {/* Logo & Title */}
          <div className="text-center mb-6">
            <img
              src="/images/logo.png"
              alt="Quickupp AI Studio"
              className="h-8 w-auto mx-auto object-contain mb-3.5 brightness-110"
            />
            <h1 className="text-lg font-bold text-white tracking-tight">
              AI STUDIO INDIA – Enterprise CRM
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Quickupp AI Studio Leads Management & CRM
            </p>
          </div>

          {/* Error notification */}
          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl border border-red-500/30 bg-red-950/40 text-red-300 text-xs flex items-center gap-2 animate-in fade-in">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0"></span>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Admin Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@aistudio.in"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-white/10 bg-black/40 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-white/10 bg-black/40 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberEmail}
                  onChange={(e) => setRememberEmail(e.target.checked)}
                  className="rounded bg-black/40 border-white/20 text-purple-600 focus:ring-0"
                />
                <span>Remember email</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>Verifying Location & Credentials...</span>
                </>
              ) : (
                <span>Sign In to Enterprise CRM</span>
              )}
            </button>
          </form>

          {/* Quick Helper Credentials Section */}
          <div className="mt-6 pt-5 border-t border-white/[0.08] text-center">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold block mb-2.5">
              Quick Test Credentials Fill
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleFillSuperAdmin}
                className="p-2 rounded-lg border border-purple-500/20 bg-purple-950/30 hover:bg-purple-900/40 text-[11px] text-purple-300 transition-colors text-left"
              >
                <div className="font-semibold text-white">Super Admin</div>
                <div className="text-[10px] text-slate-400 font-mono truncate">sa@aistudo.in</div>
              </button>
              <button
                type="button"
                onClick={handleFillTestAdmin}
                className="p-2 rounded-lg border border-blue-500/20 bg-blue-950/30 hover:bg-blue-900/40 text-[11px] text-blue-300 transition-colors text-left"
              >
                <div className="font-semibold text-white">Test Admin</div>
                <div className="text-[10px] text-slate-400 font-mono truncate">test@aistudio.in</div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer info */}
      <div className="text-center text-[11px] text-slate-500 pb-2">
        Quickupp AI Studio India • Enterprise CRM Management System
      </div>
    </div>
  );
}
