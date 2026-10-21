// Server-only CRM operations. Every function re-validates the session token and
// enforces role rules on the server:
//   • Super Admin deletes are PERMANENT (row removed from the database).
//   • Admin / Leads Manager can only SOFT delete leads (moved to Recycle Bin).
//   • Activity History, User Management and CRM Settings are Super Admin only.
import { paymentSummary } from "./payment-plan";
import { payBalancePath, payOrderPath } from "./checkout-server";
import { siteUrl } from "./payu";
import {
  dbDelete,
  dbInsert,
  dbInsertWithOptional,
  dbSelect,
  dbUpdate,
  dbUpdateWithOptional,
  logActivity,
  newId,
  setSetting,
  getSetting,
  type Filter,
} from "./crm-db";
import { LEADS_TABLE, ORDERS_TABLE, COUPONS_TABLE } from "./db-tables";
import { getSupabaseConfig } from "./db";
import { renderBrandedEmail } from "./email";
import {
  CrmAuthError,
  bumpLoginFailure,
  ensureSeedUsers,
  findUserByEmail,
  findUserById,
  hashPassword,
  loadConfig,
  normalizeEmail,
  publicUser,
  requireSession,
  requireSuperAdmin,
  signToken,
  validatePasswordStrength,
  verifyPassword,
  type CrmUserRow,
  type SessionContext,
} from "./crm-server-auth";
import { ROLE_LABEL, lockoutLabel, normalizeConfig, normalizeMatrix, type CrmRole } from "./crm-permissions";

type Fail = { ok: false; code: "UNAUTHENTICATED" | "FORBIDDEN" | "ERROR"; error: string };

export async function guard<T>(fn: () => Promise<T>): Promise<T | Fail> {
  try {
    return await fn();
  } catch (e: any) {
    if (e instanceof CrmAuthError) return { ok: false, code: e.code, error: e.message };
    console.error("CRM server error:", e);
    return { ok: false, code: "ERROR", error: e?.message || "Something went wrong." };
  }
}

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------
export function isMetaRow(r: any) {
  const src = String(r.source || "").toLowerCase();
  return src.includes("meta") || r.channel === "Facebook" || r.channel === "Instagram";
}

/** Extra manual-entry fields are kept as "Label: value" lines in `additional` (no schema change needed). */
const EXTRA_FIELDS = {
  website: "Website",
  quantity: "Video quantity",
  deliveryTarget: "Delivery target",
  closedBy: "Closed by",
  closedAt: "Closed at",
  deliveredAt: "Delivered on",
  deliveredBy: "Delivered by",
} as const;
function splitAdditional(additional: string) {
  const extra = { website: "", quantity: "", deliveryTarget: "", closedBy: "", closedAt: "", deliveredAt: "", deliveredBy: "" };
  const rest: string[] = [];
  for (const line of String(additional || "").split("\n")) {
    const m = /^(Website|Video quantity|Delivery target|Closed by|Closed at|Delivered on|Delivered by): (.*)$/.exec(line.trim());
    if (m) {
      const key = (Object.keys(EXTRA_FIELDS) as (keyof typeof EXTRA_FIELDS)[]).find((k) => EXTRA_FIELDS[k] === m[1])!;
      extra[key] = m[2]!.trim();
    } else if (line.trim()) rest.push(line);
  }
  return { extra, rest: rest.join("\n") };
}

function mapLead(r: any) {
  const { extra, rest } = splitAdditional(r.additional || "");
  const notes = [r.requirement, rest].filter(Boolean).join(" | ");
  const isClosed = r.status === "Closed";
  const isDelivered = r.project_status === "Delivered";

  const closedBy = isClosed ? ((r.closed_by || extra.closedBy || r.handled_by || "Admin") as string) : "";
  const closedAt = isClosed
    ? (r.closed_at ? new Date(r.closed_at).toISOString() : (extra.closedAt || (r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString())))
    : null;
  const deliveredAt = isDelivered
    ? (r.delivered_at ? new Date(r.delivered_at).toISOString() : (extra.deliveredAt || (r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString())))
    : null;
  const deliveredBy = isDelivered ? ((extra.deliveredBy || r.handled_by || "Admin") as string) : "";

  return {
    id: r.id as string,
    kind: (isMetaRow(r) ? "meta" : "website") as "meta" | "website",
    source: (r.source || "Website") as string,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    clientName: r.name as string,
    email: (r.email || "") as string,
    phone: (r.phone || "") as string,
    companyName: (r.business || "") as string,
    videoScope: (r.video_type || "AI Video") as string,
    businessType: (r.industry || "") as string,
    location: (r.location || "") as string,
    leadStatus: (r.status || "New") as string,
    // New leads start as "Not Started" (older rows saved "New").
    projectStatus: (!r.project_status || r.project_status === "New" ? "Not Started" : r.project_status) as string,
    notes,
    channel: (r.channel || "") as string,
    campaign: (r.campaign || "") as string,
    adSet: (r.ad_set || "") as string,
    formName: (r.form_name || "") as string,
    requirement: (r.requirement || "") as string,
    additional: rest,
    website: extra.website,
    videoQuantity: extra.quantity,
    deliveryTarget: extra.deliveryTarget,
    handledBy: (r.handled_by || "") as string,
    closedBy,
    closedAt,
    deliveredAt,
    deliveredBy,
    deletedAt: r.deleted_at ? new Date(r.deleted_at).toISOString() : null,
    deletedBy: (r.deleted_by || null) as string | null,
  };
}
export type CrmLead = ReturnType<typeof mapLead>;

/** Only real payments (money received, or refunded) are shown in the CRM. Unfinished /
 *  abandoned / failed checkout attempts stay in the database and Activity History only. */
// Orders: completed, refunded, and pending orders (including on-call / coupon checkouts) appear in CRM.
const isRealPayment = (r: any) =>
  (r.payment_status === "COMPLETED" || r.payment_status === "REFUNDED" || r.payment_status === "PENDING") &&
  paymentSummary(r).plan !== "balance";

function mapOrder(r: any) {
  const ps = paymentSummary(r);
  let d: any = {};
  try {
    d = JSON.parse(r.raw_details || "{}");
  } catch {
    /* ignore */
  }
  const coupon = d.coupon || null;
  const discountPercent = coupon?.discountPercent
    ? Number(coupon.discountPercent)
    : d.discountPercent
      ? Number(d.discountPercent)
      : 0;
  const discountAmount = coupon?.discountAmount
    ? Number(coupon.discountAmount)
    : d.discountAmount
      ? Number(d.discountAmount)
      : 0;
  const couponCode = coupon?.code || d.couponCode || "";
  const source = d.source || "website";

  return {
    paymentPlan: ps.plan,
    planLabel: ps.planLabel,
    orderTotal: ps.orderTotal,
    paidTotal: ps.paidTotal,
    balanceDue: ps.paidTotal > 0 ? ps.balanceDue : 0,
    parentOrderId: ps.parentOrderId,
    balanceOrderId: ps.balanceOrderId,
    balanceTxn: String(d.balanceTxn || ""),
    balancePayuId: String(d.balancePayuId || ""),
    balancePaidAt: d.balancePaidAt ? new Date(d.balancePaidAt).toISOString() : "",
    payBalanceUrl:
      ps.plan === "advance" && r.payment_status === "COMPLETED" && ps.balanceDue > 0
        ? `${siteUrl()}${payBalancePath(String(r.paypal_order_id))}`
        : "",
    payOrderUrl:
      r.payment_status === "PENDING"
        ? `${siteUrl()}${payOrderPath(String(r.paypal_order_id))}`
        : "",
    id: r.id as string,
    paypalOrderId: r.paypal_order_id as string,
    captureId: (r.paypal_capture_id || "") as string,
    customerName: r.customer_name as string,
    customerEmail: r.customer_email as string,
    customerPhone: (r.customer_phone || "") as string,
    customerCompany: (r.customer_company || "") as string,
    itemType: r.item_type as string,
    itemName: r.item_name as string,
    amount: typeof r.amount === "string" ? parseFloat(r.amount) : Number(r.amount || 0),
    currency: (r.currency || "INR") as string,
    paymentStatus: (r.payment_status || "PENDING") as string,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : "",
    couponCode,
    discountPercent,
    discountAmount,
    originalAmount: d.originalAmount ? Number(d.originalAmount) : null,
    source,
  };
}
export type CrmOrder = ReturnType<typeof mapOrder>;

export interface CrmCoupon {
  id: string;
  code: string;
  discountPercent: number;
  maxUses: number;
  timesUsed: number;
  active: boolean;
  usedByEmail: string | null;
  usedAt: string | null;
  orderId: string | null;
  createdBy: string | null;
  createdAt: string;
}

export function mapCoupon(r: any): CrmCoupon {
  const timesUsed = Number(r.times_used ?? 0);
  const maxUses = Number(r.max_uses ?? 1);
  return {
    id: String(r.id),
    code: String(r.code),
    discountPercent: Number(r.discount_percent),
    maxUses,
    timesUsed,
    active: Boolean(r.active) && timesUsed < maxUses,
    usedByEmail: r.used_by_email || null,
    usedAt: r.used_at ? new Date(r.used_at).toISOString() : null,
    orderId: r.order_id || null,
    createdBy: r.created_by || null,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
  };
}

export function generateCouponCode(discountPercent: number): string {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let random = "";
  for (let i = 0; i < 4; i++) {
    random += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `QAS${discountPercent}-${random}`;
}

function mapActivity(r: any) {
  return {
    id: r.id as string,
    title: r.title as string,
    category: r.category as string,
    actorEmail: (r.actor_email || "") as string,
    description: (r.description || "") as string,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : "",
  };
}

const byId = (id: string): Filter[] => [{ col: "id", op: "eq", value: String(id) }];

async function getLeadRow(id: string) {
  const rows = await dbSelect(LEADS_TABLE, { filters: byId(id) });
  if (!rows[0]) throw new Error("Lead not found — it may already have been deleted.");
  return rows[0];
}

function assertLeadAccess(ctx: SessionContext, row: any) {
  if (isMetaRow(row) && !ctx.perms.meta) throw new CrmAuthError("FORBIDDEN", "You don't have access to Meta leads.");
  if (!isMetaRow(row) && !ctx.perms.leads) throw new CrmAuthError("FORBIDDEN", "You don't have access to website leads.");
}

function paymentsPin() {
  return process.env.ADMIN_PAYMENT_PIN || process.env.CRM_PAYMENTS_PIN || "Admin@8080";
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
async function requestInfo() {
  try {
    const { getRequestIP, getRequestHeader } = await import("@tanstack/react-start/server");
    const ip = getRequestIP({ xForwardedFor: true }) || getRequestHeader("x-real-ip") || "Unknown";
    const ua = getRequestHeader("user-agent") || "Unknown";
    return { ip: String(ip), ua: String(ua) };
  } catch {
    return { ip: "Unknown", ua: "Unknown" };
  }
}

type FailureInfo = Awaited<ReturnType<typeof bumpLoginFailure>>;

export function buildFailedLoginEmail(user: CrmUserRow, f: FailureInfo, threshold: number, ip: string, ua: string) {
  const when = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "medium" }) + " IST";
  const isSA = user.role === "SUPER_ADMIN";
  const status = isSA
    ? `${threshold} wrong passwords in a row (${f.total} since the last successful sign-in). The Super Admin account is never locked.`
    : `Locked for ${lockoutLabel(f.lockMinutes)} (lock ${f.lockNumber}) until ${new Date(f.lockedUntil!).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })} IST.`;
  const subject = isSA
    ? `CRM Security Alert: ${threshold} failed sign-in attempts - ${user.email}`
    : `CRM Security Alert: Account locked - ${user.email}`;
  const rows: [string, string][] = [
    ["Account", `${user.name} (${user.email})`],
    ["Role", ROLE_LABEL[user.role]],
    ["Failed attempts", `${threshold} in a row`],
    ["Status", status],
    ["Time", when],
    ["IP address", ip],
    ["Device / browser", ua],
  ];
  const html = renderBrandedEmail({
    eyebrow: "Security Alert",
    title: isSA ? "Repeated failed sign-ins on the Super Admin account" : "A CRM account has been locked",
    intro: isSA
      ? `Someone entered the wrong password ${threshold} times in a row for the Super Admin account.`
      : `${user.name} reached ${threshold} failed sign-in attempts and the account has been locked automatically.`,
    accent: "#b91c1c",
    rows,
    buttons: [{ label: "Open User Management", href: `${(process.env.PUBLIC_SITE_URL || "https://quickuppaistudio.in").replace(/\/+$/, "")}/crm`, color: "#111827" }],
    note: "If this was not you or your team, deactivate the account in User Management. The Super Admin can unlock a locked account at any time.",
  });
  const text = ["AI STUDIO INDIA CRM - Security Alert", "", ...rows.map(([k, v]) => `${k}: ${v}`)].join("\n");
  return { subject, html, text };
}

/** Sends the alert in the background (sign-in isn't slowed down) and records the outcome
 *  — delivered, or the exact error — in Activity History. */
function dispatchFailedLoginAlert(user: CrmUserRow, f: FailureInfo, threshold: number, alertEmail: string, ip: string, ua: string) {
  const mail = buildFailedLoginEmail(user, f, threshold, ip, ua);
  void (async () => {
    try {
      const { sendSecurityAlertEmail } = await import("./email");
      const r = await sendSecurityAlertEmail({ to: alertEmail, ...mail });
      await logActivity({
        title: r.success ? "Login alert email sent" : "Login alert email FAILED",
        category: "SETTINGS",
        actorEmail: user.email,
        description: r.success ? `Alert for ${user.email} delivered to ${alertEmail} via ${r.via}.` : `Could not email ${alertEmail}: ${r.errors.join(" | ").slice(0, 900)}`,
      });
    } catch (e: any) {
      await logActivity({ title: "Login alert email FAILED", category: "SETTINGS", actorEmail: user.email, description: String(e?.message || e) });
    }
  })();
}

export async function login(email: string, password: string) {
  await ensureSeedUsers();
  const config = await loadConfig();
  const user = await findUserByEmail(email);
  const generic = "Invalid email or password.";
  if (!user) return { ok: false as const, error: generic };
  const isSA = user.role === "SUPER_ADMIN";

  // Locked accounts (never the Super Admin) are refused until the lock expires.
  if (!isSA && user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
    const mins = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000);
    const left = mins >= 120 ? `${Math.ceil(mins / 60)} hours` : `${mins} minute${mins === 1 ? "" : "s"}`;
    return { ok: false as const, error: `This account is locked after too many failed attempts. Try again in ${left}, or ask the Super Admin to unlock it.` };
  }

  if (!verifyPassword(password, user.password_hash)) {
    const { ip, ua } = await requestInfo();
    const threshold = config.failedLoginThreshold;
    const f = await bumpLoginFailure(user, threshold, config.lockoutMinutes);
    await logActivity({
      title: f.locked ? "Account locked" : "Failed sign-in attempt",
      category: "USER_ACTIVITY",
      actorEmail: user.email,
      description: isSA
        ? `Wrong password for the Super Admin account (IP ${ip}). Super Admin is never locked.`
        : f.locked
          ? `Locked for ${lockoutLabel(f.lockMinutes)} (lock #${f.lockNumber}) after ${threshold} failed attempts (IP ${ip}).`
          : `Wrong password — attempt ${f.attemptInRound} of ${threshold}, ${f.remaining} left (IP ${ip}).`,
    });
    // Email only when the failed-attempt limit is reached (e.g. every 3rd / 5th wrong password),
    // not on every single failure. For Admin / Leads Manager this is the moment the account locks.
    if (f.remaining === 0) dispatchFailedLoginAlert(user, f, threshold, config.alertEmail, ip, ua);
    if (isSA) return { ok: false as const, error: generic };
    if (f.locked) {
      return {
        ok: false as const,
        error: `Too many failed attempts. This account is locked for ${lockoutLabel(f.lockMinutes)}. Try again later or ask the Super Admin to unlock it.`,
      };
    }
    return {
      ok: false as const,
      error: `Invalid email or password. ${f.remaining} attempt${f.remaining === 1 ? "" : "s"} left before this account is locked.`,
    };
  }
  if (user.status !== "ACTIVE") {
    return { ok: false as const, error: "This account has been deactivated. Contact the Super Admin." };
  }
  await dbUpdate("crm_users", byId(user.id), {
    failed_attempts: 0,
    locked_until: null,
    last_login_at: new Date().toISOString(),
  });
  await logActivity({
    title: "Signed in",
    category: "USER_ACTIVITY",
    actorEmail: user.email,
    description: `${ROLE_LABEL[user.role]} signed in to the CRM.`,
  });
  return { ok: true as const, token: signToken(user), user: publicUser(user) };
}

export async function logout(token: string) {
  const ctx = await requireSession(token);
  await logActivity({ title: "Signed out", category: "USER_ACTIVITY", actorEmail: ctx.user.email, description: "Signed out of the CRM." });
  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// Live sync — everything the signed-in role is allowed to see
// ---------------------------------------------------------------------------
export async function sync(token: string, ordersPin?: string) {
  const ctx = await requireSession(token);
  const config = await loadConfig();

  const allLeadRows = await dbSelect(LEADS_TABLE, { order: { col: "created_at", desc: true } });
  const visible = allLeadRows.filter((r) => (isMetaRow(r) ? ctx.perms.meta : ctx.perms.leads));
  const leads = visible.filter((r) => !r.deleted_at).map(mapLead);
  const recycleBin = ctx.perms.recycle_bin
    ? visible
        .filter((r) => r.deleted_at)
        .map(mapLead)
        .sort((a, b) => String(b.deletedAt).localeCompare(String(a.deletedAt)))
    : [];

  let orders: CrmOrder[] | null = null;
  let ordersCount = 0;
  let orderRows: any[] = [];
  // Successful payments for the notification bell (no PIN needed; no customer details beyond the summary).
  // New (unpaid) orders are not shown here: only "Payment received".
  let orderEvents: ReturnType<typeof mapActivity>[] = [];
  if (ctx.perms.orders) {
    const ev = await dbSelect("crm_activity_logs", {
      filters: [{ col: "title", op: "eq", value: "Payment received" }],
      order: { col: "created_at", desc: true },
      limit: 60,
    });
    orderEvents = ev.map(mapActivity);
    orderRows = (await dbSelect(ORDERS_TABLE, { order: { col: "created_at", desc: true } })).filter(
      (r) => {
        if (paymentSummary(r).plan === "balance") return false;
        if (ctx.isSuperAdmin) {
          // Super Admin sees completed, refunded, pending, and failed checkout attempts
          return (
            r.payment_status === "COMPLETED" ||
            r.payment_status === "REFUNDED" ||
            r.payment_status === "PENDING" ||
            r.payment_status === "FAILED" ||
            r.payment_status === "CANCELLED"
          );
        }
        // Non-super-admins only see completed and refunded orders
        return r.payment_status === "COMPLETED" || r.payment_status === "REFUNDED";
      },
    );
    ordersCount = orderRows.length;
    if (ordersPin && ordersPin === paymentsPin()) orders = orderRows.map(mapOrder);
  }

  let coupons: CrmCoupon[] = [];
  if (ctx.isSuperAdmin) {
    try {
      const couponRows = await dbSelect(COUPONS_TABLE, { order: { col: "created_at", desc: true } });
      coupons = couponRows.map(mapCoupon);
    } catch (e) {
      console.error("Could not fetch coupons:", e);
    }
  }

  let users = null;
  let activity = null;
  let counts = null;
  let matrix = null;
  if (ctx.isSuperAdmin) {
    const userRows = await dbSelect<CrmUserRow>("crm_users", { order: { col: "created_at", desc: false } });
    users = userRows.map(publicUser);
    const actRows = await dbSelect("crm_activity_logs", { order: { col: "created_at", desc: true } });
    activity = actRows.slice(0, 500).map(mapActivity);
    matrix = ctx.matrix;
    const completed = orderRows.filter((o) => o.payment_status === "COMPLETED");
    const revenueByCurrency: Record<string, number> = {};
    for (const o of completed) {
      const cur = o.currency || "USD";
      revenueByCurrency[cur] = (revenueByCurrency[cur] || 0) + paymentSummary(o).paidTotal;
    }
    counts = {
      activeLeads: allLeadRows.filter((r) => !r.deleted_at).length,
      websiteLeads: allLeadRows.filter((r) => !r.deleted_at && !isMetaRow(r)).length,
      metaLeads: allLeadRows.filter((r) => !r.deleted_at && isMetaRow(r)).length,
      recycleBin: allLeadRows.filter((r) => r.deleted_at).length,
      totalCoupons: coupons.length,
      activeCoupons: coupons.filter((c) => c.active).length,
      totalOrders: orderRows.length,
      // "Pending" = paid 50% advance with a balance still due.
      pendingOrders: orderRows.filter((o) => o.payment_status === "COMPLETED" && paymentSummary(o).plan === "advance" && paymentSummary(o).balanceDue > 0).length,
      completedOrders: completed.length,
      failedOrders: orderRows.filter((o) => o.payment_status === "FAILED" || o.payment_status === "CANCELLED").length,
      revenueByCurrency,
      userAccounts: userRows.length,
      activeUsers: userRows.filter((u) => u.status === "ACTIVE").length,
      inactiveUsers: userRows.filter((u) => u.status !== "ACTIVE").length,
      activityLogs: actRows.length,
      database: getSupabaseConfig() ? "India Supabase (PostgreSQL)" : "PostgreSQL",
      countedAt: new Date().toISOString(),
    };
  }

  return {
    ok: true as const,
    user: publicUser(ctx.user),
    perms: ctx.perms,
    notif: await loadNotifState(ctx.user.id),
    orderEvents,
    config,
    leads,
    recycleBin,
    orders,
    ordersCount,
    users,
    activity,
    counts,
    matrix,
    coupons,
  };
}

// ---------------------------------------------------------------------------
// In-CRM notifications: each user's "read" state is stored in crm_settings, so
// whatever arrived while they were away is shown the next time they open the CRM
// (on any device) until they read it.
// ---------------------------------------------------------------------------
export interface NotifState {
  /** Everything created at or before this time counts as read. */
  seenAt: string;
  /** Items after seenAt that were opened individually. */
  readIds: string[];
  /** "Clear all": items created at or before this time are no longer listed. */
  clearedAt: string | null;
  /** Pop-up cards: items created at or before this time have already popped up once
   *  (when the CRM was opened or when they arrived), so they never pop up again. */
  alertedAt: string | null;
}

async function loadNotifState(userId: string): Promise<NotifState> {
  const raw = await getSetting<Partial<NotifState>>(`notif_seen:${userId}`);
  if (raw && typeof raw.seenAt === "string")
    return {
      seenAt: raw.seenAt,
      readIds: Array.isArray(raw.readIds) ? raw.readIds.slice(0, 500) : [],
      clearedAt: typeof raw.clearedAt === "string" ? raw.clearedAt : null,
      alertedAt: typeof raw.alertedAt === "string" ? raw.alertedAt : null,
    };
  // First time: anything from the last 24 hours shows as new.
  const state: NotifState = { seenAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), readIds: [], clearedAt: null, alertedAt: null };
  await setSetting(`notif_seen:${userId}`, state);
  return state;
}

export async function markNotifications(token: string, data: { all?: boolean; clear?: boolean; ids?: string[]; alerted?: string }) {
  const ctx = await requireSession(token);
  const key = `notif_seen:${ctx.user.id}`;
  let state = await loadNotifState(ctx.user.id);
  const now = new Date().toISOString();
  if (data.clear) state = { seenAt: now, readIds: [], clearedAt: now, alertedAt: now };
  else if (data.all) state = { ...state, seenAt: now, readIds: [], alertedAt: now };
  else if (Array.isArray(data.ids) && data.ids.length) {
    const ids = data.ids.filter((x) => typeof x === "string").slice(0, 200);
    state = { ...state, readIds: [...new Set([...ids, ...state.readIds])].slice(0, 500) };
  }
  // Pop-up cards shown up to this moment (sent by the CRM right after it shows them).
  if (typeof data.alerted === "string" && !Number.isNaN(Date.parse(data.alerted))) {
    const at = new Date(Math.min(Date.parse(data.alerted), Date.now())).toISOString();
    if (!state.alertedAt || at > state.alertedAt) state = { ...state, alertedAt: at };
  }
  await setSetting(key, state);
  return { ok: true as const, notif: state };
}

export async function unlockOrders(token: string, pin: string) {
  const ctx = await requireSession(token, "orders");
  if ((pin || "").trim() !== paymentsPin()) return { ok: false as const, code: "ERROR" as const, error: "Invalid security PIN." };
  // Re-check recent PENDING PayU orders with PayU, so the list shows the latest status.
  try {
    const { syncPendingPayUOrders } = await import("./checkout-server");
    await syncPendingPayUOrders();
  } catch (e) {
    console.error("PayU pending sync failed", e);
  }
  const rows = (await dbSelect(ORDERS_TABLE, { order: { col: "created_at", desc: true } })).filter(isRealPayment);
  await logActivity({ title: "Opened Orders & Payments", category: "ORDERS", actorEmail: ctx.user.email, description: "Unlocked the payments tab with the security PIN." });
  return { ok: true as const, orders: rows.map(mapOrder) };
}

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------
const LEAD_STATUS_LIST = ["New", "Contacted", "In Progress", "Hold", "Closed"];
const PROJECT_STATUS_LIST = ["Not Started", "In Progress", "Proj Active", "On Hold", "Delivered", "Cancelled"];

export async function createLead(
  token: string,
  data: {
    kind?: "website" | "meta";
    source?: string;
    clientName: string;
    business?: string;
    website?: string;
    phone?: string;
    email?: string;
    industry?: string;
    location?: string;
    videoScope?: string;
    quantity?: string;
    leadStatus?: string;
    projectStatus?: string;
    deliveryDate?: string;
    notes?: string;
    channel?: string;
    campaign?: string;
    adSet?: string;
    formName?: string;
  },
) {
  const t = (v: unknown, max = 255) => String(v ?? "").trim().slice(0, max);
  const isMeta = data.source === "Meta Ads" || (!data.source && data.kind === "meta");
  const ctx = await requireSession(token, isMeta ? "meta" : "leads");
  if (!t(data.clientName)) throw new Error("Client full name is required.");
  if (!t(data.business)) throw new Error("Company / brand name is required.");
  if (!t(data.phone)) throw new Error("WhatsApp / phone number is required.");
  const source = isMeta ? "Meta Ads" : !data.source || data.source === "Manual" ? "Manual Entry" : t(data.source, 64);
  const leadStatus = LEAD_STATUS_LIST.includes(String(data.leadStatus)) ? String(data.leadStatus) : "New";
  const projectStatus = PROJECT_STATUS_LIST.includes(String(data.projectStatus)) ? String(data.projectStatus) : "Not Started";
  const now = new Date().toISOString();
  const isClosed = leadStatus === "Closed";
  const isDelivered = projectStatus === "Delivered";
  const extras = [
    t(data.website) ? `Website: ${t(data.website)}` : "",
    t(data.quantity) ? `Video quantity: ${t(data.quantity)}` : "",
    /^\d{4}-\d{2}-\d{2}$/.test(t(data.deliveryDate)) ? `Delivery target: ${t(data.deliveryDate)}` : "",
    isClosed ? `Closed by: ${ctx.user.name}` : "",
    isClosed ? `Closed at: ${now}` : "",
    isDelivered ? `Delivered on: ${now}` : "",
    isDelivered ? `Delivered by: ${ctx.user.name}` : "",
  ].filter(Boolean);
  const row = await dbInsertWithOptional(LEADS_TABLE, {
    id: newId("lead"),
    source,
    name: t(data.clientName),
    phone: t(data.phone, 64),
    email: t(data.email) || null,
    video_type: t(data.videoScope, 128) || "AI Video",
    business: t(data.business),
    industry: t(data.industry, 128) || null,
    location: t(data.location) || null,
    requirement: t(data.notes, 4000) || null,
    additional: extras.join("\n") || null,
    status: leadStatus,
    project_status: projectStatus,
    channel: isMeta ? data.channel || "Facebook" : "Manual",
    campaign: isMeta ? t(data.campaign) || null : null,
    ad_set: isMeta ? t(data.adSet) || null : null,
    form_name: isMeta ? t(data.formName) || null : null,
    created_at: now,
  }, {
    handled_by: ctx.user.name,
    closed_by: isClosed ? ctx.user.name : null,
    closed_at: isClosed ? now : null,
    delivered_at: isDelivered ? now : null,
  });
  // New-lead WhatsApp alert (same as website form leads) → +91 80556 79162, in the background.
  {
    const leadId = String((row as any).id);
    void import("./whatsapp").then(({ notifyLeadOnWhatsApp }) =>
      notifyLeadOnWhatsApp(
        {
          source: isMeta ? `Meta Ads (${data.channel || "Facebook"})` : `${source} (CRM)`,
          name: data.clientName.trim(),
          phone: (data.phone || "").trim() || "-",
          email: data.email?.trim() || undefined,
          videoType: data.videoScope || "AI Video",
          business: t(data.business),
          industry: t(data.industry) || undefined,
          location: t(data.location) || undefined,
          requirement: t(data.notes, 4000) || undefined,
        },
        { leadId, actorEmail: ctx.user.email },
      ),
    );
  }
  // New-lead email (same as website form leads) → qsaistudio@gmail.com
  try {
    const { sendLeadNotificationEmail } = await import("./email");
    const mail = await sendLeadNotificationEmail({
      source: isMeta ? `Meta Ads (${data.channel || "Facebook"})` : `${source} (CRM)`,
      name: data.clientName.trim(),
      phone: (data.phone || "").trim() || "-",
      email: data.email?.trim() || undefined,
      videoType: data.videoScope || "AI Video",
      business: t(data.business),
      industry: t(data.industry) || undefined,
      location: t(data.location) || undefined,
      requirement: t(data.notes, 4000) || undefined,
      additional: [...extras, isMeta && data.campaign ? `Campaign: ${data.campaign}` : "", isMeta && data.formName ? `Form: ${data.formName}` : "", `Added by ${ctx.user.name}`]
        .filter(Boolean)
        .join(" • "),
      leadId: (row as any).id,
    } as any);
    await logActivity({
      title: mail.success ? "New-lead email sent" : "New-lead email FAILED",
      category: "LEADS",
      actorEmail: ctx.user.email,
      description: mail.success ? `Lead ${data.clientName.trim()}: emailed via ${mail.via}.` : `Lead ${data.clientName.trim()}: ${mail.errors.join(" | ").slice(0, 900)}`,
      leadId: (row as any).id,
    });
  } catch (e) {
    console.warn("New-lead email failed:", e);
  }
  await logActivity({
    title: isMeta ? "Meta lead added" : "Lead added",
    category: "LEADS",
    actorEmail: ctx.user.email,
    description: `${data.clientName.trim()} added manually by ${ctx.user.name}.`,
    leadId: (row as any).id,
  });
  return { ok: true as const, lead: mapLead(row) };
}

const LEAD_STATUSES = ["New", "Contacted", "In Progress", "Hold", "Closed"];
const PROJECT_STATUSES = ["Not Started", "In Progress", "Proj Active", "On Hold", "Delivered", "Cancelled"];

export type UpdateLeadPatch = {
  leadStatus?: string;
  projectStatus?: string;
  closedBy?: string;
  clientName?: string;
  business?: string;
  phone?: string;
  email?: string;
  website?: string;
  industry?: string;
  location?: string;
  videoScope?: string;
  quantity?: string;
  deliveryDate?: string;
  notes?: string;
  source?: string;
  channel?: string;
  campaign?: string;
  adSet?: string;
  formName?: string;
};

export async function updateLead(token: string, id: string, patch: UpdateLeadPatch) {
  const ctx = await requireSession(token);
  const row = await getLeadRow(id);
  assertLeadAccess(ctx, row);
  if (row.deleted_at) throw new Error("Restore this lead from the Recycle Bin before editing it.");
  const update: Record<string, unknown> = {};
  const extra: Record<string, unknown> = { handled_by: ctx.user.name };
  const now = new Date().toISOString();
  const t = (v: unknown, max = 255) => String(v ?? "").trim().slice(0, max);

  if (patch.clientName !== undefined && t(patch.clientName)) {
    update.name = t(patch.clientName);
  }
  if (patch.business !== undefined && t(patch.business)) {
    update.business = t(patch.business);
  }
  if (patch.phone !== undefined && t(patch.phone)) {
    update.phone = t(patch.phone, 64);
  }
  if (patch.email !== undefined) {
    update.email = t(patch.email) || null;
  }
  if (patch.videoScope !== undefined) {
    update.video_type = t(patch.videoScope, 128) || "AI Video";
  }
  if (patch.industry !== undefined) {
    update.industry = t(patch.industry, 128) || null;
  }
  if (patch.location !== undefined) {
    update.location = t(patch.location) || null;
  }
  if (patch.notes !== undefined) {
    update.requirement = t(patch.notes, 4000) || null;
  }
  if (patch.source !== undefined && t(patch.source)) {
    update.source = t(patch.source);
  }
  if (patch.channel !== undefined) {
    update.channel = t(patch.channel);
  }
  if (patch.campaign !== undefined) {
    update.campaign = t(patch.campaign) || null;
  }
  if (patch.adSet !== undefined) {
    update.ad_set = t(patch.adSet) || null;
  }
  if (patch.formName !== undefined) {
    update.form_name = t(patch.formName) || null;
  }

  const effectiveLeadStatus = patch.leadStatus && LEAD_STATUSES.includes(patch.leadStatus) ? patch.leadStatus : (row.status || "New");
  const effectiveProjectStatus = patch.projectStatus && PROJECT_STATUSES.includes(patch.projectStatus) ? patch.projectStatus : (row.project_status || "Not Started");

  if (patch.leadStatus && LEAD_STATUSES.includes(patch.leadStatus)) {
    update.status = patch.leadStatus;
  }
  if (patch.projectStatus && PROJECT_STATUSES.includes(patch.projectStatus)) {
    update.project_status = patch.projectStatus;
  }

  const { extra: existingExtra, rest } = splitAdditional(row.additional || "");
  const wasClosed = row.status === "Closed";
  const wasDelivered = row.project_status === "Delivered";

  // Closed: remember WHO closed it and when. The person who changes the status to Closed is
  // recorded (website, manual and Meta leads alike); an already closed lead keeps its closer.
  if (effectiveLeadStatus === "Closed") {
    const finalClosedBy = wasClosed ? patch.closedBy?.trim() || row.closed_by || existingExtra.closedBy || ctx.user.name : ctx.user.name;
    const finalClosedAt = (wasClosed && (row.closed_at || existingExtra.closedAt)) || now;
    extra.closed_by = finalClosedBy;
    extra.closed_at = finalClosedAt;
  } else if (patch.leadStatus && patch.leadStatus !== "Closed") {
    extra.closed_by = null;
    extra.closed_at = null;
  }

  // Delivered: remember WHO marked it delivered and when.
  let finalDeliveredBy = "";
  if (effectiveProjectStatus === "Delivered") {
    const finalDeliveredAt = (wasDelivered && (row.delivered_at || existingExtra.deliveredAt)) || now;
    finalDeliveredBy = (wasDelivered && existingExtra.deliveredBy) || ctx.user.name;
    extra.delivered_at = finalDeliveredAt;
  } else if (patch.projectStatus && patch.projectStatus !== "Delivered") {
    extra.delivered_at = null;
  }

  // Handle website, quantity, deliveryTarget, and backup fields inside `additional`
  const finalWebsite = patch.website !== undefined ? t(patch.website) : existingExtra.website;
  const finalQty = patch.quantity !== undefined ? t(patch.quantity) : existingExtra.quantity;
  const finalDelivery = patch.deliveryDate !== undefined ? t(patch.deliveryDate) : existingExtra.deliveryTarget;

  const extras = [
    finalWebsite ? `Website: ${finalWebsite}` : "",
    finalQty ? `Video quantity: ${finalQty}` : "",
    finalDelivery ? `Delivery target: ${finalDelivery}` : "",
    effectiveLeadStatus === "Closed" ? `Closed by: ${extra.closed_by || ctx.user.name}` : "",
    effectiveLeadStatus === "Closed" ? `Closed at: ${extra.closed_at || now}` : "",
    effectiveProjectStatus === "Delivered" ? `Delivered on: ${extra.delivered_at || now}` : "",
    effectiveProjectStatus === "Delivered" ? `Delivered by: ${finalDeliveredBy || ctx.user.name}` : "",
  ].filter(Boolean);

  const allAdditional = [rest, ...extras].filter(Boolean).join("\n");
  update.additional = allAdditional || null;
  if (!Object.keys(update).length) throw new Error("Nothing to update.");
  await dbUpdateWithOptional(LEADS_TABLE, byId(id), update, extra);
  const changes: string[] = [];
  if (update.status && update.status !== row.status)
    changes.push(`Lead status ${row.status || "New"} → ${update.status}${update.status === "Closed" ? ` (closed by ${extra.closed_by})` : ""}`);
  if (update.project_status && update.project_status !== (row.project_status || "Not Started"))
    changes.push(
      `Project status ${!row.project_status || row.project_status === "New" ? "Not Started" : row.project_status} → ${update.project_status}${update.project_status === "Delivered" ? ` (delivered by ${finalDeliveredBy})` : ""}`,
    );
  if (update.name && update.name !== row.name) changes.push(`Client name updated`);
  if (update.phone && update.phone !== row.phone) changes.push(`Phone updated`);
  if (update.email !== undefined && update.email !== row.email) changes.push(`Email updated`);
  if (update.business && update.business !== row.business) changes.push(`Company updated`);
  if (update.video_type && update.video_type !== row.video_type) changes.push(`Video scope updated`);
  if (update.requirement && update.requirement !== row.requirement) changes.push(`Notes updated`);

  await logActivity({
    title: "Lead updated",
    category: "LEADS",
    actorEmail: ctx.user.email,
    description: `${update.name || row.name}: ${changes.length ? changes.join(", ") : "Details updated"} (by ${ctx.user.name})`,
    leadId: id,
  });
  return { ok: true as const };
}

/** Per-lead audit trail — visible to anyone who can see the lead. */
export async function leadHistory(token: string, id: string) {
  const ctx = await requireSession(token);
  const row = await getLeadRow(id);
  assertLeadAccess(ctx, row);
  let rows: any[] = [];
  try {
    rows = await dbSelect("crm_activity_logs", { filters: [{ col: "lead_id", op: "eq", value: id }], order: { col: "created_at", desc: true } });
  } catch {
    rows = []; // lead_id column not added yet
  }
  return { ok: true as const, history: rows.map(mapActivity) };
}

/** Super Admin → permanent delete. Admin / Leads Manager → soft delete to Recycle Bin. */
export async function deleteLead(token: string, id: string) {
  const ctx = await requireSession(token);
  const row = await getLeadRow(id);
  assertLeadAccess(ctx, row);
  if (ctx.isSuperAdmin) {
    const n = await dbDelete(LEADS_TABLE, byId(id));
    if (!n) throw new Error("Lead could not be deleted from the database.");
    await logActivity({ title: "Lead permanently deleted", category: "LEADS", actorEmail: ctx.user.email, description: `${row.name} (${row.phone}) removed from the database.` });
    return { ok: true as const, mode: "permanent" as const };
  }
  if (!ctx.perms.delete_leads) throw new CrmAuthError("FORBIDDEN", "You don't have permission to delete leads.");
  if (row.deleted_at) return { ok: true as const, mode: "soft" as const };
  await dbUpdate(LEADS_TABLE, byId(id), { deleted_at: new Date().toISOString(), deleted_by: ctx.user.email });
  await logActivity({ title: "Lead moved to Recycle Bin", category: "LEADS", actorEmail: ctx.user.email, description: `${row.name} (${row.phone}) soft-deleted by ${ctx.user.name}.`, leadId: id });
  return { ok: true as const, mode: "soft" as const };
}

/** Bulk delete with the same rules as deleteLead (permanent for Super Admin, soft for others). */
export async function deleteLeads(token: string, ids: string[]) {
  if (!Array.isArray(ids) || !ids.length) throw new Error("No leads selected.");
  let done = 0;
  let mode: "permanent" | "soft" = "soft";
  for (const id of ids.slice(0, 500)) {
    const r = await deleteLead(token, String(id));
    mode = r.mode;
    done++;
  }
  return { ok: true as const, deleted: done, mode };
}

export async function restoreLead(token: string, id: string) {
  const ctx = await requireSession(token, "recycle_bin");
  const row = await getLeadRow(id);
  assertLeadAccess(ctx, row);
  await dbUpdate(LEADS_TABLE, byId(id), { deleted_at: null, deleted_by: null });
  await logActivity({ title: "Lead restored", category: "LEADS", actorEmail: ctx.user.email, description: `${row.name} restored from the Recycle Bin by ${ctx.user.name}.`, leadId: id });
  return { ok: true as const };
}

export async function purgeLead(token: string, id: string) {
  const ctx = await requireSuperAdmin(token);
  const row = await getLeadRow(id);
  const n = await dbDelete(LEADS_TABLE, byId(id));
  if (!n) throw new Error("Lead could not be deleted from the database.");
  await logActivity({ title: "Lead permanently deleted", category: "LEADS", actorEmail: ctx.user.email, description: `${row.name} purged from the Recycle Bin.` });
  return { ok: true as const };
}

export async function emptyRecycleBin(token: string) {
  const ctx = await requireSuperAdmin(token);
  const n = await dbDelete(LEADS_TABLE, [{ col: "deleted_at", op: "not_null" }]);
  await logActivity({ title: "Recycle Bin emptied", category: "LEADS", actorEmail: ctx.user.email, description: `${n} lead(s) permanently deleted.` });
  return { ok: true as const, deleted: n };
}

export async function clearLeads(token: string, kind: "website" | "meta") {
  const ctx = await requireSuperAdmin(token);
  const rows = await dbSelect(LEADS_TABLE, { columns: ["id", "source", "channel"] });
  const ids = rows.filter((r) => (kind === "meta" ? isMetaRow(r) : !isMetaRow(r))).map((r) => r.id as string);
  let n = 0;
  for (let i = 0; i < ids.length; i += 100) {
    n += await dbDelete(LEADS_TABLE, [{ col: "id", op: "in", value: ids.slice(i, i + 100) }]);
  }
  await logActivity({
    title: kind === "meta" ? "All Meta leads deleted" : "All website leads deleted",
    category: "LEADS",
    actorEmail: ctx.user.email,
    description: `${n} lead(s) permanently deleted from the database.`,
  });
  return { ok: true as const, deleted: n };
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------
export async function deleteOrder(token: string, id: string) {
  const ctx = await requireSuperAdmin(token);
  const rows = await dbSelect(ORDERS_TABLE, { filters: byId(id) });
  if (!rows[0]) throw new Error("Order not found — it may already have been deleted.");
  const n = await dbDelete(ORDERS_TABLE, byId(id));
  if (!n) throw new Error("Order could not be deleted from the database.");
  const o = rows[0];
  await logActivity({
    title: "Order permanently deleted",
    category: "ORDERS",
    actorEmail: ctx.user.email,
    description: `${o.payment_status} order ${o.paypal_order_id} (${o.customer_name}, ${o.currency} ${o.amount}) removed from the database.`,
  });
  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// Users (Super Admin only)
// ---------------------------------------------------------------------------
export async function createUser(token: string, data: { name: string; email: string; password: string; role: CrmRole }) {
  const ctx = await requireSuperAdmin(token);
  const name = (data.name || "").trim();
  const email = normalizeEmail(data.email);
  if (!name) throw new Error("Name is required.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  if (data.role !== "ADMIN" && data.role !== "LEADS_MANAGER") throw new Error("Role must be Admin or Leads Manager.");
  const pwErr = validatePasswordStrength(data.password);
  if (pwErr) throw new Error(pwErr);
  if (await findUserByEmail(email)) throw new Error("A user with this email already exists.");
  const now = new Date().toISOString();
  const row = await dbInsert<CrmUserRow>("crm_users", {
    id: newId("usr"),
    name,
    email,
    password_hash: hashPassword(data.password),
    role: data.role,
    status: "ACTIVE",
    is_protected: false,
    token_version: 1,
    failed_attempts: 0,
    created_at: now,
    updated_at: now,
  });
  await logActivity({ title: "User created", category: "USER_ACTIVITY", actorEmail: ctx.user.email, description: `${name} (${email}) created as ${ROLE_LABEL[data.role]}.` });
  return { ok: true as const, user: publicUser(row) };
}

export async function setUserStatus(token: string, userId: string, status: "ACTIVE" | "INACTIVE") {
  const ctx = await requireSuperAdmin(token);
  const target = await findUserById(userId);
  if (!target) throw new Error("User not found.");
  if (target.is_protected || target.role === "SUPER_ADMIN") throw new Error("The Super Admin account is protected.");
  if (status !== "ACTIVE" && status !== "INACTIVE") throw new Error("Invalid status.");
  await dbUpdate("crm_users", byId(userId), { status, updated_at: new Date().toISOString() });
  await logActivity({
    title: status === "ACTIVE" ? "User activated" : "User deactivated",
    category: "USER_ACTIVITY",
    actorEmail: ctx.user.email,
    description: `${target.email} is now ${status === "ACTIVE" ? "active" : "deactivated (signed out and blocked from signing in)"}.`,
  });
  return { ok: true as const };
}

export async function deleteUser(token: string, userId: string) {
  const ctx = await requireSuperAdmin(token);
  const target = await findUserById(userId);
  if (!target) throw new Error("User not found.");
  if (target.is_protected || target.role === "SUPER_ADMIN") throw new Error("The Super Admin account is protected.");
  const n = await dbDelete("crm_users", byId(userId));
  if (!n) throw new Error("User could not be deleted from the database.");
  await logActivity({ title: "User permanently deleted", category: "USER_ACTIVITY", actorEmail: ctx.user.email, description: `${target.name} (${target.email}, ${ROLE_LABEL[target.role]}) removed from the database.` });
  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// Settings, permissions, activity, data reset (Super Admin only)
// ---------------------------------------------------------------------------
export async function saveMatrix(token: string, matrix: unknown) {
  const ctx = await requireSuperAdmin(token);
  const normalized = normalizeMatrix(matrix);
  await setSetting("rbac_matrix", normalized);
  await logActivity({ title: "Permissions updated", category: "SETTINGS", actorEmail: ctx.user.email, description: "Role permissions matrix saved. Applies to signed-in users immediately." });
  return { ok: true as const, matrix: normalized };
}

export async function saveConfig(token: string, config: unknown) {
  const ctx = await requireSuperAdmin(token);
  const normalized = normalizeConfig(config);
  await setSetting("crm_config", normalized);
  await logActivity({ title: "CRM settings updated", category: "SETTINGS", actorEmail: ctx.user.email, description: "General & security settings saved." });
  return { ok: true as const, config: normalized };
}

export async function deleteActivity(token: string, id: string) {
  await requireSuperAdmin(token);
  await dbDelete("crm_activity_logs", byId(id));
  return { ok: true as const };
}

export async function clearActivity(token: string) {
  const ctx = await requireSuperAdmin(token);
  const n = await dbDelete("crm_activity_logs", [{ col: "id", op: "not_null" }]);
  await logActivity({ title: "Activity history cleared", category: "SETTINGS", actorEmail: ctx.user.email, description: `${n} log entr${n === 1 ? "y" : "ies"} deleted.` });
  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// Bulk actions
// ---------------------------------------------------------------------------
function cleanIds(ids: unknown): string[] {
  if (!Array.isArray(ids) || !ids.length) throw new Error("Nothing selected.");
  return ids.slice(0, 500).map(String);
}

async function deleteByIds(table: string, ids: string[]) {
  let n = 0;
  for (let i = 0; i < ids.length; i += 100) n += await dbDelete(table, [{ col: "id", op: "in", value: ids.slice(i, i + 100) }]);
  return n;
}

/** Super Admin only — permanently deletes the selected orders (any status). */
export async function deleteOrders(token: string, ids: string[]) {
  const ctx = await requireSuperAdmin(token);
  const list = cleanIds(ids);
  const n = await deleteByIds(ORDERS_TABLE, list);
  await logActivity({ title: "Orders permanently deleted", category: "ORDERS", actorEmail: ctx.user.email, description: `${n} order(s) removed from the database.` });
  return { ok: true as const, deleted: n };
}

/** Super Admin only — deletes the selected activity-history entries. */
export async function deleteActivities(token: string, ids: string[]) {
  await requireSuperAdmin(token);
  const n = await deleteByIds("crm_activity_logs", cleanIds(ids));
  return { ok: true as const, deleted: n };
}

/** Restore selected leads from the Recycle Bin (anyone with Recycle Bin access). */
export async function restoreLeads(token: string, ids: string[]) {
  let n = 0;
  for (const id of cleanIds(ids)) {
    await restoreLead(token, id);
    n++;
  }
  return { ok: true as const, restored: n };
}

/** Super Admin only — permanently deletes the selected Recycle Bin leads. */
export async function purgeLeads(token: string, ids: string[]) {
  const ctx = await requireSuperAdmin(token);
  const list = cleanIds(ids);
  // Only leads that are actually in the Recycle Bin
  const binIds: string[] = [];
  for (let i = 0; i < list.length; i += 100) {
    const rows = await dbSelect(LEADS_TABLE, { columns: ["id"], filters: [{ col: "id", op: "in", value: list.slice(i, i + 100) }, { col: "deleted_at", op: "not_null" }] });
    binIds.push(...rows.map((r: any) => r.id as string));
  }
  const n = binIds.length ? await deleteByIds(LEADS_TABLE, binIds) : 0;
  await logActivity({ title: "Leads permanently deleted", category: "LEADS", actorEmail: ctx.user.email, description: `${n} lead(s) purged from the Recycle Bin.` });
  return { ok: true as const, deleted: n };
}

/** Super Admin only — clears a sign-in lockout. */
export async function unlockUser(token: string, userId: string) {
  const ctx = await requireSuperAdmin(token);
  const target = await findUserById(userId);
  if (!target) throw new Error("User not found.");
  await dbUpdate("crm_users", byId(userId), { locked_until: null, failed_attempts: 0, updated_at: new Date().toISOString() });
  await logActivity({ title: "User unlocked", category: "USER_ACTIVITY", actorEmail: ctx.user.email, description: `Sign-in lock removed for ${target.email}.` });
  return { ok: true as const };
}

/** Super Admin only — sends a test login-alert email and reports exactly what happened. */
export async function testAlertEmail(token: string) {
  const ctx = await requireSuperAdmin(token);
  const config = await loadConfig();
  const { sendSecurityAlertEmail } = await import("./email");
  const when = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "medium" }) + " IST";
  const r = await sendSecurityAlertEmail({
    to: config.alertEmail,
    subject: "CRM Security Alert: Test email",
    text: `This is a test login-alert email sent by ${ctx.user.email} at ${when}. Security alerts will arrive at this address.`,
    html: renderBrandedEmail({
      eyebrow: "Security Alert - Test",
      title: "Login alert emails are working",
      intro: "This is a test message. Account-lock and repeated failed sign-in alerts from the CRM will arrive at this address.",
      accent: "#b91c1c",
      rows: [
        ["Sent by", ctx.user.email],
        ["Time", when],
        ["Alert address", config.alertEmail],
      ],
    }),
  });
  await logActivity({
    title: r.success ? "Test alert email sent" : "Test alert email FAILED",
    category: "SETTINGS",
    actorEmail: ctx.user.email,
    description: r.success ? `Delivered to ${config.alertEmail} via ${r.via}.` : r.errors.join(" | ").slice(0, 900),
  });
  return { ok: true as const, success: r.success, via: r.via || "", errors: r.errors, to: config.alertEmail };
}

// ---------------------------------------------------------------------------
// Coupons (Single-Use Unique Discount Codes)
// ---------------------------------------------------------------------------

/** Retrieves all coupons for CRM display. */
export async function getCoupons(token: string) {
  const ctx = await requireSession(token);
  if (!ctx.isSuperAdmin) {
    throw new CrmAuthError("FORBIDDEN", "Only Super Admin can view coupons.");
  }
  const rows = await dbSelect(COUPONS_TABLE, { order: { col: "created_at", desc: true } });
  return { ok: true as const, coupons: rows.map(mapCoupon) };
}

/** Generates a single-use unique coupon code (e.g. 10%, 20%, 25%, or custom). */
export async function createCoupon(token: string, input: { discountPercent: number; customCode?: string }) {
  const ctx = await requireSession(token);
  if (!ctx.isSuperAdmin) {
    throw new CrmAuthError("FORBIDDEN", "Only Super Admin can generate coupons.");
  }
  const pct = Math.round(Number(input.discountPercent));
  if (isNaN(pct) || pct <= 0 || pct > 100) {
    throw new Error("Discount percentage must be between 1 and 100.");
  }

  let code = (input.customCode ? String(input.customCode).trim().toUpperCase() : "").replace(/[^A-Z0-9-]/g, "");
  if (!code) {
    for (let i = 0; i < 5; i++) {
      const candidate = generateCouponCode(pct);
      const existing = await dbSelect(COUPONS_TABLE, { filters: [{ col: "code", op: "eq", value: candidate }] });
      if (!existing.length) {
        code = candidate;
        break;
      }
    }
    if (!code) code = `QAS${pct}-${Date.now().toString(36).toUpperCase()}`;
  } else {
    const existing = await dbSelect(COUPONS_TABLE, { filters: [{ col: "code", op: "eq", value: code }] });
    if (existing.length) {
      throw new Error(`Coupon code "${code}" already exists.`);
    }
  }

  const id = newId("cpn");
  const now = new Date().toISOString();
  const row = {
    id,
    code,
    discount_percent: pct,
    max_uses: 1, // Strictly single-use
    times_used: 0,
    active: true,
    used_by_email: null,
    used_at: null,
    order_id: null,
    created_by: ctx.user.email,
    created_at: now,
  };

  await dbInsert(COUPONS_TABLE, row);
  await logActivity({
    title: "Coupon created",
    category: "SETTINGS",
    actorEmail: ctx.user.email,
    description: `Single-use coupon ${code} (${pct}% OFF) generated by ${ctx.user.email}.`,
  });

  return { ok: true as const, coupon: mapCoupon(row) };
}

/** Deletes a coupon code from the CRM. */
export async function deleteCoupon(token: string, id: string) {
  const ctx = await requireSession(token);
  if (!ctx.isSuperAdmin) {
    throw new CrmAuthError("FORBIDDEN", "Only Super Admin can delete coupons.");
  }
  const rows = await dbSelect(COUPONS_TABLE, { filters: [{ col: "id", op: "eq", value: id }] });
  const coupon = rows[0];
  if (!coupon) throw new Error("Coupon not found.");

  await dbDelete(COUPONS_TABLE, [{ col: "id", op: "eq", value: id }]);
  await logActivity({
    title: "Coupon deleted",
    category: "SETTINGS",
    actorEmail: ctx.user.email,
    description: `Coupon ${coupon.code} deleted by ${ctx.user.email}.`,
  });

  return { ok: true as const };
}

/** Validates whether a coupon is valid and active for checkout. */
export async function validateCouponCode(code: string) {
  const cleaned = String(code || "").trim().toUpperCase();
  if (!cleaned) return { valid: false as const, error: "Please enter a coupon code." };

  const rows = await dbSelect(COUPONS_TABLE, { filters: [{ col: "code", op: "eq", value: cleaned }] });
  const coupon = rows[0];
  if (!coupon) {
    return { valid: false as const, error: "Invalid coupon code." };
  }
  if (!coupon.active || Number(coupon.times_used || 0) >= Number(coupon.max_uses || 1)) {
    return { valid: false as const, error: "This coupon code has already been used and is expired." };
  }

  return {
    valid: true as const,
    code: String(coupon.code),
    discountPercent: Number(coupon.discount_percent),
  };
}

/** Marks a single-use coupon as redeemed upon order placement. */
export async function redeemCoupon(code: string, email: string, orderId: string) {
  const cleaned = String(code || "").trim().toUpperCase();
  if (!cleaned) return null;

  const rows = await dbSelect(COUPONS_TABLE, { filters: [{ col: "code", op: "eq", value: cleaned }] });
  const coupon = rows[0];
  if (!coupon || !coupon.active || Number(coupon.times_used || 0) >= Number(coupon.max_uses || 1)) {
    return null;
  }

  const now = new Date().toISOString();
  await dbUpdate(COUPONS_TABLE, [{ col: "id", op: "eq", value: coupon.id }], {
    times_used: Number(coupon.times_used || 0) + 1,
    active: false, // Immediately expire after single use
    used_by_email: email,
    used_at: now,
    order_id: orderId,
  });

  await logActivity({
    title: "Coupon redeemed",
    category: "ORDERS",
    actorEmail: email,
    description: `Single-use coupon ${coupon.code} (${coupon.discount_percent}% OFF) redeemed by ${email} on order ${orderId}.`,
  });

  return {
    code: String(coupon.code),
    discountPercent: Number(coupon.discount_percent),
  };
}

export interface DirectOrderInput {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientCompany?: string;
  serviceId: string;
  qty: number;
  paymentPlan?: "full" | "advance";
  discountPercent?: number;
  customCouponCode?: string;
  paidOnCall?: boolean;
  notes?: string;
}

/**
 * Super Admin / Admin creates an order directly for a customer on a call.
 * Generates/redeems the single-use coupon, links to the customer, and produces a direct payment link.
 */
export async function createDirectOrder(token: string, input: DirectOrderInput) {
  const ctx = await requireSession(token);
  if (!ctx.isSuperAdmin) {
    throw new CrmAuthError("FORBIDDEN", "Only Super Admin can create on-call direct orders.");
  }

  const { createIndiaOrder, payOrderPath } = await import("./checkout-server");

  const pct = Math.max(0, Math.min(100, Math.round(Number(input.discountPercent || 0))));
  let couponCode = input.customCouponCode ? input.customCouponCode.trim().toUpperCase() : "";

  // If discount percentage is requested, pre-generate single-use coupon so createIndiaOrder can redeem it
  if (pct > 0) {
    if (!couponCode) {
      couponCode = generateCouponCode(pct);
    }
    const existing = await dbSelect(COUPONS_TABLE, { filters: [{ col: "code", op: "eq", value: couponCode }] });
    if (!existing.length) {
      await dbInsert(COUPONS_TABLE, {
        id: newId("cpn"),
        code: couponCode,
        discount_percent: pct,
        max_uses: 1,
        times_used: 0,
        active: true,
        created_by: ctx.user.email,
        created_at: new Date().toISOString(),
      });
    }
  }

  const res = await createIndiaOrder({
    serviceId: input.serviceId,
    qty: input.qty,
    name: input.clientName,
    email: input.clientEmail,
    phone: input.clientPhone,
    company: input.clientCompany,
    paymentPlan: input.paymentPlan || "full",
    notes: input.notes ? `[Created on call by ${ctx.user.email}] ${input.notes}` : `[Created on call by ${ctx.user.email}]`,
    couponCode: pct > 0 ? couponCode : undefined,
  });

  if (!res.ok) {
    throw new Error(res.error);
  }

  const payUrl = `${siteUrl()}${payOrderPath(res.txnid)}`;

  // If marked paid on call immediately
  if (input.paidOnCall) {
    const rows = await dbSelect(ORDERS_TABLE, { filters: [{ col: "id", op: "eq", value: res.orderId }] });
    const order = rows[0];
    if (order) {
      let d: any = {};
      try {
        d = JSON.parse(order.raw_details || "{}");
      } catch {}
      const now = new Date().toISOString();
      await dbUpdate(ORDERS_TABLE, [{ col: "id", op: "eq", value: res.orderId }], {
        payment_status: "COMPLETED",
        paypal_status: "PAID_ON_CALL",
        raw_details: JSON.stringify({
          ...d,
          paidAt: now,
          source: "on_call",
          paidOnCall: true,
          createdBy: ctx.user.email,
        }),
        updated_at: now,
      });
      await logActivity({
        title: "Order paid on call",
        category: "ORDERS",
        actorEmail: ctx.user.email,
        description: `Order ${res.orderId} (${input.clientName}) confirmed paid on call by ${ctx.user.email}.`,
      });
    }
  }

  return {
    ok: true as const,
    orderId: res.orderId,
    txnid: res.txnid,
    itemName: res.itemName,
    amount: res.amount,
    orderTotal: res.orderTotal,
    balance: res.balance,
    payOrderUrl: payUrl,
    couponCode: pct > 0 ? couponCode : null,
    discountPercent: pct,
  };
}

/**
 * Super Admin manually marks an awaiting payment order as COMPLETED (e.g. client paid via direct transfer).
 */
export async function markOrderPaid(token: string, orderId: string, notes?: string) {
  const ctx = await requireSession(token);
  if (!ctx.isSuperAdmin && !ctx.perms.orders) {
    throw new CrmAuthError("FORBIDDEN", "You do not have permission to update orders.");
  }
  const rows = await dbSelect(ORDERS_TABLE, { filters: [{ col: "id", op: "eq", value: orderId }] });
  const o = rows[0];
  if (!o) throw new Error("Order not found.");
  if (o.payment_status === "COMPLETED") return { ok: true as const, message: "Order is already completed." };

  let d: any = {};
  try {
    d = JSON.parse(o.raw_details || "{}");
  } catch {}

  const now = new Date().toISOString();
  await dbUpdate(ORDERS_TABLE, [{ col: "id", op: "eq", value: orderId }], {
    payment_status: "COMPLETED",
    paypal_status: "MANUALLY_MARKED_PAID",
    raw_details: JSON.stringify({
      ...d,
      paidAt: now,
      manuallyMarkedPaidBy: ctx.user.email,
      manualPaymentNotes: notes || "Payment confirmed by admin",
    }),
    updated_at: now,
  });

  await logActivity({
    title: "Order marked as paid",
    category: "ORDERS",
    actorEmail: ctx.user.email,
    description: `Order ${orderId} (${o.customer_name}) was manually marked as PAID by ${ctx.user.email}.`,
  });

  return { ok: true as const };
}


