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
  verifyPaymentPinServerFn,
  verifyAdminLoginServerFn,
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
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [activeTab, setActiveTab] = useState<"leads" | "orders">("leads");

  // Payment Tab Security PIN Protection (Server-Verified)
  const [isPaymentUnlocked, setIsPaymentUnlocked] = useState(false);
  const [showPaymentPinModal, setShowPaymentPinModal] = useState(false);
  const [paymentPinInput, setPaymentPinInput] = useState("");
  const [showPaymentPin, setShowPaymentPin] = useState(false);
  const [paymentPinError, setPaymentPinError] = useState("");
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);
  const pendingOrdersCallbackRef = useRef<(() => void) | null>(null);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [filterSource, setFilterSource] = useState<string>("All");
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLeadForMsg, setSelectedLeadForMsg] = useState<Lead | null>(null);
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Orders State (Default: Show COMPLETED paid orders, hide abandoned pending by default)
  const [orders, setOrders] = useState<Order[]>([]);
  const [filterOrderStatus, setFilterOrderStatus] = useState<string>("COMPLETED");
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

  // Auto-lock Payment Tab on browser tab switch, window blur/hidden, or page unload
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsPaymentUnlocked(false);
        setShowPaymentPinModal(false);
      }
    };

    const handlePageUnload = () => {
      setIsPaymentUnlocked(false);
      setShowPaymentPinModal(false);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageUnload);
    window.addEventListener("beforeunload", handlePageUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageUnload);
      window.removeEventListener("beforeunload", handlePageUnload);
    };
  }, []);

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || !passwordInput) {
      setAuthError("Please enter both email and password.");
      return;
    }

    setIsLoggingIn(true);
    setAuthError("");

    try {
      const res = await verifyAdminLoginServerFn({
        data: { email: emailInput, password: passwordInput },
      });

      if (res.success) {
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
        setAuthError(res.error || "Invalid admin credentials. Please check email and password.");
      }
    } catch (err: any) {
      setAuthError(err?.message || "Failed to authenticate with server.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setIsPaymentUnlocked(false);
    setShowPaymentPinModal(false);
    setPaymentPinInput("");
    setPaymentPinError("");
    setActiveTab("leads");
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

  const handleSelectOrdersTab = (onSuccess?: () => void) => {
    if (isPaymentUnlocked) {
      setActiveTab("orders");
      if (onSuccess) onSuccess();
    } else {
      pendingOrdersCallbackRef.current = onSuccess || null;
      setPaymentPinError("");
      setPaymentPinInput("");
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

  const handleLockPaymentTab = () => {
    setIsPaymentUnlocked(false);
    setActiveTab("leads");
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
    if (!lead) return false;
    const src = (lead.source || "").toLowerCase().trim();
    return src.startsWith("usa") || src.includes("usa -") || src.includes("united states");
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
      let msg = `Hi ${lead.name},\n\nThank you for reaching out to Quickupp AI Studio USA! 🇺🇸\n\nWe have received your AI Video Production inquiry with the following details:\n\n👤 Client Name: ${lead.name}`;
      if (lead.business) msg += `\n🏢 Business / Brand: ${lead.business}`;
      if (lead.video_type) msg += `\n🎬 Video Format: ${lead.video_type}`;
      if (lead.location) msg += `\n📍 Location: ${lead.location}`;
      if (lead.industry) msg += `\n🏷️ Industry: ${lead.industry}`;
      if (lead.requirement || lead.additional) msg += `\n📋 Project Scope: ${lead.requirement || lead.additional}`;

      msg += `\n\nOur team is reviewing your requirements and preparing custom sample concepts, video reels, and a tailored quote for your project.\n\nCould you please confirm if you have a target turnaround timeline or any reference video links in mind?\n\nBest regards,\nQuickupp AI Studio Team (USA)`;
      return msg;
    }

    let msg = `Hello ${lead.name},\n\nThank you for reaching out to Quickupp AI Studio! 🇮🇳\n\nWe have received your AI video inquiry with the following details:\n\n👤 Client Name: ${lead.name}`;
    if (lead.business) msg += `\n🏢 Business: ${lead.business}`;
    if (lead.video_type) msg += `\n🎬 Video Type: ${lead.video_type}`;
    if (lead.location) msg += `\n📍 Location: ${lead.location}`;
    if (lead.industry) msg += `\n🏷️ Industry: ${lead.industry}`;
    if (lead.requirement || lead.additional) msg += `\n📋 Requirement: ${lead.requirement || lead.additional}`;

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

  // Orders Calculations - Defaults to showing COMPLETED paid orders, prioritizes completed on top when viewing all
  const filteredOrders = orders
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
      const query = orderSearchTerm.toLowerCase().trim();
      if (!query) return true;
      return (
        order.customer_name?.toLowerCase().includes(query) ||
        order.customer_email?.toLowerCase().includes(query) ||
        order.paypal_order_id?.toLowerCase().includes(query) ||
        (order.paypal_capture_id && order.paypal_capture_id.toLowerCase().includes(query)) ||
        order.item_name?.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      // Prioritize COMPLETED status to always show at the top
      const aIsCompleted = a.payment_status === "COMPLETED" ? 1 : 0;
      const bIsCompleted = b.payment_status === "COMPLETED" ? 1 : 0;
      if (aIsCompleted !== bIsCompleted) {
        return bIsCompleted - aIsCompleted;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

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
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-gray-100 to-indigo-50/50 px-4 text-slate-800">
        <div className="relative w-full max-w-md rounded-3xl border border-slate-200/90 bg-white p-8 sm:p-10 shadow-xl shadow-slate-200/60">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-fit items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 shadow-xs">
              <img
                src="/images/logo.png"
                alt="Quickupp AI Studio logo"
                className="h-9 w-auto object-contain"
                width={120}
                height={36}
              />
            </div>
            <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-900">Admin Portal</h2>
            <p className="mt-1 text-xs text-slate-500">Quickupp AI Studio Lead Management</p>
          </div>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            {authError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-600">
                {authError}
              </div>
            ) : null}

            <div>
              <label className="block text-xs font-bold text-slate-700">Admin Email</label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="admin@aistudio.com"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700">Password</label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-9 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 transition-colors hover:text-slate-700"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span className="font-medium">Remember me</span>
              </label>
              <span className="text-[11px] text-slate-400">admin@aistudio.com</span>
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 py-3 text-sm font-bold tracking-wide text-white shadow-lg shadow-indigo-200 transition-all hover:brightness-105 active:scale-[0.99] cursor-pointer"
            >
              Sign In to Admin
            </button>
          </form>

          <div className="mt-6 border-t border-slate-200 pt-4 text-center">
            <a
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Website
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#f8fafc] text-slate-800 antialiased selection:bg-indigo-100 selection:text-indigo-900">
      {/* Real-Time Incoming Order Animated Toast Banner */}
      {newOrderNotification ? (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-lg">
          <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-indigo-500 bg-white p-4 shadow-2xl shadow-indigo-100">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 animate-pulse border border-indigo-100">
                <DollarSign className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-indigo-600">
                    New PayPal Payment!
                  </span>
                  <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold">
                    ${Number(newOrderNotification.amount).toFixed(2)} {newOrderNotification.currency}
                  </span>
                </div>
                <div className="truncate text-sm font-bold text-slate-900">
                  {newOrderNotification.customer_name} · {newOrderNotification.item_name}
                </div>
                <div className="truncate text-xs text-slate-500 font-mono">
                  Order ID: {newOrderNotification.paypal_order_id}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => {
                  handleSelectOrdersTab(() => {
                    setSelectedOrderDetails(newOrderNotification);
                    setNewOrderNotification(null);
                  });
                }}
                className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>View</span>
              </button>
              <button
                onClick={() => setNewOrderNotification(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer transition-colors"
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
          <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-purple-500 bg-white p-4 shadow-2xl shadow-purple-100">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600 animate-pulse border border-purple-100">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-purple-600">
                    New Lead Arrived!
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                    {newLeadNotification.source}
                  </span>
                </div>
                <div className="truncate text-sm font-bold text-slate-900">
                  {newLeadNotification.name} · {newLeadNotification.phone}
                </div>
                <div className="truncate text-xs text-slate-500">
                  {newLeadNotification.business} ({newLeadNotification.video_type})
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => handleOpenWhatsApp(newLeadNotification)}
                className="rounded-xl bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-[#20bd5a] flex items-center gap-1 cursor-pointer transition-colors"
                title="Open WhatsApp"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Chat</span>
              </button>
              <button
                onClick={() => setNewLeadNotification(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer transition-colors"
                title="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Top Admin Header - Full Width & Responsive */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/90 bg-white/95 shadow-xs backdrop-blur-md">
        <div className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8 lg:px-12">
          <div className="flex items-center gap-3 sm:gap-4">
            <a href="/" className="flex items-center transition-opacity hover:opacity-85">
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
              className="hidden xs:inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700 shadow-xs"
              title="Admin automatically refreshes every 10 seconds to load new leads from Popup Modal & Contact Form."
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span>Auto-Refresh: {refreshCountdown}s</span>
              {isSyncing ? (
                <span className="text-[10px] text-emerald-600 font-bold animate-pulse">···</span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Audio chime toggle */}
            <button
              onClick={toggleSound}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all cursor-pointer shadow-xs ${
                soundEnabled
                  ? "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                  : "border-slate-200 bg-slate-100 text-slate-500 hover:text-slate-800"
              }`}
              title={soundEnabled ? "Notification sound enabled" : "Notification sound muted"}
            >
              {soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{soundEnabled ? "Sound On" : "Muted"}</span>
            </button>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 transition-all hover:bg-red-100 shadow-xs cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Admin Body - Full Width & Responsive */}
      <main className="w-full px-4 py-6 sm:px-8 lg:px-12">
        {/* Top Tab Switcher: Leads CRM vs PayPal Orders & Payments */}
        <div className="flex items-center gap-3 border-b border-slate-200 pb-4 mb-6">
          <button
            type="button"
            onClick={() => {
              setActiveTab("leads");
              setIsPaymentUnlocked(false);
              setShowPaymentPinModal(false);
            }}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === "leads"
                ? "bg-white text-indigo-600 border border-slate-200/90 shadow-sm"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent"
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Leads CRM</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700 font-bold">
              {leads.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectOrdersTab()}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === "orders"
                ? "bg-white text-indigo-600 border border-slate-200/90 shadow-sm"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent"
            }`}
          >
            <DollarSign className="h-4 w-4 text-indigo-600" />
            <span>PayPal Orders & Payments</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700 font-bold">
              {orders.length}
            </span>
          </button>
        </div>

        {activeTab === "leads" && (
          <div>
        {/* KPI Stats Cards - Responsive */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all hover:shadow-md hover:border-indigo-200 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:text-xs">
                Total Leads
              </span>
              <Layers className="h-4 w-4 text-indigo-600" />
            </div>
            <p className="mt-2 text-2xl font-black text-slate-900 sm:mt-3 sm:text-3xl">{leads.length}</p>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/70 via-white to-white p-4 shadow-xs transition-all hover:shadow-md hover:border-blue-200 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 sm:text-xs">
                🇺🇸 USA Leads
              </span>
              <span className="h-2 w-2 rounded-full bg-blue-500 shadow-xs sm:h-2.5 sm:w-2.5" />
            </div>
            <p className="mt-2 text-2xl font-black text-blue-700 sm:mt-3 sm:text-3xl">{usaLeadsCount}</p>
          </div>

          <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50/70 via-white to-white p-4 shadow-xs transition-all hover:shadow-md hover:border-sky-200 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-800 sm:text-xs">
                Contact Form
              </span>
              <span className="h-2 w-2 rounded-full bg-sky-500 shadow-xs sm:h-2.5 sm:w-2.5" />
            </div>
            <p className="mt-2 text-2xl font-black text-sky-700 sm:mt-3 sm:text-3xl">{contactFormCount}</p>
          </div>

          <div className="rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50/70 via-white to-white p-4 shadow-xs transition-all hover:shadow-md hover:border-purple-200 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-800 sm:text-xs">
                Popup Modal
              </span>
              <span className="h-2 w-2 rounded-full bg-purple-500 shadow-xs sm:h-2.5 sm:w-2.5" />
            </div>
            <p className="mt-2 text-2xl font-black text-purple-700 sm:mt-3 sm:text-3xl">{popupModalCount}</p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/70 via-white to-white p-4 shadow-xs transition-all hover:shadow-md hover:border-emerald-200 sm:p-5 col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 sm:text-xs">
                New Status
              </span>
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-xs sm:h-2.5 sm:w-2.5" />
            </div>
            <p className="mt-2 text-2xl font-black text-emerald-700 sm:mt-3 sm:text-3xl">
              {leads.filter((l) => l.status === "New").length}
            </p>
          </div>
        </div>

        {/* Filters & Actions Bar */}
        <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs sm:mt-6 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="flex flex-1 flex-wrap items-center gap-2.5 sm:gap-3">
            {/* Search Input */}
            <div className="relative w-full min-w-0 sm:max-w-xs sm:flex-1">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search leads..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-none transition-all"
              />
            </div>

            {/* Source Filter */}
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5">
              <Filter className="h-3 w-3 text-indigo-600" />
              <span className="text-xs font-semibold text-slate-500">Source:</span>
              <select
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="All">All Sources</option>
                <option value="USA Leads">🇺🇸 USA Leads (All)</option>
                <option value="USA - Contact Form">🇺🇸 USA - Contact Form</option>
                <option value="USA - Popup Modal">🇺🇸 USA - Popup Modal</option>
                <option value="Contact Form">Contact Form</option>
                <option value="Popup Modal">Popup Modal</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5">
              <span className="text-xs font-semibold text-slate-500">Status:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="All">All</option>
                <option value="New">New</option>
                <option value="Contacted">Contacted</option>
                <option value="In Progress">In Progress</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <span className="hidden sm:inline text-[11px] text-slate-400">
              Auto-syncs in <span className="font-mono text-indigo-600 font-bold">{refreshCountdown}s</span> · Last: {lastSyncTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>

            <button
              onClick={() => {
                fetchLeads(false);
                setRefreshCountdown(10);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 cursor-pointer shadow-xs"
              title="Manual refresh now"
            >
              <RefreshCw className={`h-3 w-3 ${loading || isSyncing ? "animate-spin text-indigo-600" : ""}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={exportCSV}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:brightness-105 transition-all cursor-pointer"
            >
              <Download className="h-3 w-3" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Leads Container - Table on Desktop, Clean Cards on Mobile */}
        <div className="mt-5 flex-1 flex flex-col min-h-0 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs sm:mt-6">
          {/* Desktop & Tablet Table View */}
          <div className="hidden md:block overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)]">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Source</th>
                  <th className="px-5 py-3.5">Client Name</th>
                  <th className="px-5 py-3.5">WhatsApp / Phone</th>
                  <th className="px-5 py-3.5">Video Type</th>
                  <th className="px-5 py-3.5">Business / Location</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Received Date</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-sm font-medium text-slate-400">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                        <Layers className="h-6 w-6" />
                      </div>
                      <p className="mt-3 text-slate-800 font-bold">No leads yet</p>
                      <p className="mt-1 text-xs text-slate-500">
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
                        className={`transition-colors duration-300 ${
                          isNewlyArrived
                            ? "bg-indigo-50/70 ring-1 ring-inset ring-indigo-300"
                            : "hover:bg-slate-50/80"
                        }`}
                      >
                        {/* Source */}
                        <td className="whitespace-nowrap px-5 py-4">
                          {isLeadUsa(lead) ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 shadow-xs">
                              <span>🇺🇸</span>
                              <span>{lead.source}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-bold text-orange-700 shadow-xs">
                              <span>🇮🇳</span>
                              <span>{lead.source}</span>
                            </span>
                          )}
                        </td>

                        {/* Client Info */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-slate-900">{lead.name}</span>
                            {isNewlyArrived ? (
                              <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[9px] font-black uppercase text-white animate-pulse">
                                JUST NOW
                              </span>
                            ) : null}
                          </div>
                          {lead.email ? (
                            <div className="mt-0.5 text-xs text-slate-500 font-mono">{lead.email}</div>
                          ) : null}
                        </td>

                        {/* Phone (Plain text / tel link) */}
                        <td className="whitespace-nowrap px-5 py-4 font-mono text-sm text-slate-800">
                          <a
                            href={`tel:${lead.phone.replace(/[^0-9+]/g, "")}`}
                            className="hover:text-indigo-600 hover:underline"
                            title="Call Phone Number"
                          >
                            {lead.phone}
                          </a>
                        </td>

                        {/* Video Type */}
                        <td className="px-5 py-4">
                          <div className="text-xs font-semibold text-slate-800">
                            {lead.video_type}
                          </div>
                          {lead.requirement || lead.additional ? (
                            <p
                              className="mt-1 max-w-xs text-xs text-slate-500 line-clamp-1"
                              title={lead.requirement || lead.additional}
                            >
                              {lead.requirement || lead.additional}
                            </p>
                          ) : null}
                        </td>

                        {/* Business & Location */}
                        <td className="px-5 py-4 text-xs">
                          <div className="font-semibold text-slate-800">{lead.business}</div>
                          {lead.location ? (
                            <div className="mt-0.5 text-slate-500">{lead.location}</div>
                          ) : null}
                        </td>

                        {/* Status */}
                        <td className="whitespace-nowrap px-5 py-4">
                          <select
                            value={lead.status}
                            onChange={(e) => updateStatus(lead.id, e.target.value as Lead["status"])}
                            className={`rounded-xl border px-2.5 py-1 text-xs font-bold focus:outline-none cursor-pointer ${
                              lead.status === "New"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-slate-200 bg-slate-50 text-slate-700"
                            }`}
                          >
                            <option value="New">New</option>
                            <option value="Contacted">Contacted</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Closed">Closed</option>
                          </select>
                        </td>

                        {/* Date */}
                        <td className="whitespace-nowrap px-5 py-4 text-xs">
                          {receivedToday ? (
                            <div>
                              <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 font-bold text-indigo-700 shadow-xs">
                                <Calendar className="h-3 w-3" />
                                Today,{" "}
                                {new Date(lead.created_at).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                            </div>
                          ) : (
                            <div className="text-slate-500">
                              <div className="flex items-center gap-1.5 font-medium">
                                <Calendar className="h-3 w-3 text-slate-400" />
                                {new Date(lead.created_at).toLocaleDateString()}
                              </div>
                              <div className="mt-0.5 text-[11px] text-slate-400">
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
                              className="rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-emerald-700 transition-all hover:bg-emerald-100 inline-flex items-center justify-center shadow-xs"
                              title="Chat on WhatsApp (Direct Prefilled Message)"
                            >
                              <svg
                                viewBox="0 0 24 24"
                                className="h-4 w-4 fill-current text-emerald-600"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24zm-3.6 3.63c-.2 0-.42.01-.6.04-.24.04-.52.14-.72.37-.25.28-.97.95-.97 2.32s.99 2.69 1.13 2.87c.14.19 1.95 2.98 4.73 4.18.66.29 1.18.46 1.58.59.66.21 1.27.18 1.75.11.53-.08 1.63-.67 1.86-1.31.23-.65.23-1.2.16-1.31-.07-.12-.25-.19-.53-.33-.28-.14-1.63-.8-1.88-.89-.25-.09-.44-.14-.62.14-.19.28-.72.89-.88 1.07-.16.19-.33.21-.61.07-.28-.14-1.18-.44-2.25-1.39-.83-.74-1.4-1.66-1.56-1.94-.16-.28-.02-.43.12-.57.13-.13.28-.33.42-.5.14-.16.19-.28.28-.47.09-.19.05-.35-.02-.49-.07-.14-.62-1.5-.86-2.05-.22-.53-.46-.46-.62-.47z" />
                              </svg>
                            </a>
                            <button
                              onClick={() => deleteLeadItem(lead.id)}
                              className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-400 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600 cursor-pointer shadow-xs"
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
          <div className="block md:hidden divide-y divide-slate-100 overflow-y-auto max-h-[calc(100vh-270px)] p-3">
            {filteredLeads.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No leads recorded yet. Submissions will auto-load here in real time.
              </div>
            ) : (
              filteredLeads.map((lead) => {
                const receivedToday = isToday(lead.created_at);
                const isNewlyArrived = highlightedLeadIds.has(lead.id);

                return (
                  <div
                    key={lead.id}
                    className={`py-3.5 first:pt-0 last:pb-0 space-y-2 rounded-xl transition-all ${
                      isNewlyArrived ? "bg-indigo-50/80 p-2.5 ring-1 ring-indigo-300" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-slate-900">{lead.name}</span>
                        {isNewlyArrived ? (
                          <span className="rounded-full bg-indigo-600 px-1.5 py-0.2 text-[8px] font-black text-white">
                            NEW
                          </span>
                        ) : null}
                      </div>
                      {isLeadUsa(lead) ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                          <span>🇺🇸</span>
                          <span>{lead.source}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-700">
                          <span>🇮🇳</span>
                          <span>{lead.source}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <a
                        href={`tel:${lead.phone.replace(/[^0-9+]/g, "")}`}
                        className="font-mono text-slate-800 hover:underline hover:text-indigo-600 flex items-center gap-1 font-semibold"
                        title="Call Phone Number"
                      >
                        <Phone className="h-3 w-3 text-slate-400" />
                        {lead.phone}
                      </a>
                      <div className="text-[11px] text-slate-500 font-medium">{lead.video_type}</div>
                    </div>

                    {lead.business ? (
                      <div className="text-xs text-slate-600">
                        <span className="text-slate-900 font-semibold">{lead.business}</span>
                        {lead.location ? ` · ${lead.location}` : ""}
                      </div>
                    ) : null}

                    <div className="flex items-center justify-between pt-1">
                      {receivedToday ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                          <Calendar className="h-2.5 w-2.5" /> Today{" "}
                          {new Date(lead.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500 flex items-center gap-1 font-medium">
                          <Calendar className="h-2.5 w-2.5 text-slate-400" />{" "}
                          {new Date(lead.created_at).toLocaleDateString()}
                        </span>
                      )}

                      <div className="flex items-center gap-2">
                        <select
                          value={lead.status}
                          onChange={(e) => updateStatus(lead.id, e.target.value as Lead["status"])}
                          className={`rounded-lg border px-2 py-0.5 text-[11px] font-bold focus:outline-none ${
                            lead.status === "New"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 bg-slate-50 text-slate-700"
                          }`}
                        >
                          <option value="New">New</option>
                          <option value="Contacted">Contacted</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Closed">Closed</option>
                        </select>

                        <a
                          href={`https://wa.me/${sanitizePhoneNumber(lead.phone, isLeadUsa(lead))}?text=${encodeURIComponent(
                            getAdminWhatsAppPlainText(lead),
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg border border-emerald-200 bg-emerald-50 p-1.5 text-emerald-700 hover:bg-emerald-100 inline-flex items-center justify-center shadow-xs"
                          title="Chat on WhatsApp (Direct Prefilled Message)"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="h-3.5 w-3.5 fill-current text-emerald-600"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24zm-3.6 3.63c-.2 0-.42.01-.6.04-.24.04-.52.14-.72.37-.25.28-.97.95-.97 2.32s.99 2.69 1.13 2.87c.14.19 1.95 2.98 4.73 4.18.66.29 1.18.46 1.58.59.66.21 1.27.18 1.75.11.53-.08 1.63-.67 1.86-1.31.23-.65.23-1.2.16-1.31-.07-.12-.25-.19-.53-.33-.28-.14-1.63-.8-1.88-.89-.25-.09-.44-.14-.62.14-.19.28-.72.89-.88 1.07-.16.19-.33.21-.61.07-.28-.14-1.18-.44-2.25-1.39-.83-.74-1.4-1.66-1.56-1.94-.16-.28-.02-.43.12-.57.13-.13.28-.33.42-.5.14-.16.19-.28.28-.47.09-.19.05-.35-.02-.49-.07-.14-.62-1.5-.86-2.05-.22-.53-.46-.46-.62-.47z" />
                          </svg>
                        </a>
                        <button
                          onClick={() => deleteLeadItem(lead.id)}
                          className="rounded-lg border border-slate-200 bg-slate-50 p-1.5 text-slate-400 hover:border-red-300 hover:bg-red-50 hover:text-red-600"
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
        {activeTab === "orders" && !isPaymentUnlocked && (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200/90 bg-white p-8 sm:p-14 text-center shadow-lg shadow-indigo-100/50 animate-in fade-in duration-200">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 mb-4 shadow-xs">
              <Lock className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Payment & Orders Portal is Protected</h2>
            <p className="mt-2 text-xs sm:text-sm text-slate-500 max-w-md">
              This section is secured with a PIN. Please enter your security PIN to view PayPal orders and transaction records.
            </p>
            <button
              type="button"
              onClick={() => {
                setPaymentPinError("");
                setPaymentPinInput("");
                setShowPaymentPinModal(true);
              }}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-md hover:brightness-105 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Lock className="h-4 w-4" />
              <span>Enter Security PIN</span>
            </button>
          </div>
        )}

        {activeTab === "orders" && isPaymentUnlocked && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Orders KPI Stats Cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-4">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs sm:p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:text-xs">
                    Total Orders
                  </span>
                  <Package className="h-4 w-4 text-indigo-600" />
                </div>
                <p className="mt-2 text-2xl font-black text-slate-900 sm:mt-3 sm:text-3xl">
                  {orders.length}
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/70 via-white to-white p-4 shadow-xs sm:p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 sm:text-xs">
                    Total Revenue
                  </span>
                  <DollarSign className="h-4 w-4 text-emerald-600" />
                </div>
                <p className="mt-2 text-2xl font-black text-emerald-700 sm:mt-3 sm:text-3xl">
                  ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/70 via-white to-white p-4 shadow-xs sm:p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 sm:text-xs">
                    Completed
                  </span>
                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                </div>
                <p className="mt-2 text-2xl font-black text-blue-700 sm:mt-3 sm:text-3xl">
                  {completedOrdersCount}
                </p>
              </div>

              <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50/70 via-white to-white p-4 shadow-xs sm:p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 sm:text-xs">
                    Pending
                  </span>
                  <Clock className="h-4 w-4 text-amber-600" />
                </div>
                <p className="mt-2 text-2xl font-black text-amber-700 sm:mt-3 sm:text-3xl">
                  {pendingOrdersCount}
                </p>
              </div>

              <div className="rounded-2xl border border-red-100 bg-gradient-to-br from-red-50/70 via-white to-white p-4 shadow-xs sm:p-5 col-span-2 sm:col-span-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-red-800 sm:text-xs">
                    Failed / Cancelled
                  </span>
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                </div>
                <p className="mt-2 text-2xl font-black text-red-700 sm:mt-3 sm:text-3xl">
                  {failedOrdersCount}
                </p>
              </div>
            </div>

            {/* Orders Filters & Actions Bar */}
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs sm:flex-row sm:items-center sm:justify-between sm:p-4">
              <div className="flex flex-1 flex-wrap items-center gap-2.5 sm:gap-3">
                {/* Search Input */}
                <div className="relative w-full min-w-0 sm:max-w-xs sm:flex-1">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search customer, email, order ID..."
                    value={orderSearchTerm}
                    onChange={(e) => setOrderSearchTerm(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-none transition-all"
                  />
                </div>

                {/* Status Filter */}
                <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                  <Filter className="h-3 w-3 text-indigo-600" />
                  <span className="text-xs font-semibold text-slate-500">Status:</span>
                  <select
                    value={filterOrderStatus}
                    onChange={(e) => setFilterOrderStatus(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                  >
                    <option value="COMPLETED">Completed (Paid Orders)</option>
                    <option value="All">All Statuses</option>
                    <option value="PENDING">Pending Orders</option>
                    <option value="FAILED">Failed / Cancelled</option>
                    <option value="REFUNDED">Refunded</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleLockPaymentTab}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer shadow-xs"
                  title="Lock Payment & Orders Tab"
                >
                  <Lock className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Lock Tab</span>
                </button>

                <button
                  type="button"
                  onClick={exportOrdersToCsv}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer shadow-xs"
                >
                  <Download className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Export CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    fetchOrders(false);
                    setRefreshCountdown(10);
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:brightness-105 transition-all cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Orders Table Container */}
            <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="px-5 py-3.5">Customer</th>
                      <th className="px-5 py-3.5">Service / Package</th>
                      <th className="px-5 py-3.5 text-center">Amount</th>
                      <th className="px-5 py-3.5 text-center">Payment Status</th>
                      <th className="px-5 py-3.5">PayPal Order & Capture ID</th>
                      <th className="px-5 py-3.5 text-center">Date</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-12 text-center text-slate-400 text-xs">
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
                            className={`transition-colors hover:bg-slate-50/80 ${
                              highlightedOrderIds.has(order.id) ? "bg-indigo-50/70" : ""
                            }`}
                          >
                            {/* Customer */}
                            <td className="px-5 py-4">
                              <div className="font-bold text-slate-900 text-sm">{order.customer_name}</div>
                              <div className="text-[11px] text-slate-500 font-mono mt-0.5">{order.customer_email}</div>
                              {order.customer_phone && (
                                <div className="text-[11px] text-slate-500 mt-0.5">{order.customer_phone}</div>
                              )}
                              {order.customer_company && (
                                <div className="text-[10px] text-indigo-700 font-semibold mt-0.5">🏢 {order.customer_company}</div>
                              )}
                            </td>

                            {/* Service / Package */}
                            <td className="px-5 py-4">
                              <div className="font-bold text-slate-900 text-xs">{order.item_name}</div>
                              <div className="mt-1">
                                <span className="inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 uppercase">
                                  {order.item_type}
                                </span>
                              </div>
                            </td>

                            {/* Amount */}
                            <td className="px-5 py-4 text-center">
                              <span className="font-mono text-sm font-bold text-emerald-700">
                                ${Number(order.amount).toFixed(2)}
                              </span>
                              <span className="text-[10px] text-slate-400 ml-1">{order.currency}</span>
                            </td>

                            {/* Payment Status */}
                            <td className="px-5 py-4 text-center">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                                  isCompleted
                                    ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : isPending
                                    ? "border border-amber-200 bg-amber-50 text-amber-700"
                                    : "border border-red-200 bg-red-50 text-red-700"
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
                                <div className="flex items-center gap-1.5 text-slate-500">
                                  <span className="text-[10px] text-slate-400">Order:</span>
                                  <span className="text-slate-800 font-semibold select-all">{order.paypal_order_id}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(order.paypal_order_id);
                                      setCopiedNotification(true);
                                      setTimeout(() => setCopiedNotification(false), 2500);
                                    }}
                                    className="p-1 text-slate-400 hover:text-slate-700"
                                    title="Copy Order ID"
                                  >
                                    <Copy className="h-3 w-3" />
                                  </button>
                                </div>
                                {order.paypal_capture_id && (
                                  <div className="flex items-center gap-1.5 text-slate-500">
                                    <span className="text-[10px] text-slate-400">Capture:</span>
                                    <span className="text-emerald-700 font-semibold select-all">{order.paypal_capture_id}</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (order.paypal_capture_id) {
                                          navigator.clipboard.writeText(order.paypal_capture_id);
                                          setCopiedNotification(true);
                                          setTimeout(() => setCopiedNotification(false), 2500);
                                        }
                                      }}
                                      className="p-1 text-slate-400 hover:text-slate-700"
                                      title="Copy Capture ID"
                                    >
                                      <Copy className="h-3 w-3" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Date */}
                            <td className="px-5 py-4 text-center text-[11px] text-slate-500">
                              <div className="font-medium text-slate-700">{new Date(order.created_at).toLocaleDateString()}</div>
                              <div className="text-[10px] text-slate-400">
                                {new Date(order.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </div>
                            </td>

                            {/* Actions */}
                            <td className="px-5 py-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setSelectedOrderDetails(order)}
                                  className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-600 hover:text-indigo-600 hover:border-indigo-300 transition-colors shadow-xs"
                                  title="View Order Details"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => deleteOrderItem(order.id)}
                                  className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-400 hover:text-red-600 hover:border-red-300 transition-colors shadow-xs"
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
              <div className="block md:hidden divide-y divide-slate-100 p-3">
                {filteredOrders.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    No orders found.
                  </div>
                ) : (
                  filteredOrders.map((order) => (
                    <div key={order.id} className="py-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-900 text-sm">{order.customer_name}</div>
                          <div className="text-xs text-slate-500 font-mono">{order.customer_email}</div>
                        </div>
                        <span className="font-mono font-bold text-emerald-700 text-sm">
                          ${Number(order.amount).toFixed(2)}
                        </span>
                      </div>

                      <div className="text-xs text-slate-700 font-medium">
                        {order.item_name}
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 uppercase">
                          {order.payment_status}
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedOrderDetails(order)}
                            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100"
                          >
                            Details
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteOrderItem(order.id)}
                            className="rounded-lg border border-slate-200 bg-slate-50 p-1 text-slate-400 hover:text-red-600"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto text-slate-800">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                    <Package className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Order Details</h3>
                    <p className="text-xs text-slate-500 font-mono">{selectedOrderDetails.id}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedOrderDetails(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 space-y-1">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Customer</span>
                  <p className="font-bold text-slate-900 text-sm">{selectedOrderDetails.customer_name}</p>
                  <p className="text-slate-500 font-mono">{selectedOrderDetails.customer_email}</p>
                  {selectedOrderDetails.customer_phone && <p className="text-slate-600">{selectedOrderDetails.customer_phone}</p>}
                  {selectedOrderDetails.customer_company && <p className="text-indigo-700 font-semibold">🏢 {selectedOrderDetails.customer_company}</p>}
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 space-y-1">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Payment Summary</span>
                  <p className="text-lg font-bold text-emerald-700 font-mono">
                    ${Number(selectedOrderDetails.amount).toFixed(2)} {selectedOrderDetails.currency}
                  </p>
                  <div className="pt-1">
                    <span className="inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700 uppercase">
                      Status: {selectedOrderDetails.payment_status}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 text-xs space-y-1">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Item Purchased</span>
                <p className="font-bold text-slate-900 text-sm">{selectedOrderDetails.item_name}</p>
                <p className="text-slate-500">Type: <span className="font-semibold text-slate-800 capitalize">{selectedOrderDetails.item_type}</span></p>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 text-xs space-y-2 font-mono">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold font-sans">PayPal Identifiers</span>
                <div className="flex justify-between items-center text-slate-500">
                  <span>PayPal Order ID:</span>
                  <span className="text-slate-900 font-semibold select-all">{selectedOrderDetails.paypal_order_id}</span>
                </div>
                {selectedOrderDetails.paypal_capture_id && (
                  <div className="flex justify-between items-center text-slate-500">
                    <span>Payment Capture ID:</span>
                    <span className="text-emerald-700 font-semibold select-all">{selectedOrderDetails.paypal_capture_id}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-slate-500">
                  <span>Created At:</span>
                  <span className="text-slate-700">{new Date(selectedOrderDetails.created_at).toLocaleString()}</span>
                </div>
              </div>

              {/* Status Update Control */}
              <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-600 font-bold">Change Status:</span>
                  <select
                    value={selectedOrderDetails.payment_status}
                    onChange={(e) => {
                      const newSt = e.target.value as PaymentStatus;
                      updateOrderStatusItem(selectedOrderDetails.id, newSt);
                      setSelectedOrderDetails({ ...selectedOrderDetails, payment_status: newSt });
                    }}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-800 cursor-pointer"
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
                  className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-white hover:bg-slate-900 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Quick WhatsApp Message Preview & 1-Click Copy Modal */}
        {selectedLeadForMsg ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 shadow-2xl space-y-4 text-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-emerald-600" />
                    {isLeadUsa(selectedLeadForMsg)
                      ? "🇺🇸 WhatsApp Confirmation (USA Lead)"
                      : "WhatsApp Confirmation Message"}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    For {selectedLeadForMsg.name} ({selectedLeadForMsg.phone})
                  </p>
                </div>
                <button
                  onClick={() => setSelectedLeadForMsg(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  ✕
                </button>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs text-slate-800 whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed">
                {getAdminWhatsAppPlainText(selectedLeadForMsg)}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                <button
                  onClick={() => copyLeadMessage(selectedLeadForMsg)}
                  className="rounded-xl border border-slate-200 bg-slate-100 py-2.5 px-3 text-xs font-bold text-slate-700 hover:bg-slate-200 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Copy className="h-4 w-4 text-indigo-600" />
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
                  className="rounded-xl bg-[#25D366] py-2.5 px-3 text-xs font-bold text-white hover:bg-[#20bd5a] flex items-center justify-center gap-1.5 shadow-sm transition-all"
                >
                  <MessageSquare className="h-4 w-4" />
                  Chat on WhatsApp
                </a>
              </div>
            </div>
          </div>
        ) : null}

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

              <form
                onSubmit={handleUnlockPaymentPin}
                autoComplete="off"
                data-lpignore="true"
                data-form-type="other"
                className="mt-6 space-y-4"
              >
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Security PIN
                  </label>
                  <div className="relative">
                    <input
                      type={showPaymentPin ? "text" : "password"}
                      name="temporary_pin_no_autofill"
                      id="temporary_pin_no_autofill"
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
                      onChange={(e) => {
                        setPaymentPinInput(e.target.value);
                        if (paymentPinError) setPaymentPinError("");
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all font-mono"
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
                    <p className="mt-2 text-xs font-bold text-red-600 animate-in fade-in">
                      ⚠️ {paymentPinError}
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
                    type="submit"
                    className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md hover:brightness-105 transition-all hover:scale-[1.02] active:scale-98 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    <span>Unlock</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Global Copied Toast */}
        {copiedNotification && !selectedLeadForMsg ? (
          <div className="fixed bottom-6 right-6 z-50 rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-bold text-white shadow-xl flex items-center gap-2">
            ✓ Message copied! Press Ctrl+V in WhatsApp.
          </div>
        ) : null}
      </main>
    </div>
  );
}
