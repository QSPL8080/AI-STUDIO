import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  Calendar,
  Download,
  Eye,
  EyeOff,
  Filter,
  Layers,
  Lock,
  LogOut,
  Mail,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import type { Lead } from "@/lib/db";
import { fetchLeadsServerFn, updateLeadStatusServerFn, deleteLeadServerFn } from "@/lib/lead-actions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin Portal | Quickupp AI Studio CRM" }],
  }),
  component: AdminPage,
});

function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [authError, setAuthError] = useState("");

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterSource, setFilterSource] = useState<string>("All");
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLeadForMsg, setSelectedLeadForMsg] = useState<Lead | null>(null);
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Check saved session & remember me on initial mount
  useEffect(() => {
    const savedAuth = localStorage.getItem("ai_studio_admin_auth");
    if (savedAuth === "true") {
      setIsAuthenticated(true);
      fetchLeads();
    } else {
      const savedEmail = localStorage.getItem("ai_studio_remembered_email");
      if (savedEmail) {
        setEmailInput(savedEmail);
        setRememberMe(true);
      }
    }
  }, []);

  // Inactivity Auto-Logout Timer (5 minutes / 300,000 ms)
  useEffect(() => {
    if (!isAuthenticated) return;

    let timeoutId: NodeJS.Timeout;

    const resetInactivityTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        handleLogout();
        setAuthError("You were logged out due to 5 minutes of inactivity for security.");
      }, 300000); // 5 minutes
    };

    // User activity events to monitor
    const activityEvents = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];
    activityEvents.forEach((event) => {
      window.addEventListener(event, resetInactivityTimer, { passive: true });
    });

    // Start initial timer
    resetInactivityTimer();

    return () => {
      clearTimeout(timeoutId);
      activityEvents.forEach((event) => {
        window.removeEventListener(event, resetInactivityTimer);
      });
    };
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (emailInput === "admin@aistudio.com" && passwordInput === "Admin@123") {
      setIsAuthenticated(true);
      localStorage.setItem("ai_studio_admin_auth", "true");
      
      // Save ONLY email if user explicitly checked Remember Me
      if (rememberMe) {
        localStorage.setItem("ai_studio_remembered_email", emailInput);
      } else {
        localStorage.removeItem("ai_studio_remembered_email");
      }
      
      setAuthError("");
      fetchLeads();
    } else {
      setAuthError("Invalid admin credentials. Please check email and password.");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem("ai_studio_admin_auth");
    // Reload remembered email only
    const savedEmail = localStorage.getItem("ai_studio_remembered_email");
    if (savedEmail) {
      setEmailInput(savedEmail);
      setPasswordInput("");
      setRememberMe(true);
    } else {
      setEmailInput("");
      setPasswordInput("");
      setRememberMe(false);
    }
  };

  const fetchLeads = async () => {
    setLoading(true);
    try {
      // 1. Fetch directly from PostgreSQL
      const res = await fetchLeadsServerFn();
      if (res.success && res.leads && res.leads.length > 0) {
        setLeads(res.leads);
        localStorage.setItem("ai_studio_local_leads", JSON.stringify(res.leads));
      } else {
        // Fallback to local cache if DB has 0 or unreachable
        const local = localStorage.getItem("ai_studio_local_leads");
        if (local) {
          const parsed: Lead[] = JSON.parse(local);
          const realLeads = parsed.filter(
            (l) => l.id !== "lead_1" && l.id !== "lead_2" && l.name !== "Rajesh Sharma" && l.name !== "Priya Mehta"
          );
          setLeads(realLeads);
        } else {
          setLeads([]);
        }
      }
    } catch (err) {
      console.error("fetchLeads error:", err);
      const local = localStorage.getItem("ai_studio_local_leads");
      setLeads(local ? JSON.parse(local) : []);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, newStatus: Lead["status"]) => {
    const updated = leads.map((l) => (l.id === id ? { ...l, status: newStatus } : l));
    setLeads(updated);
    localStorage.setItem("ai_studio_local_leads", JSON.stringify(updated));
    try {
      await updateLeadStatusServerFn({ data: { id, status: newStatus } });
    } catch (err) {
      console.error("DB updateStatus error:", err);
    }
  };

  const deleteLeadItem = async (id: string) => {
    if (confirm("Are you sure you want to delete this lead?")) {
      const updated = leads.filter((l) => l.id !== id);
      setLeads(updated);
      localStorage.setItem("ai_studio_local_leads", JSON.stringify(updated));
      try {
        await deleteLeadServerFn({ data: { id } });
      } catch (err) {
        console.error("DB deleteLead error:", err);
      }
    }
  };

  const sanitizePhoneNumber = (phone: string) => {
    let clean = phone.replace(/[^0-9]/g, "");
    if (clean.length === 10) {
      clean = `91${clean}`;
    }
    return clean;
  };

  const getAdminWhatsAppPlainText = (lead: Lead) => {
    let msg = `Hello ${lead.name},\n\nThank you for reaching out to Quickupp AI Studio!\n\nWe have received your project inquiry with the following details:\n\nClient Name: ${lead.name}`;
    if (lead.business) msg += `\nBusiness Name: ${lead.business}`;
    if (lead.video_type) msg += `\nVideo Type: ${lead.video_type}`;
    if (lead.location) msg += `\nLocation: ${lead.location}`;
    if (lead.industry) msg += `\nIndustry: ${lead.industry}`;
    if (lead.requirement || lead.additional) msg += `\nRequirement: ${lead.requirement || lead.additional}`;
    
    msg += `\n\nOur team is reviewing your requirements and will share the tailored proposal and sample concepts shortly.\n\nCould you please confirm if you have any specific deadline or additional references in mind?\n\nBest regards,\nQuickupp AI Studio Team\nhttps://quickuppaistudio.com`;
    return msg;
  };

  const handleOpenWhatsApp = (lead: Lead) => {
    setSelectedLeadForMsg(lead);
    const text = getAdminWhatsAppPlainText(lead);
    const phone = sanitizePhoneNumber(lead.phone);

    // Auto copy text as safety backup
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }

    // Open exact standard wa.me link identical to public website
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank");
  };

  const copyLeadMessage = (lead: Lead) => {
    const text = getAdminWhatsAppPlainText(lead);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedNotification(true);
      setTimeout(() => setCopiedNotification(false), 2500);
    }
  };

  const exportCSV = () => {
    if (!filteredLeads.length) return alert("No leads to export.");
    const headers = [
      "ID",
      "Source (Category)",
      "Name",
      "Phone",
      "Email",
      "Video Type",
      "Business",
      "Location",
      "Industry/Requirement",
      "Status",
      "Date",
    ];
    const rows = filteredLeads.map((l) => [
      l.id,
      l.source,
      `"${l.name}"`,
      `"${l.phone}"`,
      `"${l.email || ""}"`,
      `"${l.video_type}"`,
      `"${l.business}"`,
      `"${l.location || ""}"`,
      `"${l.requirement || l.additional || l.industry || ""}"`,
      l.status,
      new Date(l.created_at).toLocaleString(),
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ai_studio_leads_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isToday = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  const filteredLeads = leads
    .filter((lead) => {
      const matchesSource = filterSource === "All" || lead.source === filterSource;
      const matchesStatus = filterStatus === "All" || lead.status === filterStatus;
      const matchesSearch =
        searchTerm === "" ||
        lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.phone.includes(searchTerm) ||
        lead.business.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (lead.email && lead.email.toLowerCase().includes(searchTerm.toLowerCase()));

      return matchesSource && matchesStatus && matchesSearch;
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const contactFormCount = leads.filter((l) => l.source === "Contact Form").length;
  const popupModalCount = leads.filter((l) => l.source === "Popup Modal").length;

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d0b14] px-4 text-foreground">
        <div className="panel relative w-full max-w-md border-neon/40 p-8 shadow-2xl glow-neon">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-fit items-center justify-center rounded-2xl border border-neon/30 bg-[#12101e] px-4 py-2 shadow-xl glow-neon">
              <img
                src="/images/logo.png"
                alt="Quickupp AI Studio logo"
                className="h-9 w-auto object-contain"
                width={120}
                height={36}
              />
            </div>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-white">Admin Portal</h2>
            <p className="mt-1 text-xs text-muted-foreground">Quickupp AI Studio Lead Management</p>
          </div>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            {authError ? (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
                {authError}
              </div>
            ) : null}

            <div>
              <label className="block text-xs font-semibold text-foreground">Admin Email</label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="admin@aistudio.com"
                  className="w-full rounded-lg border border-border bg-secondary/40 py-2.5 pl-9 pr-3 text-sm text-foreground focus:border-neon focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground">Password</label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-border/80 bg-[#0a0912] py-2.5 pl-9 pr-10 text-sm text-white focus:border-neon focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-muted-foreground transition-colors hover:text-white"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border bg-[#0a0912] text-neon focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
                <span>Remember me</span>
              </label>
              <span className="text-[11px] text-muted-foreground/60">admin@aistudio.com</span>
            </div>

            <button
              type="submit"
              className="w-full rounded-full bg-gradient-brand py-3 text-sm font-bold uppercase tracking-wider text-neon-foreground shadow-lg glow-neon transition-all hover:brightness-110"
            >
              Sign In to Admin
            </button>
          </form>

          <div className="mt-6 border-t border-border pt-4 text-center">
            <a href="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-neon">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Website
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#08070d] text-foreground antialiased selection:bg-neon selection:text-black">
      {/* Top Admin Header - Full Width & Responsive */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-[#100e1a]/95 backdrop-blur-xl">
        <div className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8 lg:px-12">
          <div className="flex items-center gap-3">
            <a href="/" className="flex items-center transition-opacity hover:opacity-90">
              <img
                src="/images/logo.png"
                alt="Quickupp AI Studio logo"
                className="h-8 sm:h-9 w-auto object-contain"
                width={110}
                height={34}
              />
            </a>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href="/"
              target="_blank"
              className="inline-flex items-center gap-1 rounded-lg border border-border/80 bg-secondary/60 px-2.5 py-1 text-xs font-semibold text-foreground transition-all hover:border-neon hover:text-neon sm:px-3.5 sm:py-1.5"
            >
              <span className="hidden sm:inline">View Live Website</span>
              <span className="sm:hidden">Site</span> ↗
            </a>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/20 sm:px-3.5 sm:py-1.5"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Admin Body - Full Width & Responsive */}
      <main className="w-full px-4 py-5 sm:px-8 lg:px-12">
        {/* KPI Stats Cards - Responsive 2x2 or 4x1 */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <div className="rounded-xl border border-border/80 bg-[#12101e] p-3.5 shadow-lg transition-all hover:border-neon/50 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground sm:text-xs">
                Total Leads
              </span>
              <Layers className="h-3.5 w-3.5 text-neon sm:h-4 sm:w-4" />
            </div>
            <p className="mt-2 text-2xl font-extrabold text-white sm:mt-3 sm:text-3xl">{leads.length}</p>
          </div>

          <div className="rounded-xl border border-blue-500/30 bg-[#0d1428] p-3.5 shadow-lg transition-all hover:border-blue-400 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300 sm:text-xs">
                Contact Form
              </span>
              <span className="h-2 w-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)] sm:h-2.5 sm:w-2.5" />
            </div>
            <p className="mt-2 text-2xl font-extrabold text-blue-400 sm:mt-3 sm:text-3xl">{contactFormCount}</p>
          </div>

          <div className="rounded-xl border border-pink-500/30 bg-[#250d1e] p-3.5 shadow-lg transition-all hover:border-pink-400 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-pink-300 sm:text-xs">
                Popup Modal
              </span>
              <span className="h-2 w-2 rounded-full bg-pink-400 shadow-[0_0_8px_rgba(244,114,182,0.8)] sm:h-2.5 sm:w-2.5" />
            </div>
            <p className="mt-2 text-2xl font-extrabold text-pink-400 sm:mt-3 sm:text-3xl">{popupModalCount}</p>
          </div>

          <div className="rounded-xl border border-emerald-500/30 bg-[#0c231a] p-3.5 shadow-lg transition-all hover:border-emerald-400 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 sm:text-xs">
                New Today
              </span>
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] sm:h-2.5 sm:w-2.5" />
            </div>
            <p className="mt-2 text-2xl font-extrabold text-emerald-400 sm:mt-3 sm:text-3xl">
              {leads.filter((l) => l.status === "New").length}
            </p>
          </div>
        </div>

        {/* Filters & Actions Bar */}
        <div className="mt-5 flex flex-col gap-3 rounded-xl border border-border/80 bg-[#12101e] p-3 shadow-md sm:mt-6 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="flex flex-1 flex-wrap items-center gap-2.5 sm:gap-3">
            {/* Search Input */}
            <div className="relative w-full min-w-0 sm:max-w-xs sm:flex-1">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search leads..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-border/80 bg-[#0a0912] py-2 pl-9 pr-3 text-xs text-white placeholder:text-muted-foreground focus:border-neon focus:outline-none"
              />
            </div>

            {/* Source Filter */}
            <div className="flex items-center gap-1.5 rounded-lg border border-border/80 bg-[#0a0912] px-2.5 py-1.5">
              <Filter className="h-3 w-3 text-neon" />
              <span className="text-xs font-medium text-muted-foreground">Source:</span>
              <select
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value)}
                className="bg-transparent text-xs font-semibold text-white focus:outline-none"
              >
                <option value="All" className="bg-[#12101e]">All</option>
                <option value="Contact Form" className="bg-[#12101e]">Contact Form</option>
                <option value="Popup Modal" className="bg-[#12101e]">Popup Modal</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 rounded-lg border border-border/80 bg-[#0a0912] px-2.5 py-1.5">
              <span className="text-xs font-medium text-muted-foreground">Status:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-transparent text-xs font-semibold text-white focus:outline-none"
              >
                <option value="All" className="bg-[#12101e]">All</option>
                <option value="New" className="bg-[#12101e]">New</option>
                <option value="Contacted" className="bg-[#12101e]">Contacted</option>
                <option value="In Progress" className="bg-[#12101e]">In Progress</option>
                <option value="Closed" className="bg-[#12101e]">Closed</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              onClick={fetchLeads}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-[#0a0912] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:border-neon hover:text-neon sm:px-4 sm:py-2"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin text-neon" : ""}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={exportCSV}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-brand px-3.5 py-1.5 text-xs font-bold text-neon-foreground shadow-md glow-neon transition-all hover:brightness-110 sm:px-4 sm:py-2"
            >
              <Download className="h-3 w-3" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Leads Container - Table on Desktop, Clean Cards on Mobile */}
        <div className="mt-5 flex-1 flex flex-col min-h-0 overflow-hidden rounded-xl border border-border/80 bg-[#12101e] shadow-xl sm:mt-6">
          {/* Desktop & Tablet Table View */}
          <div className="hidden md:block overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)]">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-20 border-b border-border bg-[#181528] text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-4">Source</th>
                  <th className="px-5 py-4">Client Name</th>
                  <th className="px-5 py-4">WhatsApp / Phone</th>
                  <th className="px-5 py-4">Video Type</th>
                  <th className="px-5 py-4">Business / Location</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Received Date</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-sm font-medium text-muted-foreground">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary/50 text-muted-foreground">
                        <Layers className="h-6 w-6" />
                      </div>
                      <p className="mt-3 text-white font-semibold">No leads in PostgreSQL yet</p>
                      <p className="mt-1 text-xs text-muted-foreground">Submissions from the website will automatically appear here in real time.</p>
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((lead) => {
                    const receivedToday = isToday(lead.created_at);
                    return (
                      <tr
                        key={lead.id}
                        className="transition-colors hover:bg-white/[0.03]"
                      >
                        {/* Source */}
                        <td className="whitespace-nowrap px-5 py-4">
                          <span className="inline-block rounded-md border border-border/80 bg-secondary/50 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                            {lead.source}
                          </span>
                        </td>

                        {/* Client Info */}
                        <td className="px-5 py-4">
                          <div className="text-sm font-semibold text-white">{lead.name}</div>
                          {lead.email ? (
                            <div className="mt-0.5 text-xs text-muted-foreground">{lead.email}</div>
                          ) : null}
                        </td>

                        {/* Phone */}
                        <td className="whitespace-nowrap px-5 py-4 font-mono text-sm text-foreground">
                          <a
                            href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, "")}`}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-neon hover:underline"
                          >
                            {lead.phone}
                          </a>
                        </td>

                        {/* Video Type */}
                        <td className="px-5 py-4">
                          <div className="text-xs font-medium text-foreground">
                            {lead.video_type}
                          </div>
                          {lead.requirement || lead.additional ? (
                            <p className="mt-1 max-w-xs text-xs text-muted-foreground line-clamp-1" title={lead.requirement || lead.additional}>
                              {lead.requirement || lead.additional}
                            </p>
                          ) : null}
                        </td>

                        {/* Business & Location */}
                        <td className="px-5 py-4 text-xs">
                          <div className="font-medium text-foreground">{lead.business}</div>
                          {lead.location ? (
                            <div className="mt-0.5 text-muted-foreground">
                              {lead.location}
                            </div>
                          ) : null}
                        </td>

                        {/* Status */}
                        <td className="whitespace-nowrap px-5 py-4">
                          <select
                            value={lead.status}
                            onChange={(e) => updateStatus(lead.id, e.target.value as Lead["status"])}
                            className={`rounded-md border px-2.5 py-1 text-xs font-semibold focus:outline-none cursor-pointer ${
                              lead.status === "New"
                                ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-400 font-bold"
                                : "border-border/80 bg-secondary/40 text-muted-foreground"
                            }`}
                          >
                            <option value="New" className="bg-[#12101e] text-emerald-400">New</option>
                            <option value="Contacted" className="bg-[#12101e] text-foreground">Contacted</option>
                            <option value="In Progress" className="bg-[#12101e] text-foreground">In Progress</option>
                            <option value="Closed" className="bg-[#12101e] text-muted-foreground">Closed</option>
                          </select>
                        </td>

                        {/* Date */}
                        <td className="whitespace-nowrap px-5 py-4 text-xs">
                          {receivedToday ? (
                            <div>
                              <div className="inline-flex items-center gap-1.5 rounded-full border border-neon/50 bg-neon/15 px-2.5 py-0.5 font-bold text-neon">
                                <Calendar className="h-3 w-3" />
                                Today, {new Date(lead.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </div>
                            </div>
                          ) : (
                            <div className="text-muted-foreground">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="h-3 w-3" />
                                {new Date(lead.created_at).toLocaleDateString()}
                              </div>
                              <div className="mt-0.5 text-[11px] text-muted-foreground/80">
                                {new Date(lead.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="whitespace-nowrap px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenWhatsApp(lead)}
                              className="rounded-lg border border-border/80 bg-secondary/50 p-2 text-emerald-400 transition-colors hover:border-emerald-500 hover:bg-emerald-500/10"
                              title="Send WhatsApp Confirmation (Also auto-copied to Clipboard)"
                            >
                              <MessageSquare className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => deleteLeadItem(lead.id)}
                              className="rounded-lg border border-border/80 bg-secondary/50 p-2 text-muted-foreground transition-colors hover:border-red-500 hover:text-red-400"
                              title="Delete Lead"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View (Strictly No Horizontal Page Scroll) */}
          <div className="block md:hidden divide-y divide-border/60 overflow-y-auto max-h-[calc(100vh-270px)] p-3">
            {filteredLeads.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                No leads recorded yet.
              </div>
            ) : (
              filteredLeads.map((lead) => {
                const receivedToday = isToday(lead.created_at);
                return (
                  <div key={lead.id} className="py-3.5 first:pt-0 last:pb-0 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-bold text-sm text-white">{lead.name}</div>
                      <span className="rounded border border-border/80 bg-secondary/50 px-2 py-0.5 text-[10px] text-muted-foreground">
                        {lead.source}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <a
                        href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-emerald-400 hover:underline flex items-center gap-1"
                      >
                        <Phone className="h-3 w-3" />
                        {lead.phone}
                      </a>
                      <div className="text-[11px] text-muted-foreground">{lead.video_type}</div>
                    </div>

                    {lead.business ? (
                      <div className="text-xs text-muted-foreground">
                        <span className="text-white font-medium">{lead.business}</span>
                        {lead.location ? ` · ${lead.location}` : ""}
                      </div>
                    ) : null}

                    <div className="flex items-center justify-between pt-1">
                      {receivedToday ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-neon/50 bg-neon/15 px-2 py-0.5 text-[10px] font-bold text-neon">
                          <Calendar className="h-2.5 w-2.5" /> Today {new Date(lead.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-2.5 w-2.5" /> {new Date(lead.created_at).toLocaleDateString()}
                        </span>
                      )}

                      <div className="flex items-center gap-2">
                        <select
                          value={lead.status}
                          onChange={(e) => updateStatus(lead.id, e.target.value as Lead["status"])}
                          className={`rounded border px-2 py-0.5 text-[11px] font-semibold focus:outline-none ${
                            lead.status === "New"
                              ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-400 font-bold"
                              : "border-border/80 bg-secondary/40 text-muted-foreground"
                          }`}
                        >
                          <option value="New" className="bg-[#12101e] text-emerald-400">New</option>
                          <option value="Contacted" className="bg-[#12101e]">Contacted</option>
                          <option value="In Progress" className="bg-[#12101e]">In Progress</option>
                          <option value="Closed" className="bg-[#12101e]">Closed</option>
                        </select>

                        <button
                          onClick={() => handleOpenWhatsApp(lead)}
                          className="rounded border border-border/80 bg-secondary/50 p-1.5 text-emerald-400 hover:border-emerald-500 hover:bg-emerald-500/10"
                          title="Send WhatsApp Confirmation (Also auto-copied to Clipboard)"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => deleteLeadItem(lead.id)}
                          className="rounded border border-border/80 bg-secondary/50 p-1.5 text-muted-foreground hover:border-red-500 hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Quick WhatsApp Message Preview & 1-Click Copy Modal */}
        {selectedLeadForMsg ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-border bg-[#120f20] p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-emerald-400" />
                    WhatsApp Confirmation Message
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    For {selectedLeadForMsg.name} ({selectedLeadForMsg.phone})
                  </p>
                </div>
                <button
                  onClick={() => setSelectedLeadForMsg(null)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/10 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="rounded-xl border border-border/80 bg-black/60 p-4 font-mono text-xs text-white/90 whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed">
                {getAdminWhatsAppPlainText(selectedLeadForMsg)}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
                <button
                  onClick={() => copyLeadMessage(selectedLeadForMsg)}
                  className="rounded-xl border border-border bg-secondary/80 py-2.5 px-3 text-xs font-semibold text-white hover:bg-secondary flex items-center justify-center gap-1.5"
                >
                  <Copy className="h-4 w-4 text-neon" />
                  {copiedNotification ? "Copied!" : "Copy Text"}
                </button>

                <a
                  href={`https://wa.me/${sanitizePhoneNumber(selectedLeadForMsg.phone)}?text=${encodeURIComponent(
                    getAdminWhatsAppPlainText(selectedLeadForMsg)
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl bg-[#25D366] py-2.5 px-3 text-xs font-bold text-white hover:bg-[#20bd5a] flex items-center justify-center gap-1.5"
                >
                  <MessageSquare className="h-4 w-4" />
                  Chat on WhatsApp
                </a>
              </div>
            </div>
          </div>
        ) : null}

        {/* Global Copied Toast */}
        {copiedNotification && !selectedLeadForMsg ? (
          <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-emerald-500 px-4 py-3 text-xs font-bold text-white shadow-2xl flex items-center gap-2">
            ✓ Message copied! Press Ctrl+V in WhatsApp.
          </div>
        ) : null}
      </main>
    </div>
  );
}
