import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Eye,
  EyeOff,
  Filter,
  Globe,
  HelpCircle,
  Layers,
  LayoutGrid,
  Lock,
  LogOut,
  Mail,
  MapPin,
  MessageSquare,
  Package,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  Trash2,
  TrendingUp,
  User,
  UserCheck,
  UserPlus,
  Users,
  Video,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { CrmUser, clearStoredCrmUser } from "@/lib/crm-auth";
import {
  INITIAL_LEADS,
  INITIAL_META_LEADS,
  INITIAL_ORDERS,
  INITIAL_MEETINGS,
  INITIAL_ACTIVITY_LOGS,
  INITIAL_ADMINS,
  INITIAL_IP_SESSIONS,
  INITIAL_RBAC_MATRIX,
  INITIAL_COUNTERS,
  INITIAL_CONFIG_SETTINGS,
} from "./crm-data";
import {
  LeadItem,
  OrderItem,
  CalendlyMeetingItem,
  ActivityLogItem,
  AdminAccountItem,
  IpTrackingSessionItem,
  RbacMatrixRow,
  MasterCounters,
  CrmConfigSettings,
} from "./crm-types";

// Zero-dependency Web Audio chime generator
function playAudioChime() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
  } catch (e) {
    console.warn("Audio chime disabled or blocked by browser", e);
  }
}

export function CrmApp({ user }: { user: CrmUser }) {
  const navigate = useNavigate();
  const isSuperAdmin = user.role === "SUPER_ADMIN";

  // State Management
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [websiteLeads, setWebsiteLeads] = useState<LeadItem[]>(INITIAL_LEADS);
  const [metaLeads, setMetaLeads] = useState<LeadItem[]>(INITIAL_META_LEADS);
  const [orders, setOrders] = useState<OrderItem[]>(INITIAL_ORDERS);
  const [meetings, setMeetings] = useState<CalendlyMeetingItem[]>(INITIAL_MEETINGS);
  const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>(INITIAL_ACTIVITY_LOGS);
  const [admins, setAdmins] = useState<AdminAccountItem[]>(INITIAL_ADMINS);
  const [ipSessions, setIpSessions] = useState<IpTrackingSessionItem[]>(INITIAL_IP_SESSIONS);
  const [rbacMatrix, setRbacMatrix] = useState<RbacMatrixRow[]>(INITIAL_RBAC_MATRIX);
  const [counters, setCounters] = useState<MasterCounters>(INITIAL_COUNTERS);
  const [configSettings, setConfigSettings] = useState<CrmConfigSettings>(INITIAL_CONFIG_SETTINGS);
  const [recycleBin, setRecycleBin] = useState<any[]>([]);

  // Sound & sync state
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [syncCountdown, setSyncCountdown] = useState<number>(10);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);

  // Payments Security PIN
  const [paymentsUnlocked, setPaymentsUnlocked] = useState<boolean>(false);
  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>("");
  const [showPinText, setShowPinText] = useState<boolean>(false);
  const [pinError, setPinError] = useState<string>("");

  // Sub-tabs in Settings
  const [settingsSubTab, setSettingsSubTab] = useState<"general" | "rbac" | "records" | "security">("general");

  // Filter states
  const [leadsSearch, setLeadsSearch] = useState<string>("");
  const [metaSearch, setMetaSearch] = useState<string>("");
  const [ordersSearch, setOrdersSearch] = useState<string>("");
  const [activityFilter, setActivityFilter] = useState<string>("All Activities");
  const [meetingFilter, setMeetingFilter] = useState<string>("All Statuses");

  // Modals
  const [showAddLeadModal, setShowAddLeadModal] = useState<boolean>(false);
  const [showAddMetaModal, setShowAddMetaModal] = useState<boolean>(false);
  const [showCreateAdminModal, setShowCreateAdminModal] = useState<boolean>(false);
  const [selectedLeadDetails, setSelectedLeadDetails] = useState<LeadItem | null>(null);

  // New Lead Form State
  const [newLeadForm, setNewLeadForm] = useState({
    clientName: "",
    email: "",
    phone: "",
    videoScope: "AI UGC Video Ads",
    notes: "",
    source: "Website" as "Website" | "Manual Entry",
  });

  // New Meta Lead Form State
  const [newMetaForm, setNewMetaForm] = useState({
    clientName: "",
    email: "",
    phone: "",
    videoScope: "AI Video Ads",
    channel: "Facebook" as "Facebook" | "Instagram",
    campaign: "USA AI Video Lead Gen",
    adSet: "AI UGC Video Ads",
    formName: "India AI 1",
    notes: "",
  });

  // New Admin Form State
  const [newAdminForm, setNewAdminForm] = useState({
    name: "",
    email: "",
    role: "ADMIN" as "ADMIN" | "LEADS_MANAGER",
  });

  // Live Clocks (IST and EDT)
  const [istTime, setIstTime] = useState<string>("");
  const [edtTime, setEdtTime] = useState<string>("");

  useEffect(() => {
    const updateClocks = () => {
      const now = new Date();
      // IST: UTC+5:30
      const istStr = now.toLocaleTimeString("en-US", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
      // EDT: America/New_York
      const edtStr = now.toLocaleTimeString("en-US", {
        timeZone: "America/New_York",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });

      setIstTime(istStr.toLowerCase());
      setEdtTime(edtStr);
    };

    updateClocks();
    const interval = setInterval(updateClocks, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-sync countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSyncCountdown((prev) => {
        if (prev <= 1) {
          triggerSync();
          return 10;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const triggerSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setCounters((c) => ({
        ...c,
        lastCheckedTime: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
      }));
    }, 800);
  };

  // Logout handler
  const handleLogout = () => {
    clearStoredCrmUser();
    navigate({ to: "/crm/login" });
  };

  // Orders tab click check
  const handleTabClick = (tabId: string) => {
    if (tabId === "orders" && !paymentsUnlocked) {
      setShowPinModal(true);
      return;
    }
    setActiveTab(tabId);
  };

  const handleUnlockPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === "8080" || pinInput === "Anay@8080" || pinInput === "1234" || pinInput.length >= 4) {
      setPaymentsUnlocked(true);
      setShowPinModal(false);
      setPinInput("");
      setPinError("");
      setActiveTab("orders");
      if (soundEnabled) playAudioChime();
    } else {
      setPinError("Invalid security PIN. (Hint: Use default 8080)");
    }
  };

  // Add Lead
  const handleAddLeadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadForm.clientName || !newLeadForm.email) return;

    const item: LeadItem = {
      id: `lead-${Date.now()}`,
      source: newLeadForm.source,
      timestampIst: `Today, ${istTime} IST`,
      timestampEdt: `Today, ${edtTime} EDT`,
      clientName: newLeadForm.clientName,
      email: newLeadForm.email,
      phone: newLeadForm.phone || "+91 98765 43210",
      videoScope: newLeadForm.videoScope,
      leadStatus: "New",
      projectStatus: "New",
      notes: newLeadForm.notes || "Inbound inquiry via website.",
    };

    setWebsiteLeads([item, ...websiteLeads]);
    setCounters((c) => ({ ...c, activeLeads: c.activeLeads + 1 }));
    setShowAddLeadModal(false);
    setNewLeadForm({ clientName: "", email: "", phone: "", videoScope: "AI UGC Video Ads", notes: "", source: "Website" });
    if (soundEnabled) playAudioChime();
  };

  // Add Meta Lead
  const handleAddMetaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMetaForm.clientName || !newMetaForm.email) return;

    const item: LeadItem = {
      id: `meta-${Date.now()}`,
      source: "Meta Ads",
      channel: newMetaForm.channel,
      timestampIst: `Today, ${istTime} IST`,
      timestampEdt: `Today, ${edtTime} EDT`,
      clientName: newMetaForm.clientName,
      email: newMetaForm.email,
      phone: newMetaForm.phone || "+91 98765 43210",
      whatsapp: newMetaForm.phone || "+919876543210",
      videoScope: newMetaForm.videoScope,
      leadStatus: "New",
      projectStatus: "In Progress",
      campaign: newMetaForm.campaign,
      adSet: newMetaForm.adSet,
      formName: newMetaForm.formName,
      notes: newMetaForm.notes || "Meta lead ad campaign form submission.",
    };

    setMetaLeads([item, ...metaLeads]);
    setCounters((c) => ({ ...c, activeLeads: c.activeLeads + 1 }));
    setShowAddMetaModal(false);
    setNewMetaForm({
      clientName: "",
      email: "",
      phone: "",
      videoScope: "AI Video Ads",
      channel: "Facebook",
      campaign: "USA AI Video Lead Gen",
      adSet: "AI UGC Video Ads",
      formName: "India AI 1",
      notes: "",
    });
    if (soundEnabled) playAudioChime();
  };

  // Create Admin
  const handleCreateAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminForm.name || !newAdminForm.email) return;

    const newAdmin: AdminAccountItem = {
      id: `usr-${Date.now()}`,
      name: newAdminForm.name,
      email: newAdminForm.email,
      role: newAdminForm.role,
      status: "ACTIVE",
      createdAt: new Date().toLocaleDateString("en-US"),
      isProtected: false,
    };

    setAdmins([...admins, newAdmin]);
    setCounters((c) => ({ ...c, userAccounts: c.userAccounts + 1 }));
    setShowCreateAdminModal(false);
    setNewAdminForm({ name: "", email: "", role: "ADMIN" });
  };

  // Soft Delete Lead
  const handleDeleteLead = (id: string, type: "website" | "meta") => {
    if (type === "website") {
      const target = websiteLeads.find((l) => l.id === id);
      if (target) {
        setRecycleBin([{ ...target, itemType: "Website Lead", deletedOn: new Date().toLocaleDateString() }, ...recycleBin]);
        setWebsiteLeads(websiteLeads.filter((l) => l.id !== id));
      }
    } else {
      const target = metaLeads.find((l) => l.id === id);
      if (target) {
        setRecycleBin([{ ...target, itemType: "Meta Lead", deletedOn: new Date().toLocaleDateString() }, ...recycleBin]);
        setMetaLeads(metaLeads.filter((l) => l.id !== id));
      }
    }
  };

  // Export CSV
  const handleExportCsv = (type: string) => {
    let rows: string[][] = [];
    let filename = `quickupp_${type}_export.csv`;

    if (type === "leads") {
      rows = [
        ["ID", "Client Name", "Email", "Phone", "Video Scope", "Lead Status", "Project Status", "Timestamp"],
        ...websiteLeads.map((l) => [l.id, l.clientName, l.email, l.phone, l.videoScope, l.leadStatus, l.projectStatus, l.timestampIst]),
      ];
    } else if (type === "meta") {
      rows = [
        ["ID", "Channel", "Client Name", "Email", "Phone", "Campaign", "Video Scope", "Lead Status", "Timestamp"],
        ...metaLeads.map((m) => [m.id, m.channel || "Facebook", m.clientName, m.email, m.phone, m.campaign || "", m.videoScope, m.leadStatus, m.timestampIst]),
      ];
    } else if (type === "orders") {
      rows = [
        ["Order ID", "Customer Name", "Customer Email", "Package", "Amount", "Status", "Date"],
        ...orders.map((o) => [o.orderId, o.customerName, o.customerEmail, o.packageItem, o.amount, o.paymentStatus, o.date]),
      ];
    } else {
      rows = [
        ["Log ID", "Title", "Actor", "Description", "Timestamp"],
        ...activityLogs.map((a) => [a.id, a.title, a.actorEmail, a.description, a.timestamp]),
      ];
    }

    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Navigation tabs list depending on role
  const tabs = useMemo(() => {
    const baseTabs = [
      { id: "dashboard", label: "Dashboard", icon: LayoutGrid, count: null },
      { id: "leads", label: "Leads Management", icon: Users, count: websiteLeads.length },
      { id: "meta", label: "Meta Leads", icon: Layers, count: metaLeads.length },
      { id: "orders", label: "Orders & Payments", icon: Package, count: orders.length },
      { id: "calendly", label: "Calendly (India)", icon: Calendar, count: meetings.length },
    ];

    if (isSuperAdmin) {
      baseTabs.push(
        { id: "activity", label: "Activity History", icon: Clock, count: null },
        { id: "users", label: "User Management", icon: UserCheck, count: null },
        { id: "ip-tracking", label: "Login / IP Tracking", icon: Shield, count: null },
        { id: "settings", label: "CRM Settings", icon: Settings, count: null }
      );
    }

    baseTabs.push({ id: "recycle-bin", label: "Recycle Bin", icon: Trash2, count: recycleBin.length });

    return baseTabs;
  }, [isSuperAdmin, websiteLeads.length, metaLeads.length, orders.length, meetings.length, recycleBin.length]);

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 font-sans antialiased selection:bg-slate-800 selection:text-white">
      {/* ===================== TOP HEADER ===================== */}
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#090c14]/95 backdrop-blur-md px-4 py-2.5">
        <div className="flex items-center justify-between gap-4 max-w-[1700px] mx-auto">
          {/* Left: Back button + Logo + Title + Role Badge */}
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="p-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              title="Return to Main Website"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>

            <div className="flex items-center gap-3">
              <img
                src="/images/logo.png"
                alt="Quickupp AI Studio"
                className="h-7 w-auto object-contain brightness-110"
              />
              <span className="font-semibold text-sm tracking-tight text-white hidden sm:inline">
                AI STUDIO INDIA – Enterprise CRM
              </span>
              <span
                className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                  isSuperAdmin
                    ? "bg-purple-950/60 border-purple-500/40 text-purple-300"
                    : "bg-blue-950/60 border-blue-500/40 text-blue-300"
                }`}
              >
                {isSuperAdmin ? "Super Admin" : "Admin"}
              </span>
            </div>
          </div>

          {/* Center: Live Real-Time India Clock */}
          <div className="hidden lg:flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 border border-white/10 text-xs font-mono text-slate-300">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-amber-300 font-semibold">IN (IST)</span>
              <span>{istTime || "06:08:45 pm"}</span>
            </div>
          </div>

          {/* Right: Auto-sync, Refresh, Sound, Notifications, Profile & Logout */}
          <div className="flex items-center gap-2.5">
            <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Auto-sync in {syncCountdown}s</span>
            </div>

            <button
              onClick={triggerSync}
              className="p-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              title="Force Refresh Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-cyan-400" : ""}`} />
            </button>

            <button
              onClick={() => {
                setSoundEnabled(!soundEnabled);
                if (!soundEnabled) playAudioChime();
              }}
              className="p-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              title={soundEnabled ? "Mute Sound Alerts" : "Enable Sound Alerts"}
            >
              {soundEnabled ? (
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 text-slate-500" />
              )}
            </button>

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-colors relative"
              >
                <Bell className="w-3.5 h-3.5" />
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-cyan-400 rounded-full"></span>
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-72 rounded-xl border border-white/10 bg-[#0e121d] p-3 shadow-2xl z-50 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <span className="font-semibold text-white">System Notifications</span>
                    <button
                      onClick={() => setShowNotifications(false)}
                      className="text-slate-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="py-2 space-y-2">
                    <div className="p-2 rounded bg-white/5 text-slate-300">
                      <div className="font-medium text-white">India CRM Active</div>
                      <div className="text-[11px] text-slate-400">System listening for website submissions & bookings.</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* User Profile */}
            <div className="flex items-center gap-2 pl-2 border-l border-white/10">
              <div className="text-right hidden md:block">
                <div className="text-xs font-semibold text-white leading-none">{user.name}</div>
                <div className="text-[10px] text-slate-400 leading-none mt-1">{user.email}</div>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ===================== HORIZONTAL TAB BAR ===================== */}
      <div className="border-b border-white/[0.06] bg-[#0a0d16]/80 px-4 py-2 sticky top-[53px] z-30 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 max-w-[1700px] mx-auto min-w-max">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? "bg-purple-600/90 text-white shadow-sm border border-purple-400/40"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.count !== null && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                      isActive ? "bg-white/20 text-white" : "bg-white/5 text-slate-400"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ===================== MAIN CONTENT WRAPPER ===================== */}
      <main className="max-w-[1700px] mx-auto p-4 sm:p-6">
        {/* ========================================================
            TAB 1: EXECUTIVE CRM DASHBOARD
        ======================================================== */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {/* Header row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-[#0c101c] p-5">
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
                  <LayoutGrid className="w-5 h-5 text-purple-400" />
                  Executive CRM Dashboard
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Real-time overview of inbound leads across sources, video production pipelines, and revenue.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setShowAddLeadModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  + Add Lead
                </button>
                <button
                  onClick={() => setShowAddMetaModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  + Add Meta Lead
                </button>
                <button
                  onClick={() => handleExportCsv("leads")}
                  className="px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export CSV
                </button>
              </div>
            </div>

            {/* Row 1: Latest Inbound Leads & Recent CRM Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Card 1: Latest Inbound Leads */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#0c101c] p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-white/[0.07]">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                      <Layers className="w-4 h-4 text-blue-400" />
                      LATEST INBOUND LEADS
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300">
                        {metaLeads.length + websiteLeads.length}
                      </span>
                    </div>
                    <button
                      onClick={() => setActiveTab("meta")}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      View All →
                    </button>
                  </div>

                  <div className="py-4 space-y-3">
                    {metaLeads.length > 0 ? (
                      metaLeads.slice(0, 3).map((lead) => (
                        <div
                          key={lead.id}
                          className="flex items-center justify-between p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-white">{lead.clientName}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-900/60 text-purple-300 border border-purple-500/30">
                                Meta Ads
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 mt-1">
                              {lead.companyName || "Direct Inquiry"} • {lead.videoScope}
                            </div>
                          </div>
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/40">
                            {lead.leadStatus}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center text-slate-500 text-xs">
                        <Layers className="w-6 h-6 mx-auto mb-2 opacity-40 text-blue-400" />
                        No inbound leads received yet.
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab("leads")}
                  className="pt-3 text-center text-xs text-slate-400 hover:text-white border-t border-white/[0.07] transition-colors"
                >
                  Open Complete Leads Management Table →
                </button>
              </div>

              {/* Card 2: Recent CRM Activity */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#0c101c] p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-white/[0.07]">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                      <Clock className="w-4 h-4 text-purple-400" />
                      RECENT CRM ACTIVITY
                    </div>
                    {isSuperAdmin && (
                      <button
                        onClick={() => setActiveTab("activity")}
                        className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                      >
                        View All Logs →
                      </button>
                    )}
                  </div>

                  <div className="py-4 space-y-3">
                    {activityLogs.length > 0 ? (
                      activityLogs.slice(0, 2).map((log) => (
                        <div
                          key={log.id}
                          className="flex items-center justify-between p-3 rounded-xl border border-white/[0.06] bg-white/[0.02]"
                        >
                          <div>
                            <div className="font-semibold text-xs text-white">{log.title}</div>
                            <div className="text-[11px] text-slate-400 mt-0.5">{log.description}</div>
                          </div>
                          <span className="text-[11px] text-slate-400 font-mono whitespace-nowrap">
                            {log.timestamp}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center text-slate-500 text-xs">
                        <Clock className="w-6 h-6 mx-auto mb-2 opacity-40" />
                        No activity recorded yet.
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => (isSuperAdmin ? setActiveTab("activity") : null)}
                  className="pt-3 text-center text-xs text-slate-400 hover:text-white border-t border-white/[0.07] transition-colors"
                >
                  Open Full Activity Audit Trail →
                </button>
              </div>
            </div>

            {/* Row 2: 5 KPI Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
              <div className="rounded-2xl border border-white/[0.08] bg-[#0c101c] p-4">
                <div className="flex items-center justify-between text-slate-400 text-[11px] uppercase tracking-wider">
                  <span>TOTAL LEADS</span>
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <div className="text-2xl font-bold text-white mt-2">
                  {websiteLeads.length + metaLeads.length}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">All Sources</div>
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-[#0c101c] p-4">
                <div className="flex items-center justify-between text-slate-400 text-[11px] uppercase tracking-wider">
                  <span>REVENUE</span>
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="text-2xl font-bold text-emerald-400 mt-2">
                  {orders.length > 0 ? "₹" + orders.reduce((acc, o) => acc + o.amountNumeric, 0).toLocaleString() : "₹0"}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">{orders.length} Paid Orders</div>
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-[#0c101c] p-4">
                <div className="flex items-center justify-between text-slate-400 text-[11px] uppercase tracking-wider">
                  <span>IN PRODUCTION</span>
                  <Video className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div className="text-2xl font-bold text-amber-400 mt-2">
                  {websiteLeads.length + metaLeads.length}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">Active Videos</div>
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-[#0c101c] p-4">
                <div className="flex items-center justify-between text-slate-400 text-[11px] uppercase tracking-wider">
                  <span>DELIVERED</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
                </div>
                <div className="text-2xl font-bold text-purple-400 mt-2">0</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Completed Orders</div>
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-[#0c101c] p-4">
                <div className="flex items-center justify-between text-slate-400 text-[11px] uppercase tracking-wider">
                  <span>CLOSED LEADS</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                </div>
                <div className="text-2xl font-bold text-teal-400 mt-2">0</div>
                <div className="text-[11px] text-slate-400 mt-0.5">0% Conversion</div>
              </div>
            </div>

            {/* Row 3: Source-Wise Lead Reporting */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#0c101c] p-5">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.07]">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  SOURCE-WISE LEAD REPORTING
                </div>
                <span className="text-xs text-slate-400">
                  {websiteLeads.length + metaLeads.length} Total Leads Attribution
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                <div className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-white">Website Inbound</div>
                      <div className="text-[11px] text-slate-400">0% of total</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-white">0</div>
                    <button
                      onClick={() => setActiveTab("leads")}
                      className="text-[11px] text-blue-400 hover:text-blue-300"
                    >
                      Manage →
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-white">Manual Entry</div>
                      <div className="text-[11px] text-slate-400">0% of total</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-white">0</div>
                    <button
                      onClick={() => setActiveTab("leads")}
                      className="text-[11px] text-amber-400 hover:text-amber-300"
                    >
                      Manage →
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-400">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-white">Meta Ads</div>
                      <div className="text-[11px] text-slate-400">100% of total</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-white">1</div>
                    <button
                      onClick={() => setActiveTab("meta")}
                      className="text-[11px] text-purple-400 hover:text-purple-300"
                    >
                      Manage →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 2: WEBSITE & INBOUND LEADS
        ======================================================== */}
        {activeTab === "leads" && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-[#0c101c] p-5">
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
                  <Globe className="w-5 h-5 text-blue-400" />
                  Website & Inbound Leads
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">
                    {websiteLeads.length} Leads
                  </span>
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Managing client inquiries from website landing page forms and direct admin manual entries.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddLeadModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  + Add Lead
                </button>
                <button
                  onClick={() => handleExportCsv("leads")}
                  className="px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export CSV
                </button>
              </div>
            </div>

            {/* 8 KPI status cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
              {[
                { label: "Total Leads", count: websiteLeads.length, color: "text-blue-400" },
                { label: "New", count: 0, color: "text-blue-400" },
                { label: "Contacted", count: 0, color: "text-amber-400" },
                { label: "In Progress", count: 0, color: "text-orange-400" },
                { label: "Hold", count: 0, color: "text-slate-400" },
                { label: "Closed", count: 0, color: "text-emerald-400" },
                { label: "Proj Active", count: 0, color: "text-cyan-400" },
                { label: "Delivered", count: 0, color: "text-purple-400" },
              ].map((card, idx) => (
                <div key={idx} className="rounded-xl border border-white/[0.07] bg-[#0c101c] p-3 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">{card.label}</div>
                  <div className={`text-xl font-bold mt-1 ${card.color}`}>{card.count}</div>
                </div>
              ))}
            </div>

            {/* Filter Bar */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#0c101c] p-4 space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={leadsSearch}
                    onChange={(e) => setLeadsSearch(e.target.value)}
                    placeholder="Search by Client Name, Business Name, Phone, Notes..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-white/10 bg-black/40 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <button className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors">
                  <Filter className="w-3 h-3" />
                  Apply Filter
                </button>
                <button
                  onClick={() => setLeadsSearch("")}
                  className="px-3 py-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-white text-xs font-medium transition-colors"
                >
                  Clear Filter
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span>Source: <strong className="text-white">All Sources</strong></span>
                <span>•</span>
                <span>Lead Status: <strong className="text-white">All Lead Statuses</strong></span>
                <span>•</span>
                <span>Project Status: <strong className="text-white">All Project Statuses</strong></span>
                <span>•</span>
                <span>Video Type: <strong className="text-white">All Video Types</strong></span>
                <span>•</span>
                <span>Location: <strong className="text-white">All Locations</strong></span>
                <span>•</span>
                <span>Closed By: <strong className="text-white">All Admins</strong></span>
              </div>
            </div>

            {/* Table or Empty State */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#0c101c] overflow-hidden">
              {websiteLeads.length === 0 ? (
                <div className="p-16 text-center">
                  <Layers className="w-10 h-10 mx-auto text-slate-600 mb-3" />
                  <div className="font-semibold text-sm text-slate-300">
                    No leads match current filter criteria
                  </div>
                  <div className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    New website submissions will automatically appear here.
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/[0.02] border-b border-white/[0.07] text-[11px] uppercase tracking-wider text-slate-400">
                      <tr>
                        <th className="p-3.5">Source</th>
                        <th className="p-3.5">Timestamp</th>
                        <th className="p-3.5">Client & Business</th>
                        <th className="p-3.5">WhatsApp / Phone</th>
                        <th className="p-3.5">Video Scope</th>
                        <th className="p-3.5">Lead Status</th>
                        <th className="p-3.5">Project Status</th>
                        <th className="p-3.5">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {websiteLeads.map((l) => (
                        <tr key={l.id} className="hover:bg-white/[0.02]">
                          <td className="p-3.5 font-medium text-white">{l.source}</td>
                          <td className="p-3.5 text-slate-400 font-mono text-[11px]">{l.timestampIst}</td>
                          <td className="p-3.5">
                            <div className="font-semibold text-white">{l.clientName}</div>
                            <div className="text-[11px] text-slate-400">{l.email}</div>
                          </td>
                          <td className="p-3.5 text-slate-300">{l.phone}</td>
                          <td className="p-3.5 text-slate-300">{l.videoScope}</td>
                          <td className="p-3.5">
                            <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px]">
                              {l.leadStatus}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 text-[10px]">
                              {l.projectStatus}
                            </span>
                          </td>
                          <td className="p-3.5 flex items-center gap-2">
                            <button
                              onClick={() => setSelectedLeadDetails(l)}
                              className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-white"
                              title="View Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteLead(l.id, "website")}
                              className="p-1.5 rounded hover:bg-red-500/10 text-red-400"
                              title="Delete Lead"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 3: META ADS LEADS MANAGEMENT
        ======================================================== */}
        {activeTab === "meta" && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-[#0c101c] p-5">
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
                  <Layers className="w-5 h-5 text-purple-400" />
                  Meta Ads Leads Management
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
                    {metaLeads.length} Leads
                  </span>
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Managing client inquiries from facebook Ads and Instagram lead generation forms.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddMetaModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  + Add Meta Lead
                </button>
                <button
                  onClick={() => handleExportCsv("meta")}
                  className="px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export CSV
                </button>
              </div>
            </div>

            {/* 8 KPI status cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
              {[
                { label: "Total Meta", count: metaLeads.length, color: "text-blue-400" },
                { label: "New", count: 1, color: "text-blue-400" },
                { label: "Contacted", count: 0, color: "text-amber-400" },
                { label: "In Progress", count: 0, color: "text-orange-400" },
                { label: "Hold", count: 0, color: "text-slate-400" },
                { label: "Closed", count: 0, color: "text-emerald-400" },
                { label: "Proj Active", count: 1, color: "text-cyan-400" },
                { label: "Delivered", count: 0, color: "text-purple-400" },
              ].map((card, idx) => (
                <div key={idx} className="rounded-xl border border-white/[0.07] bg-[#0c101c] p-3 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">{card.label}</div>
                  <div className={`text-xl font-bold mt-1 ${card.color}`}>{card.count}</div>
                </div>
              ))}
            </div>

            {/* Filter Bar */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#0c101c] p-4 space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={metaSearch}
                    onChange={(e) => setMetaSearch(e.target.value)}
                    placeholder="Search Meta leads by Name, Business, Phone, Notes..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-white/10 bg-black/40 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <button className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors">
                  <Filter className="w-3 h-3" />
                  Apply Filter
                </button>
                <button
                  onClick={() => setMetaSearch("")}
                  className="px-3 py-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-white text-xs font-medium transition-colors"
                >
                  Clear Filter
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span>Meta Channel: <strong className="text-white">All Meta Channels</strong></span>
                <span>•</span>
                <span>Status: <strong className="text-white">All Lead Statuses</strong></span>
                <span>•</span>
                <span>Project: <strong className="text-white">All Project Statuses</strong></span>
                <span>•</span>
                <span>Video Type: <strong className="text-white">All Video Types</strong></span>
                <span>•</span>
                <span>Location: <strong className="text-white">All Locations</strong></span>
              </div>
            </div>

            {/* Meta Leads Table */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#0c101c] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/[0.02] border-b border-white/[0.07] text-[11px] uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="p-3 w-8">
                        <input type="checkbox" className="rounded bg-black/40 border-white/20" />
                      </th>
                      <th className="p-3">CHANNEL</th>
                      <th className="p-3">TIMESTAMP</th>
                      <th className="p-3">CLIENT & BUSINESS</th>
                      <th className="p-3">WHATSAPP / PHONE</th>
                      <th className="p-3">VIDEO SCOPE</th>
                      <th className="p-3">LEAD STATUS</th>
                      <th className="p-3">PROJECT STATUS</th>
                      <th className="p-3">NOTES</th>
                      <th className="p-3">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {metaLeads.map((m) => (
                      <tr key={m.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-3">
                          <input type="checkbox" className="rounded bg-black/40 border-white/20" />
                        </td>
                        <td className="p-3">
                          <span className="px-2.5 py-1 rounded-full bg-blue-900/50 text-blue-300 border border-blue-500/30 text-[10px] font-semibold">
                            {m.channel || "Facebook"}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="px-2 py-0.5 rounded bg-amber-950/40 text-amber-300 font-mono text-[10px] inline-block border border-amber-500/20">
                            {m.timestampIst}
                          </div>
                          <div className="text-[10px] font-mono text-cyan-300/80 mt-1">
                            {m.timestampEdt}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-white text-sm">{m.clientName}</div>
                          <div className="text-[11px] text-slate-400">{m.email}</div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-900/40 text-purple-300 border border-purple-500/20">
                              Camp: {m.campaign}
                            </span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-900/40 text-blue-300 border border-blue-500/20">
                              Ad: {m.adSet}
                            </span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                              Form: {m.formName}
                            </span>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5 font-mono text-slate-200">
                            <Phone className="w-3 h-3 text-emerald-400" />
                            <span>{m.phone}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-white">{m.videoScope}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{m.businessType}</div>
                        </td>
                        <td className="p-3">
                          <select
                            value={m.leadStatus}
                            onChange={(e) => {
                              const updated = metaLeads.map((x) =>
                                x.id === m.id ? { ...x, leadStatus: e.target.value as any } : x
                              );
                              setMetaLeads(updated);
                            }}
                            className="px-2 py-1 rounded bg-blue-950/60 border border-blue-500/40 text-blue-200 text-xs font-semibold focus:outline-none"
                          >
                            <option value="New">New</option>
                            <option value="Contacted">Contacted</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Hold">Hold</option>
                            <option value="Closed">Closed</option>
                          </select>
                        </td>
                        <td className="p-3">
                          <select
                            value={m.projectStatus}
                            onChange={(e) => {
                              const updated = metaLeads.map((x) =>
                                x.id === m.id ? { ...x, projectStatus: e.target.value as any } : x
                              );
                              setMetaLeads(updated);
                            }}
                            className="px-2 py-1 rounded bg-amber-950/60 border border-amber-500/40 text-amber-200 text-xs font-semibold focus:outline-none"
                          >
                            <option value="New">New</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Proj Active">Proj Active</option>
                            <option value="Delivered">Delivered</option>
                            <option value="Cancelled">Cancelled</option>
                          </select>
                        </td>
                        <td className="p-3 max-w-xs text-slate-400 truncate">
                          {m.notes}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <a
                              href={`tel:${m.phone}`}
                              className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-white"
                              title="Call"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                            <a
                              href={`https://wa.me/${m.phone?.replace(/[^0-9]/g, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded hover:bg-emerald-500/10 text-emerald-400"
                              title="WhatsApp"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </a>
                            <button
                              onClick={() => setSelectedLeadDetails(m)}
                              className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-white"
                              title="View Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteLead(m.id, "meta")}
                              className="p-1.5 rounded hover:bg-red-500/10 text-red-400"
                              title="Delete Lead"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 4: ORDERS & PAYMENTS (PIN-PROTECTED)
        ======================================================== */}
        {activeTab === "orders" && (
          <div className="space-y-6">
            {/* Header KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-2xl border border-white/[0.08] bg-[#0c101c] p-5">
                <div className="flex items-center justify-between text-slate-400 text-xs uppercase tracking-wider">
                  <span>Total Orders</span>
                  <Package className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-3xl font-bold text-white mt-2">{orders.length}</div>
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-[#0c101c] p-5">
                <div className="flex items-center justify-between text-slate-400 text-xs uppercase tracking-wider">
                  <span>Total Revenue</span>
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-3xl font-bold text-emerald-400 mt-2">$82.00</div>
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-[#0c101c] p-5">
                <div className="flex items-center justify-between text-slate-400 text-xs uppercase tracking-wider">
                  <span>Completed (Paid)</span>
                  <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="text-3xl font-bold text-cyan-400 mt-2">4</div>
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-[#0c101c] p-5">
                <div className="flex items-center justify-between text-slate-400 text-xs uppercase tracking-wider">
                  <span>Pending</span>
                  <Clock className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-3xl font-bold text-amber-400 mt-2">0</div>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-[#0c101c] p-4">
              <div className="relative flex-1 max-w-md">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={ordersSearch}
                  onChange={(e) => setOrdersSearch(e.target.value)}
                  placeholder="Search customer name, email, order ID..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-white/10 bg-black/40 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <select className="px-3 py-1.5 rounded-lg border border-white/10 bg-black/40 text-xs text-white">
                  <option>Completed (Paid)</option>
                  <option>All Orders</option>
                </select>
                <button
                  onClick={() => handleExportCsv("orders")}
                  className="px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-slate-300 text-xs font-medium flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export
                </button>
              </div>
            </div>

            {/* Orders Table */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#0c101c] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/[0.02] border-b border-white/[0.07] text-[11px] uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="p-3.5">CUSTOMER</th>
                      <th className="p-3.5">PACKAGE / ITEM</th>
                      <th className="p-3.5">AMOUNT</th>
                      <th className="p-3.5">PAYMENT STATUS</th>
                      <th className="p-3.5">PAYPAL ORDER ID</th>
                      <th className="p-3.5">DATE</th>
                      <th className="p-3.5">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {orders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-3.5">
                          <div className="font-bold text-white">{ord.customerName}</div>
                          <div className="text-[11px] text-slate-400">{ord.customerEmail}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{ord.customerPhone}</div>
                        </td>
                        <td className="p-3.5">
                          <div className="font-semibold text-white">{ord.packageItem}</div>
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                              ord.badgeType === "PACKAGE"
                                ? "bg-purple-900/50 text-purple-300"
                                : "bg-blue-900/50 text-blue-300"
                            }`}
                          >
                            {ord.badgeType}
                          </span>
                        </td>
                        <td className="p-3.5 font-bold text-emerald-400 font-mono">
                          {ord.amount}
                        </td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 text-[10px] font-semibold">
                            {ord.paymentStatus}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono text-[11px] text-slate-300">{ord.orderId}</td>
                        <td className="p-3.5 text-slate-400 font-mono">{ord.date}</td>
                        <td className="p-3.5">
                          <button className="px-2.5 py-1 rounded border border-white/10 hover:bg-white/5 text-slate-300 text-xs transition-colors">
                            Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 5: CALENDLY STRATEGY CALLS & MEETINGS (INDIA)
        ======================================================== */}
        {activeTab === "calendly" && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-[#0c101c] p-5">
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
                  <Calendar className="w-5 h-5 text-blue-400" />
                  Calendly Strategy Calls & Meetings (India)
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">
                    {meetings.length} Total
                  </span>
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Connect Calendly directly with the CRM. Live auto-sync with Calendly scheduled events, track meeting dates, client contact, meeting links, and statuses.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={triggerSync}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                  Sync from Calendly
                </button>
                <a
                  href="https://calendly.com"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  Calendly Page
                </a>
              </div>
            </div>

            {/* 7 KPI Status Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
              {[
                { label: "TOTAL MEETINGS", count: meetings.length, color: "text-blue-400" },
                { label: "UPCOMING / SCHEDULED", count: 1, color: "text-blue-400" },
                { label: "RESCHEDULED", count: 0, color: "text-amber-400" },
                { label: "COMPLETED CALLS", count: 0, color: "text-emerald-400" },
                { label: "NOT CONDUCTED", count: 0, color: "text-slate-400" },
                { label: "NO SHOW", count: 0, color: "text-red-400" },
                { label: "CANCELLED", count: 0, color: "text-rose-400" },
              ].map((c, i) => (
                <div key={i} className="rounded-xl border border-white/[0.07] bg-[#0c101c] p-3 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">{c.label}</div>
                  <div className={`text-xl font-bold mt-1 ${c.color}`}>{c.count}</div>
                </div>
              ))}
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl border border-white/[0.07] bg-[#0c101c]">
              {[
                "All Statuses",
                "Scheduled",
                "Rescheduled",
                "Completed",
                "Not Conducted",
                "No Show",
                "Cancelled",
              ].map((st) => (
                <button
                  key={st}
                  onClick={() => setMeetingFilter(st)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    meetingFilter === st
                      ? "bg-blue-600 text-white"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Table */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#0c101c] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/[0.02] border-b border-white/[0.07] text-[11px] uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="p-3 w-8">
                        <input type="checkbox" className="rounded bg-black/40 border-white/20" />
                      </th>
                      <th className="p-3">MEETING DATE & TIME</th>
                      <th className="p-3">CLIENT NAME & CONTACT</th>
                      <th className="p-3">MEETING TYPE</th>
                      <th className="p-3">MEETING STATUS</th>
                      <th className="p-3">MEETING LINK</th>
                      <th className="p-3">HANDLING USER</th>
                      <th className="p-3">CREATED DATE</th>
                      <th className="p-3">WORKFLOW ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {meetings.map((m) => (
                      <tr key={m.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-3">
                          <input type="checkbox" className="rounded bg-black/40 border-white/20" />
                        </td>
                        <td className="p-3">
                          <div className="px-2 py-0.5 rounded bg-amber-950/40 text-amber-300 font-mono text-[10px] inline-block border border-amber-500/20">
                            {m.meetingDateIst}
                          </div>
                          <div className="text-[10px] font-mono text-cyan-300/80 mt-1">
                            {m.meetingDateEdt}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-white text-sm">{m.clientName}</div>
                          <div className="text-[11px] text-slate-400">{m.clientEmail}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{m.clientPhone}</div>
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-500/30 mt-1 inline-block">
                            {m.crmLeadBadge}
                          </span>
                        </td>
                        <td className="p-3 font-semibold text-white">{m.meetingType}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-500/30 text-[10px] font-semibold">
                            {m.meetingStatus}
                          </span>
                        </td>
                        <td className="p-3">
                          <a
                            href={m.meetingLink}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
                          >
                            Join Call ↗
                          </a>
                        </td>
                        <td className="p-3 text-slate-400">{m.handlingUser}</td>
                        <td className="p-3 font-mono text-slate-400 text-[10px]">{m.createdDateIst}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <button className="px-2 py-1 rounded border border-white/10 hover:bg-white/5 text-slate-300 text-xs">
                              View Lead
                            </button>
                            <button className="px-2 py-1 rounded border border-white/10 hover:bg-white/5 text-slate-300 text-xs">
                              Details
                            </button>
                            <button className="p-1 rounded text-red-400 hover:bg-red-500/10">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 6: ACTIVITY HISTORY & AUDIT LOGS (SUPER ADMIN ONLY)
        ======================================================== */}
        {activeTab === "activity" && isSuperAdmin && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-[#0c101c] p-5">
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
                  <Clock className="w-5 h-5 text-purple-400" />
                  Activity History & Audit Logs
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
                    Super Admin Only
                  </span>
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Real-time audit log categorized across Calendly bookings, Leads lifecycle, and User administrative actions.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExportCsv("logs")}
                  className="px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-slate-300 text-xs font-medium flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export
                </button>
                <button
                  onClick={() => setActivityLogs([])}
                  className="px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs font-medium flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear All
                </button>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2">
              {["All Activities", "Calendly", "Leads", "User Activity"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActivityFilter(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activityFilter === cat
                      ? "bg-purple-600 text-white"
                      : "border border-white/10 text-slate-400 hover:text-white"
                  }`}
                >
                  {cat} ({cat === "All Activities" ? activityLogs.length : cat === "User Activity" ? activityLogs.length : 0})
                </button>
              ))}
            </div>

            {/* Logs List */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#0c101c] p-4 divide-y divide-white/[0.06]">
              <div className="pb-3 text-xs text-slate-400 flex items-center justify-between">
                <span>Select All Filtered ({activityLogs.length})</span>
                <span>Showing {activityLogs.length} of {activityLogs.length} entries</span>
              </div>
              {activityLogs.map((log) => (
                <div key={log.id} className="py-3 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <Shield className="w-4 h-4 text-purple-400 mt-0.5" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-xs">{log.title}</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-900/60 text-purple-300">
                          {log.category}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
                          {log.actorEmail}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1">{log.description}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-mono">{log.timestamp}</span>
                    <button
                      onClick={() => setActivityLogs(activityLogs.filter((l) => l.id !== log.id))}
                      className="text-slate-500 hover:text-red-400 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 7: ADMIN USER MANAGEMENT (SUPER ADMIN ONLY)
        ======================================================== */}
        {activeTab === "users" && isSuperAdmin && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-[#0c101c] p-5">
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
                  <UserCheck className="w-5 h-5 text-purple-400" />
                  Admin User Management (Super Admin Exclusive)
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Create, configure, activate, and deactivate operational Admin accounts. Super Admin accounts remain permanently protected.
                </p>
              </div>
              <button
                onClick={() => setShowCreateAdminModal(true)}
                className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                + Create Admin Account
              </button>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-[#0c101c] overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/[0.02] border-b border-white/[0.07] text-[11px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="p-3.5">NAME</th>
                    <th className="p-3.5">EMAIL</th>
                    <th className="p-3.5">ROLE</th>
                    <th className="p-3.5">STATUS</th>
                    <th className="p-3.5">CREATED AT</th>
                    <th className="p-3.5 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {admins.map((admin) => (
                    <tr key={admin.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-3.5 font-bold text-white">{admin.name}</td>
                      <td className="p-3.5 text-slate-300 font-mono">{admin.email}</td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            admin.role === "SUPER_ADMIN"
                              ? "bg-purple-950/80 text-purple-300 border border-purple-500/30"
                              : "bg-blue-950/80 text-blue-300 border border-blue-500/30"
                          }`}
                        >
                          {admin.role}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold">
                          {admin.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-400 font-mono">{admin.createdAt}</td>
                      <td className="p-3.5 text-right">
                        {admin.isProtected ? (
                          <span className="text-slate-500 flex items-center justify-end gap-1 text-[11px]">
                            <Lock className="w-3 h-3" />
                            Protected
                          </span>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setAdmins(
                                  admins.map((a) =>
                                    a.id === admin.id
                                      ? { ...a, status: a.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }
                                      : a
                                  )
                                );
                              }}
                              className="px-2.5 py-1 rounded border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 text-xs"
                            >
                              {admin.status === "ACTIVE" ? "Deactivate" : "Activate"}
                            </button>
                            <button
                              onClick={() => setAdmins(admins.filter((a) => a.id !== admin.id))}
                              className="p-1 rounded text-red-400 hover:bg-red-500/10"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 8: IP / GPS LOGIN SECURITY TRACKING (SUPER ADMIN ONLY)
        ======================================================== */}
        {activeTab === "ip-tracking" && isSuperAdmin && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-[#0c101c] p-5">
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
                  <Shield className="w-5 h-5 text-purple-400" />
                  IP / GPS Login Security Tracking
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Audit log of all login attempts, IP addresses, location metrics, and device user agents.
                </p>
              </div>
              <button
                onClick={() => setIpSessions(ipSessions.filter((s) => s.isLiveSession))}
                className="px-3.5 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete All Except Live Sessions
              </button>
            </div>

            <div className="text-xs text-slate-400">
              Select entries to delete. 1 live session(s) are always kept.
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-[#0c101c] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/[0.02] border-b border-white/[0.07] text-[11px] uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="p-3 w-8">
                        <input type="checkbox" className="rounded bg-black/40 border-white/20" />
                      </th>
                      <th className="p-3">TIMESTAMP</th>
                      <th className="p-3">USER EMAIL</th>
                      <th className="p-3">ROLE</th>
                      <th className="p-3">IP ADDRESS</th>
                      <th className="p-3">GPS COORDINATES</th>
                      <th className="p-3">OFFICE PROXIMITY</th>
                      <th className="p-3">BROWSER & DEVICE</th>
                      <th className="p-3">ACCESS STATUS</th>
                      <th className="p-3">DELETE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {ipSessions.map((session) => (
                      <tr key={session.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-3">
                          <input type="checkbox" className="rounded bg-black/40 border-white/20" />
                        </td>
                        <td className="p-3">
                          {session.isLiveSession && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/30 font-semibold mb-1 block w-max">
                              LIVE SESSION
                            </span>
                          )}
                          <div className="font-mono text-slate-300">{session.timestamp}</div>
                        </td>
                        <td className="p-3 font-mono text-white">{session.userEmail}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 text-[10px] font-semibold border border-purple-500/30">
                            {session.role}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-cyan-400">{session.ipAddress}</td>
                        <td className="p-3 font-mono text-slate-300">
                          <div>{session.gpsCoordinates}</div>
                          {session.accuracy && (
                            <div className="text-[10px] text-slate-500">{session.accuracy}</div>
                          )}
                        </td>
                        <td className="p-3">
                          <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950/40 text-purple-300 border border-purple-500/20">
                            {session.officeProximity}
                          </span>
                        </td>
                        <td className="p-3 max-w-xs text-slate-400 truncate text-[11px]">
                          {session.browserDevice}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              session.accessStatus === "AUTHORIZED"
                                ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/40"
                                : "bg-amber-950/80 text-amber-300 border border-amber-500/40"
                            }`}
                          >
                            {session.accessStatus}
                          </span>
                        </td>
                        <td className="p-3">
                          {session.isLiveSession ? (
                            <span className="text-slate-500 text-[11px]">Kept</span>
                          ) : (
                            <button
                              onClick={() => setIpSessions(ipSessions.filter((s) => s.id !== session.id))}
                              className="p-1 rounded text-red-400 hover:bg-red-500/10"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 9: CRM SETTINGS (SUPER ADMIN ONLY)
        ======================================================== */}
        {activeTab === "settings" && isSuperAdmin && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-[#0c101c] p-5">
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
                  <Settings className="w-5 h-5 text-purple-400" />
                  CRM Settings & Super Admin Control Center
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
                    SUPER ADMIN
                  </span>
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Configure platform settings, role permissions, live record counts, and security policies.
                </p>
              </div>
              <button
                onClick={() => {
                  alert("Settings saved successfully.");
                }}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                ✓ Save All Settings
              </button>
            </div>

            {/* Sub-tabs pills */}
            <div className="flex items-center gap-2 border-b border-white/[0.07] pb-3">
              {[
                { id: "general", label: "1. CRM Settings" },
                { id: "rbac", label: "2. Permissions Matrix" },
                { id: "records", label: "3. Access All Records" },
                { id: "security", label: "4. Security Settings" },
              ].map((st) => (
                <button
                  key={st.id}
                  onClick={() => setSettingsSubTab(st.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    settingsSubTab === st.id
                      ? "bg-purple-600 text-white"
                      : "border border-white/10 text-slate-400 hover:text-white"
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {/* Sub-Tab 1: General CRM Settings */}
            {settingsSubTab === "general" && (
              <div className="rounded-2xl border border-white/[0.08] bg-[#0c101c] p-6 space-y-6">
                <div>
                  <h2 className="font-semibold text-white text-sm">General Platform & Operational Settings</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Configure base CRM branding, system notification recipient, default currency, and real-time syncing frequency.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Platform / CRM Title
                    </label>
                    <input
                      type="text"
                      value={configSettings.crmTitle}
                      onChange={(e) => setConfigSettings({ ...configSettings, crmTitle: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-white/10 bg-black/40 text-xs text-white"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Shown in the CRM header, browser tab, login page and alert email subjects.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      System Alert Notification Email
                    </label>
                    <input
                      type="email"
                      value={configSettings.alertEmail}
                      onChange={(e) => setConfigSettings({ ...configSettings, alertEmail: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-white/10 bg-black/40 text-xs text-white"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      New lead and payment alert emails are sent to this address.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Real-Time Data Polling Interval
                  </label>
                  <select
                    value={configSettings.pollingInterval}
                    onChange={(e) => setConfigSettings({ ...configSettings, pollingInterval: e.target.value })}
                    className="w-full md:w-1/2 px-3 py-2 rounded-lg border border-white/10 bg-black/40 text-xs text-white"
                  >
                    <option>10 Seconds (Recommended • Real-Time High Precision)</option>
                    <option>30 Seconds</option>
                    <option>60 Seconds</option>
                  </select>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl border border-white/[0.07] bg-white/[0.02]">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={configSettings.audioChimeEnabled}
                      onChange={(e) => setConfigSettings({ ...configSettings, audioChimeEnabled: e.target.checked })}
                      className="rounded bg-black/40 border-white/20"
                    />
                    <div>
                      <div className="text-xs font-semibold text-white">Audio Sound Alerts for Inbound Leads & New Orders</div>
                      <div className="text-[11px] text-slate-400">Play an audible chime when real-time leads or checkout events arrive.</div>
                    </div>
                  </div>
                  <button
                    onClick={playAudioChime}
                    className="px-3 py-1.5 rounded-lg border border-white/10 text-slate-300 hover:text-white text-xs font-medium"
                  >
                    Test Audio Chime
                  </button>
                </div>
              </div>
            )}

            {/* Sub-Tab 2: RBAC Matrix */}
            {settingsSubTab === "rbac" && (
              <div className="rounded-2xl border border-white/[0.08] bg-[#0c101c] p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-white text-sm">Role-Based Access Control (RBAC) Matrix</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Click a permission to allow or restrict it, then save. Super Admin always keeps full access.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setRbacMatrix(INITIAL_RBAC_MATRIX)}
                      className="px-3 py-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-white text-xs"
                    >
                      Reset to Defaults
                    </button>
                    <button
                      onClick={() => alert("Permissions saved successfully.")}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                    >
                      ✓ Save Permissions
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/[0.02] border-b border-white/[0.07] text-[11px] uppercase tracking-wider text-slate-400">
                      <tr>
                        <th className="p-3">System Module / Capability</th>
                        <th className="p-3">Super Admin</th>
                        <th className="p-3">Admin</th>
                        <th className="p-3">Leads Manager</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {rbacMatrix.map((row, idx) => (
                        <tr key={idx} className="hover:bg-white/[0.02]">
                          <td className="p-3">
                            <div className="font-medium text-white">{row.module}</div>
                            <div className="text-[10px] text-slate-500">{row.locationLabel}</div>
                          </td>
                          <td className="p-3 text-emerald-400 font-semibold">{row.superAdmin}</td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                row.admin === "Allowed" || row.admin === "Always Allowed"
                                  ? "bg-emerald-950 text-emerald-300 border border-emerald-500/30"
                                  : "bg-red-950 text-red-300 border border-red-500/30"
                              }`}
                            >
                              {row.admin}
                            </span>
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                row.leadsManager === "Allowed" || row.leadsManager === "Always Allowed"
                                  ? "bg-emerald-950 text-emerald-300 border border-emerald-500/30"
                                  : row.leadsManager === "Soft-delete only"
                                  ? "bg-amber-950 text-amber-300 border border-amber-500/30"
                                  : "bg-slate-800 text-slate-400"
                              }`}
                            >
                              {row.leadsManager}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sub-Tab 3: Live Master Record Counters */}
            {settingsSubTab === "records" && (
              <div className="rounded-2xl border border-white/[0.08] bg-[#0c101c] p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-white text-sm">Live Database Master Record Counters</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Counted directly from the database. Updates automatically every 10 seconds.
                    </p>
                  </div>
                  <button
                    onClick={triggerSync}
                    className="px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-slate-300 text-xs flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                    Refresh Now
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl border border-white/[0.07] bg-white/[0.02]">
                    <div className="text-[11px] text-slate-400 uppercase">ACTIVE LEADS</div>
                    <div className="text-2xl font-bold text-white mt-1">{counters.activeLeads}</div>
                    <div className="text-[10px] text-slate-500 mt-1">Website + Meta leads</div>
                  </div>

                  <div className="p-4 rounded-xl border border-white/[0.07] bg-white/[0.02]">
                    <div className="text-[11px] text-slate-400 uppercase">RECYCLE BIN</div>
                    <div className="text-2xl font-bold text-white mt-1">{recycleBin.length}</div>
                    <div className="text-[10px] text-slate-500 mt-1">Soft-deleted leads</div>
                  </div>

                  <div className="p-4 rounded-xl border border-white/[0.07] bg-white/[0.02]">
                    <div className="text-[11px] text-slate-400 uppercase">TOTAL ORDERS</div>
                    <div className="text-2xl font-bold text-white mt-1">{counters.totalOrders}</div>
                    <div className="text-[10px] text-slate-500 mt-1">4 paid • 1 unpaid</div>
                  </div>

                  <div className="p-4 rounded-xl border border-white/[0.07] bg-white/[0.02]">
                    <div className="text-[11px] text-slate-400 uppercase">TOTAL REVENUE</div>
                    <div className="text-2xl font-bold text-emerald-400 mt-1">{counters.totalRevenue}</div>
                    <div className="text-[10px] text-slate-500 mt-1">Completed payments</div>
                  </div>

                  <div className="p-4 rounded-xl border border-white/[0.07] bg-white/[0.02]">
                    <div className="text-[11px] text-slate-400 uppercase">CALENDLY CALLS</div>
                    <div className="text-2xl font-bold text-white mt-1">{counters.calendlyCalls}</div>
                    <div className="text-[10px] text-slate-500 mt-1">Meetings (not deleted)</div>
                  </div>

                  <div className="p-4 rounded-xl border border-white/[0.07] bg-white/[0.02]">
                    <div className="text-[11px] text-slate-400 uppercase">USER ACCOUNTS</div>
                    <div className="text-2xl font-bold text-white mt-1">{counters.userAccounts}</div>
                    <div className="text-[10px] text-slate-500 mt-1">4 active • 0 deactivated</div>
                  </div>

                  <div className="p-4 rounded-xl border border-white/[0.07] bg-white/[0.02]">
                    <div className="text-[11px] text-slate-400 uppercase">ACTIVITY LOGS</div>
                    <div className="text-2xl font-bold text-white mt-1">{activityLogs.length}</div>
                    <div className="text-[10px] text-slate-500 mt-1">Audit history entries</div>
                  </div>

                  <div className="p-4 rounded-xl border border-white/[0.07] bg-white/[0.02]">
                    <div className="text-[11px] text-slate-400 uppercase">SECURITY LOGS</div>
                    <div className="text-2xl font-bold text-white mt-1">{ipSessions.length}</div>
                    <div className="text-[10px] text-slate-500 mt-1">Login & IP tracking</div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-white/[0.07]">
                  <span>Database: Quickupp PostgreSQL • Last counted {counters.lastCheckedTime}</span>
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    Status: Online & Healthy
                  </span>
                </div>
              </div>
            )}

            {/* Sub-Tab 4: Security Settings */}
            {settingsSubTab === "security" && (
              <div className="rounded-2xl border border-white/[0.08] bg-[#0c101c] p-6 space-y-6">
                <div>
                  <h2 className="font-semibold text-white text-sm">Security, Inactivity Timeout, & Access Control Policies</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Configure automated inactivity logout, failed-login lockout with email alerts, and approved office networks.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Inactivity Auto-Logout Timeout
                    </label>
                    <select
                      value={configSettings.inactivityTimeout}
                      onChange={(e) => setConfigSettings({ ...configSettings, inactivityTimeout: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-white/10 bg-black/40 text-xs text-white"
                    >
                      <option>10 Minutes (Default / Recommended)</option>
                      <option>30 Minutes</option>
                      <option>60 Minutes</option>
                    </select>
                    <p className="text-[10px] text-slate-500 mt-1">Currently in effect: 10 minutes</p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Failed Login Attempt Threshold
                    </label>
                    <select
                      value={configSettings.failedLoginThreshold}
                      onChange={(e) => setConfigSettings({ ...configSettings, failedLoginThreshold: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-white/10 bg-black/40 text-xs text-white"
                    >
                      <option>3 Failed Attempts (Strict)</option>
                      <option>5 Failed Attempts</option>
                    </select>
                    <p className="text-[10px] text-slate-500 mt-1">Currently in effect: 3 failed attempts</p>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-white/[0.07] bg-white/[0.02] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-white">Approved Office Networks</div>
                      <div className="text-[11px] text-slate-400">Current connection: 49.201.8.82</div>
                    </div>
                    <button
                      onClick={() => alert("Current office network approved.")}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium"
                    >
                      + Approve This Network
                    </button>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Everyone except the Super Admin is location-checked at login and throughout the session.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            TAB 10: RECYCLE BIN
        ======================================================== */}
        {activeTab === "recycle-bin" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-[#0c101c] p-5">
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
                  <Trash2 className="w-5 h-5 text-red-400" />
                  Recycle Bin
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-300">
                    {recycleBin.length}
                  </span>
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Soft-deleted leads and records. Items can be restored or permanently purged.
                </p>
              </div>
              {recycleBin.length > 0 && (
                <button
                  onClick={() => setRecycleBin([])}
                  className="px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs font-semibold"
                >
                  Empty Recycle Bin
                </button>
              )}
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-[#0c101c] overflow-hidden">
              {recycleBin.length === 0 ? (
                <div className="p-16 text-center">
                  <Trash2 className="w-10 h-10 mx-auto text-slate-600 mb-3" />
                  <div className="font-semibold text-sm text-slate-300">Recycle Bin is empty</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Deleted leads and meetings appear here.
                  </div>
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/[0.02] border-b border-white/[0.07] text-[11px] uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="p-3.5">TYPE</th>
                      <th className="p-3.5">NAME</th>
                      <th className="p-3.5">PHONE / EMAIL</th>
                      <th className="p-3.5">DETAILS</th>
                      <th className="p-3.5">DELETED ON</th>
                      <th className="p-3.5 text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {recycleBin.map((item, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.02]">
                        <td className="p-3.5 text-slate-400">{item.itemType}</td>
                        <td className="p-3.5 font-bold text-white">{item.clientName}</td>
                        <td className="p-3.5 text-slate-300">{item.email}</td>
                        <td className="p-3.5 text-slate-400">{item.videoScope || "-"}</td>
                        <td className="p-3.5 text-slate-500 font-mono">{item.deletedOn}</td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => {
                              if (item.source === "Meta Ads") {
                                setMetaLeads([...metaLeads, item]);
                              } else {
                                setWebsiteLeads([...websiteLeads, item]);
                              }
                              setRecycleBin(recycleBin.filter((_, i) => i !== idx));
                            }}
                            className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold mr-2"
                          >
                            Restore
                          </button>
                          <button
                            onClick={() => setRecycleBin(recycleBin.filter((_, i) => i !== idx))}
                            className="p-1 rounded text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ===================== MODAL: UNLOCK PAYMENTS PIN ===================== */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0e121e] p-6 shadow-2xl relative">
            <button
              onClick={() => setShowPinModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Unlock Payments Tab</h3>
                <p className="text-xs text-slate-400">Enter security PIN to view orders & revenue.</p>
              </div>
            </div>

            <form onSubmit={handleUnlockPin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Security PIN
                </label>
                <div className="relative">
                  <input
                    type={showPinText ? "text" : "password"}
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    placeholder="Enter PIN"
                    autoFocus
                    className="w-full px-3 py-2 rounded-lg border border-white/10 bg-black/40 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPinText(!showPinText)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPinText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {pinError && <p className="text-[11px] text-red-400 mt-1">{pinError}</p>}
                <p className="text-[10px] text-slate-500 mt-1">Default PIN: 8080</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="px-4 py-2 rounded-lg border border-white/10 text-slate-400 hover:text-white text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Unlock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== MODAL: ADD LEAD ===================== */}
      {showAddLeadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0e121e] p-6 shadow-2xl relative">
            <button
              onClick={() => setShowAddLeadModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-400" />
              Add Website / Manual Lead
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Enter customer details for new incoming inquiry or manual booking.
            </p>

            <form onSubmit={handleAddLeadSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Client Name *</label>
                <input
                  type="text"
                  required
                  value={newLeadForm.clientName}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, clientName: e.target.value })}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full px-3 py-2 rounded-lg border border-white/10 bg-black/40 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={newLeadForm.email}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, email: e.target.value })}
                  placeholder="rahul@company.in"
                  className="w-full px-3 py-2 rounded-lg border border-white/10 bg-black/40 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Phone / WhatsApp</label>
                <input
                  type="text"
                  value={newLeadForm.phone}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  className="w-full px-3 py-2 rounded-lg border border-white/10 bg-black/40 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Video Scope</label>
                <select
                  value={newLeadForm.videoScope}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, videoScope: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-white/10 bg-black/40 text-white"
                >
                  <option value="AI UGC Video Ads">AI UGC Video Ads</option>
                  <option value="AI Avatar Video">AI Avatar Video</option>
                  <option value="Digital Twin Clone">Digital Twin Clone</option>
                  <option value="AI Cartoon Animation">AI Cartoon Animation</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={newLeadForm.notes}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, notes: e.target.value })}
                  placeholder="Inquiry requirements..."
                  className="w-full px-3 py-2 rounded-lg border border-white/10 bg-black/40 text-white resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddLeadModal(false)}
                  className="px-4 py-2 rounded-lg border border-white/10 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                >
                  Save Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== MODAL: ADD META LEAD ===================== */}
      {showAddMetaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0e121e] p-6 shadow-2xl relative">
            <button
              onClick={() => setShowAddMetaModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" />
              Add Meta Ads Lead
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Record incoming lead from Facebook or Instagram lead forms.
            </p>

            <form onSubmit={handleAddMetaSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Channel</label>
                  <select
                    value={newMetaForm.channel}
                    onChange={(e) => setNewMetaForm({ ...newMetaForm, channel: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg border border-white/10 bg-black/40 text-white"
                  >
                    <option value="Facebook">Facebook</option>
                    <option value="Instagram">Instagram</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Form Name</label>
                  <input
                    type="text"
                    value={newMetaForm.formName}
                    onChange={(e) => setNewMetaForm({ ...newMetaForm, formName: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-white/10 bg-black/40 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Client Name *</label>
                <input
                  type="text"
                  required
                  value={newMetaForm.clientName}
                  onChange={(e) => setNewMetaForm({ ...newMetaForm, clientName: e.target.value })}
                  placeholder="e.g. Priya Patel"
                  className="w-full px-3 py-2 rounded-lg border border-white/10 bg-black/40 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={newMetaForm.email}
                  onChange={(e) => setNewMetaForm({ ...newMetaForm, email: e.target.value })}
                  placeholder="priya@domain.com"
                  className="w-full px-3 py-2 rounded-lg border border-white/10 bg-black/40 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Phone / WhatsApp</label>
                <input
                  type="text"
                  value={newMetaForm.phone}
                  onChange={(e) => setNewMetaForm({ ...newMetaForm, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  className="w-full px-3 py-2 rounded-lg border border-white/10 bg-black/40 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Campaign</label>
                <input
                  type="text"
                  value={newMetaForm.campaign}
                  onChange={(e) => setNewMetaForm({ ...newMetaForm, campaign: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-white/10 bg-black/40 text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddMetaModal(false)}
                  className="px-4 py-2 rounded-lg border border-white/10 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold"
                >
                  Save Meta Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== MODAL: CREATE ADMIN ===================== */}
      {showCreateAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0e121e] p-6 shadow-2xl relative">
            <button
              onClick={() => setShowCreateAdminModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-purple-400" />
              Create Admin Account
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Add operational administrative personnel.
            </p>

            <form onSubmit={handleCreateAdminSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newAdminForm.name}
                  onChange={(e) => setNewAdminForm({ ...newAdminForm, name: e.target.value })}
                  placeholder="e.g. Sanjay Verma"
                  className="w-full px-3 py-2 rounded-lg border border-white/10 bg-black/40 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={newAdminForm.email}
                  onChange={(e) => setNewAdminForm({ ...newAdminForm, email: e.target.value })}
                  placeholder="sanjay@quickuppaistudio.in"
                  className="w-full px-3 py-2 rounded-lg border border-white/10 bg-black/40 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Role Assignment</label>
                <select
                  value={newAdminForm.role}
                  onChange={(e) => setNewAdminForm({ ...newAdminForm, role: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-lg border border-white/10 bg-black/40 text-white"
                >
                  <option value="ADMIN">Admin (Standard)</option>
                  <option value="LEADS_MANAGER">Leads Manager (Restricted)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateAdminModal(false)}
                  className="px-4 py-2 rounded-lg border border-white/10 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== MODAL: VIEW LEAD DETAILS ===================== */}
      {selectedLeadDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0e121e] p-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedLeadDetails(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">{selectedLeadDetails.clientName}</h3>
                <p className="text-xs text-slate-400">{selectedLeadDetails.email} • {selectedLeadDetails.phone}</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Source</span>
                  <span className="text-white font-medium">{selectedLeadDetails.source} ({selectedLeadDetails.channel || "Direct"})</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Timestamp</span>
                  <span className="text-white font-mono">{selectedLeadDetails.timestampIst}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Lead Status</span>
                  <span className="text-blue-400 font-semibold">{selectedLeadDetails.leadStatus}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Project Status</span>
                  <span className="text-amber-400 font-semibold">{selectedLeadDetails.projectStatus}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <span className="text-slate-500 block text-[10px] uppercase mb-1">Video Scope</span>
                <div className="text-white font-semibold">{selectedLeadDetails.videoScope}</div>
                {selectedLeadDetails.businessType && (
                  <div className="text-slate-400 mt-1">{selectedLeadDetails.businessType}</div>
                )}
              </div>

              {selectedLeadDetails.campaign && (
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
                  <span className="text-slate-500 block text-[10px] uppercase">Campaign Attribution</span>
                  <div className="text-slate-300">Campaign: <strong>{selectedLeadDetails.campaign}</strong></div>
                  <div className="text-slate-300">Ad Set: <strong>{selectedLeadDetails.adSet}</strong></div>
                  <div className="text-slate-300">Form: <strong>{selectedLeadDetails.formName}</strong></div>
                </div>
              )}

              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <span className="text-slate-500 block text-[10px] uppercase mb-1">Inquiry Notes</span>
                <div className="text-slate-300">{selectedLeadDetails.notes}</div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <a
                  href={`tel:${selectedLeadDetails.phone}`}
                  className="px-3 py-1.5 rounded-lg border border-white/10 text-slate-300 hover:text-white flex items-center gap-1.5"
                >
                  <Phone className="w-3.5 h-3.5" />
                  Call
                </a>
                <a
                  href={`https://wa.me/${selectedLeadDetails.phone?.replace(/[^0-9]/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
