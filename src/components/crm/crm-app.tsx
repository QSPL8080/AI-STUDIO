import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Calendar,
  ArrowLeft,
  Bell,
  CheckCircle2,
  Clock,
  Database,
  Download,
  Eye,
  EyeOff,
  Globe,
  Layers,
  LayoutGrid,
  Lock,
  LogOut,
  Mail,
  MessageSquare,
  Package,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Shield,
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
import { CrmUser, clearStoredCrmUser, setStoredCrmUser } from "@/lib/crm-auth";
import {
  crmClearActivityFn,
  crmClearLeadsFn,
  crmCreateLeadFn,
  crmCreateUserFn,
  crmDeleteActivityFn,
  crmDeleteLeadFn,
  crmDeleteLeadsFn,
  crmLeadHistoryFn,
  crmDeleteOrderFn,
  crmDeleteOrdersFn,
  crmDeleteActivitiesFn,
  crmRestoreLeadsFn,
  crmPurgeLeadsFn,
  crmUnlockUserFn,
  crmTestAlertEmailFn,
  crmMarkNotificationsFn,
  crmDeleteUserFn,
  crmEmptyRecycleBinFn,
  crmLogoutFn,
  crmPurgeLeadFn,
  crmRestoreLeadFn,
  crmSaveConfigFn,
  crmSaveMatrixFn,
  crmSetUserStatusFn,
  crmSyncFn,
  crmUnlockOrdersFn,
  crmUpdateLeadFn,
} from "@/lib/crm-actions";
import {
  DEFAULT_CONFIG,
  DEFAULT_MATRIX,
  LOCKOUT_OPTIONS,
  lockoutLabel,
  PERMISSION_ROWS,
  ROLE_LABEL,
  type CrmConfig,
  type ManagedRole,
  type PermSet,
  type PermissionMatrix,
} from "@/lib/crm-permissions";
import { displayLeadSource } from "@/lib/lead-source";
import type { ActivityItem, LeadItem, OrderItem, RecordCounts, UserItem } from "./crm-types";

type NotifItem = { id: string; type: "lead" | "order"; createdAt: string; title: string; sub: string; lead?: LeadItem };

export const LOGOUT_REASON_KEY = "quickupp_crm_logout_reason";

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function playAudioChime() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
  } catch {
    /* audio blocked by browser */
  }
}

function fmtIst(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function fmtIstDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" });
}

function fmtIstTime(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true });
}

function fmtMoney(amount: number, currency = "USD") {
  try {
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", { style: "currency", currency, maximumFractionDigits: currency === "INR" ? 0 : 2 }).format(amount || 0);
  } catch {
    return `${currency} ${(amount || 0).toFixed(2)}`;
  }
}

function revenueText(byCurrency: Record<string, number>) {
  const entries = Object.entries(byCurrency);
  if (!entries.length) return fmtMoney(0, "USD");
  return entries.map(([c, v]) => fmtMoney(v, c)).join(" + ");
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const blob = new Blob([rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const LEAD_STATUSES = ["New", "Contacted", "In Progress", "Hold", "Closed"];
const PROJECT_STATUSES = ["New", "In Progress", "Proj Active", "On Hold", "Delivered", "Cancelled"];

// "Add New Manual Lead" form (Leads and Meta Leads use the same form).
const LEAD_SOURCE_OPTIONS = [
  { value: "IND - Contact Form", label: "India Website - Contact Form" },
  { value: "IND - Popup Modal", label: "India Website - Popup" },
  { value: "Manual", label: "Manual" },
  { value: "Meta Ads", label: "Meta Ads" },
];
const LEAD_INDUSTRIES = [
  "E-commerce / D2C",
  "Real Estate",
  "Healthcare / Clinics",
  "Education / Coaching",
  "Finance / Insurance",
  "SaaS / Technology",
  "Jewellery & Fashion",
  "Food & Restaurants",
  "Interior Design / Architecture",
  "Hospitality / Travel",
  "Personal Brand / Founder",
  "Agency / Marketing",
  "Other",
];
const LEAD_VIDEO_TYPES = [
  "AI UGC Video",
  "AI Cartoon Animation",
  "AI Avatar Video",
  "Hyper-Realistic AI Video",
  "AI Digital Twin / Clone",
  "AI Digital Twin Setup",
  "Custom / Not decided",
];
const LEAD_QUANTITIES = ["1 Video", "1 - 3 Videos", "5 Videos", "10 Videos", "15 Videos", "15 - 30 Videos / month", "30+ Videos / month", "Not decided"];
const blankLeadForm = (source: string) => ({
  source,
  clientName: "",
  business: "",
  website: "",
  phone: "",
  email: "",
  industry: "",
  location: "",
  videoScope: "AI UGC Video",
  quantity: "1 Video",
  leadStatus: "New",
  projectStatus: "New",
  deliveryDate: "",
  notes: "",
  channel: "Facebook",
  campaign: "",
  adSet: "",
  formName: "",
});

const ORDER_STATUS_STYLE: Record<string, string> = {
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-300",
  PENDING: "bg-amber-50 text-amber-700 border-amber-300",
  FAILED: "bg-red-50 text-red-700 border-red-300",
  CANCELLED: "bg-red-50 text-red-700 border-red-300",
  REFUNDED: "bg-slate-100 text-slate-700 border-slate-200",
};

const card = "rounded-lg border border-slate-200 bg-white";
const btnGhost =
  "inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-md border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-100 text-[13px] font-medium transition-colors disabled:opacity-50";
const btnDanger =
  "inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-md border border-red-200 text-red-600 hover:bg-red-500/10 text-[13px] font-medium transition-colors disabled:opacity-50";
const iconBtn =
  "inline-flex items-center justify-center w-9 h-9 rounded-md border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors";
const inputCls =
  "w-full h-9 px-3 rounded-md border border-slate-200 bg-white text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500";

type TabId = "dashboard" | "leads" | "meta" | "orders" | "activity" | "users" | "settings" | "recycle-bin";
type Toast = { id: number; kind: "success" | "error" | "info"; text: string };

// ---------------------------------------------------------------------------
// Main app
// ---------------------------------------------------------------------------
export function CrmApp({ user: initialUser }: { user: CrmUser }) {
  const navigate = useNavigate();
  const tokenRef = useRef(initialUser.token);
  const [me, setMe] = useState<CrmUser>(initialUser);
  const isSuperAdmin = me.role === "SUPER_ADMIN";

  // Server data
  const [loaded, setLoaded] = useState(false);
  const [online, setOnline] = useState(true);
  const [perms, setPerms] = useState<PermSet | null>(null);
  const [config, setConfig] = useState<CrmConfig>(DEFAULT_CONFIG);
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [recycleBin, setRecycleBin] = useState<LeadItem[]>([]);
  const [orders, setOrders] = useState<OrderItem[] | null>(null);
  const [ordersCount, setOrdersCount] = useState(0);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [orderEvents, setOrderEvents] = useState<ActivityItem[]>([]);
  const [counts, setCounts] = useState<RecordCounts | null>(null);
  const [serverMatrix, setServerMatrix] = useState<PermissionMatrix>(DEFAULT_MATRIX);

  // UI state
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [settingsSubTab, setSettingsSubTab] = useState<"general" | "rbac" | "records" | "security">("general");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncCountdown, setSyncCountdown] = useState(10);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notif, setNotif] = useState<{ seenAt: string; readIds: string[]; clearedAt: string | null; alertedAt?: string | null } | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  // Orders PIN
  const ordersPinRef = useRef<string>("");
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [showPinText, setShowPinText] = useState(false);
  const [pinError, setPinError] = useState("");

  // Filters
  const [leadsSearch, setLeadsSearch] = useState("");
  const [leadsStatus, setLeadsStatus] = useState("All");
  const [metaSearch, setMetaSearch] = useState("");
  const [metaStatus, setMetaStatus] = useState("All");
  const [ordersSearch, setOrdersSearch] = useState("");
  const [ordersStatus, setOrdersStatus] = useState("COMPLETED");
  const [activityFilter, setActivityFilter] = useState("All");

  // Modals
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadItem | null>(null);
  const [leadHistory, setLeadHistory] = useState<ActivityItem[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null);

  const [leadForm, setLeadForm] = useState(() => blankLeadForm("Manual"));
  const openAddLead = (source: string) => {
    setLeadForm(blankLeadForm(source));
    setShowAddLeadModal(true);
  };
  const [newUserForm, setNewUserForm] = useState({ name: "", email: "", password: "", role: "ADMIN" as ManagedRole });
  const [showNewUserPw, setShowNewUserPw] = useState(false);

  // Settings drafts
  const [configDraft, setConfigDraft] = useState<CrmConfig>(DEFAULT_CONFIG);
  const [configDirty, setConfigDirty] = useState(false);
  const [matrixDraft, setMatrixDraft] = useState<PermissionMatrix>(DEFAULT_MATRIX);
  const [matrixDirty, setMatrixDirty] = useState(false);

  const knownNotifIds = useRef<Set<string> | null>(null);
  const soundRef = useRef(soundEnabled);
  soundRef.current = soundEnabled && config.audioChimeEnabled;
  const configDirtyRef = useRef(false);
  configDirtyRef.current = configDirty;
  const matrixDirtyRef = useRef(false);
  matrixDirtyRef.current = matrixDirty;

  // -------------------------------------------------------------------------
  // Toasts & server call wrapper
  // -------------------------------------------------------------------------
  const toast = useCallback((text: string, kind: Toast["kind"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  // In-CRM notification alert cards (bottom-right). No browser / desktop notifications.
  const [notifAlerts, setNotifAlerts] = useState<{ key: number; item: NotifItem }[]>([]);
  const dismissAlert = (key: number) => setNotifAlerts((a) => a.filter((x) => x.key !== key));
  // Cards stay on screen until the user opens or closes them (newest on top, max 3);
  // anything beyond that is counted on the "+N more" card, which opens the bell list.
  const announce = (fresh: NotifItem[]) => {
    setNotifAlerts((a) => {
      const existing = new Set(a.map((x) => x.item.id));
      const add = fresh.filter((n) => !existing.has(n.id)).map((item, i) => ({ key: Date.now() + i + Math.random(), item }));
      return [...add, ...a];
    });
  };

  const forceLogout = useCallback(
    (reason?: string) => {
      clearStoredCrmUser();
      try {
        if (reason) sessionStorage.setItem(LOGOUT_REASON_KEY, reason);
      } catch {
        /* ignore */
      }
      navigate({ to: "/crm/login" });
    },
    [navigate],
  );

  const call = useCallback(
    async (p: Promise<unknown>): Promise<any | null> => {
      try {
        const r: any = await p;
        if (r && r.ok === false) {
          if (r.code === "UNAUTHENTICATED") forceLogout(r.error);
          else toast(r.error || "Action failed.", "error");
          return null;
        }
        return r;
      } catch (e) {
        console.error(e);
        toast("Could not reach the server. Please try again.", "error");
        return null;
      }
    },
    [forceLogout, toast],
  );

  // -------------------------------------------------------------------------
  // Live sync
  // -------------------------------------------------------------------------
  const doSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      const r: any = await crmSyncFn({ data: ordersPinRef.current ? { token: tokenRef.current, ordersPin: ordersPinRef.current } : { token: tokenRef.current } });
      if (r?.ok === false) {
        if (r.code === "UNAUTHENTICATED") return forceLogout(r.error);
        setOnline(false);
        return;
      }
      setOnline(true);
      setPerms(r.perms);
      if (r.notif) setNotif(r.notif);
      setConfig(r.config);
      if (!configDirtyRef.current) setConfigDraft(r.config);
      setLeads([...r.leads].sort((a: LeadItem, b: LeadItem) => String(b.createdAt).localeCompare(String(a.createdAt))));
      setRecycleBin(r.recycleBin);
      setOrdersCount(r.ordersCount);
      if (r.orders && ordersPinRef.current) setOrders(r.orders); // ignore late results after the tab re-locked
      else if (!r.perms.orders) {
        setOrders(null);
        ordersPinRef.current = "";
      }
      if (r.users) setUsers(r.users);
      if (r.activity) setActivity(r.activity);
      setOrderEvents(r.orderEvents || []);
      if (r.counts) setCounts(r.counts);
      if (r.matrix) {
        setServerMatrix(r.matrix);
        if (!matrixDirtyRef.current) setMatrixDraft(r.matrix);
      }
      if (r.user && (r.user.name !== me.name || r.user.role !== me.role)) {
        const updated = { ...me, name: r.user.name, role: r.user.role };
        setMe(updated);
        setStoredCrmUser(updated, false);
      }
      setLoaded(true);
    } catch (e) {
      console.warn("CRM sync failed", e);
      setOnline(false);
    } finally {
      setIsSyncing(false);
      setSyncCountdown(config.pollingSeconds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceLogout, me, config.pollingSeconds]);

  const doSyncRef = useRef(doSync);
  doSyncRef.current = doSync;

  useEffect(() => {
    doSyncRef.current();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setSyncCountdown((prev) => {
        if (prev <= 1) {
          doSyncRef.current();
          return config.pollingSeconds;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [config.pollingSeconds]);

  // Inactivity auto-logout
  const lastActivity = useRef(Date.now());
  useEffect(() => {
    const mark = () => (lastActivity.current = Date.now());
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    const check = setInterval(() => {
      if (Date.now() - lastActivity.current > config.inactivityMinutes * 60 * 1000) {
        forceLogout(`Signed out after ${config.inactivityMinutes} minutes of inactivity.`);
      }
    }, 30000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, mark));
      clearInterval(check);
    };
  }, [config.inactivityMinutes, forceLogout]);

  // -------------------------------------------------------------------------
  // Tabs by role + live permissions
  // -------------------------------------------------------------------------
  const websiteLeads = useMemo(() => leads.filter((l) => l.kind === "website"), [leads]);
  const metaLeads = useMemo(() => leads.filter((l) => l.kind === "meta"), [leads]);

  // -------------------------------------------------------------------------
  // Notifications: only new leads, and new orders / payments. Read state is saved per user on the server, so
  // everything that arrived while someone was away is shown when they open the CRM.
  // -------------------------------------------------------------------------
  const notifItems = useMemo<NotifItem[]>(() => {
    const items: NotifItem[] = leads.slice(0, 100).map((l) => ({
      id: l.id,
      type: "lead",
      createdAt: l.createdAt,
      title: `New ${l.kind === "meta" ? "Meta" : "website"} lead: ${l.clientName}`,
      sub: `${l.kind === "meta" ? "Meta Ads" : displayLeadSource(l.source)} • ${l.videoScope}${l.phone ? ` • ${l.phone}` : ""}`,
      lead: l,
    }));
    // Orders & payments (for everyone allowed to see Orders & Payments).
    for (const a of orderEvents) items.push({ id: a.id, type: "order", createdAt: a.createdAt, title: a.title, sub: a.description });
    const cleared = notif?.clearedAt || "";
    return items
      .filter((n) => String(n.createdAt) > cleared)
      .sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt)))
      .slice(0, 60);
  }, [leads, orderEvents, notif?.clearedAt]);

  const isUnread = useCallback(
    (n: { id: string; createdAt: string }) => !!notif && String(n.createdAt) > notif.seenAt && !notif.readIds.includes(n.id),
    [notif],
  );
  const unreadItems = useMemo(() => notifItems.filter(isUnread), [notifItems, isUnread]);
  const unseenLeadIds = useMemo(() => unreadItems.filter((n) => n.type === "lead").map((n) => n.id), [unreadItems]);

  const markRead = (ids: string[]) => {
    const todo = ids.filter((id) => notifItems.some((n) => n.id === id && isUnread(n)));
    if (!todo.length) return;
    setNotif((st) => (st ? { ...st, readIds: [...new Set([...todo, ...st.readIds])] } : st));
    setNotifAlerts((a) => a.filter((x) => !todo.includes(x.item.id)));
    crmMarkNotificationsFn({ data: { token: tokenRef.current, ids: todo } }).catch(() => null);
  };
  const markSeen = (id: string) => markRead([id]);
  const markAllRead = () => {
    setNotif((st) => { const now = new Date().toISOString(); return { seenAt: now, readIds: [], clearedAt: st?.clearedAt ?? null, alertedAt: now }; });
    setNotifAlerts([]);
    crmMarkNotificationsFn({ data: { token: tokenRef.current, all: true } }).catch(() => null);
  };
  const clearAllNotifs = () => {
    const now = new Date().toISOString();
    setNotif({ seenAt: now, readIds: [], clearedAt: now, alertedAt: now });
    setNotifAlerts([]);
    crmMarkNotificationsFn({ data: { token: tokenRef.current, clear: true } }).catch(() => null);
  };
  const openNotif = (n: NotifItem) => {
    markRead([n.id]);
    setShowNotifications(false);
    if (n.lead) setSelectedLead(n.lead);
    else setActiveTab("orders");
  };

  // Unread count in the browser tab title
  useEffect(() => {
    const base = "AI STUDIO INDIA – Enterprise CRM";
    const n = unreadItems.length;
    document.title = n ? `(${n}) ${base}` : base;
  }, [unreadItems.length]);

  // On opening the CRM: the same alert cards as live ones for everything still unread
  // (the panel itself stays closed; unread items stay on the bell until opened).
  // While open: alert card (+ chime for leads) for every new item that arrives.
  useEffect(() => {
    if (!loaded || !notif) return;
    const ids = new Set(notifItems.map((n) => n.id));
    // Each notification pops up only once: unread items that already popped up on an earlier
    // visit (created at or before alertedAt) stay on the bell list but don't pop up again.
    const rememberAlerted = () => {
      const at = new Date().toISOString();
      setNotif((st) => (st ? { ...st, alertedAt: at } : st));
      crmMarkNotificationsFn({ data: { token: tokenRef.current, alerted: at } }).catch(() => null);
    };
    if (knownNotifIds.current === null) {
      knownNotifIds.current = ids;
      const alertedAt = notif.alertedAt || "";
      const notYetPopped = unreadItems.filter((n) => String(n.createdAt) > alertedAt);
      if (notYetPopped.length) {
        if (soundRef.current && notYetPopped.some((n) => n.type === "lead")) playAudioChime();
        announce(notYetPopped);
      }
      rememberAlerted();
      return;
    }
    const fresh = notifItems.filter((n) => !knownNotifIds.current!.has(n.id) && isUnread(n));
    knownNotifIds.current = ids;
    if (fresh.length) {
      if (soundRef.current && fresh.some((n) => n.type === "lead")) playAudioChime();
      announce(fresh);
      rememberAlerted();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifItems, loaded, notif]);

  const tabs = useMemo(() => {
    if (!perms) return [];
    const list: { id: TabId; label: string; icon: React.ElementType; count: number | null }[] = [];
    if (perms.dashboard) list.push({ id: "dashboard", label: "Dashboard", icon: LayoutGrid, count: null });
    if (perms.leads) list.push({ id: "leads", label: "Leads Management", icon: Users, count: websiteLeads.length });
    if (perms.meta) list.push({ id: "meta", label: "Meta Leads", icon: Layers, count: metaLeads.length });
    if (perms.orders) list.push({ id: "orders", label: "Orders & Payments", icon: Package, count: ordersCount });
    if (isSuperAdmin) {
      list.push(
        { id: "activity", label: "Activity History", icon: Clock, count: null },
        { id: "users", label: "User Management", icon: UserCheck, count: users.length },
        { id: "settings", label: "CRM Settings", icon: Settings, count: null },
      );
    }
    if (perms.recycle_bin) list.push({ id: "recycle-bin", label: "Recycle Bin", icon: Trash2, count: recycleBin.length });
    return list;
  }, [perms, isSuperAdmin, websiteLeads.length, metaLeads.length, ordersCount, users.length, recycleBin.length]);

  useEffect(() => setSelectedIds([]), [activeTab]);

  // Orders & Payments re-locks as soon as the user leaves the tab: the PIN is needed every time.
  useEffect(() => {
    if (activeTab !== "orders" && ordersPinRef.current) {
      ordersPinRef.current = "";
      setOrders(null);
      setSelectedOrder(null);
      setOrdersStatus("COMPLETED");
      setOrdersSearch("");
    }
  }, [activeTab]);

  // Per-lead audit trail for the details popup
  useEffect(() => {
    if (!selectedLead) return;
    markSeen(selectedLead.id);
    let cancelled = false;
    setLeadHistory(null);
    crmLeadHistoryFn({ data: { token: tokenRef.current, id: selectedLead.id } })
      .then((r: any) => {
        if (!cancelled) setLeadHistory(r?.ok ? r.history : []);
      })
      .catch(() => !cancelled && setLeadHistory([]));
    return () => {
      cancelled = true;
    };
  }, [selectedLead?.id]);

  // If a permission is revoked while the user is on that tab, move them to an allowed tab.
  useEffect(() => {
    if (!tabs.length) return;
    if (!tabs.some((t) => t.id === activeTab)) setActiveTab(tabs[0]!.id);
  }, [tabs, activeTab]);

  const handleTabClick = (id: TabId) => {
    if (id === "orders" && !orders) {
      setPinError("");
      setPinInput("");
      setShowPinModal(true);
      return;
    }
    setActiveTab(id);
  };

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------
  const tok = () => tokenRef.current;

  const handleLogout = async () => {
    await crmLogoutFn({ data: { token: tok() } }).catch(() => null);
    forceLogout();
  };

  const handleUnlockPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError("");
    const r: any = await crmUnlockOrdersFn({ data: { token: tok(), pin: pinInput.trim() } }).catch(() => null);
    if (r?.ok) {
      ordersPinRef.current = pinInput.trim();
      setOrders(r.orders);
      setShowPinModal(false);
      setPinInput("");
      setActiveTab("orders");
      if (soundRef.current) playAudioChime();
    } else if (r?.code === "UNAUTHENTICATED") forceLogout(r.error);
    else setPinError(r?.error || "Invalid security PIN.");
  };

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    const f = leadForm;
    if (!f.clientName.trim() || !f.business.trim() || !f.phone.trim()) {
      toast("Client name, company / brand and WhatsApp / phone are required.", "error");
      return;
    }
    const isMetaLead = f.source === "Meta Ads";
    setBusy("add-lead");
    const r = await call(crmCreateLeadFn({ data: { token: tok(), lead: { kind: isMetaLead ? "meta" : "website", ...f } } }));
    setBusy(null);
    if (!r) return;
    // Your own manual entry doesn't need to notify you.
    knownNotifIds.current?.add(r.lead.id);
    setNotif((st) => (st ? { ...st, readIds: [r.lead.id, ...st.readIds] } : st));
    crmMarkNotificationsFn({ data: { token: tok(), ids: [r.lead.id] } }).catch(() => null);
    toast(isMetaLead ? "Meta lead saved to database." : "Lead saved to database.");
    setShowAddLeadModal(false);
    doSync();
  };

  const handleLeadField = async (lead: LeadItem, field: "leadStatus" | "projectStatus", value: string) => {
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, [field]: value } : l)));
    const r = await call(crmUpdateLeadFn({ data: { token: tok(), id: lead.id, [field]: value } }));
    if (!r) doSync();
  };

  const handleDeleteLead = async (lead: LeadItem) => {
    const msg = isSuperAdmin
      ? `Permanently delete "${lead.clientName}"?\n\nThis removes the lead from the database and cannot be undone.`
      : `Move "${lead.clientName}" to the Recycle Bin?`;
    if (!window.confirm(msg)) return;
    const r = await call(crmDeleteLeadFn({ data: { token: tok(), id: lead.id } }));
    if (!r) return;
    setLeads((prev) => prev.filter((l) => l.id !== lead.id));
    toast(r.mode === "permanent" ? "Lead permanently deleted from the database." : "Lead moved to the Recycle Bin.");
    doSync();
  };

  const handleBulkDelete = async (visible: LeadItem[]) => {
    const ids = selectedIds.filter((id) => visible.some((l) => l.id === id));
    if (!ids.length) return;
    const msg = isSuperAdmin
      ? `Permanently delete ${ids.length} lead(s)?\n\nThey are removed from the database and cannot be recovered.`
      : `Move ${ids.length} lead(s) to the Recycle Bin?`;
    if (!window.confirm(msg)) return;
    const r = await call(crmDeleteLeadsFn({ data: { token: tok(), ids } }));
    if (!r) return doSync();
    setLeads((prev) => prev.filter((l) => !ids.includes(l.id)));
    setSelectedIds([]);
    toast(r.mode === "permanent" ? `${r.deleted} lead(s) permanently deleted.` : `${r.deleted} lead(s) moved to the Recycle Bin.`);
    doSync();
  };

  const handleClearLeads = async (kind: "website" | "meta") => {
    const n = kind === "meta" ? metaLeads.length : websiteLeads.length;
    if (!window.confirm(`Permanently delete ALL ${n} ${kind === "meta" ? "Meta" : "website"} leads from the database?\n\nThis cannot be undone.`)) return;
    const r = await call(crmClearLeadsFn({ data: { token: tok(), kind } }));
    if (!r) return;
    toast(`${r.deleted} lead(s) permanently deleted.`);
    doSync();
  };

  const handleRestore = async (lead: LeadItem) => {
    const r = await call(crmRestoreLeadFn({ data: { token: tok(), id: lead.id } }));
    if (!r) return;
    setRecycleBin((prev) => prev.filter((l) => l.id !== lead.id));
    toast(`${lead.clientName} restored.`);
    doSync();
  };

  const handlePurge = async (lead: LeadItem) => {
    if (!window.confirm(`Permanently delete "${lead.clientName}" from the database?\n\nThis cannot be undone.`)) return;
    const r = await call(crmPurgeLeadFn({ data: { token: tok(), id: lead.id } }));
    if (!r) return;
    setRecycleBin((prev) => prev.filter((l) => l.id !== lead.id));
    toast("Lead permanently deleted.");
    doSync();
  };

  const handleEmptyBin = async () => {
    if (!window.confirm(`Permanently delete all ${recycleBin.length} lead(s) in the Recycle Bin?\n\nThis cannot be undone.`)) return;
    const r = await call(crmEmptyRecycleBinFn({ data: { token: tok() } }));
    if (!r) return;
    toast(`${r.deleted} lead(s) permanently deleted.`);
    doSync();
  };

  const handleDeleteOrder = async (o: OrderItem) => {
    if (
      !window.confirm(
        `Permanently delete this ${o.paymentStatus} order?\n\n${o.customerName} • ${fmtMoney(o.amount, o.currency)} • ${o.paypalOrderId}\n\nThis removes it from the database and cannot be undone.`,
      )
    )
      return;
    const r = await call(crmDeleteOrderFn({ data: { token: tok(), id: o.id } }));
    if (!r) return;
    setOrders((prev) => (prev ? prev.filter((x) => x.id !== o.id) : prev));
    setSelectedOrder(null);
    toast("Order permanently deleted from the database.");
    doSync();
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("create-user");
    const r = await call(crmCreateUserFn({ data: { token: tok(), ...newUserForm } }));
    setBusy(null);
    if (!r) return;
    toast(`${ROLE_LABEL[newUserForm.role]} account created for ${r.user.email}.`);
    setShowCreateUserModal(false);
    setNewUserForm({ name: "", email: "", password: "", role: "ADMIN" });
    doSync();
  };

  const [emailTest, setEmailTest] = useState<{ success: boolean; via: string; errors: string[]; to: string } | null>(null);
  const handleTestAlertEmail = async () => {
    setBusy("test-email");
    setEmailTest(null);
    const r = await call(crmTestAlertEmailFn({ data: { token: tok() } }));
    setBusy(null);
    if (r) setEmailTest({ success: r.success, via: r.via, errors: r.errors, to: r.to });
  };

  const handleUnlockUser = async (u: UserItem) => {
    const r = await call(crmUnlockUserFn({ data: { token: tok(), userId: u.id } }));
    if (!r) return;
    toast(`${u.email} unlocked — they can sign in again.`);
    doSync();
  };

  const confirmBulk = (msg: string) => window.confirm(msg);

  const handleBulkOrders = async () => {
    const ids = selectedIds.filter((id) => (orders || []).some((o) => o.id === id));
    if (!ids.length || !confirmBulk(`Permanently delete ${ids.length} order(s)?\n\nThey are removed from the database and cannot be recovered.`)) return;
    const r = await call(crmDeleteOrdersFn({ data: { token: tok(), ids } }));
    if (!r) return doSync();
    setOrders((prev) => (prev ? prev.filter((o) => !ids.includes(o.id)) : prev));
    setSelectedIds([]);
    toast(`${r.deleted} order(s) permanently deleted.`);
    doSync();
  };

  const handleBulkActivity = async () => {
    const ids = selectedIds.filter((id) => activity.some((a) => a.id === id));
    if (!ids.length || !confirmBulk(`Delete ${ids.length} activity entr${ids.length === 1 ? "y" : "ies"}?`)) return;
    const r = await call(crmDeleteActivitiesFn({ data: { token: tok(), ids } }));
    if (!r) return doSync();
    setActivity((prev) => prev.filter((a) => !ids.includes(a.id)));
    setSelectedIds([]);
    toast(`${r.deleted} entr${r.deleted === 1 ? "y" : "ies"} deleted.`);
  };

  const handleBulkRestore = async () => {
    const ids = selectedIds.filter((id) => recycleBin.some((l) => l.id === id));
    if (!ids.length) return;
    const r = await call(crmRestoreLeadsFn({ data: { token: tok(), ids } }));
    if (!r) return doSync();
    setRecycleBin((prev) => prev.filter((l) => !ids.includes(l.id)));
    setSelectedIds([]);
    toast(`${r.restored} lead(s) restored.`);
    doSync();
  };

  const handleBulkPurge = async () => {
    const ids = selectedIds.filter((id) => recycleBin.some((l) => l.id === id));
    if (!ids.length || !confirmBulk(`Permanently delete ${ids.length} lead(s) from the database?\n\nThis cannot be undone.`)) return;
    const r = await call(crmPurgeLeadsFn({ data: { token: tok(), ids } }));
    if (!r) return doSync();
    setRecycleBin((prev) => prev.filter((l) => !ids.includes(l.id)));
    setSelectedIds([]);
    toast(`${r.deleted} lead(s) permanently deleted.`);
    doSync();
  };

  const handleToggleUser = async (u: UserItem) => {
    const next = u.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    if (next === "INACTIVE" && !window.confirm(`Deactivate ${u.email}?\n\nThey will be signed out immediately and cannot sign in until re-activated.`)) return;
    const r = await call(crmSetUserStatusFn({ data: { token: tok(), userId: u.id, status: next } }));
    if (!r) return;
    toast(next === "ACTIVE" ? `${u.email} activated.` : `${u.email} deactivated.`);
    doSync();
  };

  const handleDeleteUser = async (u: UserItem) => {
    if (!window.confirm(`Permanently delete ${u.name} (${u.email})?\n\nThe account is removed from the database and they are signed out immediately.`)) return;
    const r = await call(crmDeleteUserFn({ data: { token: tok(), userId: u.id } }));
    if (!r) return;
    setUsers((prev) => prev.filter((x) => x.id !== u.id));
    toast("User permanently deleted from the database.");
    doSync();
  };

  const handleSaveConfig = async () => {
    setBusy("config");
    const r = await call(crmSaveConfigFn({ data: { token: tok(), config: configDraft } }));
    setBusy(null);
    if (!r) return;
    setConfig(r.config);
    setConfigDraft(r.config);
    setConfigDirty(false);
    toast("Settings saved.");
  };

  const handleSaveMatrix = async () => {
    setBusy("matrix");
    const r = await call(crmSaveMatrixFn({ data: { token: tok(), matrix: matrixDraft } }));
    setBusy(null);
    if (!r) return;
    setServerMatrix(r.matrix);
    setMatrixDraft(r.matrix);
    setMatrixDirty(false);
    toast("Permissions saved — applied to all signed-in users.");
    doSync();
  };

  const updateConfigDraft = (patch: Partial<CrmConfig>) => {
    setConfigDraft((c) => ({ ...c, ...patch }));
    setConfigDirty(true);
  };

  // -------------------------------------------------------------------------
  // Derived numbers
  // -------------------------------------------------------------------------
  const countBy = (list: LeadItem[], field: "leadStatus" | "projectStatus", value: string) => list.filter((l) => l[field] === value).length;
  const closedCount = countBy(leads, "leadStatus", "Closed");
  const conversion = leads.length ? Math.round((closedCount / leads.length) * 100) : 0;
  const manualCount = websiteLeads.filter((l) => l.source === "Manual Entry").length;
  const websiteInbound = websiteLeads.length - manualCount;
  const completedOrders = (orders || []).filter((o) => o.paymentStatus === "COMPLETED");
  const revenueByCur = completedOrders.reduce<Record<string, number>>((acc, o) => {
    acc[o.currency] = (acc[o.currency] || 0) + o.amount;
    return acc;
  }, {});

  const filterLeads = (list: LeadItem[], q: string, status: string) => {
    const s = q.trim().toLowerCase();
    return list.filter(
      (l) =>
        (status === "All" || l.leadStatus === status) &&
        (!s ||
          [l.clientName, l.email, l.phone, l.companyName, l.notes, l.videoScope, l.campaign, l.location].some((v) =>
            (v || "").toLowerCase().includes(s),
          )),
    );
  };
  const shownWebsite = filterLeads(websiteLeads, leadsSearch, leadsStatus);
  const shownMeta = filterLeads(metaLeads, metaSearch, metaStatus);
  const shownOrders = (orders || []).filter((o) => {
    const s = ordersSearch.trim().toLowerCase();
    const statusOk =
      ordersStatus === "All" ||
      (ordersStatus === "FAILED" ? o.paymentStatus === "FAILED" || o.paymentStatus === "CANCELLED" : o.paymentStatus === ordersStatus);
    return statusOk && (!s || [o.customerName, o.customerEmail, o.paypalOrderId, o.itemName, o.id].some((v) => (v || "").toLowerCase().includes(s)));
  });
  const activityCats = ["All", "LEADS", "ORDERS", "USER_ACTIVITY", "SETTINGS"];
  const shownActivity = activity.filter((a) => activityFilter === "All" || a.category === activityFilter);

  const exportLeads = (kind: "website" | "meta") => {
    const list = kind === "meta" ? shownMeta : shownWebsite;
    downloadCsv(`quickupp_${kind}_leads.csv`, [
      ["ID", "Source", "Channel", "Created (IST)", "Client", "Email", "Phone", "Business", "Video Scope", "Lead Status", "Project Status", "Campaign", "Ad Set", "Form", "Notes"],
      ...list.map((l) => [l.id, l.source, l.channel, fmtIst(l.createdAt), l.clientName, l.email, l.phone, l.companyName, l.videoScope, l.leadStatus, l.projectStatus, l.campaign, l.adSet, l.formName, l.notes]),
    ]);
  };

  const roleBadge = (role: string) =>
    role === "SUPER_ADMIN"
      ? "bg-purple-50 border-purple-300 text-purple-700"
      : role === "ADMIN"
        ? "bg-blue-50 border-blue-300 text-blue-700"
        : "bg-teal-50 border-teal-300 text-teal-700";

  const canDelete = isSuperAdmin || !!perms?.delete_leads;
  const canExport = !!perms?.export;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  if (!loaded || !perms) {
    return (
      <div className="min-h-screen bg-[#f4f5f9] flex flex-col items-center justify-center p-4 text-slate-600 text-[13px]">
        <div className="w-6 h-6 border-2 border-purple-200 border-t-purple-500 rounded-full animate-spin mb-3" />
        <span>{online ? "Loading live CRM data..." : "Cannot reach the CRM database. Retrying..."}</span>
      </div>
    );
  }

  const latestLeads = leads.slice(0, 20);

  return (
    <div className="min-h-screen lg:h-dvh lg:overflow-hidden flex flex-col bg-[#f4f5f9] text-slate-900 font-sans antialiased [color-scheme:light]">
      {/* ===================== STICKY HEADER + TAB BAR ===================== */}
      <div className="shrink-0 sticky top-0 z-40 bg-white border-b border-slate-200 shadow-[0_1px_0_rgba(15,23,42,0.03),0_6px_20px_-12px_rgba(15,23,42,0.18)]">
        <header className="h-16 px-3 sm:px-5 lg:px-6 2xl:px-10">
          <div className="h-full w-full flex items-center justify-between gap-2 sm:gap-4">
            {/* Left */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <Link to="/" className={`${iconBtn} shrink-0`} title="Back to website">
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <img src="/images/logo-dark.png" alt="Quickupp AI Studio" className="h-6 sm:h-8 w-auto object-contain shrink-0" />
              <div className="hidden md:block h-8 w-px bg-slate-200" />
              <div className="hidden md:flex flex-col min-w-0">
                <span className="text-[15px] font-semibold text-slate-900 truncate leading-tight">{config.crmTitle}</span>
              </div>
              <span className={`hidden sm:inline-flex shrink-0 text-xs font-semibold px-2.5 py-1 rounded-md border ${roleBadge(me.role)}`}>{ROLE_LABEL[me.role]}</span>
            </div>

            {/* Right */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <div
                className={`hidden lg:flex items-center gap-2 h-9 px-3 rounded-md border text-xs ${
                  online ? "border-emerald-200 bg-emerald-500/5 text-emerald-700" : "border-red-200 bg-red-500/10 text-red-700"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${online ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
                {online ? `Live • sync in ${syncCountdown}s` : "Offline • retrying"}
              </div>
              <button onClick={() => doSync()} className={iconBtn} title="Refresh now">
                <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin text-cyan-600" : ""}`} />
              </button>
              <button
                onClick={() => {
                  setSoundEnabled(!soundEnabled);
                  if (!soundEnabled) playAudioChime();
                }}
                className="hidden sm:inline-flex items-center justify-center w-9 h-9 rounded-md border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                title={soundEnabled ? "Mute sound alerts" : "Enable sound alerts"}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-600" /> : <VolumeX className="w-4 h-4" />}
              </button>

              <div className="relative">
                <button onClick={() => setShowNotifications(!showNotifications)} className={`${iconBtn} relative`} title="Notifications">
                  <Bell className="w-4 h-4" />
                  {unreadItems.length > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[19px] h-[19px] px-1 rounded-full bg-red-500 text-[11px] font-bold text-white flex items-center justify-center">
                      {unreadItems.length > 99 ? "99+" : unreadItems.length}
                    </span>
                  )}
                </button>
                {showNotifications && (
                  <div className="fixed left-3 right-3 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[26rem] rounded-lg border border-slate-200 bg-white shadow-2xl z-50 text-[13px] flex flex-col max-h-[75vh]">
                    <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200">
                      <div>
                        <div className="font-semibold text-slate-900 text-sm">Notifications</div>
                        <div className="text-xs text-slate-600">{unreadItems.length ? `${unreadItems.length} unread` : "You're all caught up"}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={markAllRead}
                          disabled={!unreadItems.length}
                          className="h-8 px-2.5 rounded-md text-xs font-medium text-cyan-700 hover:bg-slate-100 disabled:text-slate-400 disabled:hover:bg-transparent"
                        >
                          Mark all as read
                        </button>
                        <button
                          onClick={clearAllNotifs}
                          disabled={!notifItems.length}
                          className="h-8 px-2.5 rounded-md text-xs font-medium text-red-700 hover:bg-red-500/10 disabled:text-slate-400 disabled:hover:bg-transparent"
                        >
                          Clear all
                        </button>
                        <button onClick={() => setShowNotifications(false)} className="w-8 h-8 inline-flex items-center justify-center rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100" title="Close">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="overflow-y-auto p-2 space-y-1">
                      {notifItems.length === 0 ? (
                        <div className="p-6 text-slate-500 text-center">No notifications. New leads will appear here.</div>
                      ) : (
                        notifItems.map((n) => {
                          const unread = isUnread(n);
                          const tone = n.type === "lead" ? "text-emerald-700 bg-emerald-500/10" : "text-purple-700 bg-purple-500/10";
                          return (
                            <button
                              key={n.id}
                              onClick={() => openNotif(n)}
                              className={`w-full text-left p-2.5 rounded-md flex items-start gap-2.5 transition-colors ${unread ? "bg-cyan-500/[0.07] hover:bg-cyan-500/[0.12]" : "hover:bg-slate-100"}`}
                            >
                              <span className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${tone}`}>
                                {n.type === "lead" ? <Users className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                              </span>
                              <span className="flex-1 min-w-0">
                                <span className={`block truncate ${unread ? "font-semibold text-slate-900" : "text-slate-700"}`}>{n.title}</span>
                                <span className="block text-xs text-slate-600 truncate">{n.sub}</span>
                                <span className="block text-[11px] text-slate-500 mt-0.5">{fmtIst(n.createdAt)}</span>
                              </span>
                              {unread && <span className="w-2 h-2 rounded-full bg-cyan-400 mt-1.5 shrink-0" />}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2.5 pl-2 sm:pl-3 sm:ml-1 border-l border-slate-200">
                <div className="hidden sm:flex w-9 h-9 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 items-center justify-center text-sm font-bold text-white">
                  {(me.name || me.email).charAt(0).toUpperCase()}
                </div>
                <div className="hidden xl:flex flex-col leading-tight">
                  <span className="text-[13px] font-semibold text-slate-900">{me.name}</span>
                  <span className="text-xs text-slate-600">{me.email}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center justify-center w-9 h-9 rounded-md border border-red-200 text-red-600 hover:bg-red-500/10 transition-colors"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </header>

        <nav className="h-12 px-3 sm:px-5 lg:px-6 2xl:px-10 border-t border-slate-100 overflow-x-auto no-scrollbar">
          <div className="h-full w-full flex items-center gap-1 min-w-max">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  className={`h-9 flex items-center gap-2 px-3.5 rounded-md text-sm font-medium transition-all ${
                    isActive ? "bg-purple-600 text-white shadow-[0_6px_16px_-6px_rgba(147,51,234,0.55)]" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {tab.id === "orders" && !orders && <Lock className="w-3 h-3 opacity-70" />}
                  {tab.count !== null && (
                    <span className={`text-[11px] min-w-[20px] px-1.5 py-0.5 rounded-md font-semibold ${isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"}`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      {/* ===================== MAIN ===================== */}
      <main className="flex-1 min-h-0 w-full px-3 sm:px-5 lg:px-6 2xl:px-10 py-4 sm:py-5 lg:overflow-y-auto">
        {/* ---------------- DASHBOARD ---------------- */}
        {activeTab === "dashboard" && perms.dashboard && (
          <div className="flex flex-col gap-4 lg:h-full lg:min-h-0">
            <PageHeader
              icon={<LayoutGrid className="w-5 h-5 text-purple-600" />}
              title="Executive CRM Dashboard"
              subtitle="Real-time overview of inbound leads, production pipeline and revenue."
            >
              {perms.leads && (
                <button onClick={() => openAddLead("Manual")} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-[13px] font-semibold">
                  <Plus className="w-4 h-4" /> Add Lead
                </button>
              )}
              {perms.meta && (
                <button onClick={() => openAddLead("Meta Ads")} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-purple-600 hover:bg-purple-500 text-white text-[13px] font-semibold">
                  <Plus className="w-4 h-4" /> Add Meta Lead
                </button>
              )}
            </PageHeader>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
              <Kpi label="Total Leads" value={leads.length} sub="All sources" icon={<Users className="w-4 h-4 text-blue-600" />} />
              <Kpi
                label="Revenue"
                value={orders ? revenueText(revenueByCur) : perms.orders ? "Locked" : "—"}
                sub={orders ? `${completedOrders.length} paid orders` : perms.orders ? "Unlock in Orders tab" : "No access"}
                icon={<TrendingUp className="w-4 h-4 text-emerald-600" />}
                valueClass="text-emerald-600"
              />
              <Kpi
                label="In Production"
                value={leads.filter((l) => l.projectStatus === "In Progress" || l.projectStatus === "Proj Active").length}
                sub="Active videos"
                icon={<Video className="w-4 h-4 text-amber-600" />}
                valueClass="text-amber-600"
              />
              <Kpi
                label="Delivered"
                value={countBy(leads, "projectStatus", "Delivered")}
                sub="Completed projects"
                icon={<CheckCircle2 className="w-4 h-4 text-purple-600" />}
                valueClass="text-purple-600"
              />
              <Kpi className="col-span-2 lg:col-span-1" label="Closed Leads" value={closedCount} sub={`${conversion}% conversion`} icon={<CheckCircle2 className="w-4 h-4 text-teal-600" />} valueClass="text-teal-600" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 lg:flex-1 lg:min-h-0">
              <div className={`${card} p-5 flex flex-col lg:min-h-0 lg:col-span-5 xl:col-span-6`}>
                <CardTitle icon={<Layers className="w-4 h-4 text-blue-600" />} title="Latest inbound leads" badge={leads.length} />
                <div className="pt-4 space-y-2.5 overflow-y-auto max-h-[60vh] lg:max-h-none lg:flex-1 lg:min-h-0 pr-1">
                  {latestLeads.length ? (
                    latestLeads.map((l) => (
                      <button
                        key={l.id}
                        onClick={() => setSelectedLead(l)}
                        className="w-full flex items-center justify-between p-3 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-left"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-slate-900 truncate">{l.clientName}</span>
                            <span
                              className={`text-[11px] px-2 py-0.5 rounded-md border ${
                                l.kind === "meta" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-blue-50 text-blue-700 border-blue-200"
                              }`}
                            >
                              {l.kind === "meta" ? "Meta Ads" : l.source}
                            </span>
                          </div>
                          <div className="text-[13px] text-slate-600 mt-1 truncate">
                            {l.companyName || "Direct inquiry"} • {l.videoScope} • {fmtIst(l.createdAt)}
                          </div>
                        </div>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-700 border border-blue-200 shrink-0">{l.leadStatus}</span>
                      </button>
                    ))
                  ) : (
                    <Empty icon={<Layers className="w-6 h-6" />} title="No inbound leads yet" text="Website and Meta leads will appear here automatically." />
                  )}
                </div>
              </div>

              <div className={`${card} p-5 flex flex-col lg:min-h-0 lg:col-span-3`}>
                <CardTitle icon={<Clock className="w-4 h-4 text-purple-600" />} title="Lead pipeline by status" />
                <div className="pt-4 space-y-3 overflow-y-auto lg:flex-1 lg:min-h-0">
                  {LEAD_STATUSES.map((s) => {
                    const n = countBy(leads, "leadStatus", s);
                    const pct = leads.length ? Math.round((n / leads.length) * 100) : 0;
                    return (
                      <div key={s}>
                        <div className="flex items-center justify-between text-[13px] mb-1">
                          <span className="text-slate-700">{s}</span>
                          <span className="text-slate-600">
                            {n} <span className="text-slate-400">({pct}%)</span>
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className={`${card} p-5 flex flex-col lg:min-h-0 lg:col-span-4 xl:col-span-3`}>
                <CardTitle icon={<Globe className="w-4 h-4 text-cyan-600" />} title="Source-wise lead reporting" right={<span className="text-[13px] text-slate-600">{leads.length} total</span>} />
                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-3 pt-4 lg:flex-1 lg:min-h-0 lg:overflow-y-auto content-start">
                  {[
                    { label: "Website Inbound", n: websiteInbound, icon: <Globe className="w-4 h-4" />, tint: "bg-blue-500/10 text-blue-600", tab: "leads" as TabId, show: perms.leads },
                    { label: "Manual Entry", n: manualCount, icon: <Users className="w-4 h-4" />, tint: "bg-amber-500/10 text-amber-600", tab: "leads" as TabId, show: perms.leads },
                    { label: "Meta Ads", n: metaLeads.length, icon: <Layers className="w-4 h-4" />, tint: "bg-purple-500/10 text-purple-600", tab: "meta" as TabId, show: perms.meta },
                  ].map((s) => (
                    <div key={s.label} className="px-4 py-3 rounded-md border border-slate-200 bg-slate-50 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-md ${s.tint}`}>{s.icon}</div>
                        <div>
                          <div className="font-semibold text-sm text-slate-900">{s.label}</div>
                          <div className="text-xs text-slate-600">{leads.length ? Math.round((s.n / leads.length) * 100) : 0}% of total</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-slate-900">{s.n}</div>
                        {s.show && (
                          <button onClick={() => setActiveTab(s.tab)} className="text-xs text-blue-600 hover:text-blue-700">
                            Manage →
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>


          </div>
        )}

        {/* ---------------- WEBSITE LEADS / META LEADS ---------------- */}
        {(["leads", "meta"] as const).map((tabKey) => {
          if (activeTab !== tabKey) return null;
          const isMeta = tabKey === "meta";
          if (isMeta ? !perms.meta : !perms.leads) return null;
          const all = isMeta ? metaLeads : websiteLeads;
          const shown = isMeta ? shownMeta : shownWebsite;
          const search = isMeta ? metaSearch : leadsSearch;
          const setSearch = isMeta ? setMetaSearch : setLeadsSearch;
          const status = isMeta ? metaStatus : leadsStatus;
          const setStatus = isMeta ? setMetaStatus : setLeadsStatus;
          return (
            <div key={tabKey} className="flex flex-col gap-4 lg:h-full lg:min-h-0">
              <PageHeader
                icon={isMeta ? <Layers className="w-5 h-5 text-purple-600" /> : <Globe className="w-5 h-5 text-blue-600" />}
                title={isMeta ? "Meta Ads Leads" : "Website & Inbound Leads"}
                badge={`${all.length} leads`}
                subtitle={
                  isMeta
                    ? "Leads from Facebook & Instagram lead forms."
                    : "Inquiries from the website contact form, popup and manual entries."
                }
              >
                <button
                  onClick={() => openAddLead(isMeta ? "Meta Ads" : "Manual")}
                  className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-white text-[13px] font-semibold ${isMeta ? "bg-purple-600 hover:bg-purple-500" : "bg-blue-600 hover:bg-blue-500"}`}
                >
                  <Plus className="w-4 h-4" /> {isMeta ? "Add Meta Lead" : "Add Lead"}
                </button>
                {canExport && (
                  <button onClick={() => exportLeads(isMeta ? "meta" : "website")} className={btnGhost}>
                    <Download className="w-4 h-4" /> Export CSV
                  </button>
                )}
                {isSuperAdmin && all.length > 0 && (
                  <button onClick={() => handleClearLeads(isMeta ? "meta" : "website")} className={btnDanger}>
                    <Trash2 className="w-4 h-4" /> Delete All
                  </button>
                )}
              </PageHeader>

              <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2.5">
                {[
                  { label: "Total", n: all.length, c: "text-blue-600" },
                  { label: "New", n: countBy(all, "leadStatus", "New"), c: "text-blue-600" },
                  { label: "Contacted", n: countBy(all, "leadStatus", "Contacted"), c: "text-amber-600" },
                  { label: "In Progress", n: countBy(all, "leadStatus", "In Progress"), c: "text-orange-600" },
                  { label: "Hold", n: countBy(all, "leadStatus", "Hold"), c: "text-slate-700" },
                  { label: "Closed", n: countBy(all, "leadStatus", "Closed"), c: "text-emerald-600" },
                  { label: "Proj Active", n: countBy(all, "projectStatus", "Proj Active"), c: "text-cyan-600" },
                  { label: "Delivered", n: countBy(all, "projectStatus", "Delivered"), c: "text-purple-600" },
                ].map((k) => (
                  <div key={k.label} className="rounded-md border border-slate-200 bg-white p-3 text-center">
                    <div className="text-[11px] uppercase tracking-wider text-slate-600">{k.label}</div>
                    <div className={`text-xl font-bold mt-1 ${k.c}`}>{k.n}</div>
                  </div>
                ))}
              </div>

              <div className={`${card} p-4 flex flex-col sm:flex-row gap-2`}>
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, business, phone, email, notes..." className={`${inputCls} pl-9`} />
                </div>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputCls} sm:w-48`}>
                  <option value="All">All lead statuses</option>
                  {LEAD_STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                {(search || status !== "All") && (
                  <button
                    onClick={() => {
                      setSearch("");
                      setStatus("All");
                    }}
                    className={btnGhost}
                  >
                    Clear filter
                  </button>
                )}
              </div>

              {canDelete && (
                <BulkBar count={selectedIds.filter((id) => shown.some((l) => l.id === id)).length} onClear={() => setSelectedIds([])}>
                  <button onClick={() => handleBulkDelete(shown)} className={btnDanger}>
                    <Trash2 className="w-4 h-4" /> {isSuperAdmin ? "Delete permanently" : "Move to Recycle Bin"}
                  </button>
                </BulkBar>
              )}

              <div className={`${card} overflow-hidden flex flex-col lg:min-h-0 lg:shrink`}>
                {shown.length === 0 ? (
                  <Empty
                    icon={<Layers className="w-8 h-8" />}
                    title={all.length ? "No leads match the current filter" : "No leads yet"}
                    text={isMeta ? "Meta leads you add or receive will appear here." : "New website submissions appear here automatically."}
                  />
                ) : (
                  <div className="overflow-auto max-h-[70vh] lg:max-h-none lg:min-h-0">
                    <table className="w-full min-w-[1180px] text-left text-[13px]">
                      <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-600">
                        <tr>
                          <th className="p-3.5 w-10">
                            {canDelete && (
                              <input
                                type="checkbox"
                                aria-label="Select all"
                                checked={shown.length > 0 && shown.every((l) => selectedIds.includes(l.id))}
                                onChange={(e) => setSelectedIds(e.target.checked ? shown.map((l) => l.id) : [])}
                                className="w-4 h-4 accent-purple-600 cursor-pointer"
                              />
                            )}
                          </th>
                          <th className="p-3.5">Source</th>
                          <th className="p-3.5">Timestamp</th>
                          <th className="p-3.5">Client & Business</th>
                          <th className="p-3.5">WhatsApp / Phone</th>
                          <th className="p-3.5">Video Scope</th>
                          <th className="p-3.5">Lead Status</th>
                          <th className="p-3.5">Project Status</th>
                          <th className="p-3.5">Notes</th>
                          <th className="p-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {shown.map((l) => {
                          const checked = selectedIds.includes(l.id);
                          return (
                            <tr
                              key={l.id}
                              className={`align-top transition-colors ${
                                checked ? "bg-purple-500/[0.06]" : unseenLeadIds.includes(l.id) ? "bg-emerald-500/[0.07] shadow-[inset_3px_0_0_0_rgb(16,185,129)]" : "hover:bg-slate-50"
                              }`}
                            >
                              <td className="p-3.5">
                                {canDelete && (
                                  <input
                                    type="checkbox"
                                    aria-label={`Select ${l.clientName}`}
                                    checked={checked}
                                    onChange={(e) =>
                                      setSelectedIds((prev) => (e.target.checked ? [...prev, l.id] : prev.filter((x) => x !== l.id)))
                                    }
                                    className="w-4 h-4 accent-purple-600 cursor-pointer"
                                  />
                                )}
                              </td>
                              <td className="p-3.5">
                                <SourceBadge lead={l} />
                                {unseenLeadIds.includes(l.id) && (
                                  <div className="mt-1.5">
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500 text-[10px] font-bold text-white uppercase tracking-wide">
                                      <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse" /> New
                                    </span>
                                  </div>
                                )}
                              </td>
                              <td className="p-3.5 whitespace-nowrap">
                                <div className="text-slate-800 font-medium">{fmtIstDate(l.createdAt)}</div>
                                <div className="text-slate-600 font-mono text-xs mt-0.5">{fmtIstTime(l.createdAt)} IST</div>
                              </td>
                              <td className="p-3.5">
                                <button onClick={() => setSelectedLead(l)} className="text-left group">
                                  <div className="font-semibold text-slate-900 group-hover:text-purple-700">{l.clientName}</div>
                                  <div className="text-xs text-slate-600">{l.companyName || "—"}</div>
                                  <div className="text-xs text-slate-500">{l.email || "No email"}</div>
                                </button>
                                {isMeta && (l.campaign || l.formName) && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {l.campaign && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700">Camp: {l.campaign}</span>}
                                    {l.adSet && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">Ad: {l.adSet}</span>}
                                    {l.formName && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">Form: {l.formName}</span>}
                                  </div>
                                )}
                              </td>
                              <td className="p-3.5 whitespace-nowrap">
                                <a href={`tel:${l.phone}`} className="flex items-center gap-1.5 font-mono text-slate-800 hover:text-slate-900">
                                  <Phone className="w-3.5 h-3.5 text-slate-600" /> {l.phone}
                                </a>
                                <a
                                  href={`https://wa.me/${l.phone.replace(/[^0-9]/g, "")}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" /> Chat on WhatsApp
                                </a>
                              </td>
                              <td className="p-3.5">
                                <div className="text-slate-800 font-medium">{l.videoScope}</div>
                                {l.businessType && <div className="text-xs text-slate-500 mt-0.5">{l.businessType}</div>}
                              </td>
                              <td className="p-3.5">
                                <select
                                  value={l.leadStatus}
                                  onChange={(e) => handleLeadField(l, "leadStatus", e.target.value)}
                                  className="h-8 px-2 rounded-md bg-blue-50 border border-blue-300 text-blue-700 text-[13px] font-semibold focus:outline-none cursor-pointer"
                                >
                                  {LEAD_STATUSES.map((st) => (
                                    <option key={st}>{st}</option>
                                  ))}
                                </select>
                                {l.leadStatus === "Closed" && l.closedBy && <div className="text-[11px] text-slate-500 mt-1">by {l.closedBy}</div>}
                              </td>
                              <td className="p-3.5">
                                <select
                                  value={l.projectStatus}
                                  onChange={(e) => handleLeadField(l, "projectStatus", e.target.value)}
                                  className="h-8 px-2 rounded-md bg-amber-50 border border-amber-300 text-amber-700 text-[13px] font-semibold focus:outline-none cursor-pointer"
                                >
                                  {PROJECT_STATUSES.map((st) => (
                                    <option key={st}>{st}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="p-3.5 max-w-[240px]">
                                <div className="text-slate-600 line-clamp-2 break-words" title={l.notes}>
                                  {l.notes || "—"}
                                </div>
                              </td>
                              <td className="p-3.5">
                                <div className="flex items-center justify-end gap-1">
                                  <button onClick={() => setSelectedLead(l)} className="p-1.5 rounded hover:bg-slate-200 text-slate-600 hover:text-slate-900" title="View details">
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  {canDelete && (
                                    <button
                                      onClick={() => handleDeleteLead(l)}
                                      className="p-1.5 rounded hover:bg-red-500/10 text-red-600"
                                      title={isSuperAdmin ? "Delete permanently" : "Move to Recycle Bin"}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* ---------------- ORDERS ---------------- */}
        {activeTab === "orders" && perms.orders && orders && (
          <div className="flex flex-col gap-4 lg:h-full lg:min-h-0">
            <PageHeader icon={<Package className="w-5 h-5 text-purple-600" />} title="Orders & Payments" badge={`${orders.length} orders`} subtitle="Website checkout orders recorded in the database.">
              {canExport && (
                <button
                  onClick={() =>
                    downloadCsv("quickupp_orders.csv", [
                      ["Order ID", "Transaction ID", "Payment ref", "Customer", "Email", "Phone", "Company", "Item", "Amount", "Currency", "Status", "Created (IST)"],
                      ...shownOrders.map((o) => [o.id, o.paypalOrderId, o.captureId, o.customerName, o.customerEmail, o.customerPhone, o.customerCompany, o.itemName, o.amount, o.currency, o.paymentStatus, fmtIst(o.createdAt)]),
                    ])
                  }
                  className={btnGhost}
                >
                  <Download className="w-4 h-4" /> Export CSV
                </button>
              )}
            </PageHeader>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <Kpi label="Total Orders" value={orders.length} icon={<Package className="w-4 h-4 text-purple-600" />} />
              <Kpi label="Revenue (paid)" value={revenueText(revenueByCur)} icon={<TrendingUp className="w-4 h-4 text-emerald-600" />} valueClass="text-emerald-600" />
              <Kpi label="Completed" value={completedOrders.length} icon={<CheckCircle2 className="w-4 h-4 text-cyan-600" />} valueClass="text-cyan-600" />
              <Kpi
                label="Pending / Failed"
                value={`${orders.filter((o) => o.paymentStatus === "PENDING").length} / ${orders.filter((o) => o.paymentStatus === "FAILED" || o.paymentStatus === "CANCELLED").length}`}
                icon={<Clock className="w-4 h-4 text-amber-600" />}
                valueClass="text-amber-600"
              />
            </div>

            <div className={`${card} p-4 flex flex-col sm:flex-row gap-2`}>
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input value={ordersSearch} onChange={(e) => setOrdersSearch(e.target.value)} placeholder="Search customer, email, order ID, item..." className={`${inputCls} pl-9`} />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: "All", label: "All" },
                { id: "COMPLETED", label: "Completed" },
                { id: "PENDING", label: "Pending" },
                { id: "FAILED", label: "Failed" },
                { id: "REFUNDED", label: "Refunded" },
              ].map((f) => {
                const n =
                  f.id === "All"
                    ? orders.length
                    : orders.filter((o) => (f.id === "FAILED" ? o.paymentStatus === "FAILED" || o.paymentStatus === "CANCELLED" : o.paymentStatus === f.id)).length;
                return (
                  <button
                    key={f.id}
                    onClick={() => {
                      setOrdersStatus(f.id);
                      setSelectedIds([]);
                    }}
                    className={`h-9 px-3.5 rounded-md text-[13px] font-medium transition-colors ${
                      ordersStatus === f.id ? "bg-purple-600 text-white" : "border border-slate-200 text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {f.label} ({n})
                  </button>
                );
              })}
            </div>

            {isSuperAdmin && (
              <BulkBar count={selectedIds.filter((id) => shownOrders.some((o) => o.id === id)).length} onClear={() => setSelectedIds([])}>
                <button onClick={handleBulkOrders} className={btnDanger}>
                  <Trash2 className="w-4 h-4" /> Delete permanently
                </button>
              </BulkBar>
            )}

            <div className={`${card} overflow-hidden flex flex-col lg:min-h-0 lg:shrink`}>
              {shownOrders.length === 0 ? (
                <Empty
                  icon={<Package className="w-8 h-8" />}
                  title={
                    !orders.length
                      ? "No payment transactions yet"
                      : ordersStatus === "All"
                        ? "No orders match your search"
                        : `No ${ordersStatus === "FAILED" ? "failed" : ordersStatus.toLowerCase()} orders`
                  }
                  text={ordersStatus === "COMPLETED" && orders.length ? "Completed payments appear here. Use the filters above to see other orders." : "Checkout orders appear here automatically."}
                />
              ) : (
                <div className="overflow-auto max-h-[70vh] lg:max-h-none lg:min-h-0">
                  <table className="w-full min-w-[960px] text-left text-[13px]">
                    <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-600">
                      <tr>
                        {isSuperAdmin && (
                          <th className="p-3.5 w-10">
                            <SelectAll ids={shownOrders.map((o) => o.id)} selected={selectedIds} setSelected={setSelectedIds} />
                          </th>
                        )}
                        <th className="p-3.5">Customer</th>
                        <th className="p-3.5">Package / Item</th>
                        <th className="p-3.5">Amount</th>
                        <th className="p-3.5">Status</th>
                        <th className="p-3.5">Transaction ID</th>
                        <th className="p-3.5">Date</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {shownOrders.map((o) => (
                        <tr key={o.id} className={selectedIds.includes(o.id) ? "bg-purple-500/[0.06]" : "hover:bg-slate-50"}>
                          {isSuperAdmin && (
                            <td className="p-3.5">
                              <SelectOne id={o.id} selected={selectedIds} setSelected={setSelectedIds} />
                            </td>
                          )}
                          <td className="p-3.5">
                            <div className="font-bold text-slate-900">{o.customerName}</div>
                            <div className="text-xs text-slate-600">{o.customerEmail}</div>
                            {o.customerPhone && <div className="text-[11px] text-slate-500 font-mono">{o.customerPhone}</div>}
                          </td>
                          <td className="p-3.5">
                            <div className="font-semibold text-slate-900">{o.itemName}</div>
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-purple-50 text-purple-700 uppercase">{o.itemType}</span>
                          </td>
                          <td className="p-3.5 font-bold text-emerald-600 font-mono">{fmtMoney(o.amount, o.currency)}</td>
                          <td className="p-3.5">
                            <span className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold ${ORDER_STATUS_STYLE[o.paymentStatus] || ORDER_STATUS_STYLE["REFUNDED"]}`}>{o.paymentStatus}</span>
                          </td>
                          <td className="p-3.5 font-mono text-xs text-slate-700">{o.paypalOrderId}</td>
                          <td className="p-3.5 text-slate-600 font-mono whitespace-nowrap">{fmtIst(o.createdAt)}</td>
                          <td className="p-3.5">
                            <div className="flex items-center justify-end gap-1.5">
                              <button onClick={() => setSelectedOrder(o)} className="h-8 px-2.5 rounded-md border border-slate-200 hover:bg-slate-100 text-slate-700 text-[13px]">
                                Details
                              </button>
                              {isSuperAdmin && (
                                <button onClick={() => handleDeleteOrder(o)} className="p-1.5 rounded hover:bg-red-500/10 text-red-600" title="Delete permanently">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
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

        {/* ---------------- ACTIVITY (SUPER ADMIN) ---------------- */}
        {activeTab === "activity" && isSuperAdmin && (
          <div className="flex flex-col gap-4 lg:h-full lg:min-h-0">
            <PageHeader icon={<Clock className="w-5 h-5 text-purple-600" />} title="Activity History & Audit Log" badge="Super Admin only" subtitle="Every sign-in, lead, order, user and settings action — stored in the database.">
              <button
                onClick={() =>
                  downloadCsv("quickupp_activity.csv", [
                    ["Time (IST)", "Category", "Title", "Actor", "Description"],
                    ...shownActivity.map((a) => [fmtIst(a.createdAt), a.category, a.title, a.actorEmail, a.description]),
                  ])
                }
                className={btnGhost}
              >
                <Download className="w-4 h-4" /> Export
              </button>
              {activity.length > 0 && (
                <button
                  onClick={async () => {
                    if (!window.confirm("Permanently delete all activity history?")) return;
                    if (await call(crmClearActivityFn({ data: { token: tok() } }))) {
                      toast("Activity history cleared.");
                      doSync();
                    }
                  }}
                  className={btnDanger}
                >
                  <Trash2 className="w-4 h-4" /> Clear all
                </button>
              )}
            </PageHeader>

            <div className="flex flex-wrap items-center gap-2">
              {activityCats.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActivityFilter(cat)}
                  className={`h-9 px-3 rounded-md text-[13px] font-medium transition-colors ${
                    activityFilter === cat ? "bg-purple-600 text-white" : "border border-slate-200 text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {cat === "All" ? "All" : cat === "USER_ACTIVITY" ? "Users & sign-ins" : cat.charAt(0) + cat.slice(1).toLowerCase()} (
                  {cat === "All" ? activity.length : activity.filter((a) => a.category === cat).length})
                </button>
              ))}
            </div>

            <BulkBar count={selectedIds.filter((id) => shownActivity.some((a) => a.id === id)).length} onClear={() => setSelectedIds([])}>
              <button onClick={handleBulkActivity} className={btnDanger}>
                <Trash2 className="w-4 h-4" /> Delete selected
              </button>
            </BulkBar>

            <div className={`${card} divide-y divide-slate-100 overflow-y-auto max-h-[70vh] lg:max-h-none lg:min-h-0 lg:shrink`}>
              {shownActivity.length > 0 && (
                <label className="sticky top-0 z-10 bg-slate-50 px-5 py-2.5 flex items-center gap-3 text-xs uppercase tracking-wider text-slate-600 cursor-pointer">
                  <SelectAll ids={shownActivity.map((a) => a.id)} selected={selectedIds} setSelected={setSelectedIds} />
                  Select all ({shownActivity.length})
                </label>
              )}
              {shownActivity.length === 0 ? (
                <Empty icon={<Clock className="w-8 h-8" />} title="No activity recorded" text="Actions in the CRM are logged here." />
              ) : (
                shownActivity.map((a) => (
                  <div key={a.id} className={`px-5 py-3.5 flex items-start justify-between gap-4 ${selectedIds.includes(a.id) ? "bg-purple-500/[0.06]" : ""}`}>
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="mt-0.5">
                        <SelectOne id={a.id} selected={selectedIds} setSelected={setSelectedIds} />
                      </span>
                      <Shield className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-900 text-[13px]">{a.title}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700">{a.category}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">{a.actorEmail}</span>
                        </div>
                        <div className="text-[13px] text-slate-600 mt-1">{a.description}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-slate-600 font-mono">{fmtIst(a.createdAt)}</span>
                      <button
                        onClick={async () => {
                          if (await call(crmDeleteActivityFn({ data: { token: tok(), id: a.id } }))) setActivity((x) => x.filter((y) => y.id !== a.id));
                        }}
                        className="text-slate-500 hover:text-red-600 p-1"
                        title="Delete entry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ---------------- USERS (SUPER ADMIN) ---------------- */}
        {activeTab === "users" && isSuperAdmin && (
          <div className="flex flex-col gap-4 lg:h-full lg:min-h-0">
            <PageHeader
              icon={<UserCheck className="w-5 h-5 text-purple-600" />}
              title="User Management"
              badge="Super Admin only"
              subtitle="Create Admins and Leads Managers, unlock, deactivate or permanently delete accounts."
            >
              <button
                onClick={() => setShowCreateUserModal(true)}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-purple-600 hover:bg-purple-500 text-white text-[13px] font-semibold"
              >
                <UserPlus className="w-4 h-4" /> Create User
              </button>
            </PageHeader>

            <div className={`${card} overflow-hidden flex flex-col lg:min-h-0 lg:shrink`}>
              <div className="overflow-auto max-h-[70vh] lg:max-h-none lg:min-h-0">
                <table className="w-full min-w-[900px] text-left text-[13px]">
                  <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-600">
                    <tr>
                      <th className="p-3.5">Name</th>
                      <th className="p-3.5">Email</th>
                      <th className="p-3.5">Role</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Last sign-in</th>
                      <th className="p-3.5">Created</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50">
                        <td className="p-3.5 font-bold text-slate-900">
                          {u.name}
                          {u.id === me.id && <span className="ml-2 text-[11px] text-slate-500 font-normal">(you)</span>}
                        </td>
                        <td className="p-3.5 text-slate-700 font-mono">{u.email}</td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded border text-[11px] font-semibold ${roleBadge(u.role)}`}>{ROLE_LABEL[u.role]}</span>
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded border text-[11px] font-semibold ${
                              u.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"
                            }`}
                          >
                            {u.status === "ACTIVE" ? "Active" : "Deactivated"}
                          </span>
                          {u.lockedUntil && (
                            <div className="mt-1 text-[11px] text-red-700">Locked until {fmtIst(u.lockedUntil)}</div>
                          )}
                        </td>
                        <td className="p-3.5 text-slate-600 font-mono whitespace-nowrap">{fmtIst(u.lastLoginAt)}</td>
                        <td className="p-3.5 text-slate-600 font-mono whitespace-nowrap">{fmtIst(u.createdAt)}</td>
                        <td className="p-3.5">
                          <div className="flex items-center justify-end gap-2">
                            {u.lockedUntil && (
                              <button
                                onClick={() => handleUnlockUser(u)}
                                className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-blue-200 text-blue-700 hover:bg-blue-500/10"
                              >
                                <Lock className="w-3.5 h-3.5" /> Unlock
                              </button>
                            )}
                            {u.isProtected || u.role === "SUPER_ADMIN" ? (
                              <span className="inline-flex items-center gap-1 text-slate-500 text-xs px-2">
                                <Lock className="w-3 h-3" /> Protected
                              </span>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleToggleUser(u)}
                                  className={`h-8 px-2.5 rounded-md border ${
                                    u.status === "ACTIVE" ? "border-amber-200 text-amber-700 hover:bg-amber-500/10" : "border-emerald-200 text-emerald-700 hover:bg-emerald-500/10"
                                  }`}
                                >
                                  {u.status === "ACTIVE" ? "Deactivate" : "Activate"}
                                </button>
                                <button onClick={() => handleDeleteUser(u)} className="p-1.5 rounded text-red-600 hover:bg-red-500/10" title="Delete permanently">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
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

        {/* ---------------- SETTINGS (SUPER ADMIN) ---------------- */}
        {activeTab === "settings" && isSuperAdmin && (
          <div className="flex flex-col gap-4">
            <PageHeader
              icon={<Settings className="w-5 h-5 text-purple-600" />}
              title="CRM Settings & Control Center"
              badge="Super Admin only"
              subtitle="Platform settings, role permissions, live record counts and security policies."
            >
              {(settingsSubTab === "general" || settingsSubTab === "security") && (
                <button
                  onClick={handleSaveConfig}
                  disabled={!configDirty || busy === "config"}
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[13px] font-semibold"
                >
                  <CheckCircle2 className="w-4 h-4" /> {busy === "config" ? "Saving..." : configDirty ? "Save Settings" : "Saved"}
                </button>
              )}
            </PageHeader>

            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: "general", label: "1. CRM Settings" },
                { id: "rbac", label: "2. Permissions Matrix" },
                { id: "records", label: "3. Access All Records" },
                { id: "security", label: "4. Security Settings" },
              ].map((st) => (
                <button
                  key={st.id}
                  onClick={() => setSettingsSubTab(st.id as typeof settingsSubTab)}
                  className={`h-9 px-3.5 rounded-md text-[13px] font-medium transition-colors ${
                    settingsSubTab === st.id ? "bg-purple-600 text-white" : "border border-slate-200 text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {settingsSubTab === "general" && (
              <div className={`${card} p-4 sm:p-6 space-y-6`}>
                <div>
                  <h2 className="font-semibold text-slate-900 text-sm">General platform settings</h2>
                  <p className="text-[13px] text-slate-600 mt-0.5">Saved to the database and applied to every signed-in user.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="CRM title" hint="Shown in the CRM header.">
                    <input value={configDraft.crmTitle} onChange={(e) => updateConfigDraft({ crmTitle: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Login alert email" hint="Failed sign-in and account-lock alerts are sent here. New-lead emails go to qsaistudio@gmail.com.">
                    <input type="email" value={configDraft.alertEmail} onChange={(e) => updateConfigDraft({ alertEmail: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Live data refresh interval">
                    <select value={configDraft.pollingSeconds} onChange={(e) => updateConfigDraft({ pollingSeconds: Number(e.target.value) })} className={inputCls}>
                      <option value={10}>Every 10 seconds (recommended)</option>
                      <option value={30}>Every 30 seconds</option>
                      <option value={60}>Every 60 seconds</option>
                    </select>
                  </Field>
                </div>
                <div className="flex items-center justify-between gap-4 p-4 rounded-md border border-slate-200 bg-slate-50">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={configDraft.audioChimeEnabled}
                      onChange={(e) => updateConfigDraft({ audioChimeEnabled: e.target.checked })}
                      className="w-4 h-4 accent-purple-600"
                    />
                    <div>
                      <div className="text-[13px] font-semibold text-slate-900">Sound alert for new leads</div>
                      <div className="text-xs text-slate-600">Plays a chime when a new lead arrives.</div>
                    </div>
                  </label>
                  <button onClick={playAudioChime} className={btnGhost}>
                    Test sound
                  </button>
                </div>
              </div>
            )}

            {settingsSubTab === "rbac" && (
              <div className={`${card} p-4 sm:p-6 space-y-4`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-slate-900 text-sm">Role-Based Access Control (RBAC)</h2>
                    <p className="text-[13px] text-slate-600 mt-0.5">
                      Click an Admin / Leads Manager cell to allow or block it, then save. Changes apply live to signed-in users within one refresh and are enforced by the server.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {matrixDirty && <span className="text-xs text-amber-700">Unsaved changes</span>}
                    <button
                      onClick={() => {
                        setMatrixDraft(DEFAULT_MATRIX);
                        setMatrixDirty(JSON.stringify(DEFAULT_MATRIX) !== JSON.stringify(serverMatrix));
                      }}
                      className={btnGhost}
                    >
                      <RotateCcw className="w-4 h-4" /> Defaults
                    </button>
                    <button
                      onClick={handleSaveMatrix}
                      disabled={!matrixDirty || busy === "matrix"}
                      className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[13px] font-semibold"
                    >
                      <CheckCircle2 className="w-4 h-4" /> {busy === "matrix" ? "Saving..." : "Save Permissions"}
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-md border border-slate-200">
                  <table className="w-full min-w-[720px] text-left text-[13px]">
                    <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-600">
                      <tr>
                        <th className="p-3">Module / capability</th>
                        <th className="p-3">Super Admin</th>
                        <th className="p-3">Admin</th>
                        <th className="p-3">Leads Manager</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {PERMISSION_ROWS.map((row) => (
                        <tr key={row.key} className="hover:bg-slate-50">
                          <td className="p-3">
                            <div className="font-medium text-slate-900">{row.module}</div>
                            <div className="text-[11px] text-slate-500">{row.location}</div>
                          </td>
                          <td className="p-3 text-emerald-600 font-semibold">
                            {row.key === "delete_leads" ? "Permanent delete" : row.locked === "always" ? "Always allowed" : "Allowed"}
                          </td>
                          {(["ADMIN", "LEADS_MANAGER"] as ManagedRole[]).map((role) => {
                            const allowed = matrixDraft[row.key][role];
                            if (row.locked) {
                              return (
                                <td key={role} className="p-3">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold border ${
                                      row.locked === "always" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"
                                    }`}
                                  >
                                    <Lock className="w-3 h-3" /> {row.locked === "always" ? "Always allowed" : "Super Admin only"}
                                  </span>
                                </td>
                              );
                            }
                            const label = allowed ? (row.key === "delete_leads" ? "Soft-delete only" : "Allowed") : "No access";
                            return (
                              <td key={role} className="p-3">
                                <button
                                  onClick={() => {
                                    const next = { ...matrixDraft, [row.key]: { ...matrixDraft[row.key], [role]: !allowed } };
                                    setMatrixDraft(next);
                                    setMatrixDirty(JSON.stringify(next) !== JSON.stringify(serverMatrix));
                                  }}
                                  className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition-colors ${
                                    allowed
                                      ? row.key === "delete_leads"
                                        ? "bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100"
                                        : "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
                                      : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                                  }`}
                                >
                                  {label}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {settingsSubTab === "records" && (
              <div className={`${card} p-4 sm:p-6 space-y-5`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-slate-900 text-sm">Live database record counters</h2>
                    <p className="text-[13px] text-slate-600 mt-0.5">Counted directly from the database every {config.pollingSeconds} seconds.</p>
                  </div>
                  <button onClick={() => doSync()} className={btnGhost}>
                    <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} /> Refresh now
                  </button>
                </div>
                {counts && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-3 sm:gap-4">
                    <RecordCard label="Active leads" value={counts.activeLeads} sub={`${counts.websiteLeads} website • ${counts.metaLeads} Meta`} />
                    <RecordCard label="Recycle Bin" value={counts.recycleBin} sub="Soft-deleted leads" />
                    <RecordCard label="Total orders" value={counts.totalOrders} sub={`${counts.completedOrders} completed • ${counts.pendingOrders} pending • ${counts.failedOrders} failed`} />
                    <RecordCard label="Total revenue" value={revenueText(counts.revenueByCurrency)} sub="Completed payments" valueClass="text-emerald-600" />
                    <RecordCard label="User accounts" value={counts.userAccounts} sub={`${counts.activeUsers} active • ${counts.inactiveUsers} deactivated`} />
                    <RecordCard label="Activity logs" value={counts.activityLogs} sub="Audit history entries" />
                  </div>
                )}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[13px] text-slate-600 pt-3 border-t border-slate-200">
                  <span className="flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5" /> {counts?.database || "Database"} • Last counted{" "}
                    {counts ? new Date(counts.countedAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true }) : "—"}
                  </span>
                  <span className={`flex items-center gap-1.5 ${online ? "text-emerald-600" : "text-red-600"}`}>
                    <span className={`w-2 h-2 rounded-full ${online ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
                    {online ? "Online & healthy" : "Database unreachable"}
                  </span>
                </div>
              </div>
            )}

            {settingsSubTab === "security" && (
              <div className={`${card} p-4 sm:p-6 space-y-6`}>
                <div>
                  <h2 className="font-semibold text-slate-900 text-sm">Security policies</h2>
                  <p className="text-[13px] text-slate-600 mt-0.5">Applied to every account. Save with the button above.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Field label="Inactivity auto sign-out" hint={`In effect: ${config.inactivityMinutes} minutes`}>
                    <select value={configDraft.inactivityMinutes} onChange={(e) => updateConfigDraft({ inactivityMinutes: Number(e.target.value) })} className={inputCls}>
                      <option value={10}>10 minutes</option>
                      <option value={20}>20 minutes</option>
                      <option value={30}>30 minutes</option>
                    </select>
                  </Field>
                  <Field label="Lock account after" hint={`In effect: ${config.failedLoginThreshold} failed attempts in a row`}>
                    <select value={configDraft.failedLoginThreshold} onChange={(e) => updateConfigDraft({ failedLoginThreshold: Number(e.target.value) })} className={inputCls}>
                      <option value={3}>3 failed attempts (strict)</option>
                      <option value={5}>5 failed attempts</option>
                    </select>
                  </Field>
                  <Field
                    label="First lockout duration (Admin & Leads Manager)"
                    hint={`Each further lock gets longer: ${LOCKOUT_OPTIONS.filter((o) => o.minutes >= config.lockoutMinutes)
                      .slice(0, 4)
                      .map((o) => o.label)
                      .join(" → ")} → … → 24 hours. Super Admin is never locked.`}
                  >
                    <select value={configDraft.lockoutMinutes} onChange={(e) => updateConfigDraft({ lockoutMinutes: Number(e.target.value) })} className={inputCls}>
                      {LOCKOUT_OPTIONS.map((o) => (
                        <option key={o.minutes} value={o.minutes}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div className="p-4 rounded-md border border-slate-200 bg-slate-50 text-[13px] text-slate-600 space-y-1">
                  <div className="text-slate-900 font-semibold">How sessions are protected</div>
                  <div>• When any account (including Super Admin) reaches {config.failedLoginThreshold} wrong passwords in a row, an alert is emailed to {config.alertEmail} — not on every single failure.</div>
                  <div>• The sign-in page tells the user how many attempts are left (e.g. "2 attempts left", "1 attempt left").</div>
                  <div>• After {config.failedLoginThreshold} wrong passwords an Admin / Leads Manager is locked for {lockoutLabel(config.lockoutMinutes)}; every further lock is longer (up to 24 hours) until they sign in successfully. Unlock them early from User Management.</div>
                  <div>• The Super Admin account is never locked — reaching the limit only sends the alert email.</div>
                  <div>• Users are signed out automatically after {config.inactivityMinutes} minutes of inactivity.</div>
                  <div>• Deactivating or deleting a user signs them out on their next refresh (within {config.pollingSeconds}s).</div>
                  <div>• The Orders tab PIN is set with the ADMIN_PAYMENT_PIN server variable in Hostinger.</div>
                </div>
                <div className="p-4 rounded-md border border-slate-200 bg-slate-50 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-[13px] font-semibold text-slate-900">Check login alert emails</div>
                      <div className="text-xs text-slate-600 mt-0.5">Sends a test email to {config.alertEmail} and shows whether it was delivered.</div>
                    </div>
                    <button onClick={handleTestAlertEmail} disabled={busy === "test-email"} className={btnGhost}>
                      <Bell className="w-4 h-4" /> {busy === "test-email" ? "Sending..." : "Send test alert email"}
                    </button>
                  </div>
                  {emailTest && (
                    <div
                      className={`p-3 rounded-md text-xs border ${
                        emailTest.success ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"
                      }`}
                    >
                      {emailTest.success ? (
                        <>✓ Sent to {emailTest.to} via {emailTest.via}. Check that inbox (and spam).</>
                      ) : (
                        <>
                          <div className="font-semibold mb-1">✗ Could not send to {emailTest.to}:</div>
                          {emailTest.errors.map((er, i) => (
                            <div key={i} className="font-mono break-all">
                              {er}
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ---------------- RECYCLE BIN ---------------- */}
        {activeTab === "recycle-bin" && perms.recycle_bin && (
          <div className="flex flex-col gap-4 lg:h-full lg:min-h-0">
            <PageHeader
              icon={<Trash2 className="w-5 h-5 text-red-600" />}
              title="Recycle Bin"
              badge={`${recycleBin.length} items`}
              subtitle={
                isSuperAdmin
                  ? "Leads soft-deleted by Admins / Leads Managers. Restore them, or delete permanently from the database."
                  : "Leads you or your team deleted. Restore them here — only the Super Admin can delete permanently."
              }
            >
              {isSuperAdmin && recycleBin.length > 0 && (
                <button onClick={handleEmptyBin} className={btnDanger}>
                  <Trash2 className="w-4 h-4" /> Empty Recycle Bin
                </button>
              )}
            </PageHeader>

            <BulkBar count={selectedIds.filter((id) => recycleBin.some((l) => l.id === id)).length} onClear={() => setSelectedIds([])}>
              <button onClick={handleBulkRestore} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-[13px] font-semibold">
                <RotateCcw className="w-4 h-4" /> Restore selected
              </button>
              {isSuperAdmin && (
                <button onClick={handleBulkPurge} className={btnDanger}>
                  <Trash2 className="w-4 h-4" /> Delete permanently
                </button>
              )}
            </BulkBar>

            <div className={`${card} overflow-hidden flex flex-col lg:min-h-0 lg:shrink`}>
              {recycleBin.length === 0 ? (
                <Empty icon={<Trash2 className="w-8 h-8" />} title="Recycle Bin is empty" text="Soft-deleted leads appear here." />
              ) : (
                <div className="overflow-auto max-h-[70vh] lg:max-h-none lg:min-h-0">
                  <table className="w-full min-w-[860px] text-left text-[13px]">
                    <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-600">
                      <tr>
                        <th className="p-3.5 w-10">
                          <SelectAll ids={recycleBin.map((l) => l.id)} selected={selectedIds} setSelected={setSelectedIds} />
                        </th>
                        <th className="p-3.5">Type</th>
                        <th className="p-3.5">Name</th>
                        <th className="p-3.5">Phone / Email</th>
                        <th className="p-3.5">Video Scope</th>
                        <th className="p-3.5">Deleted by</th>
                        <th className="p-3.5">Deleted on</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {recycleBin.map((l) => (
                        <tr key={l.id} className={selectedIds.includes(l.id) ? "bg-purple-500/[0.06]" : "hover:bg-slate-50"}>
                          <td className="p-3.5">
                            <SelectOne id={l.id} selected={selectedIds} setSelected={setSelectedIds} />
                          </td>
                          <td className="p-3.5 text-slate-600">{l.kind === "meta" ? "Meta lead" : "Website lead"}</td>
                          <td className="p-3.5 font-bold text-slate-900">{l.clientName}</td>
                          <td className="p-3.5 text-slate-700">
                            <div className="font-mono">{l.phone}</div>
                            <div className="text-xs text-slate-500">{l.email}</div>
                          </td>
                          <td className="p-3.5 text-slate-600">{l.videoScope}</td>
                          <td className="p-3.5 text-slate-600 font-mono">{l.deletedBy || "—"}</td>
                          <td className="p-3.5 text-slate-500 font-mono whitespace-nowrap">{fmtIst(l.deletedAt)}</td>
                          <td className="p-3.5">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => handleRestore(l)} className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-semibold">
                                <RotateCcw className="w-3.5 h-3.5" /> Restore
                              </button>
                              {isSuperAdmin && (
                                <button onClick={() => handlePurge(l)} className="p-1.5 rounded text-red-600 hover:bg-red-500/10" title="Delete permanently">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
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
      </main>

      {/* ===================== MODALS ===================== */}
      {showPinModal && (
        <Modal onClose={() => setShowPinModal(false)} title="Unlock Orders & Payments" subtitle="Enter the security PIN to view orders and revenue." icon={<Lock className="w-5 h-5" />}>
          <form onSubmit={handleUnlockPin} className="space-y-4">
            <Field label="Security PIN">
              <div className="relative">
                <input
                  type={showPinText ? "text" : "password"}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="Enter PIN"
                  autoFocus
                  className={`${inputCls} pr-10`}
                />
                <button type="button" onClick={() => setShowPinText(!showPinText)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-900">
                  {showPinText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {pinError && <p className="text-xs text-red-600 mt-1">{pinError}</p>}
            </Field>
            <ModalActions onCancel={() => setShowPinModal(false)} submitLabel="Unlock" />
          </form>
        </Modal>
      )}

      {showAddLeadModal && (
        <Modal
          onClose={() => setShowAddLeadModal(false)}
          title={leadForm.source === "Meta Ads" ? "Add New Meta Lead" : "Add New Manual Lead"}
          subtitle="Saved straight to the database."
          icon={<Plus className="w-5 h-5" />}
          size="xl"
        >
          <form onSubmit={handleAddLead} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <Field label="Lead Source *">
                <select value={leadForm.source} onChange={(e) => setLeadForm({ ...leadForm, source: e.target.value })} className={inputCls}>
                  {LEAD_SOURCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Client Full Name *">
                <input required value={leadForm.clientName} onChange={(e) => setLeadForm({ ...leadForm, clientName: e.target.value })} placeholder="e.g. Rahul Sharma" className={inputCls} />
              </Field>
              <Field label="Company / Brand Name *">
                <input required value={leadForm.business} onChange={(e) => setLeadForm({ ...leadForm, business: e.target.value })} placeholder="e.g. Sharma Foods" className={inputCls} />
              </Field>
              <Field label="Website">
                <input value={leadForm.website} onChange={(e) => setLeadForm({ ...leadForm, website: e.target.value })} placeholder="https://brand.in" className={inputCls} />
              </Field>
              <Field label="WhatsApp / Phone *">
                <input required value={leadForm.phone} onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })} placeholder="+91 98765 43210" inputMode="tel" className={inputCls} />
              </Field>
              <Field label="Email Address">
                <input type="email" value={leadForm.email} onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })} placeholder="client@company.com" className={inputCls} />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <Field label="Industry">
                <select value={leadForm.industry} onChange={(e) => setLeadForm({ ...leadForm, industry: e.target.value })} className={inputCls}>
                  <option value="">Select industry</option>
                  {LEAD_INDUSTRIES.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </Field>
              <Field label="Location / City">
                <input value={leadForm.location} onChange={(e) => setLeadForm({ ...leadForm, location: e.target.value })} placeholder="e.g. Pune, Maharashtra" className={inputCls} />
              </Field>
              <Field label="Video Type / Need *">
                <select value={leadForm.videoScope} onChange={(e) => setLeadForm({ ...leadForm, videoScope: e.target.value })} className={inputCls}>
                  {LEAD_VIDEO_TYPES.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </Field>
              <Field label="Video Quantity / Monthly Volume">
                <select value={leadForm.quantity} onChange={(e) => setLeadForm({ ...leadForm, quantity: e.target.value })} className={inputCls}>
                  {LEAD_QUANTITIES.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </Field>
            </div>

            {leadForm.source === "Meta Ads" && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 rounded-md border border-purple-200 bg-purple-500/[0.04] p-3">
                <Field label="Channel">
                  <select value={leadForm.channel} onChange={(e) => setLeadForm({ ...leadForm, channel: e.target.value })} className={inputCls}>
                    <option>Facebook</option>
                    <option>Instagram</option>
                  </select>
                </Field>
                <Field label="Campaign">
                  <input value={leadForm.campaign} onChange={(e) => setLeadForm({ ...leadForm, campaign: e.target.value })} placeholder="Campaign name" className={inputCls} />
                </Field>
                <Field label="Ad Set">
                  <input value={leadForm.adSet} onChange={(e) => setLeadForm({ ...leadForm, adSet: e.target.value })} placeholder="Ad set" className={inputCls} />
                </Field>
                <Field label="Form Name">
                  <input value={leadForm.formName} onChange={(e) => setLeadForm({ ...leadForm, formName: e.target.value })} placeholder="Lead form" className={inputCls} />
                </Field>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <Field label="Initial Lead Status">
                <select value={leadForm.leadStatus} onChange={(e) => setLeadForm({ ...leadForm, leadStatus: e.target.value })} className={inputCls}>
                  {LEAD_STATUSES.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </Field>
              <Field label="Project Status">
                <select value={leadForm.projectStatus} onChange={(e) => setLeadForm({ ...leadForm, projectStatus: e.target.value })} className={inputCls}>
                  {PROJECT_STATUSES.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </Field>
              <Field label="Delivery Target Date">
                <input type="date" value={leadForm.deliveryDate} onChange={(e) => setLeadForm({ ...leadForm, deliveryDate: e.target.value })} className={`${inputCls} [color-scheme:light]`} />
              </Field>
            </div>

            <Field label="Internal Notes & Scope">
              <textarea
                rows={3}
                value={leadForm.notes}
                onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })}
                placeholder="Add specific requirements, deadlines, or client preferences..."
                className="w-full px-3 py-2 rounded-md border border-slate-200 bg-white text-[13px] text-slate-900 placeholder-slate-400 resize-y focus:outline-none focus:border-purple-500"
              />
            </Field>
            <div className="border-t border-slate-200 pt-4">
              <ModalActions onCancel={() => setShowAddLeadModal(false)} submitLabel={busy === "add-lead" ? "Saving..." : "Save Lead"} disabled={busy === "add-lead"} />
            </div>
          </form>
        </Modal>
      )}

      {showCreateUserModal && (
        <Modal onClose={() => setShowCreateUserModal(false)} title="Create User" subtitle="Admins and Leads Managers sign in with this email and password." icon={<UserPlus className="w-5 h-5" />}>
          <form onSubmit={handleCreateUser} className="space-y-3.5">
            <Field label="Full name">
              <input required value={newUserForm.name} onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })} placeholder="e.g. Sanjay Verma" className={inputCls} />
            </Field>
            <Field label="Email">
              <input type="email" required value={newUserForm.email} onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })} placeholder="sanjay@aistudio.in" className={inputCls} />
            </Field>
            <Field label="Password" hint="At least 6 characters.">
              <div className="relative">
                <input
                  type={showNewUserPw ? "text" : "password"}
                  required
                  minLength={6}
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                  className={`${inputCls} pr-10`}
                />
                <button type="button" onClick={() => setShowNewUserPw(!showNewUserPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-900">
                  {showNewUserPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </Field>
            <Field label="Role">
              <select value={newUserForm.role} onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value as ManagedRole })} className={inputCls}>
                <option value="ADMIN">Admin</option>
                <option value="LEADS_MANAGER">Leads Manager</option>
              </select>
            </Field>
            <ModalActions onCancel={() => setShowCreateUserModal(false)} submitLabel={busy === "create-user" ? "Creating..." : "Create User"} disabled={busy === "create-user"} />
          </form>
        </Modal>
      )}

      {selectedLead && (() => {
        const l = leads.find((x) => x.id === selectedLead.id) || recycleBin.find((x) => x.id === selectedLead.id) || selectedLead;
        const initials = l.clientName
          .split(/\s+/)
          .map((w) => w.charAt(0))
          .join("")
          .slice(0, 2)
          .toUpperCase();
        const waLink = `https://wa.me/${l.phone.replace(/[^0-9]/g, "")}`;
        const editable = !l.deletedAt;
        const sourceLabel = l.kind === "meta" ? `Meta Ads (${l.channel || "Facebook"})` : l.source === "Manual Entry" ? "Manual Entry" : displayLeadSource(l.source);
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-2 sm:p-6"
            onMouseDown={(e) => e.target === e.currentTarget && setSelectedLead(null)}
          >
            <div className="w-full max-w-5xl max-h-[94vh] sm:max-h-[90vh] flex flex-col rounded-lg border border-slate-200 bg-white shadow-2xl overflow-hidden">
              {/* Header — always visible */}
              <div className="shrink-0 px-4 sm:px-6 py-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 shrink-0 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-sm font-bold text-white">
                    {initials || "?"}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold text-slate-900 truncate">{l.clientName}</h3>
                      <SourceBadge lead={l} />
                      {l.deletedAt && <span className="text-xs px-2 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-200">In Recycle Bin</span>}
                    </div>
                    <p className="text-[13px] text-slate-600 truncate mt-0.5">
                      {l.companyName || "No company"} · Received {fmtIst(l.createdAt)} IST
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a href={`tel:${l.phone}`} className={btnGhost} title="Call">
                    <Phone className="w-4 h-4" /> <span className="hidden sm:inline">Call</span>
                  </a>
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[13px] font-semibold"
                  >
                    <MessageSquare className="w-4 h-4" /> <span className="hidden sm:inline">WhatsApp</span>
                  </a>
                  {l.email && (
                    <a href={`mailto:${l.email}`} className={btnGhost} title="Email">
                      <Mail className="w-4 h-4" /> <span className="hidden sm:inline">Email</span>
                    </a>
                  )}
                  <button onClick={() => setSelectedLead(null)} className={iconBtn} title="Close">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Status strip — change status right here */}
              <div className="shrink-0 px-4 sm:px-6 py-3 border-b border-slate-200 bg-slate-50/70 grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Lead status</div>
                  <select
                    value={l.leadStatus}
                    disabled={!editable}
                    onChange={(e) => handleLeadField(l, "leadStatus", e.target.value)}
                    className="w-full h-9 px-2.5 rounded-md bg-blue-50 border border-blue-300 text-blue-700 text-[13px] font-semibold focus:outline-none disabled:opacity-60"
                  >
                    {LEAD_STATUSES.map((st) => (
                      <option key={st}>{st}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Project status</div>
                  <select
                    value={l.projectStatus}
                    disabled={!editable}
                    onChange={(e) => handleLeadField(l, "projectStatus", e.target.value)}
                    className="w-full h-9 px-2.5 rounded-md bg-amber-50 border border-amber-300 text-amber-700 text-[13px] font-semibold focus:outline-none disabled:opacity-60"
                  >
                    {PROJECT_STATUSES.map((st) => (
                      <option key={st}>{st}</option>
                    ))}
                  </select>
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Handled by</div>
                  <div className="h-9 flex items-center text-sm font-medium text-slate-900 truncate">{l.handledBy || "Not assigned yet"}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Closed</div>
                  <div className="h-9 flex items-center text-sm font-medium text-slate-900 truncate">
                    {l.leadStatus === "Closed" && l.closedAt ? `${fmtIst(l.closedAt)}${l.closedBy ? ` · ${l.closedBy}` : ""}` : "Not closed"}
                  </div>
                </div>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
                  <DetailCard icon={<User className="w-4 h-4" />} title="Client Information">
                    <DetailRow label="Client name" value={l.clientName} />
                    <DetailRow label="Company / brand" value={l.companyName || "—"} />
                    <DetailRow
                      label="Phone / WhatsApp"
                      value={
                        <a href={`tel:${l.phone}`} className="text-slate-900 hover:text-purple-700">
                          {l.phone}
                        </a>
                      }
                    />
                    <DetailRow
                      label="Email"
                      value={
                        l.email ? (
                          <a href={`mailto:${l.email}`} className="text-slate-900 hover:text-purple-700 break-all">
                            {l.email}
                          </a>
                        ) : (
                          "—"
                        )
                      }
                    />
                    {l.website ? (
                      <DetailRow
                        label="Website"
                        value={
                          <a
                            href={/^https?:\/\//i.test(l.website) ? l.website : `https://${l.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-900 hover:text-purple-700 break-all"
                          >
                            {l.website}
                          </a>
                        }
                      />
                    ) : null}
                    <DetailRow label="Location" value={l.location || "—"} />
                    <DetailRow label="Industry" value={l.businessType || "—"} />
                  </DetailCard>

                  <DetailCard icon={<Shield className="w-4 h-4" />} title="Lead Information">
                    <DetailRow label="Source" value={sourceLabel} />
                    <DetailRow label="Received" value={`${fmtIst(l.createdAt)} IST`} />
                    <DetailRow label="Lead status" value={<StatusPill text={l.leadStatus} />} />
                    <DetailRow label="Closed by" value={l.leadStatus === "Closed" && l.closedBy ? l.closedBy : "Not closed"} />
                    <DetailRow label="Handled by" value={l.handledBy || "Not assigned yet"} />
                    {l.kind === "meta" ? (
                      <>
                        <DetailRow label="Campaign" value={l.campaign || "—"} />
                        <DetailRow label="Ad set / form" value={[l.adSet, l.formName].filter(Boolean).join(" · ") || "—"} />
                      </>
                    ) : (
                      <DetailRow label="Lead ID" value={<span className="font-mono text-xs text-slate-600">{l.id}</span>} />
                    )}
                  </DetailCard>
                </div>

                <DetailCard icon={<Video className="w-4 h-4" />} title="Project & Creative Requirement" right={<StatusPill text={l.projectStatus} tone="amber" />}>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-md bg-slate-50 border border-slate-100">
                    <MiniStat label="Requirement / format" value={l.videoScope} />
                    <MiniStat label="Video quantity" value={l.videoQuantity || "—"} />
                    <MiniStat
                      label="Delivery target"
                      value={l.deliveryTarget ? fmtIstDate(`${l.deliveryTarget}T12:00:00+05:30`) : "Not set"}
                    />
                    <MiniStat label="Delivered on" value={l.deliveredAt ? fmtIst(l.deliveredAt) : "Not delivered yet"} />
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Project details / campaign goals</div>
                    <div className="px-4 py-3 rounded-md bg-slate-50 border border-slate-200 text-sm leading-relaxed text-slate-800 whitespace-pre-wrap break-words">
                      {l.notes || <span className="text-slate-500">No details were provided with this enquiry.</span>}
                    </div>
                  </div>
                </DetailCard>

                <DetailCard icon={<Calendar className="w-4 h-4" />} title="Meeting Information" right={<StatusPill text="Not scheduled" tone="slate" />}>
                  <p className="text-sm text-slate-600">No meeting has been scheduled for this lead yet. Call or WhatsApp the client using the buttons at the top to set one up.</p>
                </DetailCard>

                <DetailCard icon={<Clock className="w-4 h-4" />} title="Activity History & Audit Trail">
                  {leadHistory === null ? (
                    <div className="text-sm text-slate-500">Loading history…</div>
                  ) : (
                    <ol className="relative border-l border-slate-200 ml-1.5 space-y-4">
                      {leadHistory.map((h) => (
                        <li key={h.id} className="pl-5 relative">
                          <span className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-purple-500" />
                          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-0.5 sm:gap-4">
                            <div className="text-sm font-semibold text-slate-900">{h.title}</div>
                            <div className="text-xs text-slate-500 shrink-0">{fmtIst(h.createdAt)}</div>
                          </div>
                          <div className="text-[13px] text-slate-600 mt-0.5 break-words">{h.description}</div>
                        </li>
                      ))}
                      <li className="pl-5 relative">
                        <span className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-slate-300" />
                        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-0.5 sm:gap-4">
                          <div className="text-sm font-semibold text-slate-900">Lead received</div>
                          <div className="text-xs text-slate-500 shrink-0">{fmtIst(l.createdAt)}</div>
                        </div>
                        <div className="text-[13px] text-slate-600 mt-0.5">Submitted via {sourceLabel}.</div>
                      </li>
                    </ol>
                  )}
                </DetailCard>
              </div>
            </div>
          </div>
        );
      })()}

      {selectedOrder && (
        <Modal onClose={() => setSelectedOrder(null)} title={selectedOrder.itemName} subtitle={`${selectedOrder.customerName} • ${selectedOrder.customerEmail}`} icon={<Package className="w-5 h-5" />} wide>
          <div className="space-y-3 text-[13px]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-md bg-slate-50 border border-slate-200">
              <Info label="Amount" value={fmtMoney(selectedOrder.amount, selectedOrder.currency)} />
              <Info label="Status" value={selectedOrder.paymentStatus} />
              <Info label="Transaction ID" value={selectedOrder.paypalOrderId} />
              <Info label="Payment ref" value={selectedOrder.captureId || "—"} />
              <Info label="Phone" value={selectedOrder.customerPhone || "—"} />
              <Info label="Company" value={selectedOrder.customerCompany || "—"} />
              <Info label="Item type" value={selectedOrder.itemType} />
              <Info label="Created" value={fmtIst(selectedOrder.createdAt)} />
            </div>
            {isSuperAdmin && (
              <div className="flex justify-end">
                <button onClick={() => handleDeleteOrder(selectedOrder)} className={btnDanger}>
                  <Trash2 className="w-4 h-4" /> Delete permanently
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Toasts + new-lead alerts */}
      <div className="fixed bottom-5 right-5 z-[60] space-y-2 w-[min(380px,calc(100vw-40px))]">
        {notifAlerts.slice(0, 3).map(({ key, item }) => {
          const tone =
            item.type === "lead"
              ? { box: "border-emerald-300 bg-white/95", icon: "bg-emerald-500/15 text-emerald-700", label: "text-emerald-700", text: "New lead received" }
              : { box: "border-purple-300 bg-white/95", icon: "bg-purple-500/15 text-purple-700", label: "text-purple-700", text: item.title };
          return (
            <div key={key} className={`rounded-md border backdrop-blur shadow-2xl p-3.5 flex items-start gap-3 animate-in slide-in-from-right-4 fade-in ${tone.box}`}>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${tone.icon}`}>
                <Bell className="w-4 h-4" />
              </div>
              <button
                className="flex-1 min-w-0 text-left"
                onClick={() => {
                  openNotif(item);
                  dismissAlert(key);
                }}
              >
                <div className={`text-[11px] font-bold uppercase tracking-wider ${tone.label}`}>{tone.text}</div>
                <div className="text-sm font-semibold text-slate-900 truncate mt-0.5">{item.lead ? item.lead.clientName : item.title}</div>
                <div className="text-xs text-slate-600 truncate">{item.sub}</div>
                <div className={`text-xs mt-1 opacity-80 ${tone.label}`}>View details →</div>
              </button>
              <button
                onClick={() => {
                  markRead([item.id]); // closing the card counts as seen: it won't come back
                  dismissAlert(key);
                }}
                className="text-slate-500 hover:text-slate-900 p-0.5"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
        {notifAlerts.length > 3 && (
          <button
            onClick={() => setShowNotifications(true)}
            className="w-full rounded-md border border-slate-200 bg-white/95 backdrop-blur shadow-2xl px-4 py-2.5 text-left text-[13px] text-slate-800 hover:bg-slate-50"
          >
            +{notifAlerts.length - 3} more notification{notifAlerts.length - 3 === 1 ? "" : "s"} · <span className="text-cyan-700">View all</span>
          </button>
        )}
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-3 rounded-md border text-[13px] shadow-2xl backdrop-blur ${
              t.kind === "error"
                ? "bg-red-50 border-red-300 text-red-700"
                : t.kind === "info"
                  ? "bg-white border-slate-200 text-slate-800"
                  : "bg-emerald-50 border-emerald-300 text-emerald-700"
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Presentational pieces
// ---------------------------------------------------------------------------
function PageHeader({
  icon,
  title,
  subtitle,
  badge,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  badge?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`${card} p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4`}>
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-slate-900 flex flex-wrap items-center gap-2.5">
          {icon}
          {title}
          {badge && <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-700 border border-purple-200">{badge}</span>}
        </h1>
        <p className="text-sm text-slate-600 mt-1">{subtitle}</p>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2 shrink-0">{children}</div>}
    </div>
  );
}

function CardTitle({ icon, title, badge, right }: { icon: React.ReactNode; title: string; badge?: number; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between pb-3 border-b border-slate-200">
      <div className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wider text-slate-700">
        {icon}
        {title}
        {badge !== undefined && <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-blue-500/20 text-blue-700">{badge}</span>}
      </div>
      {right}
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  icon,
  valueClass = "text-slate-900",
  className = "",
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon: React.ReactNode;
  valueClass?: string;
  className?: string;
}) {
  return (
    <div className={`${card} p-4 ${className}`}>
      <div className="flex items-center justify-between text-slate-600 text-xs uppercase tracking-wider">
        <span>{label}</span>
        {icon}
      </div>
      <div className={`text-xl sm:text-2xl font-bold mt-2 truncate ${valueClass}`}>{value}</div>
      {sub && <div className="text-xs text-slate-600 mt-0.5">{sub}</div>}
    </div>
  );
}

function RecordCard({ label, value, sub, valueClass = "text-slate-900" }: { label: string; value: React.ReactNode; sub: string; valueClass?: string }) {
  return (
    <div className="p-4 rounded-md border border-slate-200 bg-slate-50">
      <div className="text-xs text-slate-600 uppercase tracking-wider">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${valueClass}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-1">{sub}</div>
    </div>
  );
}

function Empty({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="p-14 text-center">
      <div className="mx-auto mb-3 text-slate-400 flex justify-center">{icon}</div>
      <div className="font-semibold text-sm text-slate-700">{title}</div>
      <div className="text-[13px] text-slate-500 mt-1 max-w-sm mx-auto">{text}</div>
    </div>
  );
}

function BulkBar({ count, onClear, children }: { count: number; onClear: () => void; children: React.ReactNode }) {
  if (!count) return null;
  return (
    <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-md border border-purple-200 bg-purple-50">
      <span className="text-sm text-purple-700 font-medium">{count} selected</span>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={onClear} className={btnGhost}>
          Clear selection
        </button>
        {children}
      </div>
    </div>
  );
}

function SelectAll({ ids, selected, setSelected }: { ids: string[]; selected: string[]; setSelected: React.Dispatch<React.SetStateAction<string[]>> }) {
  const all = ids.length > 0 && ids.every((id) => selected.includes(id));
  return (
    <input
      type="checkbox"
      aria-label="Select all"
      checked={all}
      onChange={(e) => setSelected(e.target.checked ? Array.from(new Set([...selected, ...ids])) : selected.filter((id) => !ids.includes(id)))}
      className="w-4 h-4 accent-purple-600 cursor-pointer"
    />
  );
}

function SelectOne({ id, selected, setSelected }: { id: string; selected: string[]; setSelected: React.Dispatch<React.SetStateAction<string[]>> }) {
  return (
    <input
      type="checkbox"
      aria-label="Select row"
      checked={selected.includes(id)}
      onChange={(e) => setSelected((prev) => (e.target.checked ? [...prev, id] : prev.filter((x) => x !== id)))}
      className="w-4 h-4 accent-purple-600 cursor-pointer"
    />
  );
}

function SourceBadge({ lead }: { lead: LeadItem }) {
  const label = lead.kind === "meta" ? `Meta • ${lead.channel || "Facebook"}` : lead.source === "Manual Entry" ? "Manual" : displayLeadSource(lead.source);
  const tone =
    lead.kind === "meta"
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : lead.source === "Manual Entry"
        ? "bg-purple-50 text-purple-700 border-purple-200"
        : "bg-emerald-50 text-emerald-700 border-emerald-200";
  return <span className={`inline-block whitespace-nowrap px-2 py-0.5 rounded-md text-xs font-semibold border ${tone}`}>{label}</span>;
}

function StatusPill({ text, tone = "blue" }: { text: string; tone?: "blue" | "amber" | "slate" }) {
  const c =
    tone === "amber"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : tone === "slate"
        ? "bg-slate-100 text-slate-700 border-slate-200"
        : "bg-blue-50 text-blue-700 border-blue-200";
  return <span className={`inline-block px-2.5 py-0.5 rounded-md text-[13px] font-semibold border ${c}`}>{text}</span>;
}

function DetailCard({ icon, title, right, children }: { icon: React.ReactNode; title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 pb-3 mb-3 border-b border-slate-200">
        <div className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-slate-800">
          <span className="text-purple-600">{icon}</span>
          {title}
        </div>
        {right}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] sm:grid-cols-[160px_1fr] items-start gap-3 text-sm py-0.5">
      <span className="text-slate-600">{label}</span>
      <span className="text-slate-900 font-medium text-right min-w-0 break-words">{value}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-sm font-semibold text-slate-900 mt-1 break-words">{value}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[13px] font-medium text-slate-700 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="text-slate-500 block text-[11px] uppercase">{label}</span>
      <span className="text-slate-900 font-medium break-words">{value}</span>
    </div>
  );
}

function Modal({
  title,
  subtitle,
  icon,
  onClose,
  wide,
  size,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
  size?: "xl";
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`w-full ${size === "xl" ? "max-w-3xl" : wide ? "max-w-lg" : "max-w-md"} max-h-[90vh] overflow-y-auto rounded-lg border border-slate-200 bg-white p-5 sm:p-6 shadow-2xl relative`}>
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-600 hover:text-slate-900">
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3 mb-5 pr-6">
          <div className="p-2.5 rounded-md bg-purple-50 text-purple-600 border border-purple-200 shrink-0">{icon}</div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 truncate">{title}</h3>
            {subtitle && <p className="text-[13px] text-slate-600">{subtitle}</p>}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalActions({ onCancel, submitLabel, disabled }: { onCancel: () => void; submitLabel: string; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-end gap-2 pt-1">
      <button type="button" onClick={onCancel} className={btnGhost}>
        Cancel
      </button>
      <button type="submit" disabled={disabled} className="h-9 px-5 rounded-md bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-[13px] font-semibold">
        {submitLabel}
      </button>
    </div>
  );
}
