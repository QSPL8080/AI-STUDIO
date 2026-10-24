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
  Share2,
  Shield,
  Tag,
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
  Check,
  Copy,
  Percent,
  Filter,
  Pencil,
  Paperclip,
  FileText,
  Upload,
  Wallet,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
} from "lucide-react";
import { CrmUser, clearStoredCrmUser, setStoredCrmUser } from "@/lib/crm-auth";
import {
  crmClearActivityFn,
  crmClearLeadsFn,
  crmCreateLeadFn,
  crmListLeadFilesFn,
  crmBeginLeadFileFn,
  crmLeadFileChunkFn,
  crmFinishLeadFileFn,
  crmDownloadLeadFileFn,
  crmDeleteLeadFileFn,
  crmCancelLeadFileFn,
  crmCreateUserFn,
  crmCreateCouponFn,
  crmDeleteCouponFn,
  crmGetCouponsFn,
  crmCreateDirectOrderFn,
  crmMarkOrderPaidFn,
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
  crmUpdateUserFn,
  crmSyncFn,
  crmUnlockOrdersFn,
  crmUpdateLeadFn,
} from "@/lib/crm-actions";
import { INDIA_SERVICES, INDIA_PACKS, quoteItem, formatInr, TWIN_SETUP_ID, splitPayment } from "@/lib/india-pricing";
import {
  DEFAULT_CONFIG,
  DEFAULT_MATRIX,
  LOCKOUT_OPTIONS,
  lockoutLabel,
  PERMISSION_ROWS,
  ROLE_LABEL,
  type CrmConfig,
  type CrmRole,
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
const PROJECT_STATUSES = ["Not Started", "In Progress", "Proj Active", "On Hold", "Delivered", "Cancelled"];

// ---- Lead filters (Leads + Meta Leads tabs) ----
type LeadFilter = {
  source: string;
  leadStatus: string;
  projectStatus: string;
  videoType: string;
  closedBy: string;
  dateField: "created" | "closed" | "delivery";
  from: string;
  to: string;
};
const blankLeadFilter = (): LeadFilter => ({
  source: "All",
  leadStatus: "All",
  projectStatus: "All",
  videoType: "All",
  closedBy: "All",
  dateField: "created",
  from: "",
  to: "",
});
const isFilterActive = (f: LeadFilter) =>
  f.source !== "All" || f.leadStatus !== "All" || f.projectStatus !== "All" || f.videoType !== "All" || f.closedBy !== "All" || !!f.from || !!f.to;
const WEBSITE_SOURCE_FILTERS = ["India Website - Contact Form", "India Website - Popup", "Manual"];
const META_CHANNEL_FILTERS = ["Meta Ads", "Facebook Ads", "Instagram Ads"];
const VIDEO_TYPE_FILTERS: { label: string; match: RegExp }[] = [
  { label: "AI UGC", match: /ugc/i },
  { label: "AI Avatar", match: /avatar/i },
  { label: "Cartoon", match: /cartoon|animation/i },
  { label: "Hyper Realistic", match: /hyper/i },
  { label: "Digital Twin", match: /twin|clone/i },
];
function leadSourceFilter(l: LeadItem) {
  if (l.kind === "meta") {
    const c = `${l.channel || ""} ${l.source || ""}`.toLowerCase();
    return c.includes("instagram") ? "Instagram Ads" : c.includes("facebook") ? "Facebook Ads" : "Meta Ads";
  }
  const base = displayLeadSource(String(l.source || "").replace(/\s*\(CRM\)$/, ""));
  if (base === "IND - Contact Form") return "India Website - Contact Form";
  if (base === "IND - Popup Modal") return "India Website - Popup";
  return "Manual";
}
function leadVideoFilter(l: LeadItem) {
  return VIDEO_TYPE_FILTERS.find((v) => v.match.test(l.videoScope || ""))?.label || "Other";
}
// Calendar day (yyyy-mm-dd) in India time, for the date range filter.
function istDay(value?: string | null) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}
// ---- Orders & Payments period (All time / one month / From → To), India time ----
type OrdersPeriod = { mode: "all" | "month" | "range"; month: string; from: string; to: string };
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const thisIstMonth = () => istDay(new Date().toISOString()).slice(0, 7);
function shiftMonth(month: string, by: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return `${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][m! - 1]} ${y}`;
}
function dayLabel(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return `${d} ${MONTH_NAMES[m! - 1]} ${y}`;
}
function periodMatch(p: OrdersPeriod, iso?: string | null) {
  if (p.mode === "all") return true;
  const d = istDay(iso);
  if (!d) return false;
  if (p.mode === "month") return d.slice(0, 7) === p.month;
  if (p.from && d < p.from) return false;
  if (p.to && d > p.to) return false;
  return true;
}
function periodLabel(p: OrdersPeriod) {
  if (p.mode === "month") return monthLabel(p.month);
  if (p.mode === "range" && (p.from || p.to)) {
    if (p.from && p.to) return `${dayLabel(p.from)} – ${dayLabel(p.to)}`;
    return p.from ? `From ${dayLabel(p.from)}` : `Until ${dayLabel(p.to)}`;
  }
  return "All time";
}
type LeadOrderRow = { lead: LeadItem; deal: number; received: number; due: number; cat: "COMPLETED" | "BALANCE" | "NOT_PAID" };
function sumLeadOrders(list: LeadOrderRow[]) {
  return list.reduce(
    (t, o) => ({
      received: t.received + o.received,
      due: t.due + o.due,
      count: t.count + 1,
      full: t.full + (o.cat === "COMPLETED" ? 1 : 0),
      fullAmount: t.fullAmount + (o.cat === "COMPLETED" ? o.received : 0),
      partial: t.partial + (o.cat === "BALANCE" ? 1 : 0),
      partialDue: t.partialDue + (o.cat === "BALANCE" ? o.due : 0),
      partialReceived: t.partialReceived + (o.cat === "BALANCE" ? o.received : 0),
      notPaid: t.notPaid + (o.cat === "NOT_PAID" ? 1 : 0),
      notPaidDue: t.notPaidDue + (o.cat === "NOT_PAID" ? o.due : 0),
    }),
    { received: 0, due: 0, count: 0, full: 0, fullAmount: 0, partial: 0, partialDue: 0, partialReceived: 0, notPaid: 0, notPaidDue: 0 },
  );
}

function applyLeadFilter(list: LeadItem[], q: string, f: LeadFilter, resolveName?: (name?: string | null, id?: string | null) => string) {
  const s = q.trim().toLowerCase();
  return list.filter((l) => {
    if (f.source !== "All" && leadSourceFilter(l) !== f.source) return false;
    if (f.leadStatus !== "All" && l.leadStatus !== f.leadStatus) return false;
    if (f.projectStatus !== "All" && l.projectStatus !== f.projectStatus) return false;
    if (f.videoType !== "All" && leadVideoFilter(l) !== f.videoType) return false;
    const effectiveClosedBy = resolveName ? resolveName(l.closedBy, l.closedById) : l.closedBy;
    if (f.closedBy !== "All" && (l.leadStatus !== "Closed" || effectiveClosedBy !== f.closedBy)) return false;
    if (f.from || f.to) {
      const raw = f.dateField === "closed" ? l.closedAt : f.dateField === "delivery" ? l.deliveredAt || l.deliveryTarget : l.createdAt;
      const day = istDay(raw);
      if (!day) return false;
      if (f.from && day < f.from) return false;
      if (f.to && day > f.to) return false;
    }
    if (!s) return true;
    return [l.clientName, l.email, l.phone, l.companyName, l.notes, l.videoScope, l.campaign, l.location].some((v) => (v || "").toLowerCase().includes(s));
  });
}

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
// Payment recorded on a lead (manual entry / edit).
const LEAD_PAYMENT_STATUSES = ["Not Paid", "Partially Paid", "Full Paid"];
const PAYMENT_BADGE: Record<string, string> = {
  "Not Paid": "bg-slate-100 text-slate-600 border-slate-300",
  "Partially Paid": "bg-orange-50 text-orange-700 border-orange-300",
  "Full Paid": "bg-emerald-50 text-emerald-700 border-emerald-400",
};
const cleanMoney = (v: unknown) => {
  const n = Math.round(Number(String(v ?? "").replace(/[^0-9.]/g, "")) * 100) / 100;
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Same checks as the server, so problems show before anything is sent. */
function paymentFormProblem(f: { paymentStatus: string; dealAmount: string; amountPaid: string; balanceReceived: boolean }) {
  const deal = cleanMoney(f.dealAmount);
  const paid = cleanMoney(f.amountPaid);
  if ((f.paymentStatus === "Partially Paid" || f.paymentStatus === "Full Paid") && !deal) return "Enter the total deal amount for the payment.";
  if (f.paymentStatus === "Partially Paid") {
    if (!paid) return "Enter the amount paid for a Partially Paid lead.";
    if (paid >= deal) return "Amount paid must be less than the total deal amount — choose Full Paid instead.";
  }
  return "";
}

/** Money actually received on a lead, and what is still due. */
function leadReceived(l: { paymentStatus?: string; dealAmount?: number | string; amountPaid?: number | string; paymentReceived?: boolean | string; balanceReceived?: boolean | string }) {
  const deal = cleanMoney(l.dealAmount);
  const paid = cleanMoney(l.amountPaid);
  const pr = l.paymentReceived === true || /^(yes|true|1)$/i.test(String(l.paymentReceived ?? ""));
  const br = l.balanceReceived === true || /^(yes|true|1)$/i.test(String(l.balanceReceived ?? ""));
  const got =
    l.paymentStatus === "Full Paid"
      ? pr || br
        ? deal || paid
        : 0
      : l.paymentStatus === "Partially Paid"
        ? (pr ? paid : 0) + (br ? Math.max(0, deal - paid) : 0)
        : 0;
  return { received: got, due: Math.max(0, deal - got) };
}
const inr = (n: number) => `₹${Math.round(n * 100) / 100 >= 0 ? (Math.round(n * 100) / 100).toLocaleString("en-IN") : "0"}`;

// Lead attachments: PNG, JPG, PDF, DOC/DOCX, CSV up to 10 MB each (uploaded in 512 KB pieces).
const LEAD_FILE_EXTS = ["png", "jpg", "jpeg", "pdf", "doc", "docx", "csv"];
const LEAD_FILE_ACCEPT = ".png,.jpg,.jpeg,.pdf,.doc,.docx,.csv";
const LEAD_FILE_MAX = 10 * 1024 * 1024;
const LEAD_FILE_CHUNK = 512 * 1024;
const fileSizeLabel = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
/** Returns an error message, or "" when the file can be attached. */
function leadFileProblem(f: File) {
  const ext = (f.name.split(".").pop() || "").toLowerCase();
  if (!LEAD_FILE_EXTS.includes(ext)) return `"${f.name}": only PNG, JPG, PDF, DOC, DOCX and CSV files can be attached.`;
  if (f.size > LEAD_FILE_MAX) return `"${f.name}" is larger than 10 MB.`;
  if (!f.size) return `"${f.name}" is empty.`;
  return "";
}
function bytesToBase64(bytes: Uint8Array) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
  return btoa(bin);
}
/** Uploads one file to a lead. Returns "" on success or the error message. */
async function uploadLeadFile(token: string, leadId: string, file: File, onProgress?: (pct: number) => void): Promise<string> {
  try {
    const chunks = Math.ceil(file.size / LEAD_FILE_CHUNK);
    const begin: any = await crmBeginLeadFileFn({ data: { token, leadId, name: file.name, size: file.size, chunks } });
    if (!begin?.ok) return begin?.error || "Upload failed.";
    // If anything goes wrong part-way, the unfinished file is removed (nothing half-saved).
    const fail = async (msg: string) => {
      await crmCancelLeadFileFn({ data: { token, fileId: begin.fileId } }).catch(() => null);
      return msg;
    };
    const buf = new Uint8Array(await file.arrayBuffer());
    for (let i = 0; i < chunks; i++) {
      const data = bytesToBase64(buf.subarray(i * LEAD_FILE_CHUNK, (i + 1) * LEAD_FILE_CHUNK));
      let r: any = null;
      for (let attempt = 0; attempt < 3 && !r?.ok; attempt++) {
        r = await crmLeadFileChunkFn({ data: { token, fileId: begin.fileId, idx: i, data } }).catch(() => null);
        if (r && r.ok === false) return fail(r.error || "Upload failed.");
      }
      if (!r?.ok) return fail("Upload interrupted. Please check your connection and try again.");
      onProgress?.(Math.round(((i + 1) / chunks) * 100));
    }
    const fin: any = await crmFinishLeadFileFn({ data: { token, fileId: begin.fileId } }).catch(() => null);
    return fin?.ok ? "" : fail(fin?.error || "Upload failed.");
  } catch (e) {
    console.error(e);
    return "Upload failed. Please try again.";
  }
}

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
  projectStatus: "Not Started",
  handledBy: "",
  closedBy: "",
  deliveryDate: "",
  notes: "",
  channel: "Facebook",
  campaign: "",
  adSet: "",
  formName: "",
  paymentStatus: "Not Paid",
  dealAmount: "",
  amountPaid: "",
  paymentReceived: false,
  balanceReceived: false,
});

// Status dropdown colours: Closed / Delivered are green, the rest blue (lead) / amber (project).
const GREEN_STATUS = "bg-emerald-50 border-emerald-400 text-emerald-700";
const leadStatusCls = (s: string) => (s === "Closed" ? GREEN_STATUS : "bg-blue-50 border-blue-300 text-blue-700");
const projectStatusCls = (s: string) => (s === "Delivered" ? GREEN_STATUS : "bg-amber-50 border-amber-300 text-amber-700");

const ORDER_STATUS_STYLE: Record<string, string> = {
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-300",
  PENDING: "bg-amber-50 text-amber-700 border-amber-300",
  FAILED: "bg-red-50 text-red-700 border-red-300",
  CANCELLED: "bg-slate-100 text-slate-600 border-slate-300",
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

// Compact control for the lead filter bar (no w-full, so widths stay fixed and items sit inline).
const filterCtl =
  "h-9 shrink-0 rounded-md border border-slate-200 bg-white px-2.5 text-[13px] text-slate-900 focus:outline-none focus:border-purple-500 [color-scheme:light]";

type TabId = "dashboard" | "leads" | "meta" | "coupons" | "orders" | "activity" | "users" | "settings" | "recycle-bin";
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
  const [coupons, setCoupons] = useState<any[]>([]);
  const [orders, setOrders] = useState<OrderItem[] | null>(null);
  const [ordersCount, setOrdersCount] = useState(0);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [orderEvents, setOrderEvents] = useState<ActivityItem[]>([]);
  const [counts, setCounts] = useState<RecordCounts | null>(null);
  const [serverMatrix, setServerMatrix] = useState<PermissionMatrix>(DEFAULT_MATRIX);

  const resolveUser = (nameOrId?: string | null, id?: string | null): string => {
    const cleanId = (id || "").trim();
    if (cleanId) {
      const match = users.find((u) => u.id === cleanId) || (me.id === cleanId ? me : null);
      if (match?.name) return match.name;
    }
    const clean = String(nameOrId || "").trim();
    if (!clean) return "";
    const matchById = users.find((u) => u.id === clean) || (me.id === clean ? me : null);
    if (matchById?.name) return matchById.name;
    const matchByEmail = users.find((u) => u.email.toLowerCase() === clean.toLowerCase()) || (me.email.toLowerCase() === clean.toLowerCase() ? me : null);
    if (matchByEmail?.name) return matchByEmail.name;
    const matchByName = users.find((u) => u.name.toLowerCase() === clean.toLowerCase()) || (me.name.toLowerCase() === clean.toLowerCase() ? me : null);
    if (matchByName?.name) return matchByName.name;

    // Legacy fallback: if clean is "Test Admin", alias to active admin
    if (clean.toLowerCase() === "test admin") {
      const admin = users.find((u) => u.email === "test@aistudio.in" || u.role === "ADMIN") || (me.role === "ADMIN" ? me : null);
      if (admin?.name && admin.name.toLowerCase() !== "test admin") return admin.name;
    }

    return clean;
  };

  // Coupon Generator state
  const [couponPreset, setCouponPreset] = useState<number>(10);
  const [customDiscount, setCustomDiscount] = useState<string>("");
  const [customCodeInput, setCustomCodeInput] = useState<string>("");
  const [isCreatingCoupon, setIsCreatingCoupon] = useState<boolean>(false);
  const [couponFilter, setCouponFilter] = useState<"all" | "active" | "used">("all");
  const [couponSearch, setCouponSearch] = useState<string>("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // On-Call Client Order Modal state
  const [showOnCallModal, setShowOnCallModal] = useState(false);
  const [onCallForm, setOnCallForm] = useState({
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    clientCompany: "",
    serviceId: "ai-ugc",
    qty: 1,
    paymentPlan: "full" as "full" | "advance",
    discountPercent: 10,
    customDiscount: "",
    customCode: "",
    paidOnCall: false,
    notes: "",
  });
  const [onCallBusy, setOnCallBusy] = useState(false);
  const [onCallCreatedOrder, setOnCallCreatedOrder] = useState<any>(null);
  const [copiedPayUrl, setCopiedPayUrl] = useState(false);

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
  const [leadsFilter, setLeadsFilter] = useState<LeadFilter>(blankLeadFilter);
  const [leadsDraft, setLeadsDraft] = useState<LeadFilter>(blankLeadFilter);
  const [metaSearch, setMetaSearch] = useState("");
  const [metaFilter, setMetaFilter] = useState<LeadFilter>(blankLeadFilter);
  const [metaDraft, setMetaDraft] = useState<LeadFilter>(blankLeadFilter);
  const [ordersSearch, setOrdersSearch] = useState("");
  const [ordersStatus, setOrdersStatus] = useState("All");
  // Opens on the current month (India time): October in October, November in November…
  const [ordersPeriod, setOrdersPeriod] = useState<OrdersPeriod>(() => ({ mode: "month", month: thisIstMonth(), from: "", to: "" }));
  // When a new month starts while the CRM is open, move along with it — unless someone has
  // chosen a different month / range / All time themselves.
  const periodMonthRef = useRef(thisIstMonth());
  useEffect(() => {
    const check = setInterval(() => {
      const now = thisIstMonth();
      if (now === periodMonthRef.current) return;
      const prev = periodMonthRef.current;
      periodMonthRef.current = now;
      setOrdersPeriod((p) => (p.mode === "month" && p.month === prev ? { ...p, month: now } : p));
    }, 60 * 1000);
    return () => clearInterval(check);
  }, []);
  const [activityFilter, setActivityFilter] = useState("All");

  // Modals
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadItem | null>(null);
  const [leadHistory, setLeadHistory] = useState<ActivityItem[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null);

  const [leadForm, setLeadForm] = useState(() => blankLeadForm("Manual"));
  const [addLeadFiles, setAddLeadFiles] = useState<File[]>([]);
  const [uploadNote, setUploadNote] = useState("");
  const openAddLead = (source: string) => {
    setLeadForm(blankLeadForm(source));
    setAddLeadFiles([]);
    setUploadNote("");
    setShowAddLeadModal(true);
  };
  const [editingLead, setEditingLead] = useState<LeadItem | null>(null);
  const [editLeadForm, setEditLeadForm] = useState(() => blankLeadForm("Website"));
  const openEditLead = (l: LeadItem) => {
    setEditingLead(l);
    setEditLeadForm({
      source: l.source || "Website",
      clientName: l.clientName || "",
      business: l.companyName || "",
      website: l.website || "",
      phone: l.phone || "",
      email: l.email || "",
      industry: l.businessType || "",
      location: l.location || "",
      videoScope: l.videoScope || "AI Video",
      quantity: l.videoQuantity || "1 Video",
      leadStatus: l.leadStatus || "New",
      projectStatus: l.projectStatus || "Not Started",
      handledBy: l.handledBy || me.name || "Admin",
      closedBy: l.closedBy || (l.leadStatus === "Closed" ? (me.name || "Admin") : ""),
      deliveryDate: l.deliveryTarget || "",
      notes: l.notes || "",
      channel: l.channel || "Facebook",
      campaign: l.campaign || "",
      adSet: l.adSet || "",
      formName: l.formName || "",
      paymentStatus: l.paymentStatus || "Not Paid",
      dealAmount: l.dealAmount ? String(l.dealAmount) : "",
      amountPaid: l.amountPaid ? String(l.amountPaid) : "",
      paymentReceived: !!l.paymentReceived,
      balanceReceived: !!l.balanceReceived,
    });
  };
  const [newUserForm, setNewUserForm] = useState({ name: "", email: "", password: "", role: "ADMIN" as ManagedRole });
  const [showNewUserPw, setShowNewUserPw] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [editUserForm, setEditUserForm] = useState<{
    name: string;
    email: string;
    role: CrmRole;
    status: "ACTIVE" | "INACTIVE";
    password: string;
  }>({ name: "", email: "", role: "ADMIN", status: "ACTIVE", password: "" });
  const [showEditUserPw, setShowEditUserPw] = useState(false);

  const openEditUser = (u: UserItem) => {
    setEditingUser(u);
    setEditUserForm({
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      password: "",
    });
    setShowEditUserPw(false);
  };

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
      const sortedLeads = [...r.leads].sort((a: LeadItem, b: LeadItem) => String(b.createdAt).localeCompare(String(a.createdAt)));
      setLeads(sortedLeads);
      setSelectedLead((prev) => (prev ? (sortedLeads.find((x) => x.id === prev.id) || prev) : null));
      setRecycleBin(r.recycleBin);
      if (r.coupons) setCoupons(r.coupons);
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
  // Lead orders: every lead with a payment status or an amount written (Not Paid included).
  // Grouped by the money actually received: none → Not Paid, part → Partially Paid, all → Full Paid.
  const leadOrders = useMemo(() => {
    const out: LeadOrderRow[] = [];
    for (const l of leads) {
      if (l.deletedAt) continue;
      const deal = cleanMoney(l.dealAmount);
      if (!deal && l.paymentStatus !== "Partially Paid" && l.paymentStatus !== "Full Paid") continue;
      const r = leadReceived(l);
      const due = Math.max(0, deal - r.received);
      out.push({ lead: l, deal, received: r.received, due, cat: r.received <= 0 ? "NOT_PAID" : due > 0 ? "BALANCE" : "COMPLETED" });
    }
    return out.sort((x, y) => (y.lead.createdAt || "").localeCompare(x.lead.createdAt || ""));
  }, [leads]);
  const leadPay = useMemo(() => sumLeadOrders(leadOrders), [leadOrders]);
  const effectiveOrdersCount = (orders ? orders.length : ordersCount) + leadPay.count;

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

  // Lead link from a WhatsApp / email alert (/crm?lead=<id>): open that lead once it is loaded.
  useEffect(() => {
    if (!loaded) return;
    let id = "";
    try {
      id = new URLSearchParams(window.location.search).get("lead") || sessionStorage.getItem("crm_open_lead") || "";
    } catch {
      /* ignore */
    }
    if (!id) return;
    try {
      sessionStorage.removeItem("crm_open_lead");
      const url = new URL(window.location.href);
      url.searchParams.delete("lead");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    } catch {
      /* ignore */
    }
    const lead = leads.find((l) => l.id === id);
    if (lead) {
      setActiveTab(lead.kind === "meta" ? "meta" : "leads");
      setSelectedLead(lead);
      markRead([lead.id]);
    } else {
      toast("This lead is not available to your account (it may have been deleted).", "info");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

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
    if (perms.coupons) list.push({ id: "coupons", label: "Coupon Generator", icon: Tag, count: coupons.filter((c) => c.active).length });
    if (perms.orders) list.push({ id: "orders", label: "Orders & Payments", icon: Package, count: effectiveOrdersCount });
    if (isSuperAdmin) {
      list.push(
        { id: "activity", label: "Activity History", icon: Clock, count: null },
        { id: "users", label: "User Management", icon: UserCheck, count: users.length },
        { id: "settings", label: "CRM Settings", icon: Settings, count: null },
      );
    }
    if (perms.recycle_bin) list.push({ id: "recycle-bin", label: "Recycle Bin", icon: Trash2, count: recycleBin.length });
    return list;
  }, [perms, isSuperAdmin, websiteLeads.length, metaLeads.length, coupons, effectiveOrdersCount, users.length, recycleBin.length]);

  useEffect(() => setSelectedIds([]), [activeTab]);

  // Orders & Payments re-locks as soon as the user leaves the tab: the PIN is needed every time.
  useEffect(() => {
    if (activeTab !== "orders" && ordersPinRef.current) {
      ordersPinRef.current = "";
      setOrders(null);
      setSelectedOrder(null);
      setOrdersStatus("All");
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
    const payErr = paymentFormProblem(f);
    if (payErr) {
      toast(payErr, "error");
      return;
    }
    const isMetaLead = f.source === "Meta Ads";
    setBusy("add-lead");
    const r = await call(crmCreateLeadFn({ data: { token: tok(), lead: { kind: isMetaLead ? "meta" : "website", ...f } } }));
    setBusy(null);
    if (!r) return;
    if (r.lead) {
      setLeads((prev) => [r.lead, ...prev.filter((l) => l.id !== r.lead.id)]);
    }
    // Your own manual entry doesn't need to notify you.
    knownNotifIds.current?.add(r.lead.id);
    setNotif((st) => (st ? { ...st, readIds: [r.lead.id, ...st.readIds] } : st));
    crmMarkNotificationsFn({ data: { token: tok(), ids: [r.lead.id] } }).catch(() => null);
    // Attach the chosen files to the new lead.
    let failed: string[] = [];
    if (addLeadFiles.length) {
      setBusy("add-lead");
      for (let i = 0; i < addLeadFiles.length; i++) {
        const file = addLeadFiles[i]!;
        setUploadNote(`Uploading ${i + 1}/${addLeadFiles.length}: ${file.name}`);
        const err = await uploadLeadFile(tok(), r.lead.id, file, (pct) =>
          setUploadNote(`Uploading ${i + 1}/${addLeadFiles.length}: ${file.name} (${pct}%)`),
        );
        if (err) failed.push(err);
      }
      setUploadNote("");
      setBusy(null);
    }
    if (failed.length) toast(`Lead saved, but ${failed.length} file(s) could not be attached: ${failed[0]}`, "error");
    else
      toast(
        `${isMetaLead ? "Meta lead" : "Lead"} saved to database${addLeadFiles.length ? ` with ${addLeadFiles.length} file${addLeadFiles.length > 1 ? "s" : ""}` : ""}.`,
      );
    setAddLeadFiles([]);
    setShowAddLeadModal(false);
    doSync();
  };

  const handleSaveEditLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLead) return;
    const f = editLeadForm;
    if (!f.clientName.trim() || !f.business.trim() || !f.phone.trim()) {
      toast("Client name, company / brand and WhatsApp / phone are required.", "error");
      return;
    }
    const payErr = paymentFormProblem(f);
    if (payErr) {
      toast(payErr, "error");
      return;
    }
    setBusy("edit-lead");
    const currentUserName = me.name || "Admin";
    const finalHandledBy = f.handledBy?.trim() || editingLead.handledBy || currentUserName;
    const finalClosedBy = f.leadStatus === "Closed" ? (f.closedBy?.trim() || editingLead.closedBy || currentUserName) : "";
    const nowIso = new Date().toISOString();
    const optimisticLead: Partial<LeadItem> = {
      clientName: f.clientName,
      companyName: f.business,
      phone: f.phone,
      email: f.email,
      website: f.website,
      businessType: f.industry,
      location: f.location,
      videoScope: f.videoScope,
      videoQuantity: f.quantity,
      leadStatus: f.leadStatus,
      projectStatus: f.projectStatus,
      deliveryTarget: f.deliveryDate,
      notes: f.notes,
      source: f.source,
      channel: f.channel,
      campaign: f.campaign,
      adSet: f.adSet,
      formName: f.formName,
      handledBy: finalHandledBy,
      closedBy: finalClosedBy,
      closedAt: f.leadStatus === "Closed" ? (editingLead.closedAt || nowIso) : null,
      deliveredAt: f.projectStatus === "Delivered" ? (editingLead.deliveredAt || nowIso) : null,
      paymentStatus: f.paymentStatus,
      dealAmount: cleanMoney(f.dealAmount),
      amountPaid: cleanMoney(f.amountPaid),
      paymentReceived: f.paymentReceived,
      balanceReceived: f.balanceReceived,
    };
    setLeads((prev) => prev.map((l) => (l.id === editingLead.id ? { ...l, ...optimisticLead } : l)));
    setSelectedLead((prev) => (prev && prev.id === editingLead.id ? { ...prev, ...optimisticLead } : null));

    const r = await call(
      crmUpdateLeadFn({
        data: {
          token: tok(),
          id: editingLead.id,
          ...f,
          handledBy: finalHandledBy,
          closedBy: finalClosedBy,
        },
      })
    );
    setBusy(null);
    if (!r) return;
    toast("Lead details updated successfully.");
    setEditingLead(null);
    doSync();
  };

  const handleLeadField = async (lead: LeadItem, field: "leadStatus" | "projectStatus", value: string) => {
    const nowIso = new Date().toISOString();
    const currentUserName = me.name || "Admin";
    const updates: Partial<LeadItem> = { [field]: value };
    let closedByParam: string | undefined = undefined;

    if (field === "leadStatus") {
      if (value === "Closed") {
        // The person closing it now is recorded (the server does the same).
        updates.closedBy = lead.leadStatus === "Closed" ? lead.closedBy || currentUserName : currentUserName;
        updates.closedAt = lead.leadStatus === "Closed" ? lead.closedAt || nowIso : nowIso;
        closedByParam = updates.closedBy;
      } else {
        updates.closedBy = "";
        updates.closedAt = null;
      }
    }
    if (field === "projectStatus") {
      if (value === "Delivered") {
        updates.deliveredAt = lead.projectStatus === "Delivered" ? lead.deliveredAt || nowIso : nowIso;
        updates.deliveredBy = lead.projectStatus === "Delivered" ? lead.deliveredBy || currentUserName : currentUserName;
      } else {
        updates.deliveredAt = null;
        updates.deliveredBy = "";
      }
    }

    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, ...updates } : l)));
    if (selectedLead && selectedLead.id === lead.id) {
      setSelectedLead((prev) => (prev ? { ...prev, ...updates } : null));
    }
    await call(crmUpdateLeadFn({ data: { token: tok(), id: lead.id, [field]: value, closedBy: closedByParam } }));
    doSync();
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
    setLeads((prev) => [{ ...lead, deletedAt: null, deletedBy: null }, ...prev]);
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

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    const f = editUserForm;
    if (!f.name.trim() || !f.email.trim()) {
      toast("Name and email are required.", "error");
      return;
    }
    if (f.password && f.password.length < 6) {
      toast("Password must be at least 6 characters.", "error");
      return;
    }
    setBusy("edit-user");
    const r = await call(
      crmUpdateUserFn({
        data: {
          token: tok(),
          userId: editingUser.id,
          name: f.name.trim(),
          email: f.email.trim(),
          role: f.role,
          status: f.status,
          password: f.password.trim() || undefined,
        },
      }),
    );
    setBusy(null);
    if (!r) return;
    toast(`${r.user.name}'s profile updated successfully.`);
    if (r.newToken) {
      tokenRef.current = r.newToken;
      const updatedMe = { ...me, name: r.user.name, email: r.user.email, role: r.user.role, token: r.newToken };
      setMe(updatedMe);
      setStoredCrmUser(updatedMe, false);
    } else if (r.user.id === me.id) {
      const updatedMe = { ...me, name: r.user.name, email: r.user.email, role: r.user.role };
      setMe(updatedMe);
      setStoredCrmUser(updatedMe, false);
    }
    setUsers((prev) => prev.map((u) => (u.id === r.user.id ? r.user : u)));
    setLeads((prev) =>
      prev.map((l) => ({
        ...l,
        handledBy: l.handledById === r.user.id || (editingUser && l.handledBy.toLowerCase() === editingUser.name.toLowerCase()) ? r.user.name : l.handledBy,
        closedBy: l.closedById === r.user.id || (editingUser && l.closedBy.toLowerCase() === editingUser.name.toLowerCase()) ? r.user.name : l.closedBy,
      }))
    );
    setSelectedLead((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        handledBy: prev.handledById === r.user.id || (editingUser && prev.handledBy.toLowerCase() === editingUser.name.toLowerCase()) ? r.user.name : prev.handledBy,
        closedBy: prev.closedById === r.user.id || (editingUser && prev.closedBy.toLowerCase() === editingUser.name.toLowerCase()) ? r.user.name : prev.closedBy,
      };
    });
    setEditingUser(null);
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
    const restored = recycleBin.filter((l) => ids.includes(l.id)).map((l) => ({ ...l, deletedAt: null, deletedBy: null }));
    setRecycleBin((prev) => prev.filter((l) => !ids.includes(l.id)));
    setLeads((prev) => [...restored, ...prev]);
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

  // -------------------------------------------------------------------------
  // Coupon Generator handlers
  // -------------------------------------------------------------------------
  const handleCreateCoupon = async () => {
    const pct = customDiscount ? Number(customDiscount) : couponPreset;
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      toast("Discount must be between 1% and 100%", "error");
      return;
    }
    setIsCreatingCoupon(true);
    try {
      const res: any = await crmCreateCouponFn({
        data: {
          token: tok(),
          discountPercent: pct,
          customCode: customCodeInput.trim() || undefined,
        },
      });
      if (res?.ok) {
        toast(`Single-use coupon ${res.coupon.code} (${res.coupon.discountPercent}% OFF) generated!`, "success");
        setCoupons((prev) => [res.coupon, ...prev.filter((c) => c.id !== res.coupon.id)]);
        setCustomCodeInput("");
        setCustomDiscount("");
        doSync();
      } else {
        toast(res?.error || "Could not generate coupon", "error");
      }
    } catch {
      toast("Network error while generating coupon", "error");
    } finally {
      setIsCreatingCoupon(false);
    }
  };

  const handleDeleteCoupon = async (coupon: any) => {
    if (!window.confirm(`Delete coupon "${coupon.code}"?\n\nThis code will no longer be valid for checkout.`)) return;
    try {
      const res: any = await crmDeleteCouponFn({
        data: { token: tok(), id: coupon.id },
      });
      if (res?.ok) {
        toast(`Coupon ${coupon.code} deleted`, "info");
        setCoupons((prev) => prev.filter((c) => c.id !== coupon.id));
        doSync();
      } else {
        toast(res?.error || "Could not delete coupon", "error");
      }
    } catch {
      toast("Network error while deleting coupon", "error");
    }
  };

  const copyCouponCode = (code: string, active = true) => {
    if (!active) {
      toast("This coupon is already redeemed and expired", "info");
      return;
    }
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast(`Copied "${code}" to clipboard!`, "success");
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const shareCouponWhatsApp = (coupon: any) => {
    const text = `Hello! Here is your exclusive Quickupp AI Studio discount code:\n\n🎟 *${coupon.code}* (${coupon.discountPercent}% OFF)\n\nThis is a single-use coupon code. Enter this code during checkout on our website to apply your discount:\nhttps://quickuppaistudio.in\n\nLet us know if you have any questions!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const filteredCoupons = useMemo(() => {
    return coupons.filter((c) => {
      if (couponFilter === "active" && !c.active) return false;
      if (couponFilter === "used" && c.active) return false;
      if (couponSearch) {
        const q = couponSearch.toLowerCase();
        const matchCode = String(c.code || "").toLowerCase().includes(q);
        const matchEmail = String(c.usedByEmail || "").toLowerCase().includes(q);
        const matchOrder = String(c.orderId || "").toLowerCase().includes(q);
        return matchCode || matchEmail || matchOrder;
      }
      return true;
    });
  }, [coupons, couponFilter, couponSearch]);

  // -------------------------------------------------------------------------
  // On-Call Direct Order handlers
  // -------------------------------------------------------------------------
  const openOnCallModal = (presetDiscount = 10) => {
    setOnCallCreatedOrder(null);
    setCopiedPayUrl(false);
    setOnCallForm({
      clientName: "",
      clientEmail: "",
      clientPhone: "",
      clientCompany: "",
      serviceId: "ai-ugc",
      qty: 1,
      paymentPlan: "full",
      discountPercent: presetDiscount,
      customDiscount: "",
      customCode: "",
      paidOnCall: false,
      notes: "",
    });
    setShowOnCallModal(true);
  };

  const onCallPricing = useMemo(() => {
    const sId = onCallForm.serviceId;
    const qty = Number(onCallForm.qty) || 1;
    const quoted = quoteItem(sId, qty);
    const basePrice = quoted.amount;
    const pct =
      onCallForm.customDiscount !== ""
        ? Math.max(0, Math.min(100, Number(onCallForm.customDiscount) || 0))
        : onCallForm.discountPercent;
    const discountAmount = Math.round((basePrice * pct) / 100);
    const finalTotal = Math.max(0, basePrice - discountAmount);
    const split = splitPayment(finalTotal, onCallForm.paymentPlan);
    return {
      quoted,
      basePrice,
      pct,
      discountAmount,
      finalTotal,
      payNow: split.payNow,
      balance: split.balance,
    };
  }, [
    onCallForm.serviceId,
    onCallForm.qty,
    onCallForm.customDiscount,
    onCallForm.discountPercent,
    onCallForm.paymentPlan,
  ]);

  const handleCreateDirectOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onCallForm.clientName.trim() || !onCallForm.clientEmail.trim() || !onCallForm.clientPhone.trim()) {
      toast("Please enter the client's name, email, and phone number.", "error");
      return;
    }
    const pct =
      onCallForm.customDiscount !== ""
        ? Math.max(0, Math.min(100, Number(onCallForm.customDiscount) || 0))
        : onCallForm.discountPercent;

    setOnCallBusy(true);
    try {
      const res: any = await crmCreateDirectOrderFn({
        data: {
          token: tok(),
          order: {
            clientName: onCallForm.clientName.trim(),
            clientEmail: onCallForm.clientEmail.trim(),
            clientPhone: onCallForm.clientPhone.trim(),
            clientCompany: onCallForm.clientCompany.trim() || undefined,
            serviceId: onCallForm.serviceId,
            qty: Number(onCallForm.qty) || 1,
            paymentPlan: onCallForm.paymentPlan,
            discountPercent: pct,
            customCouponCode: onCallForm.customCode.trim() || undefined,
            paidOnCall: onCallForm.paidOnCall,
            notes: onCallForm.notes.trim() || undefined,
          },
        },
      });
      if (res?.ok) {
        setOnCallCreatedOrder(res);
        toast(`Order ${res.orderId} created successfully with ${pct}% discount!`, "success");
        doSync();
      } else {
        toast(res?.error || "Failed to create direct order", "error");
      }
    } catch (err: any) {
      toast(err?.message || "Failed to create direct order", "error");
    } finally {
      setOnCallBusy(false);
    }
  };

  const handleMarkOrderPaid = async (o: OrderItem) => {
    if (
      !window.confirm(
        `Mark order ${o.paypalOrderId} (${o.customerName}) as PAID?\n\nAmount: ${fmtMoney(o.amount, o.currency)}\n\nUse this if payment was collected directly via UPI / NEFT on call.`
      )
    )
      return;
    setBusy(`mark-paid-${o.id}`);
    try {
      const r: any = await call(
        crmMarkOrderPaidFn({
          data: {
            token: tok(),
            orderId: o.id,
            notes: `Marked paid manually by admin on call (${me?.email || "Admin"})`,
          },
        })
      );
      if (r?.ok) {
        toast(`Order ${o.paypalOrderId} marked as COMPLETED.`);
        if (selectedOrder && selectedOrder.id === o.id) {
          setSelectedOrder({
            ...selectedOrder,
            paymentStatus: "COMPLETED",
            paidTotal: selectedOrder.orderTotal,
            balanceDue: 0,
          });
        }
        doSync();
      }
    } finally {
      setBusy(null);
    }
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
  const revenueByCur = completedOrders.reduce<Record<string, number>>(
    (acc, o) => {
      acc[o.currency] = (acc[o.currency] || 0) + (o.paidTotal || o.amount);
      return acc;
    },
    leadPay.received > 0 ? { INR: leadPay.received } : {},
  );
  const ordersBalanceDue = (orders || [])
    .filter((o) => o.paymentPlan === "advance" && o.paymentStatus === "COMPLETED")
    .reduce((t, o) => t + (o.balanceDue || 0), 0);

  const shownWebsite = applyLeadFilter(websiteLeads, leadsSearch, leadsFilter, resolveUser);
  const shownMeta = applyLeadFilter(metaLeads, metaSearch, metaFilter, resolveUser);
  // 50% advance paid, balance still due ("Balance Pending").
  const isPartlyPaid = (o: OrderItem) => o.paymentPlan === "advance" && o.paymentStatus === "COMPLETED" && o.balanceDue > 0;
  const orderTab = (o: OrderItem) =>
    isPartlyPaid(o)
      ? "BALANCE"
      : o.paymentStatus === "PENDING" || o.paymentStatus === "FAILED" || o.paymentStatus === "CANCELLED"
        ? "PENDING_FAILED"
        : o.paymentStatus === "REFUNDED"
          ? "REFUNDED"
          : "COMPLETED";
  // Everything on Orders & Payments follows the chosen period (All time / month / From → To).
  const pOrders = (orders || []).filter((o) => periodMatch(ordersPeriod, o.createdAt));
  const pLeadOrders = leadOrders.filter((o) => periodMatch(ordersPeriod, o.lead.createdAt));
  const pLeadPay = sumLeadOrders(pLeadOrders);
  // How many orders each month has (for the month calendar).
  const ordersByMonth: Record<string, number> = {};
  for (const o of orders || []) {
    const k = istDay(o.createdAt).slice(0, 7);
    if (k) ordersByMonth[k] = (ordersByMonth[k] || 0) + 1;
  }
  for (const o of leadOrders) {
    const k = istDay(o.lead.createdAt).slice(0, 7);
    if (k) ordersByMonth[k] = (ordersByMonth[k] || 0) + 1;
  }
  const shownOrders = pOrders.filter((o) => {
    const s = ordersSearch.trim().toLowerCase();
    const statusOk = ordersStatus === "All" || orderTab(o) === ordersStatus;
    return statusOk && (!s || [o.customerName, o.customerEmail, o.paypalOrderId, o.itemName, o.id].some((v) => (v || "").toLowerCase().includes(s)));
  });
  // Website orders grouped the same way as lead orders (only real payments; refunds excluded).
  const webFull = pOrders.filter((o) => o.paymentStatus === "COMPLETED" && !isPartlyPaid(o));
  const webPartial = pOrders.filter(isPartlyPaid);
  const webFullAmount = webFull.reduce((t, o) => t + (o.paidTotal || o.amount), 0);
  const webPartialDue = webPartial.reduce((t, o) => t + (o.balanceDue || 0), 0);
  const webPartialReceived = webPartial.reduce((t, o) => t + (o.paidTotal || o.amount), 0);
  const pReceivedTotal = webFullAmount + webPartialReceived + pLeadPay.received;
  const shownLeadOrders = pLeadOrders.filter((o) => {
    const q = ordersSearch.trim().toLowerCase();
    const statusOk = ordersStatus === "All" || o.cat === ordersStatus;
    return statusOk && (!q || [o.lead.clientName, o.lead.companyName, o.lead.phone, o.lead.email].some((v) => (v || "").toLowerCase().includes(q)));
  });
  const activityCats = ["All", "LEADS", "ORDERS", "USER_ACTIVITY", "SETTINGS"];
  const shownActivity = activity.filter((a) => activityFilter === "All" || a.category === activityFilter);

  const exportLeads = (kind: "website" | "meta") => {
    const list = kind === "meta" ? shownMeta : shownWebsite;
    downloadCsv(`quickupp_${kind}_leads.csv`, [
      ["ID", "Source", "Channel", "Created (IST)", "Client", "Email", "Phone", "Business", "Video Scope", "Video Quantity", "Lead Status", "Project Status", "Payment Status", "Deal Amount (INR)", "Received (INR)", "Balance Due (INR)", "Campaign", "Ad Set", "Form", "Notes"],
      ...list.map((l) => [l.id, l.source, l.channel, fmtIst(l.createdAt), l.clientName, l.email, l.phone, l.companyName, l.videoScope, l.videoQuantity || "", l.leadStatus, l.projectStatus, l.paymentStatus, l.dealAmount || "", leadReceived(l).received || "", l.dealAmount ? leadReceived(l).due : "", l.campaign, l.adSet, l.formName, l.notes]),
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
                <button
                  onClick={() => {
                    const userObj = users.find((u) => u.id === me.id) || {
                      id: me.id,
                      name: me.name,
                      email: me.email,
                      role: me.role,
                      status: "ACTIVE" as const,
                      isProtected: me.role === "SUPER_ADMIN",
                      createdAt: new Date().toISOString(),
                      lastLoginAt: new Date().toISOString(),
                      lockedUntil: null,
                    };
                    openEditUser(userObj);
                  }}
                  className="flex items-center gap-2 group text-left rounded-md p-1 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Click to edit profile"
                >
                  <div className="hidden sm:flex w-9 h-9 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 items-center justify-center text-sm font-bold text-white group-hover:ring-2 group-hover:ring-purple-400">
                    {(me.name || me.email).charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden xl:flex flex-col leading-tight">
                    <span className="text-[13px] font-semibold text-slate-900 group-hover:text-purple-700 flex items-center gap-1">
                      {me.name} <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-purple-600" />
                    </span>
                    <span className="text-xs text-slate-600">{me.email}</span>
                  </div>
                </button>
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

        {/* Phones / tablets: the menu stays a horizontal bar under the header */}
        <nav className="lg:hidden h-12 px-3 sm:px-5 border-t border-slate-100 overflow-x-auto no-scrollbar">
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

      {/* ===================== SIDEBAR + MAIN (side by side on laptops / desktops) ===================== */}
      <div className="flex-1 min-h-0 flex lg:overflow-hidden">
        <aside className="hidden lg:flex w-64 2xl:w-72 shrink-0 h-full flex-col bg-white border-r border-slate-200">
          {/* Menu (scrolls on short screens; the profile card stays pinned at the bottom) */}
          <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-3 py-4">
            {(
              [
                { title: "Workspace", ids: ["dashboard", "leads", "meta", "coupons", "orders"] },
                { title: "Administration", ids: ["activity", "users", "settings"] },
                { title: "Data", ids: ["recycle-bin"] },
              ] as { title: string; ids: TabId[] }[]
            ).map((group) => {
              const items = tabs.filter((t) => group.ids.includes(t.id));
              if (!items.length) return null;
              return (
                <div key={group.title} className="mb-5 last:mb-0">
                  <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{group.title}</div>
                  <nav className="flex flex-col gap-1">
                    {items.map((tab) => {
                      const Icon = tab.icon;
                      const isActive = activeTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => handleTabClick(tab.id)}
                          className={`group w-full h-11 flex items-center gap-3 px-3 rounded-lg text-sm font-medium text-left transition-all ${
                            isActive
                              ? "bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white shadow-[0_8px_20px_-8px_rgba(147,51,234,0.6)]"
                              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                          }`}
                        >
                          <span
                            className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                              isActive ? "bg-white/15" : "bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-purple-600"
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </span>
                          <span className="flex-1 truncate">{tab.label}</span>
                          {tab.id === "orders" && !orders && <Lock className="w-3 h-3 opacity-70 shrink-0" />}
                          {tab.count !== null && (
                            <span
                              className={`text-[11px] min-w-[24px] text-center px-1.5 py-0.5 rounded-md font-semibold shrink-0 ${
                                isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {tab.count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </nav>
                </div>
              );
            })}
          </div>

          {/* Signed-in user, pinned to the bottom of the sidebar */}
          <div className="shrink-0 border-t border-slate-200 p-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-sm font-bold text-white shrink-0">
                  {(me.name || me.email).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="text-[13px] font-semibold text-slate-900 truncate">{me.name || me.email}</div>
                  <div className="text-xs text-slate-500 truncate">{me.email}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-1.5">
                <span className={`inline-flex text-[11px] font-semibold px-2 py-0.5 rounded-md border ${roleBadge(me.role)}`}>{ROLE_LABEL[me.role]}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      const userObj = users.find((u) => u.id === me.id) || {
                        id: me.id,
                        name: me.name,
                        email: me.email,
                        role: me.role,
                        status: "ACTIVE" as const,
                        isProtected: me.role === "SUPER_ADMIN",
                        createdAt: new Date().toISOString(),
                        lastLoginAt: new Date().toISOString(),
                        lockedUntil: null,
                      };
                      openEditUser(userObj);
                    }}
                    className="inline-flex items-center gap-1 h-8 px-2 rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                    title="Edit your profile"
                  >
                    <Pencil className="w-3 h-3" /> Edit
                  </button>
                  <button
                    onClick={handleLogout}
                    className="inline-flex items-center gap-1 h-8 px-2 rounded-md border border-red-200 bg-white text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                    title="Sign out"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </aside>

      {/* ===================== MAIN ===================== */}
      <main className="flex-1 min-h-0 min-w-0 w-full px-3 sm:px-5 lg:px-6 2xl:px-10 py-4 sm:py-5 lg:overflow-y-auto">
        {/* ---------------- DASHBOARD ---------------- */}
        {activeTab === "dashboard" && perms.dashboard && (
          <div className="flex flex-col gap-4 xl:h-full xl:min-h-0">
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

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
              <Kpi label="Total Leads" value={leads.length} sub="All sources" icon={<Users className="w-4 h-4 text-blue-600" />} />
              <Kpi
                label="Revenue"
                value={orders ? revenueText(revenueByCur) : perms.orders ? "Locked" : "—"}
                sub={
                  orders
                    ? `${completedOrders.length + leadPay.count} paid orders${leadPay.count ? ` (incl. ${leadPay.count} from leads)` : ""}`
                    : perms.orders
                      ? "Unlock in Orders tab"
                      : "No access"
                }
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
              <Kpi className="col-span-2 md:col-span-1" label="Closed Leads" value={closedCount} sub={`${conversion}% conversion`} icon={<CheckCircle2 className="w-4 h-4 text-teal-600" />} valueClass="text-teal-600" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 xl:flex-1 xl:min-h-0">
              <div className={`${card} p-5 flex flex-col xl:min-h-0 lg:col-span-12 xl:col-span-6`}>
                <CardTitle icon={<Layers className="w-4 h-4 text-blue-600" />} title="Latest inbound leads" badge={leads.length} />
                <div className="pt-4 space-y-2.5 overflow-y-auto max-h-[60vh] xl:max-h-none xl:flex-1 xl:min-h-0 pr-1">
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

              <div className={`${card} p-5 flex flex-col xl:min-h-0 lg:col-span-6 xl:col-span-3`}>
                <CardTitle icon={<Clock className="w-4 h-4 text-purple-600" />} title="Lead pipeline by status" />
                <div className="pt-4 space-y-3 overflow-y-auto xl:flex-1 xl:min-h-0">
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
              <div className={`${card} p-5 flex flex-col xl:min-h-0 lg:col-span-6 xl:col-span-3`}>
                <CardTitle icon={<Globe className="w-4 h-4 text-cyan-600" />} title="Source-wise lead reporting" right={<span className="text-[13px] text-slate-600">{leads.length} total</span>} />
                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-3 pt-4 xl:flex-1 xl:min-h-0 xl:overflow-y-auto content-start">
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
          const filter = isMeta ? metaFilter : leadsFilter;
          const setFilter = isMeta ? setMetaFilter : setLeadsFilter;
          const draft = isMeta ? metaDraft : leadsDraft;
          const setDraft = isMeta ? setMetaDraft : setLeadsDraft;
          const closers = Array.from(
            new Set([
              ...all.map((l) => resolveUser(l.closedBy, l.closedById)).filter(Boolean),
              ...users.map((u) => u.name).filter(Boolean),
              me.name,
            ].filter(Boolean)),
          ).sort();
          const filterSelect = (label: string, key: keyof LeadFilter, allLabel: string, options: string[], width = "w-40") => (
            <label className="flex w-full items-center gap-1.5 sm:w-auto">
              <span className="w-24 shrink-0 text-[12px] text-slate-500 whitespace-nowrap sm:w-auto">{label}:</span>
              <select value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} className={`${filterCtl} min-w-0 flex-1 sm:flex-none ${width}`}>
                <option value="All">{allLabel}</option>
                {options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
          );
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

              <div className={`${card} p-4 flex flex-col gap-3`}>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1 sm:max-w-xl">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && setFilter(draft)}
                      placeholder={isMeta ? "Search Meta leads by Name, Business, Phone, Notes..." : "Search by Client Name, Business Name, Phone, Notes..."}
                      className={`${inputCls} pl-9`}
                    />
                  </div>
                  <div className="flex gap-2 sm:ml-auto">
                    <button onClick={() => setFilter(draft)} className="inline-flex flex-1 items-center justify-center gap-1.5 h-9 px-4 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-[13px] font-semibold sm:flex-none">
                      <Filter className="w-4 h-4" /> Apply Filter
                    </button>
                    <button
                      onClick={() => {
                        setSearch("");
                        setDraft(blankLeadFilter());
                        setFilter(blankLeadFilter());
                      }}
                      className={`${btnGhost} flex-1 sm:flex-none`}
                    >
                      <RotateCcw className="w-4 h-4" /> Clear Filter
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-slate-100 pt-3">
                  {isMeta
                    ? filterSelect("Meta Channel", "source", "All Meta Channels", META_CHANNEL_FILTERS, "w-44")
                    : filterSelect("Source", "source", "All Sources", WEBSITE_SOURCE_FILTERS, "w-56")}
                  {filterSelect("Lead Status", "leadStatus", "All Lead Statuses", LEAD_STATUSES, "w-40")}
                  {filterSelect("Project Status", "projectStatus", "All Project Statuses", PROJECT_STATUSES, "w-44")}
                  {filterSelect("Video Type", "videoType", "All Video Types", [...VIDEO_TYPE_FILTERS.map((v) => v.label), "Other"], "w-40")}
                  {filterSelect("Closed By", "closedBy", "All Admins", closers, "w-40")}
                  <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                    <select
                      value={draft.dateField}
                      onChange={(e) => setDraft({ ...draft, dateField: e.target.value as LeadFilter["dateField"] })}
                      className={`${filterCtl} w-full sm:w-36`}
                    >
                      <option value="created">Created Date</option>
                      <option value="closed">Closed Date</option>
                      <option value="delivery">Delivery Date</option>
                    </select>
                    <input type="date" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} className={`${filterCtl} min-w-0 flex-1 sm:w-40 sm:flex-none`} />
                    <span className="text-[12px] text-slate-500">to</span>
                    <input type="date" value={draft.to} min={draft.from || undefined} onChange={(e) => setDraft({ ...draft, to: e.target.value })} className={`${filterCtl} min-w-0 flex-1 sm:w-40 sm:flex-none`} />
                  </div>
                  {(isFilterActive(filter) || search) && (
                    <span className="text-[12px] font-medium text-blue-600">
                      Showing {shown.length} of {all.length}
                    </span>
                  )}
                </div>
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
                          <th className="p-3.5">{isMeta ? "Channel" : "Source"}</th>
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
                                  className={`h-8 px-2 rounded-md border text-[13px] font-semibold focus:outline-none cursor-pointer ${leadStatusCls(l.leadStatus)}`}
                                >
                                  {LEAD_STATUSES.map((st) => (
                                    <option key={st}>{st}</option>
                                  ))}
                                </select>
                                {l.leadStatus === "Closed" && (
                                  <div className="text-[11px] text-emerald-700 mt-1 font-medium leading-tight">
                                    Closed by {resolveUser(l.closedBy, l.closedById) || resolveUser(l.handledBy, l.handledById) || "Admin"}
                                    {l.closedAt && <div className="text-slate-500 font-normal">{fmtIstDate(l.closedAt)}</div>}
                                  </div>
                                )}
                              </td>
                              <td className="p-3.5">
                                <select
                                  value={l.projectStatus}
                                  onChange={(e) => handleLeadField(l, "projectStatus", e.target.value)}
                                  className={`h-8 px-2 rounded-md border text-[13px] font-semibold focus:outline-none cursor-pointer ${projectStatusCls(l.projectStatus)}`}
                                >
                                  {PROJECT_STATUSES.map((st) => (
                                    <option key={st}>{st}</option>
                                  ))}
                                </select>
                                {l.projectStatus === "Delivered" && (
                                  <div className="text-[11px] text-emerald-700 font-medium mt-1 leading-tight">
                                    Delivered by {resolveUser(l.deliveredBy, l.deliveredById) || resolveUser(l.handledBy, l.handledById) || "Admin"}
                                    {l.deliveredAt && <div className="text-slate-500 font-normal">{fmtIstDate(l.deliveredAt)}</div>}
                                  </div>
                                )}
                                {l.paymentStatus && (l.paymentStatus !== "Not Paid" || l.dealAmount > 0) && (() => {
                                  const pr = leadReceived(l);
                                  const awaiting = l.paymentStatus === "Full Paid" && !pr.received;
                                  return (
                                    <div className="mt-1.5" title={l.dealAmount ? `${inr(pr.received)} received of ${inr(l.dealAmount)}${pr.due ? ` · ${inr(pr.due)} due` : ""}` : undefined}>
                                      <span
                                        className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${awaiting ? PAYMENT_BADGE["Partially Paid"] : PAYMENT_BADGE[l.paymentStatus] || PAYMENT_BADGE["Not Paid"]}`}
                                      >
                                        <Wallet className="h-3 w-3" /> {l.paymentStatus}
                                      </span>
                                      <div className="mt-0.5 whitespace-nowrap text-[11px] text-slate-500">
                                        {awaiting ? "Not received yet" : `${inr(pr.received)} received`}
                                        {!awaiting && pr.due > 0 && <span className="text-amber-700"> · {inr(pr.due)} due</span>}
                                      </div>
                                    </div>
                                  );
                                })()}
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
                                  <button
                                    onClick={() => openEditLead(l)}
                                    className="p-1.5 rounded hover:bg-purple-100 text-purple-600 hover:text-purple-900"
                                    title="Edit lead"
                                  >
                                    <Pencil className="w-4 h-4" />
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

        {/* ---------------- COUPONS ---------------- */}
        {activeTab === "coupons" && perms.coupons && (
          <div className="flex flex-col gap-4 lg:h-full lg:min-h-0">
            <PageHeader
              icon={<Tag className="w-5 h-5 text-purple-600" />}
              title="Coupon Generator"
              badge={`${coupons.filter((c) => c.active).length} Active`}
              subtitle="Generate single-use unique discount codes (10%, 15%, 20%, etc.) to share with clients. Each code expires immediately once used at checkout."
            >
              <div className="flex items-center gap-2">
                {canExport && (
                  <button
                    onClick={() =>
                      downloadCsv("quickupp_coupons.csv", [
                        ["Coupon Code", "Discount (%)", "Status", "Max Uses", "Times Used", "Redeemed By", "Order ID", "Redeemed At (IST)", "Created By", "Created At (IST)"],
                        ...coupons.map((c) => [
                          c.code,
                          `${c.discountPercent}%`,
                          c.active ? "Active" : "Redeemed / Expired",
                          c.maxUses,
                          c.timesUsed,
                          c.usedByEmail || "-",
                          c.orderId || "-",
                          c.usedAt ? fmtIst(c.usedAt) : "-",
                          c.createdBy || "-",
                          fmtIst(c.createdAt),
                        ]),
                      ])
                    }
                    className={btnGhost}
                  >
                    <Download className="w-4 h-4" /> Export CSV
                  </button>
                )}
              </div>
            </PageHeader>

            {/* Generator Card */}
            <div className={`${card} p-5 shadow-sm border-purple-200/60 bg-gradient-to-r from-purple-50/40 via-white to-pink-50/30`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-600 text-white text-xs font-bold">
                      %
                    </span>
                    Generate Single-Use Discount Coupon
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Select a discount percentage or enter a custom amount. The generated code is unique and will strictly expire after a single checkout order.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                    Strictly Single-Use Guarantee
                  </span>
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
                {/* Preset Discounts */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Discount Percentage:
                  </label>
                  <div className="flex gap-1.5">
                    {[10, 15, 20].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => {
                          setCouponPreset(pct);
                          setCustomDiscount("");
                        }}
                        className={`flex-1 h-9 rounded-md text-xs font-bold transition-all cursor-pointer ${
                          !customDiscount && couponPreset === pct
                            ? "bg-purple-600 text-white shadow-sm ring-2 ring-purple-600/30"
                            : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {pct}% OFF
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Percentage */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Or Custom Discount (%):
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={customDiscount}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val || (Number(val) >= 1 && Number(val) <= 100)) {
                          setCustomDiscount(val);
                        }
                      }}
                      placeholder="e.g. 25, 30, 50"
                      className={inputCls}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      %
                    </span>
                  </div>
                </div>

                {/* Optional Custom Code Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Custom Code (Optional):
                  </label>
                  <input
                    type="text"
                    value={customCodeInput}
                    onChange={(e) => setCustomCodeInput(e.target.value.toUpperCase())}
                    placeholder="Auto-generated if empty"
                    className={`${inputCls} uppercase font-mono text-xs`}
                  />
                </div>

                {/* Generate Button */}
                <div>
                  <button
                    type="button"
                    onClick={handleCreateCoupon}
                    disabled={isCreatingCoupon}
                    className="w-full inline-flex items-center justify-center gap-2 h-9 px-4 rounded-md bg-purple-600 hover:bg-purple-500 text-white text-[13px] font-semibold shadow-sm transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    {isCreatingCoupon ? "Generating..." : `Generate ${customDiscount ? `${customDiscount}%` : `${couponPreset}%`} Code`}
                  </button>
                </div>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200 self-start">
                {(
                  [
                    { id: "all", label: "All Coupons", count: coupons.length },
                    { id: "active", label: "Active Single-Use", count: coupons.filter((c) => c.active).length },
                    { id: "used", label: "Redeemed / Expired", count: coupons.filter((c) => !c.active).length },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setCouponFilter(tab.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      couponFilter === tab.id
                        ? "bg-white text-slate-900 shadow-sm font-semibold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {tab.label} ({tab.count})
                  </button>
                ))}
              </div>

              <div className="relative min-w-[240px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={couponSearch}
                  onChange={(e) => setCouponSearch(e.target.value)}
                  placeholder="Search code, email, or order..."
                  className={`${inputCls} pl-9`}
                />
                {couponSearch && (
                  <button
                    onClick={() => setCouponSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Coupons Table */}
            <div className={`${card} flex-1 overflow-hidden flex flex-col shadow-sm`}>
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                      <th className="p-3.5">Coupon Code</th>
                      <th className="p-3.5">Discount</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Redeemed By</th>
                      <th className="p-3.5">Order ID</th>
                      <th className="p-3.5">Created Date</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCoupons.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-12 text-center text-slate-400">
                          <Tag className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                          <div className="font-medium text-slate-600">No coupons found</div>
                          <div className="text-xs text-slate-400 mt-1">
                            {couponSearch ? "Try clearing your search query." : "Generate a 10%, 15%, or 20% single-use code above."}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredCoupons.map((coupon) => (
                        <tr key={coupon.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3.5 font-mono font-bold text-slate-900">
                            <div className="flex items-center gap-2">
                              <span
                                className={`tracking-wide px-2 py-0.5 rounded border font-mono ${
                                  coupon.active
                                    ? "text-purple-700 bg-purple-50 border-purple-200/60"
                                    : "text-slate-400 bg-slate-100 border-slate-200 line-through select-none"
                                }`}
                              >
                                {coupon.code}
                              </span>
                              {coupon.active && (
                                <button
                                  type="button"
                                  onClick={() => copyCouponCode(coupon.code, coupon.active)}
                                  title="Copy code"
                                  className="text-slate-400 hover:text-purple-600 transition-colors p-1 rounded hover:bg-purple-50 cursor-pointer"
                                >
                                  {copiedCode === coupon.code ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="p-3.5">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-purple-100 text-purple-700 border border-purple-200">
                              {coupon.discountPercent}% OFF
                            </span>
                          </td>
                          <td className="p-3.5">
                            {coupon.active ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Active (Single-Use)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                <X className="w-3 h-3 text-slate-400" />
                                Redeemed & Expired
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-slate-600">
                            {coupon.usedByEmail ? (
                              <span className="font-medium text-slate-900">{coupon.usedByEmail}</span>
                            ) : (
                              <span className="text-slate-400 italic">Not redeemed yet</span>
                            )}
                          </td>
                          <td className="p-3.5 font-mono text-xs text-slate-600">
                            {coupon.orderId || <span className="text-slate-400">—</span>}
                          </td>
                          <td className="p-3.5 text-slate-500 font-mono text-xs whitespace-nowrap">
                            {fmtIst(coupon.createdAt)}
                          </td>
                          <td className="p-3.5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              {coupon.active && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => shareCouponWhatsApp(coupon)}
                                    className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                                    title="Share code via WhatsApp with client"
                                  >
                                    <Share2 className="w-3.5 h-3.5" />
                                    <span>WhatsApp</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => copyCouponCode(coupon.code, coupon.active)}
                                    className={btnGhost}
                                    style={{ height: "32px", padding: "0 8px" }}
                                    title="Copy code to clipboard"
                                  >
                                    {copiedCode === coupon.code ? "Copied" : "Copy"}
                                  </button>
                                </>
                              )}
                              {perms.coupons && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCoupon(coupon)}
                                  className={btnDanger}
                                  style={{ height: "32px", padding: "0 8px" }}
                                  title="Delete coupon"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- ORDERS ---------------- */}
        {activeTab === "orders" && perms.orders && orders && (
          <div className="flex flex-col gap-4">
            <PageHeader icon={<Package className="w-5 h-5 text-purple-600" />} title="Orders & Payments" badge={`${pOrders.length + pLeadPay.count} orders`} subtitle={`Website checkout orders and lead payments · ${periodLabel(ordersPeriod)}`}>
              <div className="flex items-center gap-2">
                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => openOnCallModal(10)}
                    className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-purple-600 hover:bg-purple-500 text-white text-[13px] font-semibold shadow-sm transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <Phone className="w-4 h-4" /> Create On-Call Order
                  </button>
                )}
                {canExport && (
                  <button
                    onClick={() =>
                      downloadCsv("quickupp_orders.csv", [
                        ["Order ID", "Transaction ID", "Payment ref", "Customer", "Email", "Phone", "Company", "Item", "Payment type", "Order total", "Discount %", "Discount Saved", "Coupon Code", "Amount (this payment)", "Paid so far", "Balance due", "Currency", "Status", "Created (IST)"],
                        ...shownOrders.map((o) => [o.id, o.paypalOrderId, o.captureId, o.customerName, o.customerEmail, o.customerPhone, o.customerCompany, o.itemName, o.planLabel, o.orderTotal, `${o.discountPercent || 0}%`, o.discountAmount ? `₹${o.discountAmount}` : "-", o.couponCode || "-", o.amount, o.paidTotal, o.balanceDue, o.currency, o.paymentStatus, fmtIst(o.createdAt)]),
                      ])
                    }
                    className={btnGhost}
                  >
                    <Download className="w-4 h-4" /> Export CSV
                  </button>
                )}
              </div>
            </PageHeader>

            {/* Period: All time / month calendar / From → To — the cards and both tables follow it */}
            <PeriodBar value={ordersPeriod} onChange={(v) => { setOrdersPeriod(v); setSelectedIds([]); }} counts={ordersByMonth} />

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7 gap-3 sm:gap-4">
              <Kpi
                label="Orders"
                value={pOrders.length + pLeadPay.count}
                sub={`${pOrders.length} website · ${pLeadPay.count} lead${pLeadPay.count === 1 ? "" : "s"}`}
                icon={<Package className="w-4 h-4 text-purple-600" />}
                className="col-span-2 sm:col-span-1 border-purple-200 bg-purple-50/40"
              />
              <Kpi
                label="Balance Pending (Not Paid)"
                value={fmtMoney(pLeadPay.notPaidDue, "INR")}
                sub={`${pLeadPay.notPaid} order${pLeadPay.notPaid === 1 ? "" : "s"} not paid yet`}
                icon={<Clock className="w-4 h-4 text-red-600" />}
                valueClass="text-red-600"
              />
              <Kpi
                label="Balance Pending (Partially Paid)"
                value={fmtMoney(pLeadPay.partialDue + webPartialDue, "INR")}
                sub={`${fmtMoney(pLeadPay.partialReceived + webPartialReceived, "INR")} received so far`}
                icon={<Clock className="w-4 h-4 text-orange-600" />}
                valueClass="text-orange-600"
              />
              <Kpi
                label="Full Paid Amount"
                value={fmtMoney(pLeadPay.fullAmount + webFullAmount, "INR")}
                sub={`Total received ${fmtMoney(pReceivedTotal, "INR")}`}
                icon={<TrendingUp className="w-4 h-4 text-emerald-600" />}
                valueClass="text-emerald-600"
              />
              <Kpi
                label="Full Paid"
                value={webFull.length + pLeadPay.full}
                sub={`${webFull.length} website · ${pLeadPay.full} lead${pLeadPay.full === 1 ? "" : "s"}`}
                icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                valueClass="text-emerald-600"
              />
              <Kpi
                label="Partially Paid"
                value={webPartial.length + pLeadPay.partial}
                sub={`${webPartial.length} website · ${pLeadPay.partial} lead${pLeadPay.partial === 1 ? "" : "s"}`}
                icon={<Clock className="w-4 h-4 text-amber-600" />}
                valueClass="text-amber-600"
              />
              <Kpi
                label="Not Paid"
                value={pLeadPay.notPaid}
                sub="Amount written, nothing received"
                icon={<Wallet className="w-4 h-4 text-red-600" />}
                valueClass="text-red-600"
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
                { id: "COMPLETED", label: "Full Paid" },
                { id: "BALANCE", label: "Partially Paid" },
                { id: "NOT_PAID", label: "Not Paid" },
                ...(isSuperAdmin ? [{ id: "PENDING_FAILED", label: "Pending & Failed" }] : []),
                { id: "REFUNDED", label: "Refunded" },
              ].map((f) => {
                const n =
                  (f.id === "All" ? pOrders.length : pOrders.filter((o) => orderTab(o) === f.id).length) +
                  (f.id === "All" ? pLeadOrders.length : pLeadOrders.filter((o) => o.cat === f.id).length);
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

            {/* Website orders and lead orders side by side (stacked on smaller screens) */}
            <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-start">
              <div className={`${card} overflow-hidden flex flex-col min-w-0`}>
                <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
                  <div className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-slate-800">
                    <Globe className="h-4 w-4 text-purple-600" /> Website Orders
                  </div>
                  <span className="text-[12px] text-slate-500">{shownOrders.length} shown</span>
                </div>
              {shownOrders.length === 0 ? (
                <Empty
                  icon={<Package className="w-8 h-8" />}
                  title={
                    !orders.length
                      ? "No website checkout orders yet"
                      : ordersPeriod.mode !== "all" && !pOrders.length
                        ? `No website orders in ${periodLabel(ordersPeriod)}`
                      : ordersStatus === "All"
                        ? "No orders match your search"
                        : ordersStatus === "BALANCE"
                          ? "No orders with a balance pending"
                          : ordersStatus === "PENDING_FAILED"
                            ? "No pending or failed orders"
                            : ordersStatus === "COMPLETED"
                              ? "No fully paid orders"
                              : "No refunded orders"
                  }
                  text={
                    !orders.length
                      ? "Orders and checkout payments made directly by customers on the website will be tracked here. To view payments recorded on leads, please check the Leads Management tab."
                      : isSuperAdmin
                        ? "Orders and checkout attempts are tracked here."
                        : "Only real payments appear here. Unfinished checkouts are not listed."
                  }
                />
              ) : (
                <div className="overflow-auto max-h-[70vh]">
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
                        <th className="p-3.5">Discounted</th>
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
                          <td className="p-3.5">
                            <div className="font-bold text-emerald-600 font-mono">{fmtMoney(o.paidTotal || o.amount, o.currency)}</div>
                            <span
                              className={`inline-block mt-0.5 text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase ${
                                isPartlyPaid(o) ? "bg-amber-50 text-amber-700" : o.paymentPlan === "full" ? "bg-emerald-50 text-emerald-700" : "bg-sky-50 text-sky-700"
                              }`}
                            >
                              {o.planLabel}
                            </span>
                            {o.paymentPlan !== "full" && (
                              <div className="text-[11px] text-slate-500 mt-0.5">of {fmtMoney(o.orderTotal, o.currency)} total</div>
                            )}
                            {o.paymentPlan === "advance" && o.paymentStatus === "COMPLETED" && o.balanceDue > 0 && (
                              <div className="text-[11px] font-semibold text-orange-600">Balance due {fmtMoney(o.balanceDue, o.currency)}</div>
                            )}
                            {o.paymentPlan === "advance" && o.paymentStatus === "COMPLETED" && o.balanceDue <= 0 && (
                              <div className="text-[11px] font-semibold text-emerald-700">Fully paid</div>
                            )}
                            {o.paymentPlan === "balance" && o.parentOrderId && (
                              <div className="text-[11px] text-slate-500">for {o.parentOrderId}</div>
                            )}
                          </td>
                          <td className="p-3.5">
                            {o.discountPercent && o.discountPercent > 0 ? (
                              <div className="flex flex-col items-start gap-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  <Percent className="w-3 h-3" />
                                  {o.discountPercent}% OFF
                                </span>
                                {o.discountAmount ? (
                                  <span className="text-[11px] font-semibold text-emerald-700">
                                    -₹{o.discountAmount.toLocaleString("en-IN")} saved
                                  </span>
                                ) : null}
                                {o.couponCode ? (
                                  <span className="text-[10px] font-mono font-medium text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                                    {o.couponCode}
                                  </span>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">No discount (0%)</span>
                            )}
                          </td>
                          <td className="p-3.5">
                            <span className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold ${isPartlyPaid(o) ? "bg-orange-50 text-orange-700 border-orange-300" : ORDER_STATUS_STYLE[o.paymentStatus] || ORDER_STATUS_STYLE["REFUNDED"]}`}>
                              {isPartlyPaid(o) ? "PARTIALLY PAID" : o.paymentStatus === "COMPLETED" ? "PAID" : o.paymentStatus}
                            </span>
                          </td>
                          <td className="p-3.5 font-mono text-xs text-slate-700">{o.paypalOrderId}</td>
                          <td className="p-3.5 text-slate-600 font-mono whitespace-nowrap">{fmtIst(o.createdAt)}</td>
                          <td className="p-3.5">
                            <div className="flex items-center justify-end gap-1.5">
                              {o.paymentStatus === "PENDING" && o.payOrderUrl && (
                                <>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(o.payOrderUrl);
                                      toast("Payment link copied to clipboard!");
                                    }}
                                    className="h-8 px-2.5 rounded-md border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold inline-flex items-center gap-1"
                                    title="Copy payment link"
                                  >
                                    <Copy className="w-3.5 h-3.5" /> Link
                                  </button>
                                  {o.customerPhone && (
                                    <a
                                      href={`https://wa.me/${(() => {
                                        const d = o.customerPhone.replace(/[^\d]/g, "");
                                        return d.length === 10 ? `91${d}` : d;
                                      })()}?text=${encodeURIComponent(
                                        `Hello ${o.customerName.split(" ")[0]}, here is your secure payment link for ${o.itemName} (${fmtMoney(o.amount, o.currency)}): ${o.payOrderUrl}`
                                      )}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="h-8 px-2.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1"
                                      title="Share payment link on WhatsApp"
                                    >
                                      <Share2 className="w-3.5 h-3.5" /> WhatsApp
                                    </a>
                                  )}
                                  {isSuperAdmin && (
                                    <button
                                      onClick={() => handleMarkOrderPaid(o)}
                                      disabled={busy === `mark-paid-${o.id}`}
                                      className="h-8 px-2.5 rounded-md border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold inline-flex items-center gap-1"
                                      title="Client paid on call via UPI/NEFT"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Mark Paid
                                    </button>
                                  )}
                                </>
                              )}
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

              {/* Lead orders: payments recorded on leads (manual / Meta / website leads) */}
              <div className={`${card} overflow-hidden flex flex-col min-w-0`}>
                <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
                  <div className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-slate-800">
                    <Users className="h-4 w-4 text-purple-600" /> Lead Orders
                  </div>
                  <span className="text-[12px] text-slate-500">{shownLeadOrders.length} shown</span>
                </div>
                {shownLeadOrders.length === 0 ? (
                  <Empty
                    icon={<Wallet className="w-8 h-8" />}
                    title={leadOrders.length ? (ordersPeriod.mode !== "all" && !pLeadOrders.length ? `No lead orders in ${periodLabel(ordersPeriod)}` : "No lead orders match this filter") : "No lead payments yet"}
                    text="Write an amount in a lead's Payment section (Add / Edit lead) and it appears here."
                  />
                ) : (
                  <div className="overflow-auto max-h-[70vh]">
                    <table className="w-full min-w-[540px] text-left text-[13px]">
                      <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-600">
                        <tr>
                          <th className="px-2.5 py-3 w-14 whitespace-nowrap">Sr No</th>
                          <th className="px-2.5 py-3">Full Name</th>
                          <th className="px-2.5 py-3 whitespace-nowrap">Date</th>
                          <th className="px-2.5 py-3 text-right">Amount</th>
                          <th className="px-2.5 py-3 text-right">Paid</th>
                          <th className="px-2.5 py-3 text-right">Remaining</th>
                          <th className="px-2.5 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {shownLeadOrders.map((o, i) => (
                          <tr key={o.lead.id} onClick={() => setSelectedLead(o.lead)} className="cursor-pointer hover:bg-slate-50" title="Open lead details">
                            <td className="px-2.5 py-3 text-slate-500">{i + 1}</td>
                            <td className="px-2.5 py-3">
                              <div className="font-medium text-slate-900">{o.lead.clientName}</div>
                              {o.lead.companyName && <div className="text-[11px] text-slate-500">{o.lead.companyName}</div>}
                            </td>
                            <td className="px-2.5 py-3 whitespace-nowrap text-[12px] text-slate-600">{istDay(o.lead.createdAt) ? dayLabel(istDay(o.lead.createdAt)) : "—"}</td>
                            <td className="px-2.5 py-3 text-right font-semibold text-slate-900 whitespace-nowrap">{o.deal ? inr(o.deal) : "—"}</td>
                            <td className="px-2.5 py-3 text-right font-semibold text-emerald-700 whitespace-nowrap">{inr(o.received)}</td>
                            <td className={`p-3 text-right font-semibold whitespace-nowrap ${o.due > 0 ? "text-orange-600" : "text-slate-400"}`}>{o.due > 0 ? inr(o.due) : "Nil"}</td>
                            <td className="px-2.5 py-3">
                              <span
                                className={`inline-flex whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${
                                  o.cat === "COMPLETED"
                                    ? PAYMENT_BADGE["Full Paid"]
                                    : o.cat === "BALANCE"
                                      ? PAYMENT_BADGE["Partially Paid"]
                                      : "bg-red-50 text-red-700 border-red-300"
                                }`}
                              >
                                {o.cat === "COMPLETED" ? "Full Paid" : o.cat === "BALANCE" ? "Partially Paid" : "Not Paid"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="sticky bottom-0 bg-slate-50 border-t border-slate-200 text-[13px] font-bold">
                        <tr>
                          <td className="px-2.5 py-3" colSpan={3}>
                            Total ({shownLeadOrders.length})
                          </td>
                          <td className="px-2.5 py-3 text-right whitespace-nowrap">{inr(shownLeadOrders.reduce((t, o) => t + o.deal, 0))}</td>
                          <td className="px-2.5 py-3 text-right whitespace-nowrap text-emerald-700">{inr(shownLeadOrders.reduce((t, o) => t + o.received, 0))}</td>
                          <td className="px-2.5 py-3 text-right whitespace-nowrap text-orange-600">{inr(shownLeadOrders.reduce((t, o) => t + o.due, 0))}</td>
                          <td className="px-2.5 py-3" />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
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
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">
                            {a.actorName ? `${a.actorName} (${a.actorEmail})` : a.actorEmail}
                          </span>
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
                            <button
                              onClick={() => openEditUser(u)}
                              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 font-medium transition-colors"
                              title={u.role === "ADMIN" ? "Edit Admin Profile" : "Edit User Profile"}
                            >
                              <Pencil className="w-3.5 h-3.5" /> Edit
                            </button>
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
                            {row.key === "delete_leads" ? "Permanent delete" : row.locked === "always" || row.locked === "admin_always" ? "Always allowed" : "Allowed"}
                          </td>
                          {(["ADMIN", "LEADS_MANAGER"] as ManagedRole[]).map((role) => {
                            const allowed = matrixDraft[row.key][role];
                            // "admin_always": Admin is fixed on; Leads Manager stays switchable.
                            const lockedHere = row.locked === "admin_always" ? (role === "ADMIN" ? "always" : false) : row.locked;
                            if (lockedHere) {
                              return (
                                <td key={role} className="p-3">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold border ${
                                      lockedHere === "always" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"
                                    }`}
                                  >
                                    <Lock className="w-3 h-3" /> {lockedHere === "always" ? "Always allowed" : "Super Admin only"}
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
                    <RecordCard label="Total orders" value={counts.totalOrders} sub={`${counts.completedOrders} paid • ${counts.pendingOrders} with balance pending`} />
                    <RecordCard label="Total revenue" value={revenueText(counts.revenueByCurrency)} sub="Paid orders + lead payments received" valueClass="text-emerald-600" />
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
      </div>

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
              <Field label="Video Quantity / Monthly Volume" hint="Pick one or choose Custom to type">
                <ComboField value={leadForm.quantity} onChange={(v) => setLeadForm({ ...leadForm, quantity: v })} options={LEAD_QUANTITIES} placeholder="e.g. 8 Videos / month" />
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

            <PaymentFields form={leadForm} setForm={setLeadForm} />

            <AttachmentPicker files={addLeadFiles} setFiles={setAddLeadFiles} onError={(m) => toast(m, "error")} note={uploadNote} />

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
              <ModalActions onCancel={() => setShowAddLeadModal(false)} submitLabel={busy === "add-lead" ? (uploadNote ? "Uploading files..." : "Saving...") : "Save Lead"} disabled={busy === "add-lead"} />
            </div>
          </form>
        </Modal>
      )}

      {editingLead && (
        <Modal
          onClose={() => setEditingLead(null)}
          title={`Edit Lead — ${editingLead.clientName}`}
          subtitle="Update client information, project requirements, and statuses."
          icon={<Pencil className="w-5 h-5 text-purple-600" />}
          size="xl"
        >
          <form onSubmit={handleSaveEditLead} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <Field label="Lead Source *">
                <select value={editLeadForm.source} onChange={(e) => setEditLeadForm({ ...editLeadForm, source: e.target.value })} className={inputCls}>
                  {LEAD_SOURCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Client Full Name *">
                <input required value={editLeadForm.clientName} onChange={(e) => setEditLeadForm({ ...editLeadForm, clientName: e.target.value })} placeholder="e.g. Rahul Sharma" className={inputCls} />
              </Field>
              <Field label="Company / Brand Name *">
                <input required value={editLeadForm.business} onChange={(e) => setEditLeadForm({ ...editLeadForm, business: e.target.value })} placeholder="e.g. Sharma Foods" className={inputCls} />
              </Field>
              <Field label="Website">
                <input value={editLeadForm.website} onChange={(e) => setEditLeadForm({ ...editLeadForm, website: e.target.value })} placeholder="https://brand.in" className={inputCls} />
              </Field>
              <Field label="WhatsApp / Phone *">
                <input required value={editLeadForm.phone} onChange={(e) => setEditLeadForm({ ...editLeadForm, phone: e.target.value })} placeholder="+91 98765 43210" inputMode="tel" className={inputCls} />
              </Field>
              <Field label="Email Address">
                <input type="email" value={editLeadForm.email} onChange={(e) => setEditLeadForm({ ...editLeadForm, email: e.target.value })} placeholder="client@company.com" className={inputCls} />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <Field label="Industry">
                <select value={editLeadForm.industry} onChange={(e) => setEditLeadForm({ ...editLeadForm, industry: e.target.value })} className={inputCls}>
                  <option value="">Select industry</option>
                  {LEAD_INDUSTRIES.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </Field>
              <Field label="Location / City">
                <input value={editLeadForm.location} onChange={(e) => setEditLeadForm({ ...editLeadForm, location: e.target.value })} placeholder="e.g. Pune, Maharashtra" className={inputCls} />
              </Field>
              <Field label="Video Type / Need *">
                <select value={editLeadForm.videoScope} onChange={(e) => setEditLeadForm({ ...editLeadForm, videoScope: e.target.value })} className={inputCls}>
                  {LEAD_VIDEO_TYPES.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </Field>
              <Field label="Video Quantity / Monthly Volume" hint="Pick one or choose Custom to type">
                <ComboField value={editLeadForm.quantity} onChange={(v) => setEditLeadForm({ ...editLeadForm, quantity: v })} options={LEAD_QUANTITIES} placeholder="e.g. 8 Videos / month" />
              </Field>
            </div>

            {(editLeadForm.source === "Meta Ads" || editingLead.kind === "meta") && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 rounded-md border border-purple-200 bg-purple-500/[0.04] p-3">
                <Field label="Channel">
                  <select value={editLeadForm.channel} onChange={(e) => setEditLeadForm({ ...editLeadForm, channel: e.target.value })} className={inputCls}>
                    <option>Facebook</option>
                    <option>Instagram</option>
                  </select>
                </Field>
                <Field label="Campaign">
                  <input value={editLeadForm.campaign} onChange={(e) => setEditLeadForm({ ...editLeadForm, campaign: e.target.value })} placeholder="Campaign name" className={inputCls} />
                </Field>
                <Field label="Ad Set">
                  <input value={editLeadForm.adSet} onChange={(e) => setEditLeadForm({ ...editLeadForm, adSet: e.target.value })} placeholder="Ad set" className={inputCls} />
                </Field>
                <Field label="Form Name">
                  <input value={editLeadForm.formName} onChange={(e) => setEditLeadForm({ ...editLeadForm, formName: e.target.value })} placeholder="Lead form" className={inputCls} />
                </Field>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <Field label="Lead Status">
                <select value={editLeadForm.leadStatus} onChange={(e) => setEditLeadForm({ ...editLeadForm, leadStatus: e.target.value })} className={inputCls}>
                  {LEAD_STATUSES.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </Field>
              <Field label="Project Status">
                <select value={editLeadForm.projectStatus} onChange={(e) => setEditLeadForm({ ...editLeadForm, projectStatus: e.target.value })} className={inputCls}>
                  {PROJECT_STATUSES.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </Field>
              <Field label="Delivery Target Date">
                <input type="date" value={editLeadForm.deliveryDate} onChange={(e) => setEditLeadForm({ ...editLeadForm, deliveryDate: e.target.value })} className={`${inputCls} [color-scheme:light]`} />
              </Field>
            </div>

            <PaymentFields form={editLeadForm} setForm={setEditLeadForm} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <Field label="Handled By / Assigned To" hint="Select an admin or type a name">
                <input
                  list="handled-by-options"
                  value={editLeadForm.handledBy}
                  onChange={(e) => setEditLeadForm({ ...editLeadForm, handledBy: e.target.value })}
                  placeholder={me.name || "Admin"}
                  className={inputCls}
                />
                <datalist id="handled-by-options">
                  {Array.from(new Set([...users.map((u) => u.name), me.name].filter(Boolean))).map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </Field>
              <Field label="Closed By" hint={editLeadForm.leadStatus === "Closed" ? "Select who closed this lead" : "Optional / auto"}>
                <input
                  list="closed-by-options"
                  value={editLeadForm.closedBy}
                  onChange={(e) => setEditLeadForm({ ...editLeadForm, closedBy: e.target.value })}
                  placeholder={editLeadForm.leadStatus === "Closed" ? (me.name || "Admin") : "Not closed"}
                  className={inputCls}
                />
                <datalist id="closed-by-options">
                  {Array.from(new Set([...users.map((u) => u.name), me.name].filter(Boolean))).map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </Field>
            </div>

            <Field label="Internal Notes & Scope">
              <textarea
                rows={3}
                value={editLeadForm.notes}
                onChange={(e) => setEditLeadForm({ ...editLeadForm, notes: e.target.value })}
                placeholder="Add specific requirements, deadlines, or client preferences..."
                className="w-full px-3 py-2 rounded-md border border-slate-200 bg-white text-[13px] text-slate-900 placeholder-slate-400 resize-y focus:outline-none focus:border-purple-500"
              />
            </Field>
            <div className="border-t border-slate-200 pt-4">
              <ModalActions onCancel={() => setEditingLead(null)} submitLabel={busy === "edit-lead" ? "Saving Changes..." : "Save Changes"} disabled={busy === "edit-lead"} />
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

      {editingUser && (
        <Modal
          onClose={() => setEditingUser(null)}
          title={
            editingUser.role === "SUPER_ADMIN"
              ? "Edit Super Admin Profile"
              : editingUser.role === "ADMIN"
              ? "Edit Admin Profile"
              : "Edit User Profile"
          }
          subtitle={`Update profile information, role, status or reset password for ${editingUser.name}.`}
          icon={<Pencil className="w-5 h-5 text-purple-600" />}
        >
          <form onSubmit={handleSaveEditUser} className="space-y-3.5">
            <Field label="Full name">
              <input
                required
                value={editUserForm.name}
                onChange={(e) => setEditUserForm({ ...editUserForm, name: e.target.value })}
                placeholder="e.g. Test Admin"
                className={inputCls}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                required
                value={editUserForm.email}
                onChange={(e) => setEditUserForm({ ...editUserForm, email: e.target.value })}
                placeholder="admin@aistudio.in"
                className={inputCls}
              />
            </Field>
            <Field
              label="Role"
              hint={
                editingUser.isProtected || editingUser.role === "SUPER_ADMIN"
                  ? "Super Admin account role is protected and cannot be changed."
                  : undefined
              }
            >
              {editingUser.isProtected || editingUser.role === "SUPER_ADMIN" ? (
                <div className="h-10 px-3 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-sm flex items-center font-semibold">
                  Super Admin (Protected)
                </div>
              ) : (
                <select
                  value={editUserForm.role}
                  onChange={(e) => setEditUserForm({ ...editUserForm, role: e.target.value as CrmRole })}
                  className={inputCls}
                >
                  <option value="ADMIN">Admin</option>
                  <option value="LEADS_MANAGER">Leads Manager</option>
                </select>
              )}
            </Field>
            <Field
              label="Account status"
              hint={
                editingUser.isProtected || editingUser.role === "SUPER_ADMIN"
                  ? "Super Admin account cannot be deactivated."
                  : undefined
              }
            >
              {editingUser.isProtected || editingUser.role === "SUPER_ADMIN" ? (
                <div className="h-10 px-3 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center font-semibold">
                  Active (Protected)
                </div>
              ) : (
                <select
                  value={editUserForm.status}
                  onChange={(e) => setEditUserForm({ ...editUserForm, status: e.target.value as "ACTIVE" | "INACTIVE" })}
                  className={inputCls}
                >
                  <option value="ACTIVE">Active (Can sign in)</option>
                  <option value="INACTIVE">Deactivated (Blocked from sign-in)</option>
                </select>
              )}
            </Field>
            <Field label="New Password (optional)" hint="Leave blank to keep existing password. Enter at least 6 characters to reset.">
              <div className="relative">
                <input
                  type={showEditUserPw ? "text" : "password"}
                  minLength={6}
                  value={editUserForm.password}
                  onChange={(e) => setEditUserForm({ ...editUserForm, password: e.target.value })}
                  placeholder="Leave blank to keep existing password"
                  className={`${inputCls} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowEditUserPw(!showEditUserPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-900"
                >
                  {showEditUserPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </Field>
            <ModalActions
              onCancel={() => setEditingUser(null)}
              submitLabel={busy === "edit-user" ? "Saving..." : "Save Changes"}
              disabled={busy === "edit-user"}
            />
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
                  {editable && (
                    <button
                      onClick={() => {
                        const target = l;
                        setSelectedLead(null);
                        openEditLead(target);
                      }}
                      className={btnGhost}
                      title="Edit lead"
                    >
                      <Pencil className="w-4 h-4" /> <span className="hidden sm:inline">Edit</span>
                    </button>
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
                    className={`w-full h-9 px-2.5 rounded-md border text-[13px] font-semibold focus:outline-none disabled:opacity-60 ${leadStatusCls(l.leadStatus)}`}
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
                    className={`w-full h-9 px-2.5 rounded-md border text-[13px] font-semibold focus:outline-none disabled:opacity-60 ${projectStatusCls(l.projectStatus)}`}
                  >
                    {PROJECT_STATUSES.map((st) => (
                      <option key={st}>{st}</option>
                    ))}
                  </select>
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Handled by</div>
                  <div className="h-9 flex items-center text-sm font-medium text-slate-900 truncate">
                    {resolveUser(l.handledBy, l.handledById) || "Not assigned yet"}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Closed</div>
                  <div className="h-9 flex items-center text-sm font-medium text-slate-900 truncate">
                    {l.leadStatus === "Closed"
                      ? `${resolveUser(l.closedBy, l.closedById) || resolveUser(l.handledBy, l.handledById) || "Admin"}${l.closedAt ? ` · ${fmtIst(l.closedAt)}` : ""}`
                      : "Not closed"}
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
                    <DetailRow
                      label="Closed by"
                      value={l.leadStatus === "Closed" ? `${resolveUser(l.closedBy, l.closedById) || resolveUser(l.handledBy, l.handledById) || "Admin"}${l.closedAt ? ` · ${fmtIst(l.closedAt)}` : ""}` : "Not closed"}
                    />
                    <DetailRow
                      label="Delivered by"
                      value={l.projectStatus === "Delivered" ? `${resolveUser(l.deliveredBy, l.deliveredById) || resolveUser(l.handledBy, l.handledById) || "Admin"}${l.deliveredAt ? ` · ${fmtIst(l.deliveredAt)}` : ""}` : "Not delivered yet"}
                    />
                    <DetailRow label="Handled by" value={resolveUser(l.handledBy, l.handledById) || "Not assigned yet"} />
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

                <DetailCard icon={<Video className="w-4 h-4" />} title="Project & Creative Requirement" right={<StatusPill text={l.projectStatus} tone={l.projectStatus === "Delivered" ? "emerald" : "amber"} />}>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-md bg-slate-50 border border-slate-100">
                    <MiniStat label="Requirement / format" value={l.videoScope} />
                    <MiniStat label="Video quantity" value={l.videoQuantity || "—"} />
                    <MiniStat
                      label="Delivery target"
                      value={l.deliveryTarget ? fmtIstDate(`${l.deliveryTarget}T12:00:00+05:30`) : "Not set"}
                    />
                    <MiniStat
                      label="Delivered on"
                      value={
                        l.projectStatus === "Delivered"
                          ? `${l.deliveredAt ? fmtIst(l.deliveredAt) : "Delivered"} · by ${resolveUser(l.deliveredBy, l.deliveredById) || resolveUser(l.handledBy, l.handledById) || "Admin"}`
                          : "Not delivered yet"
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-md bg-emerald-50/60 border border-emerald-100">
                    <MiniStat label="Payment status" value={l.paymentStatus || "Not recorded"} />
                    <MiniStat label="Deal amount" value={l.dealAmount ? inr(l.dealAmount) : "—"} />
                    <MiniStat label="Received" value={inr(leadReceived(l).received)} />
                    <MiniStat label="Balance due" value={l.dealAmount ? (leadReceived(l).due > 0 ? inr(leadReceived(l).due) : "Nil (fully paid)") : "—"} />
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Project details / campaign goals</div>
                    <div className="px-4 py-3 rounded-md bg-slate-50 border border-slate-200 text-sm leading-relaxed text-slate-800 whitespace-pre-wrap break-words">
                      {l.notes || <span className="text-slate-500">No details were provided with this enquiry.</span>}
                    </div>
                  </div>
                </DetailCard>

                <LeadAttachments
                  leadId={l.id}
                  token={tok}
                  canEdit={editable}
                  canDeleteAll={isSuperAdmin || perms.delete_leads}
                  myName={me.name}
                  notify={toast}
                />

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
              <Info
                label={selectedOrder.paymentPlan === "advance" ? "Advance paid (50%)" : "Amount paid"}
                value={fmtMoney(selectedOrder.amount, selectedOrder.currency)}
              />
              <Info label="Status" value={selectedOrder.paymentStatus} />
              <Info label="Payment type" value={selectedOrder.planLabel} />
              <Info label="Order total" value={fmtMoney(selectedOrder.orderTotal, selectedOrder.currency)} />
              <Info label="Paid so far" value={fmtMoney(selectedOrder.paidTotal, selectedOrder.currency)} />
              <Info
                label="Balance due"
                value={selectedOrder.paymentPlan === "balance" ? "— (balance payment)" : selectedOrder.balanceDue > 0 ? fmtMoney(selectedOrder.balanceDue, selectedOrder.currency) : "Nil"}
              />
              {selectedOrder.discountPercent && selectedOrder.discountPercent > 0 ? (
                <>
                  <Info
                    label="Discount applied"
                    value={`${selectedOrder.discountPercent}% OFF${selectedOrder.couponCode ? ` (Code: ${selectedOrder.couponCode})` : ""}`}
                  />
                  {selectedOrder.discountAmount ? (
                    <Info
                      label="Discount amount saved"
                      value={`-₹${selectedOrder.discountAmount.toLocaleString("en-IN")}`}
                    />
                  ) : null}
                  {selectedOrder.originalAmount ? (
                    <Info
                      label="Original order total"
                      value={fmtMoney(selectedOrder.originalAmount, selectedOrder.currency)}
                    />
                  ) : null}
                </>
              ) : (
                <Info label="Discount" value="None (0%)" />
              )}
              {selectedOrder.parentOrderId && <Info label="Balance for order" value={selectedOrder.parentOrderId} />}
              {selectedOrder.paymentStatus === "PENDING" && selectedOrder.payOrderUrl && (
                <div className="sm:col-span-2 rounded-md border border-purple-200 bg-purple-50 p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold uppercase tracking-wider text-purple-700">Direct Order Payment Link</div>
                    <span className="text-[11px] px-2 py-0.5 rounded font-semibold bg-amber-100 text-amber-800">Awaiting Client Payment</span>
                  </div>
                  <div className="mt-1 text-[12px] font-mono text-slate-700 break-all">{selectedOrder.payOrderUrl}</div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard
                          ?.writeText(selectedOrder.payOrderUrl)
                          .then(() => toast("Payment link copied to clipboard!"))
                          .catch(() => toast("Could not copy link", "error"));
                      }}
                      className="h-8 px-3 rounded-md border border-purple-300 bg-white text-[13px] font-semibold text-purple-700 hover:bg-purple-100 inline-flex items-center gap-1.5"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copy link
                    </button>
                    {selectedOrder.customerPhone && (
                      <a
                        href={`https://wa.me/${(() => {
                          const d = selectedOrder.customerPhone.replace(/[^\d]/g, "");
                          return d.length === 10 ? `91${d}` : d;
                        })()}?text=${encodeURIComponent(
                          `Hello ${selectedOrder.customerName.split(" ")[0]}, thank you for speaking with Quickupp AI Studio! Here is your secure payment link for ${selectedOrder.itemName}${selectedOrder.discountPercent ? ` with ${selectedOrder.discountPercent}% discount` : ""}: ${selectedOrder.payOrderUrl}`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md bg-emerald-600 text-[13px] font-semibold text-white hover:bg-emerald-700"
                      >
                        <Share2 className="w-3.5 h-3.5" /> Send on WhatsApp
                      </a>
                    )}
                    {isSuperAdmin && (
                      <button
                        onClick={() => handleMarkOrderPaid(selectedOrder)}
                        disabled={busy === `mark-paid-${selectedOrder.id}`}
                        className="h-8 px-3 rounded-md bg-emerald-700 hover:bg-emerald-800 text-[13px] font-semibold text-white inline-flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Mark Order as Paid (UPI / NEFT)
                      </button>
                    )}
                  </div>
                </div>
              )}
              {selectedOrder.payBalanceUrl && (
                <div className="sm:col-span-2 rounded-md border border-orange-200 bg-orange-50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-orange-700">Balance payment link</div>
                  <div className="mt-1 text-[12px] font-mono text-slate-700 break-all">{selectedOrder.payBalanceUrl}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard
                          ?.writeText(selectedOrder.payBalanceUrl)
                          .then(() => toast("Balance payment link copied."))
                          .catch(() => toast("Could not copy. Select the link and copy it.", "error"));
                      }}
                      className="h-8 px-3 rounded-md border border-orange-300 bg-white text-[13px] font-semibold text-orange-700 hover:bg-orange-100"
                    >
                      Copy link
                    </button>
                    {selectedOrder.customerPhone && (
                      <a
                        href={`https://wa.me/${(() => {
                          const d = selectedOrder.customerPhone.replace(/[^\d]/g, "");
                          return d.length === 10 ? `91${d}` : d;
                        })()}?text=${encodeURIComponent(
                          `Hello ${selectedOrder.customerName.split(" ")[0]}, thank you for your order ${selectedOrder.id} with Quickupp AI Studio. The remaining balance of ${fmtMoney(selectedOrder.balanceDue, selectedOrder.currency)} can be paid securely here: ${selectedOrder.payBalanceUrl}`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-8 px-3 inline-flex items-center rounded-md bg-emerald-600 text-[13px] font-semibold text-white hover:bg-emerald-700"
                      >
                        Send on WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              )}
              {selectedOrder.balanceTxn && (
                <>
                  <Info label="Balance paid" value={fmtMoney(selectedOrder.paidTotal - selectedOrder.amount, selectedOrder.currency)} />
                  <Info label="Balance paid on" value={selectedOrder.balancePaidAt ? fmtIst(selectedOrder.balancePaidAt) : "—"} />
                  <Info label="Balance transaction ID" value={selectedOrder.balanceTxn} />
                  <Info label="Balance payment ref" value={selectedOrder.balancePayuId || "—"} />
                </>
              )}
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

      {/* ---------------- ON-CALL CLIENT ORDER MODAL ---------------- */}
      {showOnCallModal && (
        <Modal
          size="xl"
          onClose={() => setShowOnCallModal(false)}
          title={onCallCreatedOrder ? "Order Created Successfully" : "Create Client Order (On Call)"}
          subtitle={
            onCallCreatedOrder
              ? `Order ${onCallCreatedOrder.orderId} generated with ${onCallCreatedOrder.discountPercent}% discount.`
              : "Generate an order with an agreed discount on the spot. Customer does not need to fill any website forms."
          }
          icon={onCallCreatedOrder ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <Phone className="w-5 h-5 text-purple-600" />}
        >
          {onCallCreatedOrder ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/70 text-emerald-950">
                <div className="flex items-center gap-2.5 font-bold text-emerald-900 text-base">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  Order #{onCallCreatedOrder.orderId} Created!
                </div>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-emerald-700">Client:</span>
                    <div className="font-semibold text-slate-900 truncate">{onCallForm.clientName}</div>
                  </div>
                  <div>
                    <span className="text-emerald-700">Package:</span>
                    <div className="font-semibold text-slate-900 truncate">{onCallCreatedOrder.itemName}</div>
                  </div>
                  <div>
                    <span className="text-emerald-700">Amount:</span>
                    <div className="font-bold text-emerald-800 font-mono">₹{onCallCreatedOrder.amount.toLocaleString("en-IN")}</div>
                  </div>
                  <div>
                    <span className="text-emerald-700">Discount:</span>
                    <div className="font-bold text-purple-700">{onCallCreatedOrder.discountPercent}% OFF</div>
                  </div>
                </div>
              </div>

              {onCallForm.paidOnCall ? (
                <div className="p-3.5 rounded-lg border border-emerald-300 bg-emerald-100 text-emerald-900 text-xs font-medium flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                  Payment confirmed! This order has been saved as <strong>PAID</strong> and appears in your Fully Paid orders.
                </div>
              ) : (
                <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-900">Direct Payment Link</span>
                    <span className="text-[11px] font-semibold text-purple-700 bg-white px-2 py-0.5 rounded-full border border-purple-200">
                      Pre-loaded & Ready to Pay
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-white border border-purple-200 font-mono text-xs text-slate-800 break-all select-all">
                    {onCallCreatedOrder.payOrderUrl}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(onCallCreatedOrder.payOrderUrl);
                        setCopiedPayUrl(true);
                        toast("Payment link copied to clipboard!", "success");
                        setTimeout(() => setCopiedPayUrl(false), 3000);
                      }}
                      className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
                    >
                      {copiedPayUrl ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copiedPayUrl ? "Link Copied!" : "Copy Payment Link"}
                    </button>

                    {onCallForm.clientPhone && (
                      <a
                        href={`https://wa.me/${(() => {
                          const d = onCallForm.clientPhone.replace(/[^\d]/g, "");
                          return d.length === 10 ? `91${d}` : d;
                        })()}?text=${encodeURIComponent(
                          `Hello ${onCallForm.clientName.split(" ")[0]}! Here is your direct payment link from Quickupp AI Studio:\n\n📦 *Package*: ${onCallCreatedOrder.itemName}\n🎟 *Discount*: ${onCallCreatedOrder.discountPercent}% OFF applied\n💰 *Amount to pay*: ₹${onCallCreatedOrder.amount.toLocaleString("en-IN")}\n\n👉 *Pay securely here* (UPI / Card / NetBanking / EMI):\n${onCallCreatedOrder.payOrderUrl}\n\nNo forms required. Once paid, our production team will get started on your videos immediately!`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all"
                      >
                        <Share2 className="w-4 h-4" /> Share on WhatsApp
                      </a>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-500 italic">
                    Tip: The customer can open this link on their mobile or laptop and will see their details and discount already filled in, taking them straight to PayU without any form filling.
                  </p>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowOnCallModal(false);
                    setOnCallCreatedOrder(null);
                    setActiveTab("orders");
                    setOrdersStatus("All");
                  }}
                  className="h-9 px-4 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
                >
                  Done & View in Orders Table
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreateDirectOrder} className="space-y-4">
              {/* Client Information */}
              <div>
                <div className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-purple-600" /> Client Details (On Call)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      required
                      type="text"
                      value={onCallForm.clientName}
                      onChange={(e) => setOnCallForm({ ...onCallForm, clientName: e.target.value })}
                      placeholder="e.g. Rahul Sharma"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      required
                      type="email"
                      value={onCallForm.clientEmail}
                      onChange={(e) => setOnCallForm({ ...onCallForm, clientEmail: e.target.value })}
                      placeholder="e.g. rahul@brand.com"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Phone / WhatsApp Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      required
                      type="tel"
                      value={onCallForm.clientPhone}
                      onChange={(e) => setOnCallForm({ ...onCallForm, clientPhone: e.target.value })}
                      placeholder="e.g. +91 9876543210"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Company / Brand Name
                    </label>
                    <input
                      type="text"
                      value={onCallForm.clientCompany}
                      onChange={(e) => setOnCallForm({ ...onCallForm, clientCompany: e.target.value })}
                      placeholder="e.g. Acme Media"
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>

              {/* Service & Package Selection */}
              <div className="pt-2 border-t border-slate-200">
                <div className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-purple-600" /> Package & Service
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Service</label>
                    <select
                      value={onCallForm.serviceId}
                      onChange={(e) =>
                        setOnCallForm({
                          ...onCallForm,
                          serviceId: e.target.value,
                          qty: e.target.value === TWIN_SETUP_ID ? 1 : onCallForm.qty,
                        })
                      }
                      className={inputCls}
                    >
                      {INDIA_SERVICES.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                      <option value={TWIN_SETUP_ID}>AI Digital Twin Setup (One-Time ₹15,000)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Quantity / Reels</label>
                    <select
                      disabled={onCallForm.serviceId === TWIN_SETUP_ID}
                      value={onCallForm.qty}
                      onChange={(e) => setOnCallForm({ ...onCallForm, qty: Number(e.target.value) })}
                      className={`${inputCls} disabled:opacity-50`}
                    >
                      {INDIA_PACKS.map((p) => (
                        <option key={p.qty} value={p.qty}>
                          {p.label} — {p.deliveryShort}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Payment Plan</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setOnCallForm({ ...onCallForm, paymentPlan: "full" })}
                      className={`h-9 px-3 rounded-md text-xs font-semibold border transition-all cursor-pointer ${
                        onCallForm.paymentPlan === "full"
                          ? "bg-purple-50 border-purple-500 text-purple-900 ring-1 ring-purple-400"
                          : "border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      Full Payment (100%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setOnCallForm({ ...onCallForm, paymentPlan: "advance" })}
                      className={`h-9 px-3 rounded-md text-xs font-semibold border transition-all cursor-pointer ${
                        onCallForm.paymentPlan === "advance"
                          ? "bg-purple-50 border-purple-500 text-purple-900 ring-1 ring-purple-400"
                          : "border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      50% Advance + 50% on Delivery
                    </button>
                  </div>
                </div>
              </div>

              {/* Discount Selector */}
              <div className="pt-2 border-t border-slate-200">
                <div className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5 text-purple-600" /> Apply Discount (% Code)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">
                      Discount Percentage Preset:
                    </label>
                    <div className="flex gap-1.5">
                      {[0, 10, 15, 20].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setOnCallForm({ ...onCallForm, discountPercent: pct, customDiscount: "" })}
                          className={`flex-1 h-9 rounded-md text-xs font-bold transition-all cursor-pointer ${
                            onCallForm.customDiscount === "" && onCallForm.discountPercent === pct
                              ? "bg-purple-600 text-white shadow-sm ring-2 ring-purple-600/30"
                              : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {pct === 0 ? "0%" : `${pct}%`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Custom %</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={onCallForm.customDiscount}
                        onChange={(e) => setOnCallForm({ ...onCallForm, customDiscount: e.target.value })}
                        placeholder="Custom %"
                        className={inputCls}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Code (optional)</label>
                      <input
                        type="text"
                        value={onCallForm.customCode}
                        onChange={(e) => setOnCallForm({ ...onCallForm, customCode: e.target.value.toUpperCase() })}
                        placeholder="Auto"
                        className={`${inputCls} uppercase font-mono text-xs`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Paid on Call Checkbox */}
              <div className="pt-2 border-t border-slate-200">
                <label className="flex items-start gap-2.5 p-3 rounded-lg border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={onCallForm.paidOnCall}
                    onChange={(e) => setOnCallForm({ ...onCallForm, paidOnCall: e.target.checked })}
                    className="mt-0.5 rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-emerald-950">
                      Payment already received on call (UPI / Bank Transfer / Cash)
                    </span>
                    <p className="text-[11px] text-emerald-800 mt-0.5">
                      Check this if the client has already transferred payment on call. The order will be immediately saved as <strong>PAID (COMPLETED)</strong>.
                    </p>
                  </div>
                </label>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Admin Call Notes (optional)
                </label>
                <input
                  type="text"
                  value={onCallForm.notes}
                  onChange={(e) => setOnCallForm({ ...onCallForm, notes: e.target.value })}
                  placeholder="e.g. Agreed 20% discount on call, delivery promised in 5 days"
                  className={inputCls}
                />
              </div>

              {/* Live Price Summary */}
              <div className="p-3.5 rounded-xl border border-purple-200 bg-purple-50/50 space-y-1.5">
                <div className="flex justify-between items-center text-xs text-slate-600">
                  <span>Package Base Price:</span>
                  <span className="font-semibold text-slate-900">{formatInr(onCallPricing.basePrice)}</span>
                </div>
                {onCallPricing.pct > 0 && (
                  <div className="flex justify-between items-center text-xs text-emerald-700 font-medium">
                    <span>Discount ({onCallPricing.pct}% OFF):</span>
                    <span>-₹{onCallPricing.discountAmount.toLocaleString("en-IN")}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-sm font-bold text-slate-900 pt-1 border-t border-purple-200">
                  <span>Order Total:</span>
                  <span className="text-purple-700 font-mono">{formatInr(onCallPricing.finalTotal)}</span>
                </div>
                {onCallForm.paymentPlan === "advance" && (
                  <div className="flex justify-between items-center text-xs text-slate-700 pt-1">
                    <span>Pay Now (50% Advance):</span>
                    <span className="font-bold text-emerald-700 font-mono">{formatInr(onCallPricing.payNow)} (Balance later: {formatInr(onCallPricing.balance)})</span>
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOnCallModal(false)}
                  className="h-9 px-4 rounded-md border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={onCallBusy}
                  className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-60 cursor-pointer"
                >
                  {onCallBusy ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Creating Order...
                    </>
                  ) : onCallForm.paidOnCall ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" /> Create & Mark as Paid
                    </>
                  ) : (
                    <>
                      <Phone className="w-4 h-4" /> Create Order & Generate Pay Link
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
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

function StatusPill({ text, tone }: { text: string; tone?: "blue" | "amber" | "slate" | "emerald" }) {
  // Closed / Delivered always show green.
  if (!tone || text === "Closed" || text === "Delivered") tone = text === "Closed" || text === "Delivered" ? "emerald" : tone || "blue";
  const c =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-700 border-emerald-300"
      : tone === "amber"
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

function Field({ label, hint, children }: { label: string; hint?: string | undefined; children: React.ReactNode }) {
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

/** Pick a value from the list, or choose "Custom…" and type any value. */
function ComboField({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[]; placeholder?: string }) {
  const [custom, setCustom] = useState(() => !!value && !options.includes(value));
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <select
        value={custom ? "__custom" : value}
        onChange={(e) => {
          if (e.target.value === "__custom") {
            setCustom(true);
            onChange("");
          } else {
            setCustom(false);
            onChange(e.target.value);
          }
        }}
        className={`${inputCls} ${custom ? "sm:w-[46%] sm:shrink-0" : ""}`}
      >
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
        <option value="__custom">Custom (type your own)…</option>
      </select>
      {custom && <input autoFocus value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder || "Type here"} className={inputCls} />}
    </div>
  );
}

type PaymentForm = { paymentStatus: string; dealAmount: string; amountPaid: string; paymentReceived: boolean; balanceReceived: boolean };

/** Green when the money is received; click again to undo. */
function ReceivedButton({ on, onClick, disabled, title }: { on: boolean; onClick: () => void; disabled?: boolean; title?: string | undefined }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border px-3 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        on ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-500" : "border-slate-300 bg-white text-slate-700 hover:border-emerald-500 hover:text-emerald-700"
      }`}
    >
      {on ? <CheckCircle2 className="h-4 w-4" /> : <Check className="h-4 w-4" />} {on ? "Received" : "Mark Received"}
    </button>
  );
}

/**
 * Payment for a lead:
 *  - Not Paid       → total deal amount only
 *  - Full Paid      → total amount + Received button
 *  - Partially Paid → total, amount paid + Received button, balance (auto) + Received button.
 *    It turns into Full Paid only once the balance is marked Received.
 */
function PaymentFields<T extends PaymentForm>({ form, setForm }: { form: T; setForm: (f: T) => void }) {
  const status = LEAD_PAYMENT_STATUSES.includes(form.paymentStatus) ? form.paymentStatus : form.paymentStatus ? "Partially Paid" : "Not Paid";
  const deal = cleanMoney(form.dealAmount);
  const paid = cleanMoney(form.amountPaid);
  const balance = Math.max(0, deal - paid);
  const set = (patch: Partial<PaymentForm>) => setForm({ ...form, ...patch });
  const num = (v: string) => v.replace(/[^0-9.]/g, "");
  const twoParts = status === "Full Paid" && form.balanceReceived;
  const paidTooHigh = status === "Partially Paid" && deal > 0 && paid >= deal;

  const chooseStatus = (st: string) => {
    if (st === "Not Paid") set({ paymentStatus: st, amountPaid: "", paymentReceived: false, balanceReceived: false });
    else if (st === "Full Paid") set({ paymentStatus: st, amountPaid: deal ? String(deal) : "", paymentReceived: false, balanceReceived: false });
    else set({ paymentStatus: st, amountPaid: paid && paid < deal ? form.amountPaid : "", paymentReceived: false, balanceReceived: false });
  };

  return (
    <div className="rounded-md border border-emerald-200 bg-emerald-500/[0.04] p-3">
      <div className="mb-2.5 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-emerald-700">
        <Wallet className="h-3.5 w-3.5" /> Payment
      </div>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <Field label="Payment Status">
          <select value={status} onChange={(e) => chooseStatus(e.target.value)} className={inputCls}>
            {LEAD_PAYMENT_STATUSES.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </Field>
        <Field label={status === "Full Paid" ? "Total Amount (₹)" : "Total Deal Amount (₹)"}>
          <input
            inputMode="decimal"
            value={form.dealAmount}
            onChange={(e) => {
              const v = num(e.target.value);
              set(status === "Full Paid" && !form.balanceReceived ? { dealAmount: v, amountPaid: v } : { dealAmount: v });
            }}
            placeholder="e.g. 8999"
            className={inputCls}
          />
        </Field>
        {status === "Full Paid" && (
          <Field label="Payment" {...(twoParts ? { hint: `Received in 2 parts: ${inr(paid)} + ${inr(balance)}` } : {})}>
            <ReceivedButton
              on={form.paymentReceived || form.balanceReceived}
              disabled={!deal}
              title={!deal ? "Enter the amount first" : undefined}
              onClick={() =>
                twoParts
                  ? set({ paymentStatus: "Partially Paid", balanceReceived: false }) // undo the balance → back to Partially Paid
                  : set({ paymentReceived: !form.paymentReceived })
              }
            />
          </Field>
        )}
      </div>

      {status === "Partially Paid" && (
        <div className="mt-3.5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <Field label="Amount Paid (₹)" {...(paidTooHigh ? { hint: "Must be less than the total — choose Full Paid instead." } : {})}>
            <div className="flex gap-2">
              <input
                inputMode="decimal"
                value={form.amountPaid}
                onChange={(e) => set({ amountPaid: num(e.target.value), paymentReceived: false, balanceReceived: false })}
                placeholder="e.g. 4500"
                className={inputCls}
              />
              <ReceivedButton
                on={form.paymentReceived}
                disabled={!paid || paidTooHigh}
                title={!paid ? "Enter the amount paid first" : undefined}
                onClick={() => set({ paymentReceived: !form.paymentReceived, balanceReceived: false })}
              />
            </div>
          </Field>
          <Field label="Balance (₹)" hint={form.paymentReceived ? "Mark Received when the balance is paid — the lead then becomes Full Paid." : "Mark the paid amount Received first."}>
            <div className="flex gap-2">
              <input value={deal ? String(balance) : ""} readOnly placeholder="Total − amount paid" className={`${inputCls} bg-slate-50 font-semibold text-amber-700`} />
              <ReceivedButton
                on={false}
                disabled={!form.paymentReceived || !balance || paidTooHigh}
                onClick={() => set({ paymentStatus: "Full Paid", balanceReceived: true })}
              />
            </div>
          </Field>
        </div>
      )}
    </div>
  );
}

/** File picker used in "Add New Lead" (files upload right after the lead is saved). */
function AttachmentPicker({ files, setFiles, onError, note }: { files: File[]; setFiles: (f: File[]) => void; onError: (msg: string) => void; note?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-slate-600">
          <Paperclip className="h-3.5 w-3.5" /> Attach Files <span className="font-normal normal-case tracking-normal text-slate-500">(PNG, JPG, PDF, DOC, CSV · max 10 MB each)</span>
        </div>
        <button type="button" onClick={() => ref.current?.click()} className={btnGhost}>
          <Upload className="h-4 w-4" /> Choose files
        </button>
        <input
          ref={ref}
          type="file"
          multiple
          accept={LEAD_FILE_ACCEPT}
          className="hidden"
          onChange={(e) => {
            const picked = Array.from(e.target.files || []);
            e.target.value = "";
            const ok: File[] = [];
            for (const f of picked) {
              const p = leadFileProblem(f);
              if (p) onError(p);
              else ok.push(f);
            }
            if (ok.length) setFiles([...files, ...ok].slice(0, 10));
          }}
        />
      </div>
      {files.length > 0 && (
        <ul className="mt-2.5 space-y-1.5">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[13px]">
              <FileText className="h-4 w-4 shrink-0 text-purple-600" />
              <span className="min-w-0 flex-1 truncate text-slate-800">{f.name}</span>
              <span className="shrink-0 text-[11px] text-slate-500">{fileSizeLabel(f.size)}</span>
              <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="shrink-0 text-slate-400 hover:text-red-600" aria-label={`Remove ${f.name}`}>
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {note && <p className="mt-2 text-[12px] font-medium text-purple-700">{note}</p>}
    </div>
  );
}

/** Attachments on a lead: list, download, add more, remove. */
function LeadAttachments({ leadId, token, canEdit, canDeleteAll, myName, notify }: {
  leadId: string;
  token: () => string;
  canEdit: boolean;
  canDeleteAll: boolean;
  myName: string;
  notify: (msg: string, kind?: "success" | "error" | "info") => void;
}) {
  const [files, setFiles] = useState<{ id: string; name: string; type: string; size: number; uploadedBy: string; createdAt: string }[] | null>(null);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [note, setNote] = useState("");
  const [busyId, setBusyId] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => {
    const r: any = await crmListLeadFilesFn({ data: { token: token(), leadId } }).catch(() => null);
    if (r?.ok) {
      setFiles(r.files);
      setSetupNeeded(!!r.setupNeeded);
    } else setFiles([]);
  }, [leadId, token]);
  useEffect(() => {
    setFiles(null);
    load();
  }, [load]);

  const addFiles = async (picked: File[]) => {
    for (let i = 0; i < picked.length; i++) {
      const f = picked[i]!;
      const p = leadFileProblem(f);
      if (p) {
        notify(p, "error");
        continue;
      }
      setNote(`Uploading ${f.name}…`);
      const err = await uploadLeadFile(token(), leadId, f, (pct) => setNote(`Uploading ${f.name} (${pct}%)`));
      if (err) notify(err, "error");
      else notify(`${f.name} attached.`);
    }
    setNote("");
    load();
  };
  const download = async (id: string) => {
    setBusyId(id);
    const r: any = await crmDownloadLeadFileFn({ data: { token: token(), fileId: id } }).catch(() => null);
    setBusyId("");
    if (!r?.ok) return notify(r?.error || "Could not download the file.", "error");
    const parts = (r.parts as string[]).map((b64) => {
      const bin = atob(b64);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    });
    const url = URL.createObjectURL(new Blob(parts, { type: r.type || "application/octet-stream" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = r.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  const remove = async (f: { id: string; name: string }) => {
    if (!window.confirm(`Remove "${f.name}" from this lead?`)) return;
    setBusyId(f.id);
    const r: any = await crmDeleteLeadFileFn({ data: { token: token(), fileId: f.id } }).catch(() => null);
    setBusyId("");
    if (!r?.ok) return notify(r?.error || "Could not remove the file.", "error");
    notify(`${f.name} removed.`);
    load();
  };

  return (
    <DetailCard
      icon={<Paperclip className="w-4 h-4" />}
      title="Attachments"
      right={
        canEdit && !setupNeeded ? (
          <>
            <button type="button" onClick={() => ref.current?.click()} className={btnGhost} disabled={!!note}>
              <Upload className="h-4 w-4" /> Add files
            </button>
            <input
              ref={ref}
              type="file"
              multiple
              accept={LEAD_FILE_ACCEPT}
              className="hidden"
              onChange={(e) => {
                const picked = Array.from(e.target.files || []);
                e.target.value = "";
                if (picked.length) addFiles(picked);
              }}
            />
          </>
        ) : undefined
      }
    >
      {setupNeeded ? (
        <p className="text-sm text-amber-700">
          File attachments need a one-time database update: run the “Lead attachments” SQL (supabase-schema.sql, section 9) in Supabase → SQL Editor.
        </p>
      ) : files === null ? (
        <p className="text-sm text-slate-500">Loading files…</p>
      ) : files.length === 0 && !note ? (
        <p className="text-sm text-slate-500">No files attached yet. PNG, JPG, PDF, DOC and CSV files up to 10 MB can be added.</p>
      ) : (
        <ul className="space-y-2">
          {files.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
              <FileText className="h-4 w-4 shrink-0 text-purple-600" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-slate-900">{f.name}</div>
                <div className="text-[11px] text-slate-500">
                  {fileSizeLabel(f.size)} · {f.uploadedBy || "Admin"} · {fmtIst(f.createdAt)}
                </div>
              </div>
              <button type="button" onClick={() => download(f.id)} disabled={busyId === f.id} className={btnGhost}>
                <Download className="h-4 w-4" /> {busyId === f.id ? "…" : "Download"}
              </button>
              {(canDeleteAll || f.uploadedBy === myName) && (
                <button type="button" onClick={() => remove(f)} disabled={busyId === f.id} className={btnDanger} aria-label={`Remove ${f.name}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {note && <p className="mt-2 text-[12px] font-medium text-purple-700">{note}</p>}
    </DetailCard>
  );
}

/** Orders & Payments period: All time · month calendar (◀ month ▶) · From → To dates. */
function PeriodBar({ value, onChange, counts }: { value: OrdersPeriod; onChange: (v: OrdersPeriod) => void; counts: Record<string, number> }) {
  const cur = value.month || thisIstMonth();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => Number(cur.slice(0, 4)));
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const pickMonth = (m: string) => {
    onChange({ mode: "month", month: m, from: "", to: "" });
    setYear(Number(m.slice(0, 4)));
  };
  const today = thisIstMonth();
  const chip = (active: boolean) =>
    `inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition-colors ${
      active ? "bg-purple-600 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
    }`;
  return (
    <div className={`${card} flex flex-col gap-3 p-3 sm:p-4 xl:flex-row xl:items-center`}>
      <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-slate-600">
        <CalendarDays className="h-4 w-4 text-purple-600" /> Period
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => onChange({ ...value, mode: "all", from: "", to: "" })} className={chip(value.mode === "all")}>
          All time
        </button>
        <div ref={boxRef} className="relative flex items-center">
          <button type="button" aria-label="Previous month" onClick={() => pickMonth(shiftMonth(cur, -1))} className="inline-flex h-9 w-9 items-center justify-center rounded-l-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-100">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setYear(Number(cur.slice(0, 4)));
              setOpen((o) => !o);
            }}
            className={`inline-flex h-9 min-w-[150px] items-center justify-center gap-1.5 border-y px-3 text-[13px] font-semibold ${
              value.mode === "month" ? "border-purple-600 bg-purple-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
            }`}
          >
            <CalendarDays className="h-4 w-4" /> {value.mode === "month" ? monthLabel(value.month) : "Select month"}
          </button>
          <button type="button" aria-label="Next month" onClick={() => pickMonth(shiftMonth(cur, 1))} className="inline-flex h-9 w-9 items-center justify-center rounded-r-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-100">
            <ChevronRight className="h-4 w-4" />
          </button>
          {open && (
            <div className="absolute right-0 top-full z-30 mt-2 w-[290px] max-w-[calc(100vw-2rem)] rounded-lg border border-slate-200 bg-white p-3 shadow-xl sm:left-0 sm:right-auto">
              <div className="mb-2 flex items-center justify-between">
                <button type="button" aria-label="Previous year" onClick={() => setYear((y) => y - 1)} className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="text-sm font-bold text-slate-900">{year}</div>
                <button type="button" aria-label="Next year" onClick={() => setYear((y) => y + 1)} className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {MONTH_NAMES.map((name, i) => {
                  const key = `${year}-${String(i + 1).padStart(2, "0")}`;
                  const n = counts[key] || 0;
                  const selected = value.mode === "month" && value.month === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        pickMonth(key);
                        setOpen(false);
                      }}
                      className={`flex flex-col items-center rounded-md border px-1 py-1.5 text-[13px] transition-colors ${
                        selected
                          ? "border-purple-600 bg-purple-600 text-white"
                          : key === today
                            ? "border-purple-300 bg-purple-50 text-purple-800 hover:bg-purple-100"
                            : "border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <span className="font-semibold">{name}</span>
                      <span className={`text-[10px] ${selected ? "text-purple-100" : n ? "text-emerald-700 font-semibold" : "text-slate-400"}`}>
                        {n ? `${n} order${n === 1 ? "" : "s"}` : "—"}
                      </span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => {
                  pickMonth(today);
                  setOpen(false);
                }}
                className="mt-2 w-full rounded-md border border-slate-200 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-100"
              >
                This month
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 xl:ml-auto">
        <span className="text-[12px] text-slate-500">From</span>
        <input
          type="date"
          value={value.mode === "range" ? value.from : ""}
          max={value.mode === "range" && value.to ? value.to : undefined}
          onChange={(e) => onChange({ ...value, mode: "range", from: e.target.value, to: value.mode === "range" ? value.to : "" })}
          className="h-9 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2.5 text-[13px] text-slate-900 [color-scheme:light] focus:border-purple-500 focus:outline-none sm:w-40 sm:flex-none"
        />
        <span className="text-[12px] text-slate-500">to</span>
        <input
          type="date"
          value={value.mode === "range" ? value.to : ""}
          min={value.mode === "range" && value.from ? value.from : undefined}
          onChange={(e) => onChange({ ...value, mode: "range", to: e.target.value, from: value.mode === "range" ? value.from : "" })}
          className="h-9 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2.5 text-[13px] text-slate-900 [color-scheme:light] focus:border-purple-500 focus:outline-none sm:w-40 sm:flex-none"
        />
        {value.mode !== "all" && (
          <button type="button" onClick={() => onChange({ ...value, mode: "all", from: "", to: "" })} className={btnGhost}>
            <RotateCcw className="h-4 w-4" /> Clear
          </button>
        )}
      </div>
    </div>
  );
}
