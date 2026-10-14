// Server-only CRM operations. Every function re-validates the session token and
// enforces role rules on the server:
//   • Super Admin deletes are PERMANENT (row removed from the database).
//   • Admin / Leads Manager can only SOFT delete leads (moved to Recycle Bin).
//   • Activity History, User Management and CRM Settings are Super Admin only.
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
  type Filter,
} from "./crm-db";
import { LEADS_TABLE, ORDERS_TABLE } from "./db-tables";
import { getSupabaseConfig } from "./db";
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

function mapLead(r: any) {
  const notes = [r.requirement, r.additional].filter(Boolean).join(" | ");
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
    projectStatus: (r.project_status || "New") as string,
    notes,
    channel: (r.channel || "") as string,
    campaign: (r.campaign || "") as string,
    adSet: (r.ad_set || "") as string,
    formName: (r.form_name || "") as string,
    requirement: (r.requirement || "") as string,
    additional: (r.additional || "") as string,
    handledBy: (r.handled_by || "") as string,
    closedBy: (r.closed_by || "") as string,
    closedAt: r.closed_at ? new Date(r.closed_at).toISOString() : null,
    deliveredAt: r.delivered_at ? new Date(r.delivered_at).toISOString() : null,
    deletedAt: r.deleted_at ? new Date(r.deleted_at).toISOString() : null,
    deletedBy: (r.deleted_by || null) as string | null,
  };
}
export type CrmLead = ReturnType<typeof mapLead>;

function mapOrder(r: any) {
  return {
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
    currency: (r.currency || "USD") as string,
    paymentStatus: (r.payment_status || "PENDING") as string,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : "",
  };
}
export type CrmOrder = ReturnType<typeof mapOrder>;

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
function escapeHtml(v: string) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

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

/** Emails the CRM alert address about a failed sign-in (every attempt, every account). */
async function sendFailedLoginAlert(opts: {
  user: CrmUserRow;
  attempts: number;
  threshold: number;
  locked: boolean;
  lockedUntil: string | null;
  lockMinutes: number;
  alertEmail: string;
}) {
  const { user, attempts, threshold, locked, lockedUntil, lockMinutes, alertEmail } = opts;
  const { ip, ua } = await requestInfo();
  const when = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "medium" }) + " IST";
  const isSA = user.role === "SUPER_ADMIN";
  const status = isSA
    ? "Super Admin account — never locked."
    : locked
      ? `Account LOCKED for ${lockoutLabel(lockMinutes)} (until ${new Date(lockedUntil!).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", timeStyle: "short", dateStyle: "medium" })} IST).`
      : `Attempt ${attempts} of ${threshold} — the account locks for ${lockoutLabel(lockMinutes)} after ${threshold} failed attempts.`;
  const subject = locked
    ? `🔒 CRM account locked: ${user.email}`
    : `⚠️ Failed CRM sign-in: ${user.email}${isSA ? " (Super Admin)" : ""}`;
  const rows: [string, string][] = [
    ["Account", `${user.name} (${user.email})`],
    ["Role", ROLE_LABEL[user.role]],
    ["Time", when],
    ["IP address", ip],
    ["Device / browser", ua],
    ["Status", status],
  ];
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
  <div style="background:${locked ? "#b91c1c" : "#b45309"};color:#fff;padding:14px 18px;font-size:16px;font-weight:bold">${escapeHtml(locked ? "CRM account locked" : "Failed CRM sign-in attempt")}</div>
  <table style="width:100%;border-collapse:collapse;font-size:14px">${rows
    .map(([k, v]) => `<tr><td style="padding:10px 18px;color:#6b7280;width:150px;border-top:1px solid #f1f5f9">${escapeHtml(k)}</td><td style="padding:10px 18px;color:#111827;border-top:1px solid #f1f5f9">${escapeHtml(v)}</td></tr>`)
    .join("")}</table>
  <div style="padding:12px 18px;font-size:12px;color:#6b7280;background:#f9fafb">AI STUDIO INDIA – Enterprise CRM security alert. If this wasn't you or your team, deactivate the account in User Management.</div>
</div>`;
  const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n");
  try {
    const { sendSecurityAlertEmail } = await import("./email");
    await sendSecurityAlertEmail({ to: alertEmail, subject, html, text });
  } catch (e) {
    console.warn("Failed-login alert email error:", e);
  }
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
    const r = await bumpLoginFailure(user, config.failedLoginThreshold, config.lockoutMinutes);
    await logActivity({
      title: r.locked ? "Account locked" : "Failed sign-in attempt",
      category: "USER_ACTIVITY",
      actorEmail: user.email,
      description: isSA
        ? `Wrong password for the Super Admin account (attempt ${r.attempts}). Super Admin is never locked.`
        : r.locked
          ? `Locked for ${lockoutLabel(config.lockoutMinutes)} after ${config.failedLoginThreshold} failed attempts.`
          : `Wrong password (attempt ${r.attempts} of ${config.failedLoginThreshold}).`,
    });
    await sendFailedLoginAlert({
      user,
      attempts: r.attempts,
      threshold: config.failedLoginThreshold,
      locked: r.locked,
      lockedUntil: r.lockedUntil,
      lockMinutes: config.lockoutMinutes,
      alertEmail: config.alertEmail,
    });
    if (r.locked) {
      return { ok: false as const, error: `Too many failed attempts. This account is locked for ${lockoutLabel(config.lockoutMinutes)}.` };
    }
    return { ok: false as const, error: generic };
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
  if (ctx.perms.orders) {
    orderRows = await dbSelect(ORDERS_TABLE, { order: { col: "created_at", desc: true } });
    ordersCount = orderRows.length;
    if (ordersPin && ordersPin === paymentsPin()) orders = orderRows.map(mapOrder);
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
      revenueByCurrency[cur] = (revenueByCurrency[cur] || 0) + (typeof o.amount === "string" ? parseFloat(o.amount) : Number(o.amount || 0));
    }
    counts = {
      activeLeads: allLeadRows.filter((r) => !r.deleted_at).length,
      websiteLeads: allLeadRows.filter((r) => !r.deleted_at && !isMetaRow(r)).length,
      metaLeads: allLeadRows.filter((r) => !r.deleted_at && isMetaRow(r)).length,
      recycleBin: allLeadRows.filter((r) => r.deleted_at).length,
      totalOrders: orderRows.length,
      pendingOrders: orderRows.filter((o) => o.payment_status === "PENDING").length,
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
    config,
    leads,
    recycleBin,
    orders,
    ordersCount,
    users,
    activity,
    counts,
    matrix,
  };
}

export async function unlockOrders(token: string, pin: string) {
  const ctx = await requireSession(token, "orders");
  if ((pin || "").trim() !== paymentsPin()) return { ok: false as const, code: "ERROR" as const, error: "Invalid security PIN." };
  const rows = await dbSelect(ORDERS_TABLE, { order: { col: "created_at", desc: true } });
  await logActivity({ title: "Opened Orders & Payments", category: "ORDERS", actorEmail: ctx.user.email, description: "Unlocked the payments tab with the security PIN." });
  return { ok: true as const, orders: rows.map(mapOrder) };
}

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------
export async function createLead(
  token: string,
  data: {
    kind: "website" | "meta";
    clientName: string;
    email?: string;
    phone?: string;
    business?: string;
    videoScope?: string;
    notes?: string;
    channel?: string;
    campaign?: string;
    adSet?: string;
    formName?: string;
  },
) {
  const ctx = await requireSession(token, data.kind === "meta" ? "meta" : "leads");
  if (!data.clientName?.trim()) throw new Error("Client name is required.");
  const isMeta = data.kind === "meta";
  const row = await dbInsertWithOptional(LEADS_TABLE, {
    id: newId("lead"),
    source: isMeta ? "Meta Ads" : "Manual Entry",
    name: data.clientName.trim(),
    phone: (data.phone || "").trim() || "-",
    email: data.email?.trim() || null,
    video_type: data.videoScope || "AI Video",
    business: data.business?.trim() || (isMeta ? "Meta Lead" : "General Inquiry"),
    requirement: data.notes?.trim() || null,
    status: "New",
    project_status: "New",
    channel: isMeta ? data.channel || "Facebook" : "Manual",
    campaign: isMeta ? data.campaign || null : null,
    ad_set: isMeta ? data.adSet || null : null,
    form_name: isMeta ? data.formName || null : null,
    created_at: new Date().toISOString(),
  }, { handled_by: ctx.user.name });
  // New-lead email (same as website form leads) → qsaistudio@gmail.com
  try {
    const { sendLeadNotificationEmail } = await import("./email");
    await sendLeadNotificationEmail({
      source: isMeta ? `Meta Ads (${data.channel || "Facebook"})` : "Manual Entry (CRM)",
      name: data.clientName.trim(),
      phone: (data.phone || "").trim() || "-",
      email: data.email?.trim() || undefined,
      videoType: data.videoScope || "AI Video",
      business: data.business?.trim() || (isMeta ? "Meta Lead" : "General Inquiry"),
      requirement: data.notes?.trim() || undefined,
      additional: [isMeta && data.campaign ? `Campaign: ${data.campaign}` : "", isMeta && data.formName ? `Form: ${data.formName}` : "", `Added by ${ctx.user.name}`]
        .filter(Boolean)
        .join(" • "),
      leadId: (row as any).id,
    } as any);
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
const PROJECT_STATUSES = ["New", "In Progress", "Proj Active", "On Hold", "Delivered", "Cancelled"];

export async function updateLead(token: string, id: string, patch: { leadStatus?: string; projectStatus?: string }) {
  const ctx = await requireSession(token);
  const row = await getLeadRow(id);
  assertLeadAccess(ctx, row);
  if (row.deleted_at) throw new Error("Restore this lead from the Recycle Bin before editing it.");
  const update: Record<string, unknown> = {};
  const extra: Record<string, unknown> = { handled_by: ctx.user.name };
  const now = new Date().toISOString();
  if (patch.leadStatus && LEAD_STATUSES.includes(patch.leadStatus)) {
    update.status = patch.leadStatus;
    if (patch.leadStatus === "Closed" && row.status !== "Closed") {
      extra.closed_by = ctx.user.name;
      extra.closed_at = now;
    } else if (patch.leadStatus !== "Closed") {
      extra.closed_by = null;
      extra.closed_at = null;
    }
  }
  if (patch.projectStatus && PROJECT_STATUSES.includes(patch.projectStatus)) {
    update.project_status = patch.projectStatus;
    if (patch.projectStatus === "Delivered" && row.project_status !== "Delivered") extra.delivered_at = now;
    else if (patch.projectStatus !== "Delivered") extra.delivered_at = null;
  }
  if (!Object.keys(update).length) throw new Error("Nothing to update.");
  await dbUpdateWithOptional(LEADS_TABLE, byId(id), update, extra);
  const changes: string[] = [];
  if (update.status && update.status !== row.status) changes.push(`Lead status ${row.status || "New"} → ${update.status}`);
  if (update.project_status && update.project_status !== (row.project_status || "New"))
    changes.push(`Project status ${row.project_status || "New"} → ${update.project_status}`);
  if (changes.length) {
    await logActivity({
      title: "Lead updated",
      category: "LEADS",
      actorEmail: ctx.user.email,
      description: `${row.name}: ${changes.join(", ")} (by ${ctx.user.name})`,
      leadId: id,
    });
  }
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
