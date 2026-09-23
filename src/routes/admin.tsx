import { useState, useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  DollarSign,
  Download,
  Eye,
  EyeOff,
  Filter,
  Layers,
  Lock,
  LogOut,
  Mail,
  MessageSquare,
  Package,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import type { Lead, Order, PaymentStatus } from "@/lib/db";
import {
  fetchLeadsServerFn,
  updateLeadStatusServerFn,
  deleteLeadServerFn,
  broadcastLeadEvent,
} from "@/lib/lead-actions";
import {
  fetchOrdersServerFn,
  updateOrderStatusServerFn,
  deleteOrderServerFn,
  broadcastOrderEvent,
} from "@/lib/paypal-actions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin Portal | Quickupp AI Studio CRM" }],
  }),
  component: AdminPage,
});

// Audio chime using Web Audio API (Zero external network dependencies)
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
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.1); // A5
    osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.22); // D6

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.55);
  } catch {
    // Audio may be blocked before first user gesture, fail gracefully
  }
}

function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [authError, setAuthError] = useState("");

  const [activeTab, setActiveTab] = useState<"leads" | "orders">("leads");

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [filterSource, setFilterSource] = useState<string>("All");
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLeadForMsg, setSelectedLeadForMsg] = useState<Lead | null>(null);
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Orders State
  const [orders, setOrders] = useState<Order[]>([]);
  const [filterOrderStatus, setFilterOrderStatus] = useState<string>("All");
  const [orderSearchTerm, setOrderSearchTerm] = useState("");
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<Order | null>(null);
  const [newOrderNotification, setNewOrderNotification] = useState<Order | null>(null);
  const [highlightedOrderIds, setHighlightedOrderIds] = useState<Set<string>>(new Set());

  // Real-time live sync state
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const [refreshCountdown, setRefreshCountdown] = useState<number>(10);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("ai_studio_sound_enabled") !== "false";
  });
  const [newLeadNotification, setNewLeadNotification] = useState<Lead | null>(null);
  const [highlightedLeadIds, setHighlightedLeadIds] = useState<Set<string>>(new Set());

  // Ref to always access the latest state inside callbacks/intervals without stale closures
  const leadsRef = useRef<Lead[]>(leads);
  useEffect(() => {
    leadsRef.current = leads;
  }, [leads]);

  const ordersRef = useRef<Order[]>(orders);
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  // Check saved session & remember me on initial mount
  useEffect(() => {
    const savedAuth = localStorage.getItem("ai_studio_admin_auth");
    if (savedAuth === "true") {
      setIsAuthenticated(true);
      fetchLeads(false);
      fetchOrders(false);
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
  }, [isAuthenticated]);

  // Handle incoming lead in real-time (from broadcast, supabase, or polling)
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

    if (soundEnabled) {
      playNotificationChime();
    }
    setNewLeadNotification(newLead);
    setLastSyncTime(new Date());

    setTimeout(() => {
      setNewLeadNotification((curr) => (curr?.id === newLead.id ? null : curr));
    }, 7000);
  };

  // Handle incoming order in real-time (from broadcast or polling)
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

    if (soundEnabled) {
      playNotificationChime();
    }
    setNewOrderNotification(newOrder);
    setLastSyncTime(new Date());

    setTimeout(() => {
      setNewOrderNotification((curr) => (curr?.id === newOrder.id ? null : curr));
    }, 7000);
  };

  // 10-Second Auto-Refresh Polling and Multi-Channel Event Listeners
  useEffect(() => {
    if (!isAuthenticated) return;

    // 1. Second-by-second countdown timer for visual transparency
    const countdownTimer = setInterval(() => {
      setRefreshCountdown((prev) => (prev <= 1 ? 10 : prev - 1));
    }, 1000);

    // 2. Auto-refresh leads and orders from database every 10 seconds (10,000 ms)
    const intervalId = setInterval(() => {
      fetchLeads(true);
      fetchOrders(true);
      setRefreshCountdown(10);
    }, 10000);

    // 3. Window Focus & Visibility Change (Instant fetch whenever admin clicks/switches to this tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchLeads(true);
        fetchOrders(true);
        setRefreshCountdown(10);
      }
    };
    const handleFocus = () => {
      fetchLeads(true);
      fetchOrders(true);
      setRefreshCountdown(10);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    // 4. BroadcastChannel for 0ms Instant Cross-Tab Sync
    let bcLeads: BroadcastChannel | null = null;
    let bcOrders: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      try {
        bcLeads = new BroadcastChannel("ai_studio_leads_sync");
        bcLeads.onmessage = (event) => {
          if (event.data?.type === "NEW_LEAD" && event.data.lead) {
            handleIncomingLead(event.data.lead);
          } else if (event.data?.type === "UPDATE_LEAD" || event.data?.type === "DELETE_LEAD") {
            fetchLeads(true);
          }
        };

        bcOrders = new BroadcastChannel("ai_studio_orders_sync");
        bcOrders.onmessage = (event) => {
          if (event.data?.type === "NEW_ORDER" && event.data.order) {
            handleIncomingOrder(event.data.order);
          } else if (event.data?.type === "UPDATE_ORDER" || event.data?.type === "DELETE_ORDER") {
            fetchOrders(true);
          }
        };
      } catch (e) {
        console.warn("BroadcastChannel init warning:", e);
      }
    }

    // 5. Custom Window Event Listener (same-tab immediate trigger)
    const handleCustomLeadEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.type === "NEW_LEAD" && customEvent.detail.lead) {
        handleIncomingLead(customEvent.detail.lead);
      } else if (
        customEvent.detail?.type === "UPDATE_LEAD" ||
        customEvent.detail?.type === "DELETE_LEAD"
      ) {
        fetchLeads(true);
      }
    };
    window.addEventListener("ai_studio_lead_event", handleCustomLeadEvent);

    const handleCustomOrderEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.type === "NEW_ORDER" && customEvent.detail.order) {
        handleIncomingOrder(customEvent.detail.order);
      } else if (
        customEvent.detail?.type === "UPDATE_ORDER" ||
        customEvent.detail?.type === "DELETE_ORDER"
      ) {
        fetchOrders(true);
      }
    };
    window.addEventListener("ai_studio_order_event", handleCustomOrderEvent);

    // 6. Local Storage StorageEvent Listener (cross-window storage sync)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "ai_studio_local_leads" && e.newValue) {
        try {
          const parsed: Lead[] = JSON.parse(e.newValue);
          setLeads(parsed);
          setLastSyncTime(new Date());
        } catch {
          // ignore json parse error
        }
      }
    };
    window.addEventListener("storage", handleStorageChange);

    return () => {
      clearInterval(countdownTimer);
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      if (bcLeads) bcLeads.close();
      if (bcOrders) bcOrders.close();
      window.removeEventListener("ai_studio_lead_event", handleCustomLeadEvent);
      window.removeEventListener("ai_studio_order_event", handleCustomOrderEvent);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [isAuthenticated, soundEnabled]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = emailInput.trim().toLowerCase();
    const isValid =
      (cleanEmail === "qsaistudio@gmail.com" && passwordInput === "Anay@0079") ||
      (cleanEmail === "admin@aistudio.com" && passwordInput === "Admin@123") ||
      (cleanEmail === "info@quickuppaistudio.us" && passwordInput === "Admin@123");

    if (isValid) {
      setIsAuthenticated(true);
      localStorage.setItem("ai_studio_admin_auth", "true");

      if (rememberMe) {
        localStorage.setItem("ai_studio_remembered_email", emailInput);
      } else {
        localStorage.removeItem("ai_studio_remembered_email");
      }

      setAuthError("");
      fetchLeads(false);
    } else {
      setAuthError("Invalid admin credentials. Please check email and password.");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem("ai_studio_admin_auth");
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

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem("ai_studio_sound_enabled", String(next));
    if (next) {
      playNotificationChime();
    }
  };

  const fetchLeads = async (silent = false) => {
    if (!silent) {
      setLoading(true);
    } else {
      setIsSyncing(true);
    }

    try {
      const res = await fetchLeadsServerFn();
      if (res.success && res.leads && res.leads.length > 0) {
        const currentIds = new Set(leadsRef.current.map((l) => l.id));

        const brandNewLeads = res.leads.filter((l) => !currentIds.has(l.id));
        if (brandNewLeads.length > 0 && leadsRef.current.length > 0) {
          if (soundEnabled) {
            playNotificationChime();
          }
          setNewLeadNotification(brandNewLeads[0]);
          const newIds = brandNewLeads.map((l) => l.id);
          setHighlightedLeadIds((prev) => new Set([...prev, ...newIds]));
          setTimeout(() => {
            setHighlightedLeadIds((prev) => {
              const next = new Set(prev);
              newIds.forEach((id) => next.delete(id));
              return next;
            });
          }, 10000);
          setTimeout(() => setNewLeadNotification(null), 7000);
        }

        setLeads(res.leads);
        localStorage.setItem("ai_studio_local_leads", JSON.stringify(res.leads));
        setLastSyncTime(new Date());
      } else {
        const local = localStorage.getItem("ai_studio_local_leads");
        if (local) {
          const parsed: Lead[] = JSON.parse(local);
          const realLeads = parsed.filter(
            (l) =>
              l.id !== "lead_1" &&
              l.id !== "lead_2" &&
              l.name !== "Rajesh Sharma" &&
              l.name !== "Priya Mehta",
          );
          setLeads(realLeads);
        } else {
          setLeads([]);
        }
        setLastSyncTime(new Date());
      }
    } catch (err) {
      console.error("fetchLeads error:", err);
      const local = localStorage.getItem("ai_studio_local_leads");
      setLeads(local ? JSON.parse(local) : []);
    } finally {
      if (!silent) setLoading(false);
      setIsSyncing(false);
    }
  };

  const updateStatus = async (id: string, newStatus: Lead["status"]) => {
    const updated = leads.map((l) => (l.id === id ? { ...l, status: newStatus } : l));
    setLeads(updated);
    localStorage.setItem("ai_studio_local_leads", JSON.stringify(updated));
    broadcastLeadEvent({ type: "UPDATE_LEAD", id });
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
      broadcastLeadEvent({ type: "DELETE_LEAD", id });
      try {
        await deleteLeadServerFn({ data: { id } });
      } catch (err) {
        console.error("DB deleteLead error:", err);
      }
    }
  };

  // ==========================================
  // ORDERS MANAGEMENT HANDLERS
  // ==========================================
  const fetchOrders = async (silent = false) => {
    try {
      const res = await fetchOrdersServerFn();
      if (res.success && res.orders) {
        const currentIds = new Set(ordersRef.current.map((o) => o.id));
        const brandNewOrders = res.orders.filter((o) => !currentIds.has(o.id));
        if (brandNewOrders.length > 0 && ordersRef.current.length > 0) {
          if (soundEnabled) {
            playNotificationChime();
          }
          setNewOrderNotification(brandNewOrders[0]);
          const newIds = brandNewOrders.map((o) => o.id);
          setHighlightedOrderIds((prev) => new Set([...prev, ...newIds]));
          setTimeout(() => {
            setHighlightedOrderIds((prev) => {
              const next = new Set(prev);
              newIds.forEach((id) => next.delete(id));
              return next;
            });
          }, 10000);
          setTimeout(() => setNewOrderNotification(null), 7000);
        }

        setOrders(res.orders);
        setLastSyncTime(new Date());
      }
    } catch (err) {
      console.error("fetchOrders error:", err);
    }
  };

  const updateOrderStatusItem = async (id: string, newStatus: PaymentStatus) => {
    const updated = orders.map((o) => (o.id === id ? { ...o, payment_status: newStatus } : o));
    setOrders(updated);
    broadcastOrderEvent({ type: "UPDATE_ORDER", id });
    try {
      await updateOrderStatusServerFn({ data: { id, status: newStatus } });
    } catch (err) {
      console.error("DB updateOrderStatus error:", err);
    }
  };

  const deleteOrderItem = async (id: string) => {
    if (confirm("Are you sure you want to delete this payment record?")) {
      const updated = orders.filter((o) => o.id !== id);
      setOrders(updated);
      broadcastOrderEvent({ type: "DELETE_ORDER", id });
      try {
        await deleteOrderServerFn({ data: { id } });
      } catch (err) {
        console.error("DB deleteOrder error:", err);
      }
    }
  };

  const exportOrdersToCsv = () => {
    if (orders.length === 0) return;
    const headers = [
      "Order ID",
      "PayPal Order ID",
      "PayPal Capture ID",
      "Customer Name",
      "Customer Email",
      "Customer Phone",
      "Company",
      "Item Type",
      "Item Name",
      "Amount",
      "Currency",
      "Payment Status",
      "Date",
    ];
    const rows = orders.map((o) => [
      `"${o.id}"`,
      `"${o.paypal_order_id}"`,
      `"${o.paypal_capture_id || ""}"`,
      `"${o.customer_name}"`,
      `"${o.customer_email}"`,
      `"${o.customer_phone || ""}"`,
      `"${o.customer_company || ""}"`,
      `"${o.item_type}"`,
      `"${o.item_name}"`,
      `"${o.amount}"`,
      `"${o.currency}"`,
      `"${o.payment_status}"`,
      `"${new Date(o.created_at).toLocaleString()}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ai_studio_orders_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isLeadUsa = (lead: Lead | null | undefined): boolean => {
    if (!lead) return true;
    if (lead.source?.toLowerCase().includes("india") || lead.source?.includes("IN -")) {
      return false;
    }
    return true;
  };

  const sanitizePhoneNumber = (phone: string, isUsa: boolean = true) => {
    let clean = phone.replace(/[^0-9]/g, "");
    if (clean.length === 10) {
      clean = isUsa ? `1${clean}` : `91${clean}`;
    }
    return clean;
  };

  const getAdminWhatsAppPlainText = (lead: Lead) => {
    const isUsa = isLeadUsa(lead);

    if (isUsa) {
      let msg = `Hi ${lead.name},\n\nThank you for reaching out to Quickupp AI Studio USA! 🇺🇸\n\nWe have received your AI Video Production inquiry with the following details:\n\n👤 Client Name: ${lead.name}`;
      if (lead.business) msg += `\n🏢 Business / Brand: ${lead.business}`;
      if (lead.video_type) msg += `\n🎬 Video Format: ${lead.video_type}`;
      if (lead.location) msg += `\n📍 Location: ${lead.location}`;
      if (lead.industry) msg += `\n🏷️ Industry: ${lead.industry}`;
      if (lead.requirement || lead.additional) msg += `\n📋 Project Scope: ${lead.requirement || lead.additional}`;

      msg += `\n\nOur US team is reviewing your requirements and preparing custom sample concepts, video reels, and a tailored quote for your project.\n\nCould you please confirm if you have a target turnaround timeline or any reference video links in mind?\n\nBest regards,\nQuickupp AI Studio Team (USA)\n🌐 https://quickuppaistudio.us\n📧 info@quickuppaistudio.us\n📍 8 The Green, Suite A, Dover, DE 19901, USA`;
      return msg;
    }

    let msg = `Hello ${lead.name},\n\nThank you for reaching out to Quickupp AI Studio!\n\nWe have received your project inquiry with the following details:\n\n👤 Client Name: ${lead.name}`;
    if (lead.business) msg += `\nBusiness Name: ${lead.business}`;
    if (lead.video_type) msg += `\nVideo Type: ${lead.video_type}`;
    if (lead.location) msg += `\nLocation: ${lead.location}`;
    if (lead.industry) msg += `\nIndustry: ${lead.industry}`;
    if (lead.requirement || lead.additional) msg += `\nRequirement: ${lead.requirement || lead.additional}`;

    msg += `\n\nOur team is reviewing your requirements and will share the tailored proposal and sample concepts shortly.\n\nCould you please confirm if you have any specific deadline or additional references in mind?\n\nBest regards,\nQuickupp AI Studio Team\nhttps://quickuppaistudio.us`;
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
      const matchesSource =
        filterSource === "All" ||
        (filterSource === "USA Leads" ? lead.source.includes("USA") : lead.source === filterSource);
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

  const usaLeadsCount = leads.filter((l) => l.source.includes("USA")).length;
  const contactFormCount = leads.filter((l) => l.source.includes("Contact Form")).length;
  const popupModalCount = leads.filter((l) => l.source.includes("Popup Modal")).length;

  // Orders Calculations
  const filteredOrders = orders
    .filter((order) => {
      const matchesStatus =
        filterOrderStatus === "All" ||
        order.payment_status?.toUpperCase() === filterOrderStatus.toUpperCase();

      const query = orderSearchTerm.toLowerCase().trim();
      const matchesSearch =
        query === "" ||
        order.customer_name?.toLowerCase().includes(query) ||
        order.customer_email?.toLowerCase().includes(query) ||
        order.paypal_order_id?.toLowerCase().includes(query) ||
        (order.paypal_capture_id && order.paypal_capture_id.toLowerCase().includes(query)) ||
        order.item_name?.toLowerCase().includes(query);

      return matchesStatus && matchesSearch;
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const totalRevenue = orders
    .filter((o) => o.payment_status === "COMPLETED")
    .reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
  const completedOrdersCount = orders.filter((o) => o.payment_status === "COMPLETED").length;
  const pendingOrdersCount = orders.filter((o) => o.payment_status === "PENDING").length;
  const failedOrdersCount = orders.filter(
    (o) => o.payment_status === "FAILED" || o.payment_status === "CANCELLED"
  ).length;

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
            <a
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-neon"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Website
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#08070d] text-foreground antialiased selection:bg-neon selection:text-black">
      {/* Real-Time Incoming Order Animated Toast Banner */}
      {newOrderNotification ? (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-lg">
          <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-purple-400 bg-[#1e1330] p-3.5 shadow-[0_0_30px_rgba(168,85,247,0.5)] backdrop-blur-xl">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/20 text-purple-300 animate-pulse">
                <DollarSign className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-purple-300">
                    New PayPal Payment!
                  </span>
                  <span className="rounded bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 text-[10px] font-bold">
                    ${Number(newOrderNotification.amount).toFixed(2)} {newOrderNotification.currency}
                  </span>
                </div>
                <div className="truncate text-sm font-bold text-white">
                  {newOrderNotification.customer_name} · {newOrderNotification.item_name}
                </div>
                <div className="truncate text-xs text-muted-foreground font-mono">
                  Order ID: {newOrderNotification.paypal_order_id}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => {
                  setActiveTab("orders");
                  setSelectedOrderDetails(newOrderNotification);
                  setNewOrderNotification(null);
                }}
                className="rounded-lg bg-purple-600 px-2.5 py-1.5 text-xs font-bold text-white shadow hover:bg-purple-500 flex items-center gap-1 cursor-pointer"
              >
                <span>View</span>
              </button>
              <button
                onClick={() => setNewOrderNotification(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-white/10 hover:text-white cursor-pointer"
                title="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Real-Time Incoming Lead Animated Toast Banner */}
      {newLeadNotification ? (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-lg">
          <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-neon bg-[#17132a] p-3.5 shadow-[0_0_30px_rgba(200,80,255,0.4)] backdrop-blur-xl">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neon/20 text-neon animate-pulse">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-neon">
                    New Lead Arrived!
                  </span>
                  <span className="rounded bg-secondary/80 px-1.5 py-0.2 text-[10px] text-muted-foreground">
                    {newLeadNotification.source}
                  </span>
                </div>
                <div className="truncate text-sm font-bold text-white">
                  {newLeadNotification.name} · {newLeadNotification.phone}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {newLeadNotification.business} ({newLeadNotification.video_type})
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => handleOpenWhatsApp(newLeadNotification)}
                className="rounded-lg bg-[#25D366] px-2.5 py-1.5 text-xs font-bold text-white shadow hover:bg-[#20bd5a] flex items-center gap-1 cursor-pointer"
                title="Open WhatsApp"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Chat</span>
              </button>
              <button
                onClick={() => setNewLeadNotification(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-white/10 hover:text-white cursor-pointer"
                title="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Top Admin Header - Full Width & Responsive */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-[#100e1a]/95 backdrop-blur-xl">
        <div className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-8 lg:px-12">
          <div className="flex items-center gap-3 sm:gap-4">
            <a href="/" className="flex items-center transition-opacity hover:opacity-90">
              <img
                src="/images/logo.png"
                alt="Quickupp AI Studio logo"
                className="h-8 sm:h-9 w-auto object-contain"
                width={110}
                height={34}
              />
            </a>

            {/* Live 10-Second Auto-Refresh Badge */}
            <div
              className="hidden xs:inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.15)]"
              title="Admin automatically refreshes every 10 seconds to load new leads from Popup Modal & Contact Form."
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span>Auto-Refresh: {refreshCountdown}s</span>
              {isSyncing ? (
                <span className="text-[10px] text-muted-foreground animate-pulse">···</span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Audio chime toggle */}
            <button
              onClick={toggleSound}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer sm:px-3 sm:py-1.5 ${
                soundEnabled
                  ? "border-neon/40 bg-neon/10 text-neon hover:bg-neon/20"
                  : "border-border/80 bg-secondary/50 text-muted-foreground hover:text-white"
              }`}
              title={soundEnabled ? "Notification sound enabled" : "Notification sound muted"}
            >
              {soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{soundEnabled ? "Sound On" : "Muted"}</span>
            </button>

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
              className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/20 sm:px-3.5 sm:py-1.5 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Admin Body - Full Width & Responsive */}
      <main className="w-full px-4 py-5 sm:px-8 lg:px-12">
        {/* Top Tab Switcher: Leads CRM vs PayPal Orders & Payments */}
        <div className="flex items-center gap-3 border-b border-border/80 pb-4 mb-6">
          <button
            type="button"
            onClick={() => setActiveTab("leads")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === "leads"
                ? "bg-neon/15 text-neon border border-neon/40 shadow-[0_0_15px_rgba(200,80,255,0.2)]"
                : "text-muted-foreground hover:bg-white/5 hover:text-white border border-transparent"
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Leads CRM</span>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-foreground font-semibold">
              {leads.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("orders")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === "orders"
                ? "bg-purple-500/20 text-purple-300 border border-purple-400/50 shadow-[0_0_15px_rgba(168,85,247,0.25)]"
                : "text-muted-foreground hover:bg-white/5 hover:text-white border border-transparent"
            }`}
          >
            <DollarSign className="h-4 w-4 text-purple-400" />
            <span>PayPal Orders & Payments</span>
            <span className="rounded-full bg-purple-900/60 border border-purple-500/40 px-2 py-0.5 text-[11px] text-purple-200 font-semibold">
              {orders.length}
            </span>
          </button>
        </div>

        {activeTab === "leads" && (
          <div>
        {/* KPI Stats Cards - Responsive */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-4">
          <div className="rounded-xl border border-border/80 bg-[#12101e] p-3.5 shadow-lg transition-all hover:border-neon/50 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground sm:text-xs">
                Total Leads
              </span>
              <Layers className="h-3.5 w-3.5 text-neon sm:h-4 sm:w-4" />
            </div>
            <p className="mt-2 text-2xl font-extrabold text-white sm:mt-3 sm:text-3xl">{leads.length}</p>
          </div>

          <div className="rounded-xl border border-indigo-500/30 bg-[#0d1028] p-3.5 shadow-lg transition-all hover:border-indigo-400 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 sm:text-xs">
                🇺🇸 USA Leads
              </span>
              <span className="h-2 w-2 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)] sm:h-2.5 sm:w-2.5" />
            </div>
            <p className="mt-2 text-2xl font-extrabold text-indigo-400 sm:mt-3 sm:text-3xl">{usaLeadsCount}</p>
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

          <div className="rounded-xl border border-emerald-500/30 bg-[#0c231a] p-3.5 shadow-lg transition-all hover:border-emerald-400 sm:p-5 col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 sm:text-xs">
                New Status
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
                className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer"
              >
                <option value="All" className="bg-[#12101e]">All Sources</option>
                <option value="USA Leads" className="bg-[#12101e]">🇺🇸 USA Leads (All)</option>
                <option value="USA - Contact Form" className="bg-[#12101e]">🇺🇸 USA - Contact Form</option>
                <option value="USA - Popup Modal" className="bg-[#12101e]">🇺🇸 USA - Popup Modal</option>
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
                className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer"
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
            <span className="hidden sm:inline text-[11px] text-muted-foreground/70">
              Auto-syncs in <span className="font-mono text-neon font-semibold">{refreshCountdown}s</span> · Last: {lastSyncTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>

            <button
              onClick={() => {
                fetchLeads(false);
                setRefreshCountdown(10);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-[#0a0912] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:border-neon hover:text-neon sm:px-4 sm:py-2 cursor-pointer"
              title="Manual refresh now"
            >
              <RefreshCw className={`h-3 w-3 ${loading || isSyncing ? "animate-spin text-neon" : ""}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={exportCSV}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-brand px-3.5 py-1.5 text-xs font-bold text-neon-foreground shadow-md glow-neon transition-all hover:brightness-110 sm:px-4 sm:py-2 cursor-pointer"
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
                      <p className="mt-3 text-white font-semibold">No leads yet</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Submissions from the Popup Modal or Contact Form will automatically appear here in real time without refreshing.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((lead) => {
                    const receivedToday = isToday(lead.created_at);
                    const isNewlyArrived = highlightedLeadIds.has(lead.id);

                    return (
                      <tr
                        key={lead.id}
                        className={`transition-colors duration-500 ${
                          isNewlyArrived
                            ? "bg-neon/15 ring-1 ring-inset ring-neon"
                            : "hover:bg-white/[0.03]"
                        }`}
                      >
                        {/* Source */}
                        <td className="whitespace-nowrap px-5 py-4">
                          {isLeadUsa(lead) ? (
                            <span className="inline-flex items-center gap-1 rounded-md border border-blue-500/40 bg-blue-500/15 px-2.5 py-1 text-[11px] font-bold text-blue-300 shadow-sm">
                              <span>🇺🇸</span>
                              <span>{lead.source}</span>
                            </span>
                          ) : (
                            <span className="inline-block rounded-md border border-border/80 bg-secondary/50 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                              {lead.source}
                            </span>
                          )}
                        </td>

                        {/* Client Info */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold text-white">{lead.name}</span>
                            {isNewlyArrived ? (
                              <span className="rounded bg-neon px-1.5 py-0.2 text-[9px] font-black uppercase text-black animate-pulse">
                                JUST NOW
                              </span>
                            ) : null}
                          </div>
                          {lead.email ? (
                            <div className="mt-0.5 text-xs text-muted-foreground">{lead.email}</div>
                          ) : null}
                        </td>

                        {/* Phone (Plain text / tel link) */}
                        <td className="whitespace-nowrap px-5 py-4 font-mono text-sm text-foreground">
                          <a
                            href={`tel:${lead.phone.replace(/[^0-9+]/g, "")}`}
                            className="hover:text-neon hover:underline"
                            title="Call Phone Number"
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
                            <p
                              className="mt-1 max-w-xs text-xs text-muted-foreground line-clamp-1"
                              title={lead.requirement || lead.additional}
                            >
                              {lead.requirement || lead.additional}
                            </p>
                          ) : null}
                        </td>

                        {/* Business & Location */}
                        <td className="px-5 py-4 text-xs">
                          <div className="font-medium text-foreground">{lead.business}</div>
                          {lead.location ? (
                            <div className="mt-0.5 text-muted-foreground">{lead.location}</div>
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
                            <option value="New" className="bg-[#12101e] text-emerald-400">
                              New
                            </option>
                            <option value="Contacted" className="bg-[#12101e] text-foreground">
                              Contacted
                            </option>
                            <option value="In Progress" className="bg-[#12101e] text-foreground">
                              In Progress
                            </option>
                            <option value="Closed" className="bg-[#12101e] text-muted-foreground">
                              Closed
                            </option>
                          </select>
                        </td>

                        {/* Date */}
                        <td className="whitespace-nowrap px-5 py-4 text-xs">
                          {receivedToday ? (
                            <div>
                              <div className="inline-flex items-center gap-1.5 rounded-full border border-neon/50 bg-neon/15 px-2.5 py-0.5 font-bold text-neon">
                                <Calendar className="h-3 w-3" />
                                Today,{" "}
                                {new Date(lead.created_at).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                            </div>
                          ) : (
                            <div className="text-muted-foreground">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="h-3 w-3" />
                                {new Date(lead.created_at).toLocaleDateString()}
                              </div>
                              <div className="mt-0.5 text-[11px] text-muted-foreground/80">
                                {new Date(lead.created_at).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="whitespace-nowrap px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <a
                              href={`https://wa.me/${sanitizePhoneNumber(lead.phone, isLeadUsa(lead))}?text=${encodeURIComponent(
                                getAdminWhatsAppPlainText(lead),
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-lg border border-[#25D366]/40 bg-[#25D366]/15 p-2 text-[#25D366] transition-all hover:scale-110 hover:border-[#25D366] hover:bg-[#25D366]/30 inline-flex items-center justify-center shadow-[0_0_10px_rgba(37,211,102,0.2)]"
                              title="Chat on WhatsApp (Direct Prefilled Message)"
                            >
                              <svg
                                viewBox="0 0 24 24"
                                className="h-4 w-4 fill-current"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24zm-3.6 3.63c-.2 0-.42.01-.6.04-.24.04-.52.14-.72.37-.25.28-.97.95-.97 2.32s.99 2.69 1.13 2.87c.14.19 1.95 2.98 4.73 4.18.66.29 1.18.46 1.58.59.66.21 1.27.18 1.75.11.53-.08 1.63-.67 1.86-1.31.23-.65.23-1.2.16-1.31-.07-.12-.25-.19-.53-.33-.28-.14-1.63-.8-1.88-.89-.25-.09-.44-.14-.62.14-.19.28-.72.89-.88 1.07-.16.19-.33.21-.61.07-.28-.14-1.18-.44-2.25-1.39-.83-.74-1.4-1.66-1.56-1.94-.16-.28-.02-.43.12-.57.13-.13.28-.33.42-.5.14-.16.19-.28.28-.47.09-.19.05-.35-.02-.49-.07-.14-.62-1.5-.86-2.05-.22-.53-.46-.46-.62-.47z" />
                              </svg>
                            </a>
                            <button
                              onClick={() => deleteLeadItem(lead.id)}
                              className="rounded-lg border border-border/80 bg-secondary/50 p-2 text-muted-foreground transition-colors hover:border-red-500 hover:text-red-400 cursor-pointer"
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
                No leads recorded yet. Submissions will auto-load here in real time.
              </div>
            ) : (
              filteredLeads.map((lead) => {
                const receivedToday = isToday(lead.created_at);
                const isNewlyArrived = highlightedLeadIds.has(lead.id);

                return (
                  <div
                    key={lead.id}
                    className={`py-3.5 first:pt-0 last:pb-0 space-y-2 rounded-lg transition-all ${
                      isNewlyArrived ? "bg-neon/15 p-2.5 ring-1 ring-neon" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-white">{lead.name}</span>
                        {isNewlyArrived ? (
                          <span className="rounded bg-neon px-1 py-0.2 text-[8px] font-black text-black">
                            NEW
                          </span>
                        ) : null}
                      </div>
                      {isLeadUsa(lead) ? (
                        <span className="rounded border border-blue-500/40 bg-blue-500/15 px-2 py-0.5 text-[10px] font-bold text-blue-300">
                          🇺🇸 {lead.source}
                        </span>
                      ) : (
                        <span className="rounded border border-border/80 bg-secondary/50 px-2 py-0.5 text-[10px] text-muted-foreground">
                          {lead.source}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <a
                        href={`tel:${lead.phone.replace(/[^0-9+]/g, "")}`}
                        className="font-mono text-white/90 hover:underline hover:text-neon flex items-center gap-1"
                        title="Call Phone Number"
                      >
                        <Phone className="h-3 w-3 text-muted-foreground" />
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
                          <Calendar className="h-2.5 w-2.5" /> Today{" "}
                          {new Date(lead.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-2.5 w-2.5" />{" "}
                          {new Date(lead.created_at).toLocaleDateString()}
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
                          <option value="New" className="bg-[#12101e] text-emerald-400">
                            New
                          </option>
                          <option value="Contacted" className="bg-[#12101e]">
                            Contacted
                          </option>
                          <option value="In Progress" className="bg-[#12101e]">
                            In Progress
                          </option>
                          <option value="Closed" className="bg-[#12101e]">
                            Closed
                          </option>
                        </select>

                        <a
                          href={`https://wa.me/${sanitizePhoneNumber(lead.phone, isLeadUsa(lead))}?text=${encodeURIComponent(
                            getAdminWhatsAppPlainText(lead),
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded border border-[#25D366]/40 bg-[#25D366]/15 p-1.5 text-[#25D366] hover:border-[#25D366] hover:bg-[#25D366]/30 inline-flex items-center justify-center shadow-[0_0_8px_rgba(37,211,102,0.2)]"
                          title="Chat on WhatsApp (Direct Prefilled Message)"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="h-3.5 w-3.5 fill-current"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24zm-3.6 3.63c-.2 0-.42.01-.6.04-.24.04-.52.14-.72.37-.25.28-.97.95-.97 2.32s.99 2.69 1.13 2.87c.14.19 1.95 2.98 4.73 4.18.66.29 1.18.46 1.58.59.66.21 1.27.18 1.75.11.53-.08 1.63-.67 1.86-1.31.23-.65.23-1.2.16-1.31-.07-.12-.25-.19-.53-.33-.28-.14-1.63-.8-1.88-.89-.25-.09-.44-.14-.62.14-.19.28-.72.89-.88 1.07-.16.19-.33.21-.61.07-.28-.14-1.18-.44-2.25-1.39-.83-.74-1.4-1.66-1.56-1.94-.16-.28-.02-.43.12-.57.13-.13.28-.33.42-.5.14-.16.19-.28.28-.47.09-.19.05-.35-.02-.49-.07-.14-.62-1.5-.86-2.05-.22-.53-.46-.46-.62-.47z" />
                          </svg>
                        </a>
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
        </div>
        )}

        {/* ========================================== */}
        {/* ORDERS & PAYMENTS TAB VIEW                */}
        {/* ========================================== */}
        {activeTab === "orders" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Orders KPI Stats Cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-4">
              <div className="rounded-xl border border-border/80 bg-[#12101e] p-3.5 shadow-lg sm:p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground sm:text-xs">
                    Total Orders
                  </span>
                  <Package className="h-3.5 w-3.5 text-purple-400 sm:h-4 sm:w-4" />
                </div>
                <p className="mt-2 text-2xl font-extrabold text-white sm:mt-3 sm:text-3xl">
                  {orders.length}
                </p>
              </div>

              <div className="rounded-xl border border-emerald-500/30 bg-[#0c231a] p-3.5 shadow-lg sm:p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 sm:text-xs">
                    Total Revenue
                  </span>
                  <DollarSign className="h-3.5 w-3.5 text-emerald-400 sm:h-4 sm:w-4" />
                </div>
                <p className="mt-2 text-2xl font-extrabold text-emerald-400 sm:mt-3 sm:text-3xl">
                  ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>

              <div className="rounded-xl border border-blue-500/30 bg-[#0d1428] p-3.5 shadow-lg sm:p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300 sm:text-xs">
                    Completed
                  </span>
                  <CheckCircle2 className="h-3.5 w-3.5 text-blue-400 sm:h-4 sm:w-4" />
                </div>
                <p className="mt-2 text-2xl font-extrabold text-blue-400 sm:mt-3 sm:text-3xl">
                  {completedOrdersCount}
                </p>
              </div>

              <div className="rounded-xl border border-amber-500/30 bg-[#241a0b] p-3.5 shadow-lg sm:p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 sm:text-xs">
                    Pending
                  </span>
                  <Clock className="h-3.5 w-3.5 text-amber-400 sm:h-4 sm:w-4" />
                </div>
                <p className="mt-2 text-2xl font-extrabold text-amber-400 sm:mt-3 sm:text-3xl">
                  {pendingOrdersCount}
                </p>
              </div>

              <div className="rounded-xl border border-red-500/30 bg-[#250d1e] p-3.5 shadow-lg sm:p-5 col-span-2 sm:col-span-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-red-300 sm:text-xs">
                    Failed / Cancelled
                  </span>
                  <span className="h-2 w-2 rounded-full bg-red-400" />
                </div>
                <p className="mt-2 text-2xl font-extrabold text-red-400 sm:mt-3 sm:text-3xl">
                  {failedOrdersCount}
                </p>
              </div>
            </div>

            {/* Orders Filters & Actions Bar */}
            <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-[#12101e] p-3 shadow-md sm:flex-row sm:items-center sm:justify-between sm:p-4">
              <div className="flex flex-1 flex-wrap items-center gap-2.5 sm:gap-3">
                {/* Search Input */}
                <div className="relative w-full min-w-0 sm:max-w-xs sm:flex-1">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search customer, email, order ID..."
                    value={orderSearchTerm}
                    onChange={(e) => setOrderSearchTerm(e.target.value)}
                    className="w-full rounded-lg border border-border/80 bg-[#0a0912] py-2 pl-9 pr-3 text-xs text-white placeholder:text-muted-foreground focus:border-purple-400 focus:outline-none"
                  />
                </div>

                {/* Status Filter */}
                <div className="flex items-center gap-1.5 rounded-lg border border-border/80 bg-[#0a0912] px-2.5 py-1.5">
                  <Filter className="h-3 w-3 text-purple-400" />
                  <span className="text-xs font-medium text-muted-foreground">Status:</span>
                  <select
                    value={filterOrderStatus}
                    onChange={(e) => setFilterOrderStatus(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer"
                  >
                    <option value="All" className="bg-[#12101e]">All Statuses</option>
                    <option value="COMPLETED" className="bg-[#12101e]">COMPLETED</option>
                    <option value="PENDING" className="bg-[#12101e]">PENDING</option>
                    <option value="FAILED" className="bg-[#12101e]">FAILED</option>
                    <option value="CANCELLED" className="bg-[#12101e]">CANCELLED</option>
                    <option value="REFUNDED" className="bg-[#12101e]">REFUNDED</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={exportOrdersToCsv}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-[#0a0912] px-3 py-2 text-xs font-semibold text-white hover:bg-secondary transition-colors cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5 text-purple-400" />
                  <span>Export CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    fetchOrders(false);
                    setRefreshCountdown(10);
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-gradient-brand px-3 py-2 text-xs font-bold text-white hover:brightness-110 shadow-sm cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Orders Table Container */}
            <div className="overflow-hidden rounded-xl border border-border/80 bg-[#12101e] shadow-xl">
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/80 bg-[#171427] text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      <th className="px-5 py-3.5">Customer</th>
                      <th className="px-5 py-3.5">Service / Package</th>
                      <th className="px-5 py-3.5 text-center">Amount</th>
                      <th className="px-5 py-3.5 text-center">Payment Status</th>
                      <th className="px-5 py-3.5">PayPal Order & Capture ID</th>
                      <th className="px-5 py-3.5 text-center">Date</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-12 text-center text-muted-foreground text-xs">
                          No PayPal payment orders found matching criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((order) => {
                        const isCompleted = order.payment_status === "COMPLETED";
                        const isPending = order.payment_status === "PENDING";
                        const isFailed = order.payment_status === "FAILED" || order.payment_status === "CANCELLED";

                        return (
                          <tr
                            key={order.id}
                            className={`transition-colors hover:bg-white/[0.03] ${
                              highlightedOrderIds.has(order.id) ? "bg-purple-900/20" : ""
                            }`}
                          >
                            {/* Customer */}
                            <td className="px-5 py-4">
                              <div className="font-bold text-white text-sm">{order.customer_name}</div>
                              <div className="text-[11px] text-muted-foreground font-mono mt-0.5">{order.customer_email}</div>
                              {order.customer_phone && (
                                <div className="text-[11px] text-muted-foreground/80 mt-0.5">{order.customer_phone}</div>
                              )}
                              {order.customer_company && (
                                <div className="text-[10px] text-purple-300 font-semibold mt-0.5">🏢 {order.customer_company}</div>
                              )}
                            </td>

                            {/* Service / Package */}
                            <td className="px-5 py-4">
                              <div className="font-bold text-white text-xs">{order.item_name}</div>
                              <div className="mt-1">
                                <span className="inline-flex rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-300 uppercase">
                                  {order.item_type}
                                </span>
                              </div>
                            </td>

                            {/* Amount */}
                            <td className="px-5 py-4 text-center">
                              <span className="font-mono text-sm font-bold text-emerald-400">
                                ${Number(order.amount).toFixed(2)}
                              </span>
                              <span className="text-[10px] text-muted-foreground ml-1">{order.currency}</span>
                            </td>

                            {/* Payment Status */}
                            <td className="px-5 py-4 text-center">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                                  isCompleted
                                    ? "border border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                                    : isPending
                                    ? "border border-amber-500/40 bg-amber-500/15 text-amber-300"
                                    : "border border-red-500/40 bg-red-500/15 text-red-300"
                                }`}
                              >
                                {isCompleted && <CheckCircle2 className="h-3 w-3" />}
                                {isPending && <Clock className="h-3 w-3" />}
                                {isFailed && <AlertCircle className="h-3 w-3" />}
                                <span>{order.payment_status}</span>
                              </span>
                            </td>

                            {/* PayPal IDs */}
                            <td className="px-5 py-4">
                              <div className="space-y-1 font-mono text-[11px]">
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                  <span className="text-[10px] text-slate-400">Order:</span>
                                  <span className="text-white select-all">{order.paypal_order_id}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(order.paypal_order_id);
                                      setCopiedNotification(true);
                                      setTimeout(() => setCopiedNotification(false), 2500);
                                    }}
                                    className="p-1 text-muted-foreground hover:text-white"
                                    title="Copy Order ID"
                                  >
                                    <Copy className="h-3 w-3" />
                                  </button>
                                </div>
                                {order.paypal_capture_id && (
                                  <div className="flex items-center gap-1.5 text-muted-foreground">
                                    <span className="text-[10px] text-slate-400">Capture:</span>
                                    <span className="text-emerald-300 select-all">{order.paypal_capture_id}</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (order.paypal_capture_id) {
                                          navigator.clipboard.writeText(order.paypal_capture_id);
                                          setCopiedNotification(true);
                                          setTimeout(() => setCopiedNotification(false), 2500);
                                        }
                                      }}
                                      className="p-1 text-muted-foreground hover:text-white"
                                      title="Copy Capture ID"
                                    >
                                      <Copy className="h-3 w-3" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Date */}
                            <td className="px-5 py-4 text-center text-[11px] text-muted-foreground">
                              <div>{new Date(order.created_at).toLocaleDateString()}</div>
                              <div className="text-[10px] text-muted-foreground/70">
                                {new Date(order.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </div>
                            </td>

                            {/* Actions */}
                            <td className="px-5 py-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setSelectedOrderDetails(order)}
                                  className="rounded-lg border border-border/80 bg-secondary/50 p-2 text-muted-foreground hover:text-white hover:border-purple-400 transition-colors"
                                  title="View Order Details"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => deleteOrderItem(order.id)}
                                  className="rounded-lg border border-border/80 bg-secondary/50 p-2 text-muted-foreground hover:text-red-400 hover:border-red-500 transition-colors"
                                  title="Delete Record"
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

              {/* Mobile Card List View for Orders */}
              <div className="block md:hidden divide-y divide-border/60 p-3">
                {filteredOrders.length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted-foreground">
                    No orders found.
                  </div>
                ) : (
                  filteredOrders.map((order) => (
                    <div key={order.id} className="py-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-white text-sm">{order.customer_name}</div>
                          <div className="text-xs text-muted-foreground">{order.customer_email}</div>
                        </div>
                        <span className="font-mono font-bold text-emerald-400 text-sm">
                          ${Number(order.amount).toFixed(2)}
                        </span>
                      </div>

                      <div className="text-xs text-slate-300 font-medium">
                        {order.item_name}
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-300 uppercase">
                          {order.payment_status}
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedOrderDetails(order)}
                            className="rounded border border-border bg-secondary/60 px-2.5 py-1 text-xs text-white"
                          >
                            Details
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteOrderItem(order.id)}
                            className="rounded border border-border bg-secondary/60 p-1 text-muted-foreground hover:text-red-400"
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

        {/* Detailed Order Modal */}
        {selectedOrderDetails ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-xl rounded-2xl border border-purple-400/40 bg-[#120f20] p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-border/80 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/20 text-purple-300">
                    <Package className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Order Details</h3>
                    <p className="text-xs text-muted-foreground font-mono">{selectedOrderDetails.id}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedOrderDetails(null)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/10 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-border/60 bg-[#0a0912] p-3 space-y-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Customer</span>
                  <p className="font-bold text-white text-sm">{selectedOrderDetails.customer_name}</p>
                  <p className="text-muted-foreground font-mono">{selectedOrderDetails.customer_email}</p>
                  {selectedOrderDetails.customer_phone && <p className="text-muted-foreground">{selectedOrderDetails.customer_phone}</p>}
                  {selectedOrderDetails.customer_company && <p className="text-purple-300 font-medium">🏢 {selectedOrderDetails.customer_company}</p>}
                </div>

                <div className="rounded-xl border border-border/60 bg-[#0a0912] p-3 space-y-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Payment Summary</span>
                  <p className="text-lg font-bold text-emerald-400 font-mono">
                    ${Number(selectedOrderDetails.amount).toFixed(2)} {selectedOrderDetails.currency}
                  </p>
                  <div className="pt-1">
                    <span className="inline-flex rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-300 uppercase">
                      Status: {selectedOrderDetails.payment_status}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-[#0a0912] p-3 text-xs space-y-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Item Purchased</span>
                <p className="font-bold text-white text-sm">{selectedOrderDetails.item_name}</p>
                <p className="text-muted-foreground">Type: <span className="font-semibold text-white capitalize">{selectedOrderDetails.item_type}</span></p>
              </div>

              <div className="rounded-xl border border-border/60 bg-[#0a0912] p-3 text-xs space-y-2 font-mono">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold font-sans">PayPal Identifiers</span>
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>PayPal Order ID:</span>
                  <span className="text-white select-all">{selectedOrderDetails.paypal_order_id}</span>
                </div>
                {selectedOrderDetails.paypal_capture_id && (
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>Payment Capture ID:</span>
                    <span className="text-emerald-400 select-all">{selectedOrderDetails.paypal_capture_id}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Created At:</span>
                  <span className="text-slate-300">{new Date(selectedOrderDetails.created_at).toLocaleString()}</span>
                </div>
              </div>

              {/* Status Update Control */}
              <div className="flex items-center justify-between border-t border-border/80 pt-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground font-semibold">Change Status:</span>
                  <select
                    value={selectedOrderDetails.payment_status}
                    onChange={(e) => {
                      const newSt = e.target.value as PaymentStatus;
                      updateOrderStatusItem(selectedOrderDetails.id, newSt);
                      setSelectedOrderDetails({ ...selectedOrderDetails, payment_status: newSt });
                    }}
                    className="rounded-lg border border-border bg-[#0a0912] px-2 py-1 text-xs text-white cursor-pointer"
                  >
                    <option value="COMPLETED">COMPLETED</option>
                    <option value="PENDING">PENDING</option>
                    <option value="FAILED">FAILED</option>
                    <option value="CANCELLED">CANCELLED</option>
                    <option value="REFUNDED">REFUNDED</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedOrderDetails(null)}
                  className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-500 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Quick WhatsApp Message Preview & 1-Click Copy Modal */}
        {selectedLeadForMsg ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-border bg-[#120f20] p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-emerald-400" />
                    {isLeadUsa(selectedLeadForMsg)
                      ? "🇺🇸 WhatsApp Confirmation (USA Lead)"
                      : "WhatsApp Confirmation Message"}
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
                  href={`https://wa.me/${sanitizePhoneNumber(
                    selectedLeadForMsg.phone,
                    isLeadUsa(selectedLeadForMsg),
                  )}?text=${encodeURIComponent(
                    getAdminWhatsAppPlainText(selectedLeadForMsg),
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
