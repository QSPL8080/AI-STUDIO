import { useState, useEffect, useRef, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  BellRing,
  Calendar,
  CalendarCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  CreditCard,
  DollarSign,
  Download,
  Edit,
  ExternalLink,
  Eye,
  EyeOff,
  Filter,
  Layers,
  Lock,
  LogOut,
  Mail,
  MessageSquare,
  Moon,
  Package,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  Video,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import type { Lead, LeadStatus, ProjectStatus, Order, PaymentStatus, AdminUser, ActivityLog, LoginLog, CalendlyMeeting, CRMNotification } from "@/lib/db";
import {
  fetchLeadsServerFn,
  addManualLeadServerFn,
  updateLeadDetailsServerFn,
  updateLeadStatusServerFn,
  updateProjectStatusServerFn,
  softDeleteLeadServerFn,
  restoreLeadServerFn,
  permanentDeleteLeadServerFn,
  fetchActivityLogsServerFn,
  addActivityLogServerFn,
  recordLoginLogServerFn,
  fetchLoginLogsServerFn,
  fetchAdminUsersServerFn,
  createAdminUserServerFn,
  toggleAdminUserStatusServerFn,
  deleteAdminUserServerFn,
  fetchCalendlyMeetingsServerFn,
  saveCalendlyMeetingServerFn,
  updateCalendlyMeetingServerFn,
  deleteCalendlyMeetingServerFn,
  sendTestCalendlyBookingServerFn,
  fetchNotificationsServerFn,
  markNotificationReadServerFn,
  markAllNotificationsReadServerFn,
  clearNotificationsServerFn,
  broadcastLeadEvent,
} from "@/lib/lead-actions";
import {
  fetchOrdersServerFn,
  updateOrderStatusServerFn,
  deleteOrderServerFn,
  broadcastOrderEvent,
  verifyPaymentPinServerFn,
} from "@/lib/paypal-actions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "CRM & Lead Management Portal | Quickupp AI Studio" }],
  }),
  component: AdminPage,
});

// Audio chime using Web Audio API
function playNotificationChime() {
  try {
    if (typeof window === "undefined") return;
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
    osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.22);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.55);
  } catch {}
}

const VIDEO_TYPES = [
  "AI UGC",
  "AI Avatar",
  "Product Video",
  "Cartoon",
  "Hyper Realistic",
  "Digital Twin",
  "Other",
];

interface AuthSession {
  email: string;
  name: string;
  role: "super_admin" | "admin";
}

function AdminPage() {
  // Theme State: White/Light by default as per requirements, switchable to dark
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    return (localStorage.getItem("ai_studio_crm_theme") as "light" | "dark") || "light";
  });

  const isDark = theme === "dark";

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("ai_studio_crm_theme", next);
  };

  // Authentication & Role State
  const [session, setSession] = useState<AuthSession | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [authError, setAuthError] = useState("");

  // Tabs Navigation
  type TabType = "leads" | "orders" | "calendly" | "activity" | "users" | "security" | "recycle_bin" | "settings";
  const [activeTab, setActiveTab] = useState<TabType>("leads");

  // Leads Data
  const [leads, setLeads] = useState<Lead[]>([]);
  const [recycleBinLeads, setRecycleBinLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Search & Filtering State (Section 11: Filters & Search)
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSource, setFilterSource] = useState<string>("All");
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [filterProjectStatus, setFilterProjectStatus] = useState<string>("All");
  const [filterVideoType, setFilterVideoType] = useState<string>("All");
  const [filterLocation, setFilterLocation] = useState<string>("");
  const [filterClosedBy, setFilterClosedBy] = useState<string>("All");
  const [filterDateType, setFilterDateType] = useState<"created_at" | "meeting_date" | "closed_at" | "delivery_date">("created_at");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Applied Filters State (Controlled by Apply Filters / Clear Filters buttons)
  const [appliedFilters, setAppliedFilters] = useState({
    search: "",
    source: "All",
    status: "All",
    projectStatus: "All",
    videoType: "All",
    location: "",
    closedBy: "All",
    dateType: "created_at" as "created_at" | "meeting_date" | "closed_at" | "delivery_date",
    fromDate: "",
    toDate: "",
  });

  const handleApplyFilters = () => {
    setAppliedFilters({
      search: searchTerm,
      source: filterSource,
      status: filterStatus,
      projectStatus: filterProjectStatus,
      videoType: filterVideoType,
      location: filterLocation,
      closedBy: filterClosedBy,
      dateType: filterDateType,
      fromDate: fromDate,
      toDate: toDate,
    });
    showToast("Filters applied");
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setFilterSource("All");
    setFilterStatus("All");
    setFilterProjectStatus("All");
    setFilterVideoType("All");
    setFilterLocation("");
    setFilterClosedBy("All");
    setFilterDateType("created_at");
    setFromDate("");
    setToDate("");
    setAppliedFilters({
      search: "",
      source: "All",
      status: "All",
      projectStatus: "All",
      videoType: "All",
      location: "",
      closedBy: "All",
      dateType: "created_at",
      fromDate: "",
      toDate: "",
    });
    showToast("All filters cleared");
  };

  // Selection & Bulk Actions
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());

  // Orders State
  const [orders, setOrders] = useState<Order[]>([]);
  const [filterOrderStatus, setFilterOrderStatus] = useState<string>("COMPLETED");
  const [orderSearchTerm, setOrderSearchTerm] = useState("");
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<Order | null>(null);
  // Payment Tab PIN Security State
  const [isPaymentUnlocked, setIsPaymentUnlocked] = useState(false);
  const [showPaymentPinModal, setShowPaymentPinModal] = useState(false);
  const [paymentPinInput, setPaymentPinInput] = useState("");
  const [paymentPinError, setPaymentPinError] = useState("");
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);
  const [showPaymentPin, setShowPaymentPin] = useState(false);
  const pendingOrdersCallbackRef = useRef<(() => void) | null>(null);

  const handleSelectOrdersTab = (callback?: () => void) => {
    if (isPaymentUnlocked) {
      setActiveTab("orders");
      if (callback) callback();
    } else {
      pendingOrdersCallbackRef.current = callback || null;
      setPaymentPinInput("");
      setPaymentPinError("");
      setShowPaymentPinModal(true);
    }
  };

  const handleUnlockPaymentPin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!paymentPinInput.trim()) {
      setPaymentPinError("Please enter the security PIN.");
      return;
    }

    setIsVerifyingPin(true);
    setPaymentPinError("");

    try {
      const res = await verifyPaymentPinServerFn({
        data: { pin: paymentPinInput },
      });

      if (res.success) {
        setIsPaymentUnlocked(true);
        setShowPaymentPinModal(false);
        setPaymentPinInput("");
        setPaymentPinError("");
        setActiveTab("orders");
        if (pendingOrdersCallbackRef.current) {
          pendingOrdersCallbackRef.current();
          pendingOrdersCallbackRef.current = null;
        }
      } else {
        setPaymentPinError(res.error || "Incorrect PIN. Please enter the valid security PIN.");
      }
    } catch (err: any) {
      setPaymentPinError(err?.message || "Failed to verify PIN with server.");
    } finally {
      setIsVerifyingPin(false);
    }
  };


  // Calendly Meetings State
  const [meetings, setMeetings] = useState<CalendlyMeeting[]>([]);
  const [meetingSearchTerm, setMeetingSearchTerm] = useState("");
  const [meetingStatusFilter, setMeetingStatusFilter] = useState<string>("all");
  const [isSendingTestMeeting, setIsSendingTestMeeting] = useState(false);
  const [calendlyWebhookCopied, setCalendlyWebhookCopied] = useState(false);

  // CRM Notifications State (Image 2 & Image 3)
  const [notifications, setNotifications] = useState<CRMNotification[]>([]);
  const [showNotificationsPopover, setShowNotificationsPopover] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState<"all" | "unread" | "meeting" | "lead">("all");

  // Activity & Login Logs State
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loginLogs, setLoginLogs] = useState<LoginLog[]>([]);

  // Admin Users Management State
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);

  // Modals State
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [viewLeadDetails, setViewLeadDetails] = useState<Lead | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [closingLead, setClosingLead] = useState<Lead | null>(null);
  const [deliveringLead, setDeliveringLead] = useState<Lead | null>(null);
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [showAddMeetingModal, setShowAddMeetingModal] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<CalendlyMeeting | null>(null);
  const [selectedLeadForMsg, setSelectedLeadForMsg] = useState<Lead | null>(null);

  // Real-time Sync & Notification State
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const [refreshCountdown, setRefreshCountdown] = useState<number>(10);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("ai_studio_sound_enabled") !== "false";
  });
  const [newLeadNotification, setNewLeadNotification] = useState<Lead | null>(null);
  const [newOrderNotification, setNewOrderNotification] = useState<Order | null>(null);
  const [highlightedLeadIds, setHighlightedLeadIds] = useState<Set<string>>(new Set());
  const [highlightedOrderIds, setHighlightedOrderIds] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const isSuperAdmin = session?.role === "super_admin";

  // Refs for real-time handlers
  const leadsRef = useRef<Lead[]>(leads);
  useEffect(() => {
    leadsRef.current = leads;
  }, [leads]);

  const ordersRef = useRef<Order[]>(orders);
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  // Session Restore on initial mount
  useEffect(() => {
    const savedSession = localStorage.getItem("ai_studio_auth_session");
    if (savedSession) {
      try {
        const parsed: AuthSession = JSON.parse(savedSession);
        setSession(parsed);
        fetchAllData(false);
      } catch {
        localStorage.removeItem("ai_studio_auth_session");
      }
    } else {
      const savedEmail = localStorage.getItem("ai_studio_remembered_email");
      if (savedEmail) {
        setEmailInput(savedEmail);
        setRememberMe(true);
      }
    }
  }, []);

  // 5-Minute Inactivity Auto-Logout
  useEffect(() => {
    if (!session) return;
    let timeoutId: NodeJS.Timeout;

    const resetInactivityTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        handleLogout();
        setAuthError("You were logged out due to 5 minutes of inactivity for security.");
      }, 300000);
    };

    const activityEvents = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];
    activityEvents.forEach((event) => {
      window.addEventListener(event, resetInactivityTimer, { passive: true });
    });

    resetInactivityTimer();

    return () => {
      clearTimeout(timeoutId);
      activityEvents.forEach((event) => {
        window.removeEventListener(event, resetInactivityTimer);
      });
    };
  }, [session]);

  // Real-Time Incoming Notifications
  const handleIncomingLead = (newLead: Lead) => {
    if (!newLead || !newLead.id) return;

    setLeads((prev) => {
      const exists = prev.some((l) => l.id === newLead.id);
      if (exists) {
        return prev.map((l) => (l.id === newLead.id ? newLead : l));
      }
      return [newLead, ...prev];
    });

    setHighlightedLeadIds((prev) => new Set([...prev, newLead.id]));
    setTimeout(() => {
      setHighlightedLeadIds((prev) => {
        const next = new Set(prev);
        next.delete(newLead.id);
        return next;
      });
    }, 10000);

    if (soundEnabled) playNotificationChime();
    setNewLeadNotification(newLead);
    setLastSyncTime(new Date());

    setTimeout(() => {
      setNewLeadNotification((curr) => (curr?.id === newLead.id ? null : curr));
    }, 7000);
  };

  const handleIncomingOrder = (newOrder: Order) => {
    if (!newOrder || !newOrder.id) return;

    setOrders((prev) => {
      const exists = prev.some((o) => o.id === newOrder.id);
      if (exists) {
        return prev.map((o) => (o.id === newOrder.id ? newOrder : o));
      }
      return [newOrder, ...prev];
    });

    setHighlightedOrderIds((prev) => new Set([...prev, newOrder.id]));
    setTimeout(() => {
      setHighlightedOrderIds((prev) => {
        const next = new Set(prev);
        next.delete(newOrder.id);
        return next;
      });
    }, 10000);

    if (soundEnabled) playNotificationChime();
    setNewOrderNotification(newOrder);
    setLastSyncTime(new Date());

    setTimeout(() => {
      setNewOrderNotification((curr) => (curr?.id === newOrder.id ? null : curr));
    }, 7000);
  };

  // 10-Second Auto-Refresh & Cross-Tab Listeners
  useEffect(() => {
    if (!session) return;

    const countdownTimer = setInterval(() => {
      setRefreshCountdown((prev) => (prev <= 1 ? 10 : prev - 1));
    }, 1000);

    const intervalId = setInterval(() => {
      fetchAllData(true);
      setRefreshCountdown(10);
    }, 10000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchAllData(true);
        setRefreshCountdown(10);
      }
    };
    const handleFocus = () => {
      fetchAllData(true);
      setRefreshCountdown(10);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    let bcLeads: BroadcastChannel | null = null;
    let bcOrders: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      try {
        bcLeads = new BroadcastChannel("ai_studio_leads_sync");
        bcLeads.onmessage = (event) => {
          if (event.data?.type === "NEW_LEAD" && event.data.lead) {
            handleIncomingLead(event.data.lead);
          } else {
            fetchAllData(true);
          }
        };

        bcOrders = new BroadcastChannel("ai_studio_orders_sync");
        bcOrders.onmessage = (event) => {
          if (event.data?.type === "NEW_ORDER" && event.data.order) {
            handleIncomingOrder(event.data.order);
          } else {
            fetchAllData(true);
          }
        };
      } catch (e) {
        console.warn("BroadcastChannel error:", e);
      }
    }

    const handleCustomLeadEvent = (e: Event) => {
      const ce = e as CustomEvent;
      if (ce.detail?.type === "NEW_LEAD" && ce.detail.lead) {
        handleIncomingLead(ce.detail.lead);
      } else {
        fetchAllData(true);
      }
    };
    window.addEventListener("ai_studio_lead_event", handleCustomLeadEvent);

    return () => {
      clearInterval(countdownTimer);
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      if (bcLeads) bcLeads.close();
      if (bcOrders) bcOrders.close();
      window.removeEventListener("ai_studio_lead_event", handleCustomLeadEvent);
    };
  }, [session, soundEnabled]);

  // Data Fetching
  const fetchAllData = async (silent = false) => {
    if (!silent) setLoading(true);
    else setIsSyncing(true);

    try {
      await Promise.all([
        fetchLeadsList(),
        fetchRecycleBinList(),
        fetchOrdersList(),
        fetchMeetingsList(),
        fetchNotificationsList(),
        fetchLogsList(),
        fetchAdminUsersList(),
      ]);
      setLastSyncTime(new Date());
    } finally {
      if (!silent) setLoading(false);
      setIsSyncing(false);
    }
  };

  const fetchLeadsList = async () => {
    try {
      const res = await fetchLeadsServerFn({ data: { includeDeleted: false } });
      if (res.success && res.leads) {
        setLeads(res.leads);
        localStorage.setItem("ai_studio_local_leads", JSON.stringify(res.leads));
      } else {
        const local = localStorage.getItem("ai_studio_local_leads");
        if (local) setLeads(JSON.parse(local));
      }
    } catch {
      const local = localStorage.getItem("ai_studio_local_leads");
      if (local) setLeads(JSON.parse(local));
    }
  };

  const fetchRecycleBinList = async () => {
    try {
      const res = await fetchLeadsServerFn({ data: { includeDeleted: true } });
      if (res.success && res.leads) {
        const deleted = res.leads.filter((l) => Boolean(l.deleted_at));
        setRecycleBinLeads(deleted);
      }
    } catch {}
  };

  const fetchOrdersList = async () => {
    try {
      const res = await fetchOrdersServerFn();
      if (res.success && res.orders) setOrders(res.orders);
    } catch {}
  };

  const fetchMeetingsList = async () => {
    try {
      const res = await fetchCalendlyMeetingsServerFn();
      if (res.success && res.meetings) setMeetings(res.meetings);
    } catch {}
  };

  const fetchNotificationsList = async () => {
    try {
      const res = await fetchNotificationsServerFn({ data: { limit: 50 } });
      if (res.success && res.notifications) setNotifications(res.notifications);
    } catch {}
  };

  const fetchLogsList = async () => {
    try {
      const [actRes, logRes] = await Promise.all([
        fetchActivityLogsServerFn({ data: 100 }),
        fetchLoginLogsServerFn({ data: 100 }),
      ]);
      if (actRes.success && actRes.logs) setActivityLogs(actRes.logs);
      if (logRes.success && logRes.logs) setLoginLogs(logRes.logs);
    } catch {}
  };

  const fetchAdminUsersList = async () => {
    try {
      const res = await fetchAdminUsersServerFn();
      if (res.success && res.users) {
        setAdminUsers(res.users);
      }
    } catch {}
  };

  // Authentication Handler with IP/Security Tracking
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = emailInput.trim().toLowerCase();
    const cleanPass = passwordInput.trim();

    // 1. Super Admin Credentials (superadmin@aistudio.com / SA@123 or sa@aistudio.com / Anay@123)
    let authRole: "super_admin" | "admin" | null = null;
    let authName = "Admin";

    if (
      (cleanEmail === "superadmin@aistudio.com" && cleanPass === "SA@123") ||
      (cleanEmail === "sa@aistudio.com" && (cleanPass === "Anay@123" || cleanPass === "SA@123"))
    ) {
      authRole = "super_admin";
      authName = "Super Admin";
    }
    // 2. Operational Admin Credentials
    else if (
      (cleanEmail === "admin@aistudio.com" && cleanPass === "Admin@123") ||
      (cleanEmail === "qsaistudio@gmail.com" && cleanPass === "Anay@0079") ||
      (cleanEmail === "info@quickuppaistudio.us" && cleanPass === "Admin@123") ||
      (cleanEmail === "admin" && cleanPass === "admin")
    ) {
      authRole = "admin";
      authName = "Admin";
    } else {
      // 3. Check dynamically registered admin users in database/local state
      const dynamicUser = adminUsers.find(
        (u) => u.email.toLowerCase() === cleanEmail && u.password === cleanPass && u.status === "active"
      );
      if (dynamicUser) {
        authRole = dynamicUser.role;
        authName = dynamicUser.name;
      }
    }

    if (authRole) {
      const userSession: AuthSession = {
        email: cleanEmail,
        name: authName,
        role: authRole,
      };

      setSession(userSession);
      localStorage.setItem("ai_studio_auth_session", JSON.stringify(userSession));

      if (rememberMe) {
        localStorage.setItem("ai_studio_remembered_email", cleanEmail);
      } else {
        localStorage.removeItem("ai_studio_remembered_email");
      }

      setAuthError("");
      fetchAllData(false);

      // Record Login Audit Log with Real IP & Geolocation
      try {
        let ipAddress = "127.0.0.1";
        let location = "India / Web Client";
        try {
          const ipRes = await fetch("https://api.ipify.org?format=json");
          const ipData = await ipRes.json();
          if (ipData?.ip) {
            ipAddress = ipData.ip;
            try {
              const geoRes = await fetch(`https://ipwho.is/${ipAddress}`);
              const geoData = await geoRes.json();
              if (geoData && geoData.success !== false) {
                const parts = [geoData.city, geoData.region, geoData.country].filter(Boolean);
                if (parts.length > 0) {
                  location = parts.join(", ");
                }
              }
            } catch {
              const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
              if (tz.includes("Calcutta") || tz.includes("Kolkata") || tz.includes("Asia")) {
                location = "India / Web Client";
              }
            }
          }
        } catch {}

        await recordLoginLogServerFn({
          data: {
            email: cleanEmail,
            role: authRole,
            ip_address: ipAddress,
            location,
            user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "Web Browser",
            status: "success",
          },
        });
      } catch {}
    } else {
      setAuthError("Invalid credentials. Please verify your email and password.");
      try {
        await recordLoginLogServerFn({
          data: {
            email: cleanEmail,
            role: "unknown",
            ip_address: "Unknown IP",
            location: "Failed Attempt",
            user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "Web Browser",
            status: "failed",
          },
        });
      } catch {}
    }
  };

  const handleLogout = () => {
    setSession(null);
    localStorage.removeItem("ai_studio_auth_session");
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

  // Lead Actions
  const handleUpdateLeadStatus = async (
    lead: Lead,
    newStatus: LeadStatus,
    extra?: { deliveryDate?: string }
  ) => {
    if (newStatus === "Closed" && !extra?.deliveryDate) {
      // Prompt Closed Lead Modal to require Delivery Date
      setClosingLead(lead);
      return;
    }

    const updated = leads.map((l) =>
      l.id === lead.id
        ? {
            ...l,
            status: newStatus,
            closed_by: newStatus === "Closed" ? session?.name || "Admin" : l.closed_by,
            closed_at: newStatus === "Closed" ? new Date().toISOString() : l.closed_at,
            delivery_date: extra?.deliveryDate || l.delivery_date,
          }
        : l
    );
    setLeads(updated);
    localStorage.setItem("ai_studio_local_leads", JSON.stringify(updated));
    broadcastLeadEvent({ type: "UPDATE_LEAD", id: lead.id });

    try {
      await updateLeadStatusServerFn({
        data: {
          id: lead.id,
          status: newStatus,
          closedBy: session?.name || session?.email || "Admin",
          deliveryDate: extra?.deliveryDate,
          userRole: session?.role || "admin",
        },
      });
      showToast(`Lead status changed to ${newStatus}`);
      fetchLogsList();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateProjectStatus = async (
    lead: Lead,
    newProjectStatus: ProjectStatus,
    deliveryDate?: string
  ) => {
    if (newProjectStatus === "Delivered" && !lead.delivery_date && !deliveryDate) {
      setDeliveringLead(lead);
      return;
    }

    const updated = leads.map((l) =>
      l.id === lead.id
        ? {
            ...l,
            project_status: newProjectStatus,
            delivered_at: newProjectStatus === "Delivered" ? new Date().toISOString() : l.delivered_at,
            delivery_date: deliveryDate || l.delivery_date,
          }
        : l
    );
    setLeads(updated);
    localStorage.setItem("ai_studio_local_leads", JSON.stringify(updated));
    broadcastLeadEvent({ type: "UPDATE_LEAD", id: lead.id });

    try {
      await updateProjectStatusServerFn({
        data: {
          id: lead.id,
          projectStatus: newProjectStatus,
          deliveryDate: deliveryDate || lead.delivery_date,
          performedBy: session?.name || session?.email || "Admin",
          userRole: session?.role || "admin",
        },
      });
      showToast(`Project status set to ${newProjectStatus}`);
      fetchLogsList();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSoftDeleteLead = async (id: string) => {
    if (confirm("Are you sure you want to move this lead to the Recycle Bin?")) {
      const target = leads.find((l) => l.id === id);
      const updated = leads.filter((l) => l.id !== id);
      setLeads(updated);
      if (target) setRecycleBinLeads((prev) => [{ ...target, deleted_at: new Date().toISOString() }, ...prev]);
      localStorage.setItem("ai_studio_local_leads", JSON.stringify(updated));
      broadcastLeadEvent({ type: "DELETE_LEAD", id });

      try {
        await softDeleteLeadServerFn({
          data: {
            id,
            performedBy: session?.name || session?.email || "Admin",
            userRole: session?.role || "admin",
          },
        });
        showToast("Lead moved to Recycle Bin");
        fetchLogsList();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleRestoreLead = async (id: string) => {
    const target = recycleBinLeads.find((l) => l.id === id);
    setRecycleBinLeads((prev) => prev.filter((l) => l.id !== id));
    if (target) {
      const restored = { ...target, deleted_at: null };
      setLeads((prev) => [restored, ...prev]);
    }
    broadcastLeadEvent({ type: "RESTORE_LEAD", id });

    try {
      await restoreLeadServerFn({
        data: {
          id,
          performedBy: session?.name || session?.email || "Admin",
          userRole: session?.role || "admin",
        },
      });
      showToast("Lead restored successfully");
      fetchLogsList();
    } catch (err) {
      console.error(err);
    }
  };

  const handlePermanentDeleteLead = async (id: string) => {
    if (!isSuperAdmin) {
      alert("Only Super Admin can permanently delete records.");
      return;
    }
    if (confirm("WARNING: This will permanently delete this lead from the database. This action cannot be undone. Continue?")) {
      setRecycleBinLeads((prev) => prev.filter((l) => l.id !== id));
      try {
        await permanentDeleteLeadServerFn({
          data: {
            id,
            performedBy: session?.name || session?.email || "Super Admin",
            userRole: "super_admin",
          },
        });
        showToast("Lead permanently deleted");
        fetchLogsList();
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Bulk Actions
  const handleSelectAllLeads = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(filteredLeads.map((l) => l.id));
      setSelectedLeadIds(allIds);
    } else {
      setSelectedLeadIds(new Set());
    }
  };

  const handleToggleSelectLead = (id: string) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkStatusChange = async (newStatus: LeadStatus) => {
    if (selectedLeadIds.size === 0) return;
    if (confirm(`Change status of ${selectedLeadIds.size} selected leads to "${newStatus}"?`)) {
      for (const id of Array.from(selectedLeadIds)) {
        const lead = leads.find((l) => l.id === id);
        if (lead) await handleUpdateLeadStatus(lead, newStatus);
      }
      setSelectedLeadIds(new Set());
      showToast(`Updated ${selectedLeadIds.size} leads to ${newStatus}`);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedLeadIds.size === 0) return;
    if (confirm(`Move ${selectedLeadIds.size} selected leads to Recycle Bin?`)) {
      for (const id of Array.from(selectedLeadIds)) {
        await softDeleteLeadLeadServerFnWrapper(id);
      }
      setSelectedLeadIds(new Set());
      showToast(`Moved ${selectedLeadIds.size} leads to Recycle Bin`);
    }
  };

  const softDeleteLeadLeadServerFnWrapper = async (id: string) => {
    const target = leads.find((l) => l.id === id);
    setLeads((prev) => prev.filter((l) => l.id !== id));
    if (target) setRecycleBinLeads((prev) => [{ ...target, deleted_at: new Date().toISOString() }, ...prev]);
    try {
      await softDeleteLeadServerFn({
        data: {
          id,
          performedBy: session?.name || "Admin",
          userRole: session?.role || "admin",
        },
      });
    } catch {}
  };

  // Helper Functions
  const isLeadUsa = (lead: Lead | null | undefined): boolean => {
    if (!lead) return false;
    const src = (lead.source || "").toLowerCase().trim();
    const loc = (lead.location || "").toLowerCase().trim();
    return (
      src.startsWith("usa") ||
      src.includes("usa -") ||
      src.includes("united states") ||
      loc.includes("usa") ||
      loc.includes("united states") ||
      (lead.phone && lead.phone.startsWith("+1"))
    );
  };

  const sanitizePhoneNumber = (phone: string, isUsa: boolean = false) => {
    let clean = (phone || "").replace(/[^0-9]/g, "");
    if (clean.length === 10) {
      clean = isUsa ? `1${clean}` : `91${clean}`;
    }
    return clean;
  };

  const getAdminWhatsAppPlainText = (lead: Lead) => {
    const isUsa = isLeadUsa(lead);

    if (isUsa) {
      let msg = `Hi ${lead.name},\n\nThank you for reaching out to Quickupp AI Studio USA!\n\nWe have received your AI Video Production inquiry with the following details:\n\nClient Name: ${lead.name}`;
      if (lead.business) msg += `\nBusiness / Brand: ${lead.business}`;
      if (lead.video_type) msg += `\nVideo Format: ${lead.video_type}`;
      if (lead.video_quantity) msg += `\nVideo Quantity: ${lead.video_quantity}`;
      if (lead.location) msg += `\nLocation: ${lead.location}`;
      if (lead.requirement || lead.additional) msg += `\nProject Scope: ${lead.requirement || lead.additional}`;

      msg += `\n\nOur team is reviewing your requirements and preparing custom sample concepts, video reels, and a tailored quote for your project.\n\nCould you please confirm if you have a target turnaround timeline or any reference video links in mind?\n\nBest regards,\nQuickupp AI Studio Team (USA)`;
      return msg;
    }

    let msg = `Hello ${lead.name},\n\nThank you for reaching out to Quickupp AI Studio!\n\nWe have received your AI video inquiry with the following details:\n\nClient Name: ${lead.name}`;
    if (lead.business) msg += `\nBusiness: ${lead.business}`;
    if (lead.video_type) msg += `\nVideo Type: ${lead.video_type}`;
    if (lead.video_quantity) msg += `\nVideo Quantity: ${lead.video_quantity}`;
    if (lead.location) msg += `\nLocation: ${lead.location}`;
    if (lead.requirement || lead.additional) msg += `\nRequirement: ${lead.requirement || lead.additional}`;

    msg += `\n\nOur team is reviewing your requirements and will share the tailored proposal and sample concepts shortly.\n\nCould you please confirm if you have any specific deadline or reference in mind?\n\nBest regards,\nQuickupp AI Studio Team`;
    return msg;
  };

  const handleOpenWhatsApp = (lead: Lead) => {
    setSelectedLeadForMsg(lead);
    const text = getAdminWhatsAppPlainText(lead);
    const isUsa = isLeadUsa(lead);
    const phone = sanitizePhoneNumber(lead.phone, isUsa);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank");
  };

  const exportCSV = (selectedOnly = false) => {
    const listToExport = selectedOnly
      ? filteredLeads.filter((l) => selectedLeadIds.has(l.id))
      : filteredLeads;

    if (!listToExport.length) return alert("No leads to export.");
    const headers = [
      "ID",
      "Source",
      "Client Name",
      "Business Name",
      "Phone",
      "Email",
      "Video Type",
      "Video Quantity",
      "Location",
      "Lead Status",
      "Project Status",
      "Closed By",
      "Closed Date",
      "Delivery Date",
      "Meeting Date",
      "Internal Notes",
      "Created At",
    ];
    const rows = listToExport.map((l) => [
      l.id,
      `"${l.source}"`,
      `"${l.name}"`,
      `"${l.business}"`,
      `"${l.phone}"`,
      `"${l.email || ""}"`,
      `"${l.video_type}"`,
      `"${l.video_quantity || 1}"`,
      `"${l.location || ""}"`,
      l.status,
      l.project_status || "In Progress",
      `"${l.closed_by || ""}"`,
      `"${l.closed_at ? new Date(l.closed_at).toLocaleDateString() : ""}"`,
      `"${l.delivery_date || ""}"`,
      `"${l.meeting_date || ""}"`,
      `"${(l.notes || "").replace(/"/g, '""')}"`,
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

  const isToday = (dateStr?: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  // Status Badge Colors (Matching Document Specification)
  const getLeadStatusBadge = (status: LeadStatus) => {
    switch (status) {
      case "New":
        return isDark
          ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
          : "bg-blue-50 text-blue-700 border-blue-200";
      case "Contacted":
        return isDark
          ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/40"
          : "bg-yellow-50 text-yellow-800 border-yellow-300";
      case "In Progress":
        return isDark
          ? "bg-orange-500/20 text-orange-300 border-orange-500/40"
          : "bg-orange-50 text-orange-700 border-orange-200";
      case "Hold":
        return isDark
          ? "bg-gray-500/20 text-gray-300 border-gray-500/40"
          : "bg-slate-100 text-slate-700 border-slate-300";
      case "Closed":
        return isDark
          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
          : "bg-emerald-50 text-emerald-700 border-emerald-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const getProjectStatusBadge = (status?: ProjectStatus) => {
    switch (status) {
      case "Hold":
        return isDark
          ? "bg-gray-500/20 text-gray-300 border-gray-500/40"
          : "bg-slate-100 text-slate-700 border-slate-300";
      case "In Progress":
        return isDark
          ? "bg-orange-500/20 text-orange-300 border-orange-500/40"
          : "bg-orange-50 text-orange-700 border-orange-200";
      case "Delivered":
        return isDark
          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
          : "bg-emerald-50 text-emerald-700 border-emerald-200";
      default:
        return isDark
          ? "bg-orange-500/20 text-orange-300 border-orange-500/40"
          : "bg-orange-50 text-orange-700 border-orange-200";
    }
  };

  const getLeadSourceDisplay = (source: string): "USA Website" | "India Website" | "Meta" | "Manual" => {
    if (!source) return "India Website";
    const s = source.toLowerCase();
    if (s.includes("usa")) return "USA Website";
    if (s.includes("meta")) return "Meta";
    if (s.includes("manual")) return "Manual";
    return "India Website";
  };

  const getLeadSourceBadgeClass = (source: string) => {
    const type = getLeadSourceDisplay(source);
    switch (type) {
      case "USA Website":
        return isDark
          ? "border-blue-500/40 bg-blue-500/15 text-blue-300"
          : "border-blue-200 bg-blue-50 text-blue-700";
      case "India Website":
        return isDark
          ? "border-orange-500/40 bg-orange-500/15 text-orange-300"
          : "border-orange-200 bg-orange-50 text-orange-700";
      case "Meta":
        return isDark
          ? "border-sky-500/40 bg-sky-500/15 text-sky-300"
          : "border-sky-200 bg-sky-50 text-sky-700";
      case "Manual":
        return isDark
          ? "border-purple-500/40 bg-purple-500/15 text-purple-300"
          : "border-purple-200 bg-purple-50 text-purple-700";
    }
  };

  // Filtered Leads Calculation (Matching Section 11 Search & Filter Criteria)
  const filteredLeads = useMemo(() => {
    return leads
      .filter((lead) => {
        // Source Filter
        const leadSourceCat = getLeadSourceDisplay(lead.source);
        const matchesSource =
          appliedFilters.source === "All" ||
          appliedFilters.source === leadSourceCat ||
          lead.source === appliedFilters.source;

        // Lead Status Filter
        const matchesStatus = appliedFilters.status === "All" || lead.status === appliedFilters.status;

        // Project Status Filter
        const matchesProjStatus =
          appliedFilters.projectStatus === "All" || (lead.project_status || "In Progress") === appliedFilters.projectStatus;

        // Video Type Filter
        const matchesVideoType =
          appliedFilters.videoType === "All" ||
          lead.video_type === appliedFilters.videoType ||
          (lead.video_type &&
            (lead.video_type.toLowerCase().includes(appliedFilters.videoType.toLowerCase().replace("ai ", "")) ||
              appliedFilters.videoType.toLowerCase().includes(lead.video_type.toLowerCase())));

        // Business Location Filter
        const matchesLocation =
          !appliedFilters.location ||
          (lead.location && lead.location.toLowerCase().includes(appliedFilters.location.toLowerCase().trim()));

        // Lead Closed By Filter
        const matchesClosedBy =
          appliedFilters.closedBy === "All" ||
          (lead.closed_by && lead.closed_by.toLowerCase().includes(appliedFilters.closedBy.toLowerCase().trim()));

        // Text Search (Client Name, Business Name, Phone, Email) - Section 11
        const q = appliedFilters.search.toLowerCase().trim();
        const matchesSearch =
          q === "" ||
          lead.name.toLowerCase().includes(q) ||
          lead.business.toLowerCase().includes(q) ||
          lead.phone.includes(q) ||
          (lead.email && lead.email.toLowerCase().includes(q));

        // Date Range Filtering
        let matchesDate = true;
        let dateValue: string | undefined = undefined;
        if (appliedFilters.dateType === "created_at") dateValue = lead.created_at;
        else if (appliedFilters.dateType === "meeting_date") dateValue = lead.meeting_date;
        else if (appliedFilters.dateType === "closed_at") dateValue = lead.closed_at;
        else if (appliedFilters.dateType === "delivery_date") dateValue = lead.delivery_date;

        if (dateValue) {
          const leadD = new Date(dateValue).getTime();
          if (appliedFilters.fromDate) {
            const fD = new Date(appliedFilters.fromDate).getTime();
            if (leadD < fD) matchesDate = false;
          }
          if (appliedFilters.toDate) {
            const tD = new Date(appliedFilters.toDate).getTime() + 86400000; // end of day
            if (leadD > tD) matchesDate = false;
          }
        } else if (appliedFilters.fromDate || appliedFilters.toDate) {
          matchesDate = false;
        }

        return (
          matchesSource &&
          matchesStatus &&
          matchesProjStatus &&
          matchesVideoType &&
          matchesLocation &&
          matchesClosedBy &&
          matchesSearch &&
          matchesDate
        );
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [leads, appliedFilters]);

  const uniqueLocations = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => {
      if (l.location && l.location.trim()) {
        set.add(l.location.trim());
      }
    });
    return Array.from(set).sort();
  }, [leads]);

  const uniqueClosedByAdmins = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => {
      if (l.closed_by && l.closed_by.trim()) {
        set.add(l.closed_by.trim());
      }
    });
    return Array.from(set).sort();
  }, [leads]);

  // KPI Summary Counts
  const totalLeadsCount = leads.length;
  const newLeadsCount = leads.filter((l) => l.status === "New").length;
  const contactedCount = leads.filter((l) => l.status === "Contacted").length;
  const inProgressCount = leads.filter((l) => l.status === "In Progress").length;
  const holdCount = leads.filter((l) => l.status === "Hold").length;
  const closedCount = leads.filter((l) => l.status === "Closed").length;
  const projectsDeliveredCount = leads.filter((l) => l.project_status === "Delivered").length;
  const projectsInProgressCount = leads.filter((l) => (l.project_status || "In Progress") === "In Progress").length;
  const usaLeadsCount = leads.filter((l) => isLeadUsa(l)).length;
  const manualLeadsCount = leads.filter((l) => l.source === "Manual").length;
  const websiteLeadsCount = leads.filter((l) => l.source !== "Manual" && !isLeadUsa(l)).length;

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders
      .filter((order) => {
        const status = (order.payment_status || "").toUpperCase();
        if (filterOrderStatus === "COMPLETED") return status === "COMPLETED";
        if (filterOrderStatus === "PENDING") return status === "PENDING";
        if (filterOrderStatus === "FAILED") return status === "FAILED" || status === "CANCELLED";
        if (filterOrderStatus === "REFUNDED") return status === "REFUNDED";
        if (filterOrderStatus === "All") return true;
        return status === filterOrderStatus.toUpperCase();
      })
      .filter((order) => {
        const q = orderSearchTerm.toLowerCase().trim();
        if (!q) return true;
        return (
          order.customer_name?.toLowerCase().includes(q) ||
          order.customer_email?.toLowerCase().includes(q) ||
          order.paypal_order_id?.toLowerCase().includes(q) ||
          (order.paypal_capture_id && order.paypal_capture_id.toLowerCase().includes(q)) ||
          order.item_name?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [orders, filterOrderStatus, orderSearchTerm]);

  const totalRevenue = orders
    .filter((o) => o.payment_status === "COMPLETED")
    .reduce((sum, o) => sum + (Number(o.amount) || 0), 0);

  // =========================================================================
  // LOGIN SCREEN
  // =========================================================================
  if (!session) {
    return (
      <div className={`flex min-h-screen items-center justify-center p-4 transition-colors ${
        isDark ? "bg-[#0b0a12] text-white" : "bg-slate-50 text-slate-900"
      }`}>
        <div className={`relative w-full max-w-md rounded-2xl border p-8 shadow-2xl transition-all ${
          isDark ? "border-slate-800 bg-[#12101e]" : "border-slate-200 bg-white"
        }`}>
          {/* Logo & Header */}
          <div className="text-center">
            <div className={`mx-auto flex h-14 w-fit items-center justify-center rounded-2xl border px-4 py-2 shadow-md ${
              isDark ? "border-slate-700 bg-[#181528]" : "border-slate-200 bg-slate-50"
            }`}>
              <img
                src="/images/ADMIN LOGO.png"
                alt="Quickupp AI Studio logo"
                className="h-9 w-auto object-contain"
                width={120}
                height={36}
              />
            </div>
            <h2 className="mt-4 text-2xl font-bold tracking-tight">CRM Admin Portal</h2>
            <p className={`mt-1 text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Quickupp AI Studio Lead & Client Management
            </p>
          </div>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            {authError ? (
              <div className="flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{authError}</span>
              </div>
            ) : null}

            <div>
              <label className="block text-xs font-semibold">Admin Email</label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="sa@aistudio.com"
                  className={`w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDark
                      ? "border-slate-700 bg-slate-900 text-white placeholder-slate-500"
                      : "border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400"
                  }`}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold">Password</label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full rounded-xl border py-2.5 pl-9 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDark
                      ? "border-slate-700 bg-slate-900 text-white placeholder-slate-500"
                      : "border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className={isDark ? "text-slate-300" : "text-slate-600"}>Remember email</span>
              </label>
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Sign In to CRM Portal</span>
            </button>
          </form>

          <div className="mt-6 border-t border-slate-200 dark:border-slate-800 pt-4 text-center">
            <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
              <Shield className="h-3.5 w-3.5" />
              <span>Super Admin & Admin Role Protected</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // AUTHENTICATED CRM DASHBOARD
  // =========================================================================
  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors ${
      isDark ? "bg-[#0c0b14] text-slate-100" : "bg-white text-slate-900"
    }`}>
      {/* Top Navbar */}
      <header className={`sticky top-0 z-40 border-b backdrop-blur-md transition-colors ${
        isDark ? "border-slate-800 bg-[#12101e]/90" : "border-slate-200 bg-white/90"
      }`}>
        <div className="mx-auto flex w-full items-center justify-between px-4 py-3 sm:px-6">
          {/* Brand & Role Badge */}
          <div className="flex items-center gap-3">
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className={`rounded-lg p-1.5 transition-colors ${
                isDark ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-500 hover:bg-slate-100"
              }`}
              title="View Public Website"
            >
              <ArrowLeft className="h-4 w-4" />
            </a>

            <div className="flex items-center gap-3">
              <a href="/" className="flex items-center transition-opacity hover:opacity-85">
                <img
                  src="/images/ADMIN LOGO.png"
                  alt="Quickupp AI Studio logo"
                  className="h-8 sm:h-9 w-auto object-contain"
                  width={110}
                  height={34}
                />
              </a>

              {isSuperAdmin ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/40 bg-purple-500/15 px-2.5 py-0.5 text-[11px] font-bold text-purple-600 dark:text-purple-300">
                  <ShieldCheck className="h-3 w-3" />
                  <span>Super Admin</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/40 bg-blue-500/15 px-2.5 py-0.5 text-[11px] font-bold text-blue-600 dark:text-blue-300">
                  <ShieldCheck className="h-3 w-3" />
                  <span>Admin</span>
                </span>
              )}
            </div>
          </div>

          {/* Controls: Auto-Sync, Theme Switch, Sound, User Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span>Auto-sync in</span>
              <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{refreshCountdown}s</span>
            </div>

            <button
              onClick={() => {
                fetchAllData(false);
                setRefreshCountdown(10);
              }}
              className={`rounded-lg border p-2 transition-colors cursor-pointer ${
                isDark
                  ? "border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-slate-700"
                  : "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
              title="Refresh Data Now"
            >
              <RefreshCw className={`h-4 w-4 ${loading || isSyncing ? "animate-spin text-blue-500" : ""}`} />
            </button>

            {/* Sound Toggle */}
            <button
              onClick={() => {
                const next = !soundEnabled;
                setSoundEnabled(next);
                localStorage.setItem("ai_studio_sound_enabled", String(next));
                if (next) playNotificationChime();
              }}
              className={`rounded-lg border p-2 transition-colors cursor-pointer ${
                isDark
                  ? "border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-slate-700"
                  : "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
              title={soundEnabled ? "Mute notification sounds" : "Enable notification sounds"}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4 text-emerald-500" /> : <VolumeX className="h-4 w-4 text-slate-400" />}
            </button>

            {/* Notification Bell (Doc Requirement 15 & 20) */}
            <div className="relative">
              <button
                onClick={() => setShowNotificationsPopover(!showNotificationsPopover)}
                className={`relative rounded-lg border p-2 transition-colors cursor-pointer ${
                  showNotificationsPopover
                    ? "border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400"
                    : isDark
                    ? "border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-slate-700"
                    : "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
                title="Notifications Center"
              >
                <Bell className="h-4 w-4" />
                {notifications.filter((n) => !n.is_read).length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-extrabold text-white shadow animate-pulse">
                    {notifications.filter((n) => !n.is_read).length > 99 ? "99+" : notifications.filter((n) => !n.is_read).length}
                  </span>
                )}
              </button>

              {/* Notification Popover Dropdown */}
              {showNotificationsPopover && (
                <div className={`absolute right-0 top-11 z-50 w-80 sm:w-96 rounded-2xl border p-3 shadow-2xl space-y-3 animate-in fade-in ${
                  isDark ? "border-slate-700 bg-[#161327] text-white" : "border-slate-200 bg-white text-slate-900"
                }`}>
                  <div className="flex items-center justify-between border-b pb-2 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <BellRing className="h-4 w-4 text-blue-500" />
                      <span className="text-xs font-bold">CRM Notifications</span>
                      <span className="rounded-full bg-blue-100 px-1.5 py-0.2 text-[10px] font-extrabold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                        {notifications.length}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {notifications.some((n) => !n.is_read) && (
                        <button
                          onClick={async () => {
                            await markAllNotificationsReadServerFn();
                            setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
                            showToast("All notifications marked as read");
                          }}
                          className="text-[10px] font-semibold text-blue-600 hover:underline cursor-pointer px-1"
                        >
                          Mark all read
                        </button>
                      )}
                      {notifications.length > 0 && (
                        <button
                          onClick={async () => {
                            await clearNotificationsServerFn();
                            setNotifications([]);
                            showToast("Notifications cleared");
                          }}
                          className="text-[10px] text-slate-400 hover:text-red-500 cursor-pointer px-1"
                          title="Clear all notifications"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1 text-[10px]">
                    <button
                      onClick={() => setNotificationFilter("all")}
                      className={`rounded px-2 py-0.5 font-bold cursor-pointer ${
                        notificationFilter === "all" ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setNotificationFilter("unread")}
                      className={`rounded px-2 py-0.5 font-bold cursor-pointer ${
                        notificationFilter === "unread" ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      Unread ({notifications.filter((n) => !n.is_read).length})
                    </button>
                    <button
                      onClick={() => setNotificationFilter("meeting")}
                      className={`rounded px-2 py-0.5 font-bold cursor-pointer ${
                        notificationFilter === "meeting" ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      Meetings
                    </button>
                    <button
                      onClick={() => setNotificationFilter("lead")}
                      className={`rounded px-2 py-0.5 font-bold cursor-pointer ${
                        notificationFilter === "lead" ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      Leads
                    </button>
                  </div>

                  {/* Notification List */}
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {notifications
                      .filter((n) => {
                        if (notificationFilter === "unread") return !n.is_read;
                        if (notificationFilter === "meeting") return n.type.includes("meeting") || n.type.includes("calendly");
                        if (notificationFilter === "lead") return n.type.includes("lead") || n.type.includes("project");
                        return true;
                      })
                      .length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-400">
                        No notifications found.
                      </div>
                    ) : (
                      notifications
                        .filter((n) => {
                          if (notificationFilter === "unread") return !n.is_read;
                          if (notificationFilter === "meeting") return n.type.includes("meeting") || n.type.includes("calendly");
                          if (notificationFilter === "lead") return n.type.includes("lead") || n.type.includes("project");
                          return true;
                        })
                        .map((n) => (
                          <div
                            key={n.id}
                            className={`p-2.5 transition-colors flex items-start justify-between gap-2 hover:bg-slate-50 dark:hover:bg-white/[0.03] ${
                              !n.is_read ? "bg-blue-50/50 dark:bg-blue-950/20 font-medium" : ""
                            }`}
                          >
                            <div className="space-y-0.5 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className={`h-1.5 w-1.5 rounded-full ${!n.is_read ? "bg-blue-500 animate-ping" : "bg-slate-300 dark:bg-slate-600"}`} />
                                <span className="font-bold text-[11px]">{n.title}</span>
                              </div>
                              <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2">{n.message}</p>
                              <div className="flex items-center gap-2 pt-0.5 text-[9px] text-slate-400 font-mono">
                                <span>{new Date(n.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                                <span>{n.actor}</span>
                              </div>
                            </div>

                            {!n.is_read && (
                              <button
                                onClick={async () => {
                                  await markNotificationReadServerFn({ data: { id: n.id } });
                                  setNotifications((prev) => prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item)));
                                }}
                                className="text-slate-400 hover:text-blue-500 p-1 cursor-pointer"
                                title="Mark as read"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* White/Dark Theme Toggle (Doc Requirement 1) */}
            <button
              onClick={toggleTheme}
              className={`rounded-lg border p-2 transition-colors cursor-pointer ${
                isDark
                  ? "border-slate-700 bg-slate-800/80 text-amber-400 hover:bg-slate-700"
                  : "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
              title={`Switch to ${isDark ? "White / Light Theme" : "Dark Theme"}`}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* User Profile & Logout */}
            <div className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 ${
              isDark ? "border-slate-800 bg-slate-900/80" : "border-slate-200 bg-slate-100"
            }`}>
              <div className="hidden sm:block text-right">
                <p className="text-xs font-bold leading-none">{session.name}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">{session.email}</p>
              </div>

              <button
                onClick={handleLogout}
                className="rounded-lg p-1 text-slate-500 hover:text-red-500 transition-colors cursor-pointer"
                title="Log Out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation Bar */}
        <div className={`overflow-x-auto border-t transition-colors ${
          isDark ? "border-slate-800 bg-[#151222]" : "border-slate-200 bg-white"
        }`}>
          <div className="mx-auto flex w-full items-center gap-1 px-4 py-1.5 sm:px-6">
            <button
              onClick={() => { setActiveTab("leads"); setIsPaymentUnlocked(false); setShowPaymentPinModal(false); }}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition-all cursor-pointer ${
                activeTab === "leads"
                  ? "bg-blue-600 text-white shadow-sm"
                  : isDark
                  ? "text-slate-400 hover:bg-slate-800 hover:text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Layers className="h-4 w-4" />
              <span>Leads Management</span>
              <span className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
                activeTab === "leads" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              }`}>
                {leads.length}
              </span>
            </button>

            <button
              onClick={() => handleSelectOrdersTab()}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition-all cursor-pointer ${
                activeTab === "orders"
                  ? "bg-blue-600 text-white shadow-sm"
                  : isDark
                  ? "text-slate-400 hover:bg-slate-800 hover:text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <DollarSign className="h-4 w-4" />
              <span>Orders & Payments</span>
              <span className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
                activeTab === "orders" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              }`}>
                {orders.length}
              </span>
            </button>

            <button
              onClick={() => { setActiveTab("calendly"); setIsPaymentUnlocked(false); setShowPaymentPinModal(false); }}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition-all cursor-pointer ${
                activeTab === "calendly"
                  ? "bg-blue-600 text-white shadow-sm"
                  : isDark
                  ? "text-slate-400 hover:bg-slate-800 hover:text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Calendar className="h-4 w-4" />
              <span>Calendly (USA)</span>
              <span className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
                activeTab === "calendly" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              }`}>
                {meetings.length}
              </span>
            </button>

            <button
              onClick={() => { setActiveTab("activity"); setIsPaymentUnlocked(false); setShowPaymentPinModal(false); }}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition-all cursor-pointer ${
                activeTab === "activity"
                  ? "bg-blue-600 text-white shadow-sm"
                  : isDark
                  ? "text-slate-400 hover:bg-slate-800 hover:text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Clock className="h-4 w-4" />
              <span>Activity History</span>
            </button>

            {/* Super Admin Tabs */}
            {isSuperAdmin && (
              <>
                <button
                  onClick={() => { setActiveTab("users"); setIsPaymentUnlocked(false); setShowPaymentPinModal(false); }}
                  className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition-all cursor-pointer ${
                    activeTab === "users"
                      ? "bg-purple-600 text-white shadow-sm"
                      : isDark
                      ? "text-purple-300 hover:bg-purple-950/40 hover:text-white"
                      : "text-purple-700 hover:bg-purple-50"
                  }`}
                >
                  <Users className="h-4 w-4" />
                  <span>User Management</span>
                </button>

                <button
                  onClick={() => { setActiveTab("security"); setIsPaymentUnlocked(false); setShowPaymentPinModal(false); }}
                  className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition-all cursor-pointer ${
                    activeTab === "security"
                      ? "bg-purple-600 text-white shadow-sm"
                      : isDark
                      ? "text-purple-300 hover:bg-purple-950/40 hover:text-white"
                      : "text-purple-700 hover:bg-purple-50"
                  }`}
                >
                  <ShieldAlert className="h-4 w-4" />
                  <span>Login / IP Tracking</span>
                </button>
              </>
            )}

            <button
              onClick={() => { setActiveTab("recycle_bin"); setIsPaymentUnlocked(false); setShowPaymentPinModal(false); }}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition-all cursor-pointer ${
                activeTab === "recycle_bin"
                  ? "bg-red-600 text-white shadow-sm"
                  : isDark
                  ? "text-slate-400 hover:bg-slate-800 hover:text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Trash2 className="h-4 w-4" />
              <span>Recycle Bin</span>
              {recycleBinLeads.length > 0 && (
                <span className="rounded-full bg-red-500/20 px-1.5 py-0.2 text-[10px] font-extrabold text-red-600 dark:text-red-300">
                  {recycleBinLeads.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full flex-1 p-4 sm:p-6 lg:p-8 space-y-6">
        {/* ========================================================================= */}
        {/* TAB 1: LEADS MANAGEMENT */}
        {/* ========================================================================= */}
        {activeTab === "leads" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* KPI Summary Cards - Pure White Theme matching background */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7 sm:gap-4">
              <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs transition-all hover:shadow-md hover:border-slate-300">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                  <span>Total Leads</span>
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-blue-600">
                    <Layers className="h-3.5 w-3.5" />
                  </div>
                </div>
                <p className="mt-2 text-2xl font-black text-slate-900">{totalLeadsCount}</p>
              </div>

              <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs transition-all hover:shadow-md hover:border-blue-300">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                  <span>New Leads</span>
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-500 shadow-xs" />
                </div>
                <p className="mt-2 text-2xl font-black text-blue-600">{newLeadsCount}</p>
              </div>

              <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs transition-all hover:shadow-md hover:border-amber-300">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                  <span>Contacted</span>
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500 shadow-xs" />
                </div>
                <p className="mt-2 text-2xl font-black text-amber-600">{contactedCount}</p>
              </div>

              <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs transition-all hover:shadow-md hover:border-orange-300">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                  <span>In Progress</span>
                  <span className="h-2.5 w-2.5 rounded-full bg-orange-500 shadow-xs" />
                </div>
                <p className="mt-2 text-2xl font-black text-orange-600">{inProgressCount}</p>
              </div>

              <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs transition-all hover:shadow-md hover:border-slate-300">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                  <span>On Hold</span>
                  <span className="h-2.5 w-2.5 rounded-full bg-gray-400 shadow-xs" />
                </div>
                <p className="mt-2 text-2xl font-black text-slate-700">{holdCount}</p>
              </div>

              <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs transition-all hover:shadow-md hover:border-emerald-300">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                  <span>Closed</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </div>
                <p className="mt-2 text-2xl font-black text-emerald-600">{closedCount}</p>
              </div>

              <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs transition-all hover:shadow-md hover:border-purple-300 col-span-2 sm:col-span-1">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                  <span>Delivered</span>
                  <Package className="h-4 w-4 text-purple-500" />
                </div>
                <p className="mt-2 text-2xl font-black text-purple-600">{projectsDeliveredCount}</p>
              </div>
            </div>

            {/* Actions & Filters Bar (Section 11: Filters & Search) */}
            <div className={`rounded-2xl border p-4 shadow-sm space-y-3.5 transition-colors ${
              isDark ? "border-slate-800 bg-[#12101e]" : "border-slate-200 bg-white"
            }`}>
              {/* Top Row: Search + Quick Action Buttons */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative flex-1 min-w-0 max-w-lg">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by Client Name, Business Name, Phone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleApplyFilters();
                    }}
                    className={`w-full rounded-xl border py-2 pl-9 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      isDark
                        ? "border-slate-700 bg-slate-900 text-white placeholder-slate-500"
                        : "border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400"
                    }`}
                  />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Apply Filters Button */}
                  <button
                    onClick={handleApplyFilters}
                    className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition-all cursor-pointer"
                  >
                    <Filter className="h-3.5 w-3.5" />
                    <span>Apply Filters</span>
                  </button>

                  {/* Clear Filters Button */}
                  <button
                    onClick={handleClearFilters}
                    className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition-colors cursor-pointer ${
                      isDark
                        ? "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                        : "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
                    <span>Clear Filters</span>
                  </button>

                  <button
                    onClick={() => setShowAddLeadModal(true)}
                    className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-all cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    <span>+ Add Lead</span>
                  </button>

                  <button
                    onClick={() => exportCSV(false)}
                    className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                      isDark
                        ? "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
                        : "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    <Download className="h-4 w-4 text-blue-500" />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              {/* Bottom Row: Detailed Filters Grid */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                {/* Source Filter */}
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-semibold text-slate-400">Source:</span>
                  <select
                    value={filterSource}
                    onChange={(e) => setFilterSource(e.target.value)}
                    className={`rounded-lg border px-2 py-1.5 text-xs font-semibold focus:outline-none cursor-pointer ${
                      isDark ? "border-slate-700 bg-slate-900 text-white" : "border-slate-200 bg-slate-50 text-slate-900"
                    }`}
                  >
                    <option value="All">All Sources</option>
                    <option value="USA Website">USA Website</option>
                    <option value="India Website">India Website</option>
                    <option value="Meta">Meta</option>
                    <option value="Manual">Manual</option>
                  </select>
                </div>

                {/* Lead Status Filter */}
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-semibold text-slate-400">Lead Status:</span>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className={`rounded-lg border px-2 py-1.5 text-xs font-semibold focus:outline-none cursor-pointer ${
                      isDark ? "border-slate-700 bg-slate-900 text-white" : "border-slate-200 bg-slate-50 text-slate-900"
                    }`}
                  >
                    <option value="All">All Lead Statuses</option>
                    <option value="New">New</option>
                    <option value="Contacted">Contacted</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Hold">Hold</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>

                {/* Project Status Filter */}
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-semibold text-slate-400">Project Status:</span>
                  <select
                    value={filterProjectStatus}
                    onChange={(e) => setFilterProjectStatus(e.target.value)}
                    className={`rounded-lg border px-2 py-1.5 text-xs font-semibold focus:outline-none cursor-pointer ${
                      isDark ? "border-slate-700 bg-slate-900 text-white" : "border-slate-200 bg-slate-50 text-slate-900"
                    }`}
                  >
                    <option value="All">All Project Statuses</option>
                    <option value="Hold">Hold</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Delivered">Delivered</option>
                  </select>
                </div>

                {/* Video Type Filter */}
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-semibold text-slate-400">Video Type:</span>
                  <select
                    value={filterVideoType}
                    onChange={(e) => setFilterVideoType(e.target.value)}
                    className={`rounded-lg border px-2 py-1.5 text-xs font-semibold focus:outline-none cursor-pointer ${
                      isDark ? "border-slate-700 bg-slate-900 text-white" : "border-slate-200 bg-slate-50 text-slate-900"
                    }`}
                  >
                    <option value="All">All Video Types</option>
                    {VIDEO_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {/* Business Location Filter */}
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-semibold text-slate-400">Location:</span>
                  <select
                    value={filterLocation}
                    onChange={(e) => setFilterLocation(e.target.value)}
                    className={`rounded-lg border px-2 py-1.5 text-xs font-semibold focus:outline-none cursor-pointer ${
                      isDark ? "border-slate-700 bg-slate-900 text-white" : "border-slate-200 bg-slate-50 text-slate-900"
                    }`}
                  >
                    <option value="">All Locations</option>
                    {uniqueLocations.map((loc) => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </div>

                {/* Lead Closed By Filter */}
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-semibold text-slate-400">Closed By:</span>
                  <select
                    value={filterClosedBy}
                    onChange={(e) => setFilterClosedBy(e.target.value)}
                    className={`rounded-lg border px-2 py-1.5 text-xs font-semibold focus:outline-none cursor-pointer ${
                      isDark ? "border-slate-700 bg-slate-900 text-white" : "border-slate-200 bg-slate-50 text-slate-900"
                    }`}
                  >
                    <option value="All">All Admins</option>
                    <option value="Super Admin">Super Admin</option>
                    <option value="Admin">Admin</option>
                    {uniqueClosedByAdmins.map((adm) => (
                      <option key={adm} value={adm}>{adm}</option>
                    ))}
                  </select>
                </div>

                {/* Date Filter Selection */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <select
                    value={filterDateType}
                    onChange={(e) => setFilterDateType(e.target.value as any)}
                    className={`rounded-lg border px-2 py-1.5 text-xs font-semibold focus:outline-none cursor-pointer ${
                      isDark ? "border-slate-700 bg-slate-900 text-white" : "border-slate-200 bg-slate-50 text-slate-900"
                    }`}
                  >
                    <option value="created_at">Created Date</option>
                    <option value="meeting_date">Meeting Date</option>
                    <option value="closed_at">Closed Date</option>
                    <option value="delivery_date">Delivery Date</option>
                  </select>

                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className={`rounded-lg border px-2 py-1 text-xs focus:outline-none ${
                      isDark ? "border-slate-700 bg-slate-900 text-white" : "border-slate-200 bg-slate-50"
                    }`}
                    title="From Date"
                  />
                  <span className="text-slate-400">to</span>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className={`rounded-lg border px-2 py-1 text-xs focus:outline-none ${
                      isDark ? "border-slate-700 bg-slate-900 text-white" : "border-slate-200 bg-slate-50"
                    }`}
                    title="To Date"
                  />
                </div>

                {/* Apply Filter and Clear Filter Buttons */}
                <div className="flex items-center gap-1.5 ml-auto">
                  <button
                    onClick={handleApplyFilters}
                    className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition-all cursor-pointer"
                    title="Apply Filters"
                  >
                    <Filter className="h-3.5 w-3.5" />
                    <span>Apply Filter</span>
                  </button>

                  <button
                    onClick={handleClearFilters}
                    className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                      isDark
                        ? "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                        : "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                    title="Clear Filters"
                  >
                    <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
                    <span>Clear Filter</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Bulk Actions Bar (Appears when 1+ selected) */}
            {selectedLeadIds.size > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-500/40 bg-blue-50 dark:bg-blue-950/40 p-3 shadow-md">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-900 dark:text-blue-200">
                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                  <span>{selectedLeadIds.size} lead(s) selected</span>
                </div>

                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="text-slate-500">Bulk Status:</span>
                  <select
                    onChange={(e) => {
                      if (e.target.value) handleBulkStatusChange(e.target.value as LeadStatus);
                    }}
                    defaultValue=""
                    className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-semibold cursor-pointer"
                  >
                    <option value="" disabled>Change Status to...</option>
                    <option value="New">New</option>
                    <option value="Contacted">Contacted</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Hold">Hold</option>
                    <option value="Closed">Closed</option>
                  </select>

                  <button
                    onClick={() => exportCSV(true)}
                    className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-bold text-white hover:bg-blue-700 cursor-pointer"
                  >
                    Export Selected
                  </button>

                  <button
                    onClick={handleBulkDelete}
                    className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs font-bold text-red-600 hover:bg-red-500/20 cursor-pointer"
                  >
                    Move to Recycle Bin
                  </button>

                  <button
                    onClick={() => setSelectedLeadIds(new Set())}
                    className="text-xs text-slate-500 hover:underline cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
              </div>
            )}

            {/* Main Leads Table (Desktop Table & Mobile Cards) */}
            <div className={`overflow-hidden rounded-2xl border shadow-sm transition-colors ${
              isDark ? "border-slate-800 bg-[#12101e]" : "border-slate-200 bg-white"
            }`}>
              {/* Desktop Table with Horizontal Scroll */}
              <div className="hidden md:block overflow-x-auto w-full">
                <table className="w-full min-w-[1200px] text-left text-xs">
                  <thead className={`border-b text-[11px] font-bold uppercase tracking-wider ${
                    isDark ? "border-slate-800 bg-[#171427] text-slate-400" : "border-slate-200 bg-slate-50 text-slate-600"
                  }`}>
                    <tr>
                      <th className="px-4 py-3.5">
                        <input
                          type="checkbox"
                          checked={filteredLeads.length > 0 && selectedLeadIds.size === filteredLeads.length}
                          onChange={(e) => handleSelectAllLeads(e.target.checked)}
                          className="rounded border-slate-300 text-blue-600 cursor-pointer"
                        />
                      </th>
                      <th className="px-4 py-3.5">Source</th>
                      <th className="px-4 py-3.5">Timestamp</th>
                      <th className="px-4 py-3.5">Client & Business</th>
                      <th className="px-4 py-3.5">WhatsApp / Phone</th>
                      <th className="px-4 py-3.5">Video Scope</th>
                      <th className="px-4 py-3.5">Lead Status</th>
                      <th className="px-4 py-3.5">Project Status</th>
                      <th className="px-4 py-3.5">Notes</th>
                      <th className="px-4 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredLeads.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-16 text-center text-xs text-slate-500">
                          <Layers className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                          <p className="font-bold text-sm">No leads match current filter criteria</p>
                          <p className="mt-1 text-slate-400">New website submissions will automatically appear here.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredLeads.map((lead) => {
                        const isSelected = selectedLeadIds.has(lead.id);
                        const isNewlyArrived = highlightedLeadIds.has(lead.id);

                        return (
                          <tr
                            key={lead.id}
                            className={`transition-colors hover:bg-slate-50/50 dark:hover:bg-white/[0.02] ${
                              isSelected ? "bg-blue-50/60 dark:bg-blue-950/30" : ""
                            } ${isNewlyArrived ? "bg-blue-100 dark:bg-blue-900/30 ring-1 ring-blue-500" : ""}`}
                          >
                            {/* Checkbox */}
                            <td className="px-4 py-3.5">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelectLead(lead.id)}
                                className="rounded border-slate-300 text-blue-600 cursor-pointer"
                              />
                            </td>

                            {/* Source */}
                            <td className="whitespace-nowrap px-4 py-3.5">
                              <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${getLeadSourceBadgeClass(lead.source)}`}>
                                {getLeadSourceDisplay(lead.source)}
                              </span>
                            </td>

                            {/* Timestamp */}
                            <td className="whitespace-nowrap px-4 py-3.5 text-xs text-slate-500">
                              {isToday(lead.created_at) ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/40 bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-300">
                                  <Calendar className="h-3 w-3" />
                                  Today, {new Date(lead.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              ) : (
                                <div>
                                  <div>{new Date(lead.created_at).toLocaleDateString()}</div>
                                  <div className="text-[10px] text-slate-400">
                                    {new Date(lead.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  </div>
                                </div>
                              )}
                            </td>

                            {/* Client & Business */}
                            <td className="px-4 py-3.5">
                              <button
                                type="button"
                                onClick={() => setViewLeadDetails(lead)}
                                className="text-left font-bold text-sm flex items-center gap-1.5 hover:text-blue-600 transition-colors cursor-pointer"
                                title="Click to view full lead details"
                              >
                                <span>{lead.name}</span>
                                {isNewlyArrived && (
                                  <span className="rounded bg-blue-600 px-1 py-0.2 text-[8px] font-black text-white animate-pulse">
                                    JUST NOW
                                  </span>
                                )}
                              </button>
                              <div className="text-xs text-slate-500 font-medium">
                                {lead.business}
                                {lead.location ? ` · ${lead.location}` : ""}
                              </div>
                              {lead.email && <div className="text-[11px] text-slate-400 font-mono">{lead.email}</div>}
                            </td>

                            {/* WhatsApp / Phone */}
                            <td className="whitespace-nowrap px-4 py-3.5">
                              <a
                                href={`tel:${lead.phone.replace(/[^0-9+]/g, "")}`}
                                className="font-mono text-xs font-semibold hover:text-blue-600 hover:underline flex items-center gap-1"
                              >
                                <Phone className="h-3 w-3 text-slate-400" />
                                <span>{lead.phone}</span>
                              </a>
                            </td>

                            {/* Video Scope */}
                            <td className="px-4 py-3.5">
                              <div className="font-semibold text-xs flex items-center gap-1">
                                <Video className="h-3 w-3 text-blue-500" />
                                <span>{lead.video_type}</span>
                                {lead.video_quantity && (
                                  <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 text-[10px] font-bold">
                                    x{lead.video_quantity}
                                  </span>
                                )}
                              </div>
                              {(lead.requirement || lead.additional) && (
                                <p className="mt-0.5 text-[11px] text-slate-400 line-clamp-1 max-w-xs" title={lead.requirement || lead.additional}>
                                  {lead.requirement || lead.additional}
                                </p>
                              )}
                            </td>

                            {/* Lead Status Dropdown */}
                            <td className="whitespace-nowrap px-4 py-3.5">
                              <select
                                value={lead.status}
                                onChange={(e) => handleUpdateLeadStatus(lead, e.target.value as LeadStatus)}
                                className={`rounded-lg border px-2.5 py-1 text-xs font-bold cursor-pointer focus:outline-none ${getLeadStatusBadge(lead.status)}`}
                              >
                                <option value="New">New</option>
                                <option value="Contacted">Contacted</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Hold">Hold</option>
                                <option value="Closed">Closed</option>
                              </select>
                              {lead.closed_by && lead.status === "Closed" && (
                                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                                  By: {lead.closed_by}
                                </div>
                              )}
                            </td>

                            {/* Project Status Dropdown */}
                            <td className="whitespace-nowrap px-4 py-3.5">
                              <select
                                value={lead.project_status || "In Progress"}
                                onChange={(e) => handleUpdateProjectStatus(lead, e.target.value as ProjectStatus)}
                                className={`rounded-lg border px-2.5 py-1 text-xs font-bold cursor-pointer focus:outline-none ${getProjectStatusBadge(lead.project_status)}`}
                              >
                                <option value="Hold">Hold</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Delivered">Delivered</option>
                              </select>
                              {lead.delivery_date && (
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  Due: {lead.delivery_date}
                                </div>
                              )}
                            </td>

                            {/* Notes Snippet */}
                            <td className="px-4 py-3.5 max-w-[150px]">
                              {lead.notes ? (
                                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2" title={lead.notes}>
                                  {lead.notes}
                                </p>
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">No notes</span>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="whitespace-nowrap px-4 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* 1-Click WhatsApp */}
                                <button
                                  type="button"
                                  onClick={() => handleOpenWhatsApp(lead)}
                                  className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-all cursor-pointer"
                                  title="Chat on WhatsApp"
                                >
                                  <MessageSquare className="h-3.5 w-3.5" />
                                </button>

                                {/* View Details */}
                                <button
                                  type="button"
                                  onClick={() => setViewLeadDetails(lead)}
                                  className={`rounded-lg border p-1.5 transition-colors cursor-pointer ${
                                    isDark
                                      ? "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
                                      : "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
                                  }`}
                                  title="View Full Profile"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </button>

                                {/* Edit Lead */}
                                <button
                                  type="button"
                                  onClick={() => setEditingLead(lead)}
                                  className={`rounded-lg border p-1.5 transition-colors cursor-pointer ${
                                    isDark
                                      ? "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
                                      : "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
                                  }`}
                                  title="Edit Lead"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </button>

                                {/* Soft Delete */}
                                <button
                                  type="button"
                                  onClick={() => handleSoftDeleteLead(lead.id)}
                                  className="rounded-lg border border-red-500/30 bg-red-500/10 p-1.5 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
                                  title="Move to Recycle Bin"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
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

              {/* Mobile Cards View */}
              <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800 p-3 space-y-4">
                {filteredLeads.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-500">
                    No leads found matching criteria.
                  </div>
                ) : (
                  filteredLeads.map((lead) => (
                    <div key={lead.id} className="pt-3 first:pt-0 space-y-2.5 text-xs">
                      {/* Header with Name & Source */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {lead.name}
                        </div>
                        <span className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-bold ${getLeadSourceBadgeClass(lead.source)}`}>
                          {getLeadSourceDisplay(lead.source)}
                        </span>
                      </div>

                      {/* Business & Location */}
                      <div className="text-slate-500">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{lead.business}</span>
                        {lead.location ? ` · ${lead.location}` : ""}
                        {lead.email && <div className="text-[11px] font-mono text-slate-400">{lead.email}</div>}
                      </div>

                      {/* Phone & Scope */}
                      <div className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg">
                        <a href={`tel:${lead.phone}`} className="font-mono text-blue-600 font-semibold flex items-center gap-1">
                          <Phone className="h-3 w-3 text-slate-400" /> {lead.phone}
                        </a>
                        <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                          <Video className="h-3 w-3 text-blue-500" /> {lead.video_type}
                          {lead.video_quantity && ` (x${lead.video_quantity})`}
                        </span>
                      </div>

                      {/* Status selectors */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div>
                          <label className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Lead Status</label>
                          <select
                            value={lead.status}
                            onChange={(e) => handleUpdateLeadStatus(lead, e.target.value as LeadStatus)}
                            className={`w-full rounded-lg px-2 py-1 text-[11px] font-bold ${getLeadStatusBadge(lead.status)}`}
                          >
                            <option value="New">New</option>
                            <option value="Contacted">Contacted</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Hold">Hold</option>
                            <option value="Closed">Closed</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Project Status</label>
                          <select
                            value={lead.project_status || "In Progress"}
                            onChange={(e) => handleUpdateProjectStatus(lead, e.target.value as ProjectStatus)}
                            className={`w-full rounded-lg px-2 py-1 text-[11px] font-bold ${getProjectStatusBadge(lead.project_status)}`}
                          >
                            <option value="Hold">Hold</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Delivered">Delivered</option>
                          </select>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/60">
                        <div className="text-[10px] text-slate-400">
                          {new Date(lead.created_at).toLocaleDateString()}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenWhatsApp(lead)}
                            className="rounded-lg bg-emerald-600 p-1.5 text-white hover:bg-emerald-700 transition-colors cursor-pointer"
                            title="WhatsApp"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setViewLeadDetails(lead)}
                            className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            Details
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingLead(lead)}
                            className="rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Edit"
                          >
                            <Edit className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSoftDeleteLead(lead.id)}
                            className="rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 p-1.5 text-red-600 dark:text-red-400 hover:bg-red-100 transition-colors cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: ORDERS & PAYPAL PAYMENTS */}
        {/* ========================================================================= */}
        {activeTab === "orders" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Orders KPI Cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              <div className={`rounded-xl border p-4 shadow-sm ${
                isDark ? "border-slate-800 bg-[#12101e]" : "border-slate-200 bg-white"
              }`}>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                  <span>Total Orders</span>
                  <Package className="h-4 w-4 text-purple-500" />
                </div>
                <p className="mt-2 text-2xl font-extrabold">{orders.length}</p>
              </div>

              <div className={`rounded-xl border p-4 shadow-sm ${
                isDark ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-300" : "border-emerald-200 bg-emerald-50/70 text-emerald-900"
              }`}>
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span>Total Revenue</span>
                  <DollarSign className="h-4 w-4 text-emerald-500" />
                </div>
                <p className="mt-2 text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                  ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>

              <div className={`rounded-xl border p-4 shadow-sm ${
                isDark ? "border-blue-500/30 bg-blue-950/20 text-blue-300" : "border-blue-200 bg-blue-50/70 text-blue-900"
              }`}>
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span>Completed (Paid)</span>
                  <CheckCircle2 className="h-4 w-4 text-blue-500" />
                </div>
                <p className="mt-2 text-2xl font-extrabold text-blue-600 dark:text-blue-400">
                  {orders.filter((o) => o.payment_status === "COMPLETED").length}
                </p>
              </div>

              <div className={`rounded-xl border p-4 shadow-sm ${
                isDark ? "border-amber-500/30 bg-amber-950/20 text-amber-300" : "border-amber-200 bg-amber-50/70 text-amber-900"
              }`}>
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span>Pending</span>
                  <Clock className="h-4 w-4 text-amber-500" />
                </div>
                <p className="mt-2 text-2xl font-extrabold text-amber-600 dark:text-amber-400">
                  {orders.filter((o) => o.payment_status === "PENDING").length}
                </p>
              </div>
            </div>

            {/* Orders Search & Filter */}
            <div className={`rounded-2xl border p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              isDark ? "border-slate-800 bg-[#12101e]" : "border-slate-200 bg-white"
            }`}>
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search customer name, email, order ID..."
                  value={orderSearchTerm}
                  onChange={(e) => setOrderSearchTerm(e.target.value)}
                  className={`w-full rounded-xl border py-2 pl-9 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDark ? "border-slate-700 bg-slate-900 text-white" : "border-slate-200 bg-slate-50"
                  }`}
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={filterOrderStatus}
                  onChange={(e) => setFilterOrderStatus(e.target.value)}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold focus:outline-none cursor-pointer ${
                    isDark ? "border-slate-700 bg-slate-900 text-white" : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <option value="COMPLETED">Completed (Paid)</option>
                  <option value="All">All Statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="FAILED">Failed / Cancelled</option>
                  <option value="REFUNDED">Refunded</option>
                </select>
              </div>
            </div>

            {/* Orders Table */}
            <div className={`overflow-x-auto w-full rounded-2xl border shadow-sm ${
              isDark ? "border-slate-800 bg-[#12101e]" : "border-slate-200 bg-white"
            }`}>
              <table className="w-full min-w-[900px] text-left text-xs">
                <thead className={`border-b text-[11px] font-bold uppercase tracking-wider ${
                  isDark ? "border-slate-800 bg-[#171427] text-slate-400" : "border-slate-200 bg-slate-50 text-slate-600"
                }`}>
                  <tr>
                    <th className="px-4 py-3.5">Customer</th>
                    <th className="px-4 py-3.5">Package / Item</th>
                    <th className="px-4 py-3.5 text-center">Amount</th>
                    <th className="px-4 py-3.5 text-center">Payment Status</th>
                    <th className="px-4 py-3.5">PayPal Order ID</th>
                    <th className="px-4 py-3.5">Date</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-xs text-slate-500">
                        No PayPal orders found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                        <td className="px-4 py-3.5">
                          <div className="font-bold">{order.customer_name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{order.customer_email}</div>
                          {order.customer_phone && <div className="text-[10px] text-slate-400">{order.customer_phone}</div>}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-semibold">{order.item_name}</div>
                          <span className="inline-block rounded bg-purple-500/10 text-purple-600 dark:text-purple-300 px-1.5 py-0.2 text-[9px] font-bold uppercase mt-0.5">
                            {order.item_type}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          ${Number(order.amount).toFixed(2)} {order.currency}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            order.payment_status === "COMPLETED"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                          }`}>
                            {order.payment_status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-[11px] text-slate-500 select-all">
                          {order.paypal_order_id}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-500">
                          {new Date(order.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <button
                            onClick={() => setSelectedOrderDetails(order)}
                            className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: CALENDLY MEETINGS (USA FOCUS & CRM INTEGRATION) */}
        {/* ========================================================================= */}
        {activeTab === "calendly" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Header & Quick Action Bar */}
            <div className={`rounded-2xl border p-4 sm:p-5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
              isDark ? "border-slate-800 bg-[#12101e]" : "border-slate-200 bg-white"
            }`}>
              <div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-500" />
                  <h3 className="text-base font-bold">Calendly Strategy Calls & Meetings (USA)</h3>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-extrabold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                    {meetings.length} Total
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Connect Calendly directly with the CRM. Track meeting dates, client info, video requirements, follow-ups, and lead status updates.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={async () => {
                    setIsSendingTestMeeting(true);
                    try {
                      const res = await sendTestCalendlyBookingServerFn({
                        performedBy: session?.name || "Admin",
                      });
                      if (res.success && res.meeting) {
                        setMeetings((prev) => [res.meeting!, ...prev]);
                        if (res.lead) {
                          setLeads((prev) => [res.lead!, ...prev]);
                        }
                        if (soundEnabled) playNotificationChime();
                        showToast("Live Test Calendly Booking generated successfully!");
                        await fetchNotificationsList();
                        await fetchLogsList();
                      } else {
                        showToast("Failed to create test meeting.");
                      }
                    } catch (err: any) {
                      showToast(err?.message || "Error generating test meeting");
                    } finally {
                      setIsSendingTestMeeting(false);
                    }
                  }}
                  disabled={isSendingTestMeeting}
                  className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2 text-xs font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Simulate a real incoming Calendly booking from USA"
                >
                  <Zap className={`h-3.5 w-3.5 ${isSendingTestMeeting ? "animate-spin text-amber-500" : "text-amber-500"}`} />
                  <span>{isSendingTestMeeting ? "Booking Test..." : "⚡ Send Test Booking"}</span>
                </button>

                <a
                  href="https://calendly.com/quickuppaistudio"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-blue-500/40 bg-blue-500/10 px-3.5 py-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 flex items-center gap-1.5"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Calendly Page</span>
                </a>

                <button
                  onClick={() => setShowAddMeetingModal(true)}
                  className="rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700 flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>+ Book / Log Meeting</span>
                </button>
              </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className={`rounded-xl border p-3.5 ${isDark ? "border-slate-800 bg-[#12101e]" : "border-slate-200 bg-white"}`}>
                <p className="text-[11px] font-bold text-slate-500 uppercase">Total Meetings</p>
                <p className="text-xl font-extrabold text-blue-600 mt-1">{meetings.length}</p>
              </div>

              <div className={`rounded-xl border p-3.5 ${isDark ? "border-slate-800 bg-[#12101e]" : "border-slate-200 bg-white"}`}>
                <p className="text-[11px] font-bold text-slate-500 uppercase">Upcoming / Scheduled</p>
                <p className="text-xl font-extrabold text-purple-600 mt-1">
                  {meetings.filter((m) => m.meeting_status === "scheduled" || m.meeting_status === "upcoming").length}
                </p>
              </div>

              <div className={`rounded-xl border p-3.5 ${isDark ? "border-slate-800 bg-[#12101e]" : "border-slate-200 bg-white"}`}>
                <p className="text-[11px] font-bold text-slate-500 uppercase">Completed Calls</p>
                <p className="text-xl font-extrabold text-emerald-600 mt-1">
                  {meetings.filter((m) => m.meeting_status === "completed").length}
                </p>
              </div>

              <div className={`rounded-xl border p-3.5 ${isDark ? "border-slate-800 bg-[#12101e]" : "border-slate-200 bg-white"}`}>
                <p className="text-[11px] font-bold text-slate-500 uppercase">Rescheduled / Cancelled</p>
                <p className="text-xl font-extrabold text-amber-600 mt-1">
                  {meetings.filter((m) => m.meeting_status === "rescheduled" || m.meeting_status === "cancelled").length}
                </p>
              </div>
            </div>

            {/* Live Webhook Integration Assistant Card */}
            <div className={`rounded-xl border p-4 ${
              isDark ? "border-slate-800 bg-[#161327]" : "border-blue-200/80 bg-blue-50/50"
            }`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-blue-500" />
                    <span className="text-xs font-bold">Calendly Webhook Auto-Sync Listener</span>
                    <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 px-2 py-0.2 text-[9px] font-extrabold uppercase">
                      Active Endpoint
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    To auto-sync external bookings from Calendly into this CRM, paste this webhook endpoint in your Calendly Webhook Developer Settings:
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <code className={`px-2.5 py-1 rounded text-[11px] font-mono select-all ${
                      isDark ? "bg-slate-900 text-blue-300 border border-slate-800" : "bg-white text-blue-700 border border-blue-200"
                    }`}>
                      https://quickuppaistudio.us/api/calendly-webhook
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText("https://quickuppaistudio.us/api/calendly-webhook");
                        setCalendlyWebhookCopied(true);
                        showToast("Webhook URL copied to clipboard!");
                        setTimeout(() => setCalendlyWebhookCopied(false), 2500);
                      }}
                      className="text-xs text-blue-600 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="h-3 w-3" />
                      <span>{calendlyWebhookCopied ? "Copied!" : "Copy URL"}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search meetings by client, email, phone..."
                  value={meetingSearchTerm}
                  onChange={(e) => setMeetingSearchTerm(e.target.value)}
                  className={`w-full rounded-xl border pl-9 pr-4 py-2 text-xs outline-none focus:border-blue-500 ${
                    isDark ? "border-slate-800 bg-[#12101e] text-white" : "border-slate-200 bg-white text-slate-900"
                  }`}
                />
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto text-xs">
                {["all", "scheduled", "upcoming", "completed", "rescheduled", "cancelled"].map((st) => (
                  <button
                    key={st}
                    onClick={() => setMeetingStatusFilter(st)}
                    className={`rounded-lg px-3 py-1.5 font-bold capitalize transition-colors cursor-pointer text-[11px] whitespace-nowrap ${
                      meetingStatusFilter === st
                        ? "bg-blue-600 text-white shadow-sm"
                        : isDark
                        ? "text-slate-400 hover:bg-slate-800"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {st === "all" ? "All Statuses" : st}
                  </button>
                ))}
              </div>
            </div>

            {/* Meetings Table (Matching Section 14 in Document) */}
            <div className={`overflow-x-auto w-full rounded-2xl border shadow-sm ${
              isDark ? "border-slate-800 bg-[#12101e]" : "border-slate-200 bg-white"
            }`}>
              <table className="w-full min-w-[950px] text-left text-xs">
                <thead className={`border-b text-[11px] font-bold uppercase tracking-wider ${
                  isDark ? "border-slate-800 bg-[#171427] text-slate-400" : "border-slate-200 bg-slate-50 text-slate-600"
                }`}>
                  <tr>
                    <th className="px-4 py-3.5">Meeting Date & Time</th>
                    <th className="px-4 py-3.5">Client Name & Contact</th>
                    <th className="px-4 py-3.5">Meeting Type</th>
                    <th className="px-4 py-3.5">Meeting Status</th>
                    <th className="px-4 py-3.5">Meeting Link</th>
                    <th className="px-4 py-3.5">Handling User</th>
                    <th className="px-4 py-3.5">Created Date</th>
                    <th className="px-4 py-3.5 text-right">Workflow Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {meetings
                    .filter((m) => {
                      const matchSearch =
                        m.client_name.toLowerCase().includes(meetingSearchTerm.toLowerCase()) ||
                        m.email.toLowerCase().includes(meetingSearchTerm.toLowerCase()) ||
                        (m.phone && m.phone.includes(meetingSearchTerm));
                      const matchStatus =
                        meetingStatusFilter === "all" ? true : m.meeting_status === meetingStatusFilter;
                      return matchSearch && matchStatus;
                    })
                    .length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-xs text-slate-500">
                        <Calendar className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                        <p className="font-bold">No Calendly meetings match your search or filter.</p>
                        <p className="text-[11px] text-slate-400 mt-1">Click "+ Book / Log Meeting" or "⚡ Send Test Booking" to record one.</p>
                      </td>
                    </tr>
                  ) : (
                    meetings
                      .filter((m) => {
                        const matchSearch =
                          m.client_name.toLowerCase().includes(meetingSearchTerm.toLowerCase()) ||
                          m.email.toLowerCase().includes(meetingSearchTerm.toLowerCase()) ||
                          (m.phone && m.phone.includes(meetingSearchTerm));
                        const matchStatus =
                          meetingStatusFilter === "all" ? true : m.meeting_status === meetingStatusFilter;
                        return matchSearch && matchStatus;
                      })
                      .map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                          {/* 1. Meeting Date & Time */}
                          <td className="px-4 py-3.5">
                            <div className="font-bold text-blue-600 dark:text-blue-400">{m.meeting_date}</div>
                            <div className="text-[11px] text-slate-500 font-mono mt-0.5">{m.meeting_time}</div>
                          </td>

                          {/* 2. Client Name & Contact */}
                          <td className="px-4 py-3.5">
                            <div className="font-bold text-sm">{m.client_name}</div>
                            <div className="text-[11px] text-slate-500 font-mono">{m.email}</div>
                            {m.phone && <div className="text-[10px] text-slate-400 font-mono">{m.phone}</div>}
                          </td>

                          {/* 3. Meeting Type */}
                          <td className="px-4 py-3.5 font-medium">
                            <span>{m.meeting_type || "AI Video Strategy Call (30 min)"}</span>
                          </td>

                          {/* 4. Meeting Status (Editable Dropdown) */}
                          <td className="px-4 py-3.5">
                            <select
                              value={m.meeting_status || "scheduled"}
                              onChange={async (e) => {
                                const newStatus = e.target.value;
                                await updateCalendlyMeetingServerFn({
                                  id: m.id,
                                  meeting_status: newStatus,
                                  performedBy: session?.name || "Admin",
                                });
                                setMeetings((prev) =>
                                  prev.map((item) => (item.id === m.id ? { ...item, meeting_status: newStatus } : item))
                                );
                                showToast(`Meeting status updated to ${newStatus}`);
                                await fetchNotificationsList();
                                await fetchLogsList();
                              }}
                              className={`rounded-lg px-2 py-1 text-[11px] font-bold uppercase border cursor-pointer ${
                                m.meeting_status === "completed"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                                  : m.meeting_status === "cancelled"
                                  ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300"
                                  : m.meeting_status === "rescheduled"
                                  ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                                  : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300"
                              }`}
                            >
                              <option value="scheduled">Scheduled</option>
                              <option value="upcoming">Upcoming</option>
                              <option value="completed">Completed</option>
                              <option value="rescheduled">Rescheduled</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </td>

                          {/* 5. Meeting Link */}
                          <td className="px-4 py-3.5">
                            {m.meeting_link ? (
                              <a
                                href={m.meeting_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-blue-600 hover:underline font-mono text-xs"
                              >
                                <span>Join Call</span>
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <span className="text-slate-400 italic">No link</span>
                            )}
                          </td>

                          {/* 6. Admin / Handling User */}
                          <td className="px-4 py-3.5">
                            <select
                              value={m.assigned_admin || ""}
                              onChange={async (e) => {
                                const newAdmin = e.target.value;
                                await updateCalendlyMeetingServerFn({
                                  id: m.id,
                                  assigned_admin: newAdmin,
                                  performedBy: session?.name || "Admin",
                                });
                                setMeetings((prev) =>
                                  prev.map((item) => (item.id === m.id ? { ...item, assigned_admin: newAdmin } : item))
                                );
                                showToast("Handling admin assigned");
                              }}
                              className={`rounded-lg px-2 py-1 text-[11px] font-medium border cursor-pointer outline-none ${
                                isDark ? "border-slate-800 bg-[#161327] text-white" : "border-slate-200 bg-slate-50 text-slate-800"
                              }`}
                            >
                              <option value="">Unassigned</option>
                              <option value="superadmin@aistudio.com">Super Admin</option>
                              <option value="admin@aistudio.com">Admin</option>
                              {adminUsers.map((u) => (
                                <option key={u.id} value={u.email}>
                                  {u.name} ({u.email})
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* 7. Meeting Created Date */}
                          <td className="px-4 py-3.5 text-slate-500 font-mono text-[11px]">
                            {new Date(m.created_at).toLocaleDateString()}
                          </td>

                          {/* 8. Workflow Actions */}
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setShowAddLeadModal(true);
                                }}
                                className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-2.5 py-1 text-[11px] font-bold text-blue-600 dark:text-blue-300 hover:bg-blue-500/20 cursor-pointer"
                                title="Lead -> Calendly -> Notification -> Follow-up -> Lead Status"
                              >
                                Link Lead
                              </button>

                              <button
                                onClick={() => setEditingMeeting(m)}
                                className="rounded-lg border border-slate-200 dark:border-slate-700 p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                title="Edit Meeting Details"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </button>

                              <button
                                onClick={async () => {
                                  if (confirm(`Delete meeting record for ${m.client_name}?`)) {
                                    await deleteCalendlyMeetingServerFn({
                                      id: m.id,
                                      client_name: m.client_name,
                                      performedBy: session?.name || "Admin",
                                    });
                                    setMeetings((prev) => prev.filter((item) => item.id !== m.id));
                                    showToast("Meeting record removed");
                                    await fetchLogsList();
                                  }
                                }}
                                className="rounded-lg border border-slate-200 dark:border-slate-700 p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                                title="Delete Meeting"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: ACTIVITY HISTORY / AUDIT LOG */}
        {/* ========================================================================= */}
        {activeTab === "activity" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className={`rounded-2xl border p-4 shadow-sm ${
              isDark ? "border-slate-800 bg-[#12101e]" : "border-slate-200 bg-white"
            }`}>
              <h3 className="text-base font-bold flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-500" />
                <span>Activity History & Audit Logs</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Complete timeline of lead updates, status transitions, manual entries, and administrative actions.
              </p>
            </div>

            <div className={`overflow-hidden rounded-2xl border shadow-sm ${
              isDark ? "border-slate-800 bg-[#12101e]" : "border-slate-200 bg-white"
            }`}>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {activityLogs.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-500">
                    No activity logs recorded yet.
                  </div>
                ) : (
                  activityLogs.map((log) => (
                    <div key={log.id} className="p-4 flex items-start justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs">{log.action}</span>
                          <span className={`rounded px-1.5 py-0.2 text-[9px] font-extrabold uppercase ${
                            log.user_role === "super_admin"
                              ? "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                              : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                          }`}>
                            {log.performed_by}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300">{log.details}</p>
                      </div>

                      <div className="text-[11px] text-slate-400 font-mono shrink-0">
                        {new Date(log.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: USER MANAGEMENT (SUPER ADMIN ONLY) */}
        {/* ========================================================================= */}
        {activeTab === "users" && isSuperAdmin && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className={`rounded-2xl border p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              isDark ? "border-purple-900/40 bg-[#151026]" : "border-purple-200 bg-purple-50/50"
            }`}>
              <div>
                <h3 className="text-base font-bold flex items-center gap-2 text-purple-900 dark:text-purple-200">
                  <Users className="h-5 w-5 text-purple-600" />
                  <span>Admin User Management (Super Admin Exclusive)</span>
                </h3>
                <p className="text-xs text-purple-700/80 dark:text-purple-300/80 mt-0.5">
                  Create, configure, activate, and deactivate operational Admin accounts.
                </p>
              </div>

              <button
                onClick={() => setShowAddAdminModal(true)}
                className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-purple-700 flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="h-4 w-4" />
                <span>+ Create Admin Account</span>
              </button>
            </div>

            {/* Admin Users Table */}
            <div className={`overflow-x-auto w-full rounded-2xl border shadow-sm ${
              isDark ? "border-slate-800 bg-[#12101e]" : "border-slate-200 bg-white"
            }`}>
              <table className="w-full min-w-[750px] text-left text-xs">
                <thead className={`border-b text-[11px] font-bold uppercase tracking-wider ${
                  isDark ? "border-slate-800 bg-[#171427] text-slate-400" : "border-slate-200 bg-slate-50 text-slate-600"
                }`}>
                  <tr>
                    <th className="px-4 py-3.5">Name</th>
                    <th className="px-4 py-3.5">Email</th>
                    <th className="px-4 py-3.5">Role</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5">Created At</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {/* Default Pre-Configured Users */}
                  <tr className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                    <td className="px-4 py-3.5 font-bold">Super Admin</td>
                    <td className="px-4 py-3.5 font-mono">sa@aistudio.com</td>
                    <td className="px-4 py-3.5">
                      <span className="rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 px-2 py-0.5 text-[10px] font-bold">
                        Super Admin
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-bold">
                        Active
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-400">System Built-in</td>
                    <td className="px-4 py-3.5 text-right text-slate-400 text-[11px]">Protected</td>
                  </tr>

                  <tr className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                    <td className="px-4 py-3.5 font-bold">Operational Admin</td>
                    <td className="px-4 py-3.5 font-mono">admin@aistudio.com</td>
                    <td className="px-4 py-3.5">
                      <span className="rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 px-2 py-0.5 text-[10px] font-bold">
                        Admin
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-bold">
                        Active
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-400">System Built-in</td>
                    <td className="px-4 py-3.5 text-right text-slate-400 text-[11px]">Master Account</td>
                  </tr>

                  {/* Dynamically Created Admin Users */}
                  {adminUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                      <td className="px-4 py-3.5 font-bold">{user.name}</td>
                      <td className="px-4 py-3.5 font-mono">{user.email}</td>
                      <td className="px-4 py-3.5">
                        <span className="rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 px-2 py-0.5 text-[10px] font-bold capitalize">
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          user.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                        }`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-400">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={async () => {
                              const nextStatus = user.status === "active" ? "inactive" : "active";
                              await toggleAdminUserStatusServerFn({
                                data: {
                                  id: user.id,
                                  status: nextStatus,
                                  email: user.email,
                                  performedBy: session.name,
                                },
                              });
                              fetchAdminUsersList();
                              showToast(`Admin ${user.email} status updated to ${nextStatus}`);
                            }}
                            className="rounded border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            {user.status === "active" ? "Deactivate" : "Activate"}
                          </button>

                          <button
                            onClick={async () => {
                              if (confirm(`Delete admin account for ${user.email}?`)) {
                                await deleteAdminUserServerFn({
                                  data: { id: user.id, email: user.email, performedBy: session.name },
                                });
                                fetchAdminUsersList();
                                showToast(`Admin ${user.email} deleted`);
                              }
                            }}
                            className="rounded border border-red-300 p-1 text-red-500 hover:bg-red-50 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: LOGIN & SECURITY LOGS (SUPER ADMIN ONLY) */}
        {/* ========================================================================= */}
        {activeTab === "security" && isSuperAdmin && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className={`rounded-2xl border p-4 shadow-sm ${
              isDark ? "border-slate-800 bg-[#12101e]" : "border-slate-200 bg-white"
            }`}>
              <h3 className="text-base font-bold flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-purple-500" />
                <span>IP / GPS Login Security Tracking</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Audit log of all login attempts, IP addresses, location metrics, and device user agents.
              </p>
            </div>

            <div className={`overflow-x-auto w-full rounded-2xl border shadow-sm ${
              isDark ? "border-slate-800 bg-[#12101e]" : "border-slate-200 bg-white"
            }`}>
              <table className="w-full min-w-[900px] text-left text-xs">
                <thead className={`border-b text-[11px] font-bold uppercase tracking-wider ${
                  isDark ? "border-slate-800 bg-[#171427] text-slate-400" : "border-slate-200 bg-slate-50 text-slate-600"
                }`}>
                  <tr>
                    <th className="px-4 py-3.5">Timestamp</th>
                    <th className="px-4 py-3.5">User Email</th>
                    <th className="px-4 py-3.5">Role</th>
                    <th className="px-4 py-3.5">IP Address</th>
                    <th className="px-4 py-3.5">Approx Location</th>
                    <th className="px-4 py-3.5">Browser & Device</th>
                    <th className="px-4 py-3.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loginLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-xs text-slate-500">
                        No login attempts recorded yet.
                      </td>
                    </tr>
                  ) : (
                    loginLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                        <td className="px-4 py-3.5 text-slate-500 font-mono">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3.5 font-bold">{log.email}</td>
                        <td className="px-4 py-3.5">
                          <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold uppercase">
                            {log.role}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-blue-600 dark:text-blue-400 font-semibold select-all">
                          {log.ip_address}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">
                          {log.location || "USA / Web Client"}
                        </td>
                        <td className="px-4 py-3.5 text-slate-400 max-w-xs truncate" title={log.user_agent}>
                          {log.user_agent}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            log.status === "success"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                          }`}>
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 7: RECYCLE BIN */}
        {/* ========================================================================= */}
        {activeTab === "recycle_bin" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className={`rounded-2xl border p-4 shadow-sm flex items-center justify-between ${
              isDark ? "border-red-950/40 bg-[#160d18]" : "border-red-200 bg-red-50/50"
            }`}>
              <div>
                <h3 className="text-base font-bold flex items-center gap-2 text-red-900 dark:text-red-200">
                  <Trash2 className="h-5 w-5 text-red-600" />
                  <span>Recycle Bin (Soft-Deleted Leads)</span>
                </h3>
                <p className="text-xs text-red-700/80 dark:text-red-300/80 mt-0.5">
                  Deleted leads remain recoverable here. Super Admin can restore or permanently erase records.
                </p>
              </div>
            </div>

            <div className={`overflow-x-auto w-full rounded-2xl border shadow-sm ${
              isDark ? "border-slate-800 bg-[#12101e]" : "border-slate-200 bg-white"
            }`}>
              <table className="w-full min-w-[750px] text-left text-xs">
                <thead className={`border-b text-[11px] font-bold uppercase tracking-wider ${
                  isDark ? "border-slate-800 bg-[#171427] text-slate-400" : "border-slate-200 bg-slate-50 text-slate-600"
                }`}>
                  <tr>
                    <th className="px-4 py-3.5">Client Name</th>
                    <th className="px-4 py-3.5">Phone / Email</th>
                    <th className="px-4 py-3.5">Original Source</th>
                    <th className="px-4 py-3.5">Deleted Date</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {recycleBinLeads.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-xs text-slate-500">
                        <Trash className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                        <p className="font-bold">Recycle Bin is empty.</p>
                      </td>
                    </tr>
                  ) : (
                    recycleBinLeads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                        <td className="px-4 py-3.5 font-bold">{lead.name}</td>
                        <td className="px-4 py-3.5">
                          <div className="font-mono">{lead.phone}</div>
                          <div className="text-slate-400">{lead.email}</div>
                        </td>
                        <td className="px-4 py-3.5">{lead.source}</td>
                        <td className="px-4 py-3.5 text-slate-400">
                          {lead.deleted_at ? new Date(lead.deleted_at).toLocaleString() : "Recently"}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleRestoreLead(lead.id)}
                              className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-600 hover:bg-blue-500/20 flex items-center gap-1 cursor-pointer"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              <span>Restore</span>
                            </button>

                            {isSuperAdmin && (
                              <button
                                onClick={() => handlePermanentDeleteLead(lead.id)}
                                className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs font-bold text-red-600 hover:bg-red-500/20 flex items-center gap-1 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Permanent Erase</span>
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
        )}
      </main>

      {/* ========================================================================= */}
      {/* MODAL 1: + ADD MANUAL LEAD */}
      {/* ========================================================================= */}
      {showAddLeadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className={`w-full max-w-lg rounded-2xl border p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto ${
            isDark ? "border-slate-700 bg-[#151222] text-white" : "border-slate-200 bg-white text-slate-900"
          }`}>
            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Plus className="h-5 w-5 text-blue-500" />
                <span>Add New Manual Lead</span>
              </h3>
              <button
                onClick={() => setShowAddLeadModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const name = formData.get("name") as string;
                const phone = formData.get("phone") as string;
                const email = formData.get("email") as string;
                const business = formData.get("business") as string;
                const location = formData.get("location") as string;
                const source = (formData.get("source") as string) || "Manual";
                const videoType = formData.get("videoType") as string;
                const videoQuantity = formData.get("videoQuantity") as string;
                const status = formData.get("status") as LeadStatus;
                const projectStatus = formData.get("projectStatus") as ProjectStatus;
                const deliveryDate = formData.get("deliveryDate") as string;
                const notes = formData.get("notes") as string;

                try {
                  const res = await addManualLeadServerFn({
                    data: {
                      source,
                      name,
                      phone,
                      email: email || undefined,
                      business,
                      location: location || undefined,
                      videoType,
                      videoQuantity: videoQuantity || 1,
                      status: status || "New",
                      projectStatus: projectStatus || "In Progress",
                      deliveryDate: deliveryDate || undefined,
                      notes: notes || undefined,
                      createdBy: session.name,
                      userRole: session.role,
                    },
                  });

                  if (res.success && res.lead) {
                    setLeads((prev) => [res.lead, ...prev]);
                    broadcastLeadEvent({ type: "NEW_LEAD", lead: res.lead });
                    showToast(`${source} lead added successfully`);
                    setShowAddLeadModal(false);
                    fetchLogsList();
                  }
                } catch (err) {
                  alert("Failed to create lead.");
                }
              }}
              className="space-y-3.5 text-xs"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Lead Source *</label>
                  <select
                    name="source"
                    defaultValue="Manual"
                    className={`w-full rounded-xl border p-2.5 focus:outline-none ${
                      isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <option value="USA Website">USA Website</option>
                    <option value="India Website">India Website</option>
                    <option value="Meta">Meta</option>
                    <option value="Manual">Manual</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Client Full Name *</label>
                  <input
                    name="name"
                    required
                    placeholder="John Doe"
                    className={`w-full rounded-xl border p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
                    }`}
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Company / Brand Name *</label>
                  <input
                    name="business"
                    required
                    placeholder="Acme Studio"
                    className={`w-full rounded-xl border p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">WhatsApp / Phone *</label>
                  <input
                    name="phone"
                    required
                    placeholder="+1 (555) 019-2834"
                    className={`w-full rounded-xl border p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
                    }`}
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Email Address</label>
                  <input
                    type="email"
                    name="email"
                    placeholder="client@company.com"
                    className={`w-full rounded-xl border p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Video Type *</label>
                  <select
                    name="videoType"
                    required
                    defaultValue="AI UGC"
                    className={`w-full rounded-xl border p-2.5 focus:outline-none ${
                      isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    {VIDEO_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Video Quantity</label>
                  <input
                    type="number"
                    name="videoQuantity"
                    defaultValue="1"
                    min="1"
                    className={`w-full rounded-xl border p-2.5 focus:outline-none ${
                      isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
                    }`}
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Location / City</label>
                  <input
                    name="location"
                    placeholder="New York, USA"
                    className={`w-full rounded-xl border p-2.5 focus:outline-none ${
                      isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Initial Lead Status</label>
                  <select
                    name="status"
                    defaultValue="New"
                    className={`w-full rounded-xl border p-2.5 focus:outline-none ${
                      isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <option value="New">New</option>
                    <option value="Contacted">Contacted</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Hold">Hold</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Project Status</label>
                  <select
                    name="projectStatus"
                    defaultValue="In Progress"
                    className={`w-full rounded-xl border p-2.5 focus:outline-none ${
                      isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <option value="In Progress">In Progress</option>
                    <option value="Hold">Hold</option>
                    <option value="Delivered">Delivered</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Delivery Target Date</label>
                  <input
                    type="date"
                    name="deliveryDate"
                    className={`w-full rounded-xl border p-2.5 focus:outline-none ${
                      isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Internal Notes & Scope</label>
                <textarea
                  name="notes"
                  rows={3}
                  placeholder="Add specific requirements, deadlines, or client preferences..."
                  className={`w-full rounded-xl border p-2.5 focus:outline-none ${
                    isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
                  }`}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddLeadModal(false)}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-5 py-2 font-bold text-white shadow-md hover:bg-blue-700 cursor-pointer"
                >
                  Save Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: LEAD DETAILS FULL DRAWER / POPUP (DOC REQUIREMENT 8) */}
      {/* ========================================================================= */}
      {viewLeadDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className={`w-full max-w-3xl rounded-2xl border p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto ${
            isDark ? "border-slate-700 bg-[#151222] text-white" : "border-slate-200 bg-white text-slate-900"
          }`}>
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-4 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-600 font-extrabold text-base">
                  {viewLeadDetails.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black">{viewLeadDetails.name}</h3>
                    <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${getLeadSourceBadgeClass(viewLeadDetails.source)}`}>
                      {getLeadSourceDisplay(viewLeadDetails.source)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">{viewLeadDetails.business}</p>
                </div>
              </div>

              <button
                onClick={() => setViewLeadDetails(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Quick Status Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 p-3 text-xs">
              <div>
                <span className="text-slate-500 font-semibold block text-[10px] uppercase">Lead Status</span>
                <span className={`inline-block mt-0.5 rounded-lg border px-2.5 py-0.5 font-bold ${getLeadStatusBadge(viewLeadDetails.status)}`}>
                  {viewLeadDetails.status}
                </span>
              </div>

              <div>
                <span className="text-slate-500 font-semibold block text-[10px] uppercase">Project Status</span>
                <span className={`inline-block mt-0.5 rounded-lg border px-2.5 py-0.5 font-bold ${getProjectStatusBadge(viewLeadDetails.project_status)}`}>
                  {viewLeadDetails.project_status || "In Progress"}
                </span>
              </div>

              <div>
                <span className="text-slate-500 font-semibold block text-[10px] uppercase">Created Date</span>
                <span className="font-mono text-slate-700 dark:text-slate-300 text-[11px] block mt-0.5">
                  {new Date(viewLeadDetails.created_at).toLocaleDateString()}
                </span>
              </div>

              <div>
                <span className="text-slate-500 font-semibold block text-[10px] uppercase">Delivery Target</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400 text-xs block mt-0.5">
                  {viewLeadDetails.delivery_date || "Not scheduled"}
                </span>
              </div>
            </div>

            {/* 2-Column Sections: Client Info & Lead Info (Doc Section 8) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Section 1: Client Information */}
              <div className="rounded-2xl border p-4 space-y-3 dark:border-slate-800 bg-white dark:bg-slate-900/40 shadow-xs">
                <div className="flex items-center gap-1.5 border-b pb-2 dark:border-slate-800">
                  <User className="h-4 w-4 text-blue-500" />
                  <span className="font-extrabold uppercase tracking-wider text-[11px] text-slate-700 dark:text-slate-300">
                    Client Information
                  </span>
                </div>

                <div className="space-y-2.5">
                  <div className="flex justify-between items-start">
                    <span className="text-slate-500">Client Name:</span>
                    <span className="font-bold text-slate-900 dark:text-white text-right">{viewLeadDetails.name}</span>
                  </div>

                  <div className="flex justify-between items-start">
                    <span className="text-slate-500">Business Name:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 text-right">{viewLeadDetails.business}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Phone Number:</span>
                    <a
                      href={`tel:${viewLeadDetails.phone.replace(/[^0-9+]/g, "")}`}
                      className="font-mono font-bold text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <Phone className="h-3 w-3" />
                      <span>{viewLeadDetails.phone}</span>
                    </a>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">WhatsApp:</span>
                    <button
                      type="button"
                      onClick={() => handleOpenWhatsApp(viewLeadDetails)}
                      className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white hover:bg-emerald-700 cursor-pointer"
                    >
                      <MessageSquare className="h-3 w-3" />
                      <span>Chat on WhatsApp</span>
                    </button>
                  </div>

                  <div className="flex justify-between items-start">
                    <span className="text-slate-500">Email Address:</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300 text-right">
                      {viewLeadDetails.email || "Not provided"}
                    </span>
                  </div>

                  <div className="flex justify-between items-start">
                    <span className="text-slate-500">Business Location:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 text-right">
                      {viewLeadDetails.location || "USA / Global"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 2: Lead Information */}
              <div className="rounded-2xl border p-4 space-y-3 dark:border-slate-800 bg-white dark:bg-slate-900/40 shadow-xs">
                <div className="flex items-center gap-1.5 border-b pb-2 dark:border-slate-800">
                  <ShieldCheck className="h-4 w-4 text-purple-500" />
                  <span className="font-extrabold uppercase tracking-wider text-[11px] text-slate-700 dark:text-slate-300">
                    Lead & Project Information
                  </span>
                </div>

                <div className="space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Lead Source:</span>
                    <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${getLeadSourceBadgeClass(viewLeadDetails.source)}`}>
                      {getLeadSourceDisplay(viewLeadDetails.source)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Created Timestamp:</span>
                    <span className="font-mono text-slate-600 dark:text-slate-400 text-[11px]">
                      {new Date(viewLeadDetails.created_at).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Lead Status:</span>
                    <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${getLeadStatusBadge(viewLeadDetails.status)}`}>
                      {viewLeadDetails.status}
                    </span>
                  </div>

                  {viewLeadDetails.closed_by && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Lead Closed By:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {viewLeadDetails.closed_by}
                      </span>
                    </div>
                  )}

                  {viewLeadDetails.closed_at && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Closed Date:</span>
                      <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        {new Date(viewLeadDetails.closed_at).toLocaleString()}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Delivery Date:</span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      {viewLeadDetails.delivery_date || "Pending schedule"}
                    </span>
                  </div>

                  {viewLeadDetails.delivered_at && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Delivered Date:</span>
                      <span className="font-mono text-[11px] text-emerald-600 font-bold">
                        {new Date(viewLeadDetails.delivered_at).toLocaleString()}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Assigned / Handled By:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {viewLeadDetails.assigned_admin || session.name || "Admin"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Scope & Requirements */}
            <div className="rounded-2xl border p-4 space-y-3 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-xs">
              <div className="flex items-center justify-between border-b pb-2 dark:border-slate-800">
                <div className="flex items-center gap-1.5">
                  <Video className="h-4 w-4 text-blue-500" />
                  <span className="font-extrabold uppercase tracking-wider text-[11px] text-slate-700 dark:text-slate-300">
                    Video Scope & Project Details
                  </span>
                </div>
                <span className="font-bold text-slate-900 dark:text-white">
                  {viewLeadDetails.video_type} (Quantity: {viewLeadDetails.video_quantity || 1})
                </span>
              </div>

              {(viewLeadDetails.requirement || viewLeadDetails.additional) && (
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Requirements / Client Notes</span>
                  <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed bg-white dark:bg-slate-900 p-3 rounded-xl border dark:border-slate-800">
                    {viewLeadDetails.requirement || viewLeadDetails.additional}
                  </p>
                </div>
              )}

              {viewLeadDetails.notes && (
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Internal Team Notes</span>
                  <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap bg-white dark:bg-slate-900 p-3 rounded-xl border dark:border-slate-800">
                    {viewLeadDetails.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Section 4: Live Activity History for this Lead */}
            <div className="rounded-2xl border p-4 space-y-2 dark:border-slate-800 bg-white dark:bg-slate-900/40 text-xs">
              <div className="flex items-center gap-1.5 border-b pb-2 dark:border-slate-800">
                <Clock className="h-4 w-4 text-amber-500" />
                <span className="font-extrabold uppercase tracking-wider text-[11px] text-slate-700 dark:text-slate-300">
                  Lead Activity History & Audit Trail
                </span>
              </div>

              <div className="space-y-2 pt-1 max-h-40 overflow-y-auto">
                {activityLogs.filter((a) => a.lead_id === viewLeadDetails.id).length === 0 ? (
                  <div className="text-slate-400 text-xs italic py-2">
                    Initial lead submission recorded on {new Date(viewLeadDetails.created_at).toLocaleString()}.
                  </div>
                ) : (
                  activityLogs
                    .filter((a) => a.lead_id === viewLeadDetails.id)
                    .map((log) => (
                      <div key={log.id} className="flex items-start justify-between gap-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-[11px]">{log.action}</span>
                            <span className="rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 px-1 py-0.2 text-[9px] font-extrabold uppercase">
                              {log.performed_by}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-300">{log.details}</p>
                        </div>
                        <span className="font-mono text-[10px] text-slate-400 shrink-0">
                          {new Date(log.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    ))
                )}
              </div>
            </div>

            {/* Quick Actions Footer */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t dark:border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenWhatsApp(viewLeadDetails)}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>Open WhatsApp</span>
                </button>

                <a
                  href={`tel:${viewLeadDetails.phone.replace(/[^0-9+]/g, "")}`}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer"
                >
                  <Phone className="h-4 w-4" />
                  <span>Call Client</span>
                </a>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingLead(viewLeadDetails);
                    setViewLeadDetails(null);
                  }}
                  className="rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-xs font-bold text-blue-600 hover:bg-blue-500/20 flex items-center gap-1 cursor-pointer"
                >
                  <Edit className="h-3.5 w-3.5" />
                  <span>Edit Lead</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewLeadDetails(null)}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: EDIT LEAD */}
      {/* ========================================================================= */}
      {editingLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className={`w-full max-w-lg rounded-2xl border p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto ${
            isDark ? "border-slate-700 bg-[#151222] text-white" : "border-slate-200 bg-white text-slate-900"
          }`}>
            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Edit className="h-5 w-5 text-blue-500" />
                <span>Edit Lead Information</span>
              </h3>
              <button
                onClick={() => setEditingLead(null)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const updates: Partial<Lead> = {
                  name: formData.get("name") as string,
                  business: formData.get("business") as string,
                  phone: formData.get("phone") as string,
                  email: (formData.get("email") as string) || undefined,
                  location: (formData.get("location") as string) || undefined,
                  video_type: formData.get("videoType") as string,
                  video_quantity: formData.get("videoQuantity") as string,
                  delivery_date: (formData.get("deliveryDate") as string) || undefined,
                  notes: (formData.get("notes") as string) || undefined,
                };

                const updatedLeads = leads.map((l) => (l.id === editingLead.id ? { ...l, ...updates } : l));
                setLeads(updatedLeads);
                localStorage.setItem("ai_studio_local_leads", JSON.stringify(updatedLeads));
                broadcastLeadEvent({ type: "UPDATE_LEAD", id: editingLead.id });

                try {
                  await updateLeadDetailsServerFn({
                    data: {
                      id: editingLead.id,
                      updates,
                      updatedBy: session.name,
                      userRole: session.role,
                      changeSummary: `Lead ${editingLead.name} details updated by ${session.name}`,
                    },
                  });
                  showToast("Lead updated successfully");
                  setEditingLead(null);
                  fetchLogsList();
                } catch (err) {
                  alert("Failed to update lead.");
                }
              }}
              className="space-y-3.5 text-xs"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Client Full Name *</label>
                  <input
                    name="name"
                    required
                    defaultValue={editingLead.name}
                    className={`w-full rounded-xl border p-2.5 focus:outline-none ${
                      isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
                    }`}
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Company / Brand *</label>
                  <input
                    name="business"
                    required
                    defaultValue={editingLead.business}
                    className={`w-full rounded-xl border p-2.5 focus:outline-none ${
                      isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Phone Number *</label>
                  <input
                    name="phone"
                    required
                    defaultValue={editingLead.phone}
                    className={`w-full rounded-xl border p-2.5 focus:outline-none ${
                      isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
                    }`}
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Email Address</label>
                  <input
                    name="email"
                    defaultValue={editingLead.email || ""}
                    className={`w-full rounded-xl border p-2.5 focus:outline-none ${
                      isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Video Type</label>
                  <select
                    name="videoType"
                    defaultValue={editingLead.video_type}
                    className={`w-full rounded-xl border p-2.5 focus:outline-none ${
                      isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    {VIDEO_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Video Quantity</label>
                  <input
                    name="videoQuantity"
                    defaultValue={editingLead.video_quantity || "1"}
                    className={`w-full rounded-xl border p-2.5 focus:outline-none ${
                      isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
                    }`}
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Location</label>
                  <input
                    name="location"
                    defaultValue={editingLead.location || ""}
                    className={`w-full rounded-xl border p-2.5 focus:outline-none ${
                      isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Delivery Target Date</label>
                <input
                  type="date"
                  name="deliveryDate"
                  defaultValue={editingLead.delivery_date || ""}
                  className={`w-full rounded-xl border p-2.5 focus:outline-none ${
                    isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
                  }`}
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Internal Notes</label>
                <textarea
                  name="notes"
                  rows={3}
                  defaultValue={editingLead.notes || ""}
                  className={`w-full rounded-xl border p-2.5 focus:outline-none ${
                    isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
                  }`}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingLead(null)}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-5 py-2 font-bold text-white shadow-md hover:bg-blue-700 cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: CLOSE LEAD LOGIC (DOC REQUIREMENT 6.1) */}
      {/* ========================================================================= */}
      {closingLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl space-y-4 ${
            isDark ? "border-slate-700 bg-[#151222] text-white" : "border-slate-200 bg-white text-slate-900"
          }`}>
            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
              <h3 className="text-base font-bold flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
                <span>Finalize & Close Lead</span>
              </h3>
              <button
                onClick={() => setClosingLead(null)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Closing lead for <strong className="text-slate-900 dark:text-white">{closingLead.name}</strong> ({closingLead.business}).
              As per CRM policy, please specify the expected delivery date.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const deliveryDate = formData.get("deliveryDate") as string;
                if (!deliveryDate) return alert("Delivery Date is required to close a lead.");
                handleUpdateLeadStatus(closingLead, "Closed", { deliveryDate });
                setClosingLead(null);
              }}
              className="space-y-4 text-xs"
            >
              <div className="rounded-xl border p-3 bg-slate-50 dark:bg-slate-900/50 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Lead Closed By:</span>
                  <span className="font-bold">{session.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Closed Timestamp:</span>
                  <span className="font-mono">{new Date().toLocaleDateString()}</span>
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Expected Delivery Date *</label>
                <input
                  type="date"
                  name="deliveryDate"
                  required
                  defaultValue={closingLead.delivery_date || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)}
                  className={`w-full rounded-xl border p-2.5 font-bold focus:outline-none ${
                    isDark ? "border-slate-700 bg-slate-900 text-white" : "border-slate-200 bg-slate-50 text-slate-900"
                  }`}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setClosingLead(null)}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-600 px-5 py-2 font-bold text-white shadow-md hover:bg-emerald-700 cursor-pointer"
                >
                  Confirm Lead Closed
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: DELIVER PROJECT LOGIC (DOC REQUIREMENT 7.1) */}
      {/* ========================================================================= */}
      {deliveringLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl space-y-4 ${
            isDark ? "border-slate-700 bg-[#151222] text-white" : "border-slate-200 bg-white text-slate-900"
          }`}>
            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
              <h3 className="text-base font-bold flex items-center gap-2 text-emerald-600">
                <Package className="h-5 w-5" />
                <span>Mark Project Delivered</span>
              </h3>
              <button
                onClick={() => setDeliveringLead(null)}
                className="rounded-lg p-1 text-slate-400 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Confirm project delivery for <strong>{deliveringLead.name}</strong> ({deliveringLead.video_type}).
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const deliveryDate = formData.get("deliveryDate") as string;
                handleUpdateProjectStatus(deliveringLead, "Delivered", deliveryDate);
                setDeliveringLead(null);
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-bold mb-1">Actual Delivery Date *</label>
                <input
                  type="date"
                  name="deliveryDate"
                  required
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  className={`w-full rounded-xl border p-2.5 font-bold focus:outline-none ${
                    isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
                  }`}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeliveringLead(null)}
                  className="rounded-xl border px-4 py-2 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-600 px-5 py-2 font-bold text-white shadow-md hover:bg-emerald-700 cursor-pointer"
                >
                  Mark Delivered
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: CREATE ADMIN ACCOUNT (SUPER ADMIN ONLY) */}
      {/* ========================================================================= */}
      {showAddAdminModal && isSuperAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl space-y-4 ${
            isDark ? "border-purple-900/50 bg-[#151026] text-white" : "border-purple-200 bg-white text-slate-900"
          }`}>
            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
              <h3 className="text-base font-bold flex items-center gap-2 text-purple-600">
                <UserPlus className="h-5 w-5" />
                <span>Create New Admin Account</span>
              </h3>
              <button
                onClick={() => setShowAddAdminModal(false)}
                className="rounded-lg p-1 text-slate-400 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const name = formData.get("name") as string;
                const email = formData.get("email") as string;
                const password = formData.get("password") as string;
                const role = formData.get("role") as "super_admin" | "admin";

                try {
                  const res = await createAdminUserServerFn({
                    data: {
                      name,
                      email,
                      password,
                      role: role || "admin",
                      status: "active",
                      performedBy: session.name,
                    },
                  });

                  if (res.success && res.user) {
                    setAdminUsers((prev) => [res.user, ...prev]);
                    showToast(`Admin account for ${email} created successfully`);
                    setShowAddAdminModal(false);
                    fetchLogsList();
                  }
                } catch (err) {
                  alert("Failed to create admin user.");
                }
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block font-semibold mb-1">Admin Full Name *</label>
                <input
                  name="name"
                  required
                  placeholder="Sarah Johnson"
                  className={`w-full rounded-xl border p-2.5 focus:outline-none ${
                    isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
                  }`}
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Admin Email *</label>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="sarah@aistudio.com"
                  className={`w-full rounded-xl border p-2.5 focus:outline-none ${
                    isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
                  }`}
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Password *</label>
                <input
                  type="password"
                  name="password"
                  required
                  placeholder="••••••••"
                  className={`w-full rounded-xl border p-2.5 focus:outline-none ${
                    isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
                  }`}
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Role Permission</label>
                <select
                  name="role"
                  defaultValue="admin"
                  className={`w-full rounded-xl border p-2.5 focus:outline-none ${
                    isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <option value="admin">Admin (Operational CRM Access)</option>
                  <option value="super_admin">Super Admin (Full System & User Control)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddAdminModal(false)}
                  className="rounded-xl border px-4 py-2 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-purple-600 px-5 py-2 font-bold text-white shadow-md hover:bg-purple-700 cursor-pointer"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 7: ADD CALENDLY MEETING */}
      {/* ========================================================================= */}
      {showAddMeetingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl space-y-4 ${
            isDark ? "border-slate-700 bg-[#151222] text-white" : "border-slate-200 bg-white text-slate-900"
          }`}>
            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
              <h3 className="text-base font-bold flex items-center gap-2 text-blue-600">
                <Calendar className="h-5 w-5" />
                <span>Schedule Calendly Strategy Call</span>
              </h3>
              <button
                onClick={() => setShowAddMeetingModal(false)}
                className="rounded-lg p-1 text-slate-400 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const client_name = formData.get("client_name") as string;
                const email = formData.get("email") as string;
                const phone = formData.get("phone") as string;
                const meeting_date = formData.get("meeting_date") as string;
                const meeting_time = formData.get("meeting_time") as string;
                const meeting_link = formData.get("meeting_link") as string;
                const meeting_type = formData.get("meeting_type") as string;
                const assigned_admin = formData.get("assigned_admin") as string;
                const notes = formData.get("notes") as string;

                try {
                  const res = await saveCalendlyMeetingServerFn({
                    data: {
                      client_name,
                      email,
                      phone: phone || undefined,
                      meeting_date,
                      meeting_time,
                      meeting_link: meeting_link || "https://calendly.com/quickuppaistudio/strategy-call",
                      meeting_type: meeting_type || "AI Video Strategy Call (30 min)",
                      assigned_admin: assigned_admin || undefined,
                      notes: notes || undefined,
                      meeting_status: "scheduled",
                      performedBy: session?.name || "Admin",
                    },
                  });

                  if (res.success && res.meeting) {
                    setMeetings((prev) => [res.meeting!, ...prev]);
                    showToast("Meeting scheduled & recorded in CRM");
                    setShowAddMeetingModal(false);
                    await fetchNotificationsList();
                    await fetchLogsList();
                  }
                } catch (err) {
                  alert("Failed to save meeting.");
                }
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block font-semibold mb-1">Client Name *</label>
                <input
                  name="client_name"
                  required
                  placeholder="Alex Rivera"
                  className={`w-full rounded-xl border p-2.5 focus:outline-none ${
                    isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Email *</label>
                  <input
                    type="email"
                    name="email"
                    required
                    placeholder="alex@brand.com"
                    className={`w-full rounded-xl border p-2.5 focus:outline-none ${
                      isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
                    }`}
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Phone</label>
                  <input
                    name="phone"
                    placeholder="+1 (555) 234-5678"
                    className={`w-full rounded-xl border p-2.5 focus:outline-none ${
                      isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Meeting Date *</label>
                  <input
                    type="date"
                    name="meeting_date"
                    required
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    className={`w-full rounded-xl border p-2.5 focus:outline-none ${
                      isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
                    }`}
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Meeting Time *</label>
                  <input
                    type="text"
                    name="meeting_time"
                    required
                    defaultValue="3:00 PM EST"
                    placeholder="e.g. 3:00 PM EST"
                    className={`w-full rounded-xl border p-2.5 focus:outline-none ${
                      isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Meeting Type</label>
                  <select
                    name="meeting_type"
                    defaultValue="AI Video Strategy Call (30 min)"
                    className={`w-full rounded-xl border p-2.5 focus:outline-none ${
                      isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <option value="AI Video Strategy Call (30 min)">AI Video Strategy Call (30 min)</option>
                    <option value="Product Demo Call (15 min)">Product Demo Call (15 min)</option>
                    <option value="Custom Enterprise Consultation">Custom Enterprise Consultation</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Handling Admin</label>
                  <select
                    name="assigned_admin"
                    className={`w-full rounded-xl border p-2.5 focus:outline-none ${
                      isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <option value="">Unassigned</option>
                    <option value="superadmin@aistudio.com">Super Admin</option>
                    <option value="admin@aistudio.com">Admin</option>
                    {adminUsers.map((u) => (
                      <option key={u.id} value={u.email}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Meeting Link (Google Meet / Zoom / Calendly)</label>
                <input
                  name="meeting_link"
                  defaultValue="https://calendly.com/quickuppaistudio/strategy-call"
                  className={`w-full rounded-xl border p-2.5 font-mono focus:outline-none ${
                    isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
                  }`}
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Notes / Client Requirement</label>
                <textarea
                  name="notes"
                  rows={2}
                  placeholder="Notes about the client's video goals or brand background..."
                  className={`w-full rounded-xl border p-2.5 focus:outline-none resize-none ${
                    isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
                  }`}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddMeetingModal(false)}
                  className="rounded-xl border px-4 py-2 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-5 py-2 font-bold text-white shadow-md hover:bg-blue-700 cursor-pointer"
                >
                  Save Meeting
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 7.5: EDIT CALENDLY MEETING DETAILS */}
      {editingMeeting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl space-y-4 ${
            isDark ? "border-slate-700 bg-[#151222] text-white" : "border-slate-200 bg-white text-slate-900"
          }`}>
            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
              <h3 className="text-base font-bold flex items-center gap-2 text-blue-600">
                <Edit className="h-5 w-5" />
                <span>Edit Meeting Details</span>
              </h3>
              <button
                onClick={() => setEditingMeeting(null)}
                className="rounded-lg p-1 text-slate-400 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const client_name = formData.get("client_name") as string;
                const email = formData.get("email") as string;
                const phone = formData.get("phone") as string;
                const meeting_date = formData.get("meeting_date") as string;
                const meeting_time = formData.get("meeting_time") as string;
                const meeting_status = formData.get("meeting_status") as string;
                const meeting_link = formData.get("meeting_link") as string;
                const meeting_type = formData.get("meeting_type") as string;
                const assigned_admin = formData.get("assigned_admin") as string;
                const notes = formData.get("notes") as string;

                try {
                  const res = await updateCalendlyMeetingServerFn({
                    id: editingMeeting.id,
                    client_name,
                    email,
                    phone: phone || undefined,
                    meeting_date,
                    meeting_time,
                    meeting_status,
                    meeting_link,
                    meeting_type,
                    assigned_admin: assigned_admin || undefined,
                    notes: notes || undefined,
                    performedBy: session?.name || "Admin",
                  });

                  if (res.success) {
                    setMeetings((prev) =>
                      prev.map((m) =>
                        m.id === editingMeeting.id
                          ? {
                              ...m,
                              client_name,
                              email,
                              phone,
                              meeting_date,
                              meeting_time,
                              meeting_status,
                              meeting_link,
                              meeting_type,
                              assigned_admin,
                              notes,
                            }
                          : m
                      )
                    );
                    showToast("Meeting updated successfully");
                    setEditingMeeting(null);
                    await fetchNotificationsList();
                    await fetchLogsList();
                  }
                } catch (err) {
                  alert("Failed to update meeting.");
                }
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block font-semibold mb-1">Client Name *</label>
                <input
                  name="client_name"
                  required
                  defaultValue={editingMeeting.client_name}
                  className={`w-full rounded-xl border p-2.5 focus:outline-none ${
                    isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Email *</label>
                  <input
                    type="email"
                    name="email"
                    required
                    defaultValue={editingMeeting.email}
                    className={`w-full rounded-xl border p-2.5 focus:outline-none ${
                      isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
                    }`}
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Phone</label>
                  <input
                    name="phone"
                    defaultValue={editingMeeting.phone || ""}
                    className={`w-full rounded-xl border p-2.5 focus:outline-none ${
                      isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Meeting Date *</label>
                  <input
                    type="text"
                    name="meeting_date"
                    required
                    defaultValue={editingMeeting.meeting_date}
                    className={`w-full rounded-xl border p-2.5 focus:outline-none ${
                      isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
                    }`}
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Meeting Time *</label>
                  <input
                    type="text"
                    name="meeting_time"
                    required
                    defaultValue={editingMeeting.meeting_time}
                    className={`w-full rounded-xl border p-2.5 focus:outline-none ${
                      isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Status</label>
                  <select
                    name="meeting_status"
                    defaultValue={editingMeeting.meeting_status || "scheduled"}
                    className={`w-full rounded-xl border p-2.5 focus:outline-none ${
                      isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="upcoming">Upcoming</option>
                    <option value="completed">Completed</option>
                    <option value="rescheduled">Rescheduled</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Handling Admin</label>
                  <select
                    name="assigned_admin"
                    defaultValue={editingMeeting.assigned_admin || ""}
                    className={`w-full rounded-xl border p-2.5 focus:outline-none ${
                      isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <option value="">Unassigned</option>
                    <option value="superadmin@aistudio.com">Super Admin</option>
                    <option value="admin@aistudio.com">Admin</option>
                    {adminUsers.map((u) => (
                      <option key={u.id} value={u.email}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Meeting Link</label>
                <input
                  name="meeting_link"
                  defaultValue={editingMeeting.meeting_link}
                  className={`w-full rounded-xl border p-2.5 font-mono focus:outline-none ${
                    isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
                  }`}
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Meeting Type</label>
                <input
                  name="meeting_type"
                  defaultValue={editingMeeting.meeting_type || "AI Video Strategy Call (30 min)"}
                  className={`w-full rounded-xl border p-2.5 focus:outline-none ${
                    isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
                  }`}
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Notes</label>
                <textarea
                  name="notes"
                  rows={2}
                  defaultValue={editingMeeting.notes || ""}
                  className={`w-full rounded-xl border p-2.5 focus:outline-none resize-none ${
                    isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
                  }`}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingMeeting(null)}
                  className="rounded-xl border px-4 py-2 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-5 py-2 font-bold text-white shadow-md hover:bg-blue-700 cursor-pointer"
                >
                  Update Meeting
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 8: ORDER DETAILS MODAL */}
      {/* ========================================================================= */}
      {selectedOrderDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className={`w-full max-w-lg rounded-2xl border p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto ${
            isDark ? "border-slate-700 bg-[#151222] text-white" : "border-slate-200 bg-white text-slate-900"
          }`}>
            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
              <h3 className="text-base font-bold flex items-center gap-2 text-purple-600">
                <Package className="h-5 w-5" />
                <span>PayPal Order Record</span>
              </h3>
              <button
                onClick={() => setSelectedOrderDetails(null)}
                className="rounded-lg p-1 text-slate-400 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border p-3 bg-slate-50 dark:bg-slate-900/50 space-y-1">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Customer</span>
                <p className="font-bold text-sm">{selectedOrderDetails.customer_name}</p>
                <p className="font-mono text-slate-500">{selectedOrderDetails.customer_email}</p>
              </div>

              <div className="rounded-xl border p-3 bg-slate-50 dark:bg-slate-900/50 space-y-1">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Payment</span>
                <p className="font-mono font-bold text-base text-emerald-600">
                  ${Number(selectedOrderDetails.amount).toFixed(2)} {selectedOrderDetails.currency}
                </p>
                <p className="font-bold text-purple-600">Status: {selectedOrderDetails.payment_status}</p>
              </div>
            </div>

            <div className="rounded-xl border p-3 space-y-1 text-xs font-mono dark:border-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-400">Order ID:</span>
                <span className="font-bold select-all">{selectedOrderDetails.paypal_order_id}</span>
              </div>
              {selectedOrderDetails.paypal_capture_id && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Capture ID:</span>
                  <span className="font-bold text-emerald-600 select-all">{selectedOrderDetails.paypal_capture_id}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedOrderDetails(null)}
                className="rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white hover:bg-purple-700 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Tab Security PIN Modal */}
      {showPaymentPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white p-7 shadow-2xl text-slate-800">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-600 shadow-xs">
                  <Lock className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Unlock Payments Tab</h3>
                  <p className="text-xs text-slate-500">Enter security PIN to view orders &amp; revenue</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPaymentPinModal(false);
                  setPaymentPinInput("");
                  setPaymentPinError("");
                }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Security PIN
                </label>
                <div className="relative">
                  <input
                    type="text"
                    name="security_pin_code"
                    id="security_pin_code"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    data-form-type="other"
                    autoFocus
                    placeholder="Enter PIN"
                    value={paymentPinInput}
                    style={
                      {
                        WebkitTextSecurity: showPaymentPin ? "none" : "disc",
                      } as React.CSSProperties
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleUnlockPaymentPin();
                      }
                    }}
                    onChange={(e) => {
                      setPaymentPinInput(e.target.value);
                      if (paymentPinError) setPaymentPinError("");
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all font-mono tracking-wider"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPaymentPin(!showPaymentPin)}
                    className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                    tabIndex={-1}
                    title={showPaymentPin ? "Hide PIN" : "Show PIN"}
                  >
                    {showPaymentPin ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                  </button>
                </div>

                {paymentPinError && (
                  <p className="mt-2 text-xs font-bold text-red-600 animate-in fade-in flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>{paymentPinError}</span>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPaymentPinModal(false);
                    setPaymentPinInput("");
                    setPaymentPinError("");
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-100 py-2.5 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleUnlockPaymentPin()}
                  disabled={isVerifyingPin}
                  className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md hover:brightness-105 transition-all hover:scale-[1.02] active:scale-98 cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <ShieldCheck className="h-4 w-4" />
                  <span>{isVerifyingPin ? "Verifying..." : "Unlock"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-white px-4 py-3 text-xs font-bold text-white dark:text-slate-900 shadow-2xl animate-in slide-in-from-bottom-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 dark:text-emerald-600" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
