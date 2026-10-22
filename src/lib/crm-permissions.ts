// Shared (client + server) role & permission model for the CRM.
// The server is the source of truth: every CRM server function re-checks these.

export type CrmRole = "SUPER_ADMIN" | "ADMIN" | "LEADS_MANAGER";
export type ManagedRole = Exclude<CrmRole, "SUPER_ADMIN">;

export type PermKey =
  | "leads"
  | "dashboard"
  | "meta"
  | "coupons"
  | "delete_leads"
  | "recycle_bin"
  | "orders"
  | "export"
  | "purge"
  | "activity"
  | "users"
  | "settings";

export type PermissionMatrix = Record<PermKey, Record<ManagedRole, boolean>>;

export interface PermRowDef {
  key: PermKey;
  module: string;
  location: string;
  /** locked rows cannot be changed from the Permissions Matrix.
   *  "admin_always": Admin always has it; Leads Manager can be switched on or off. */
  locked: "always" | "super_admin_only" | "admin_always" | false;
}

export const PERMISSION_ROWS: PermRowDef[] = [
  { key: "leads", module: "Website Leads Management & Status Updating", location: "Leads Management tab", locked: "always" },
  { key: "dashboard", module: "Dashboard & Real-Time Performance Analytics", location: "Dashboard tab", locked: false },
  { key: "meta", module: "Meta Ads Leads Management & Notes", location: "Meta Leads tab", locked: false },
  { key: "coupons", module: "Coupon Generator & Single-Use Discount Codes", location: "Coupon Generator tab (Super Admin & Admin)", locked: "admin_always" },
  { key: "delete_leads", module: "Delete Leads (move to Recycle Bin)", location: "Delete buttons on lead tables — soft delete only", locked: false },
  { key: "recycle_bin", module: "Recycle Bin (view & restore leads)", location: "Recycle Bin tab", locked: false },
  { key: "orders", module: "Orders & Payments", location: "Orders tab (still needs the security PIN)", locked: false },
  { key: "export", module: "Export Leads & Campaign Data (CSV)", location: "Export CSV buttons", locked: false },
  { key: "purge", module: "Permanent Delete (leads, orders, users) & Empty Recycle Bin", location: "Irreversible database delete", locked: "super_admin_only" },
  { key: "activity", module: "Activity History / Audit Log", location: "Activity History tab", locked: "super_admin_only" },
  { key: "users", module: "Create, Unlock, Deactivate & Delete Users", location: "User Management tab", locked: "super_admin_only" },
  { key: "settings", module: "CRM Settings, Permissions & Access All Records", location: "CRM Settings tab", locked: "super_admin_only" },
];

export const DEFAULT_MATRIX: PermissionMatrix = {
  leads: { ADMIN: true, LEADS_MANAGER: true },
  dashboard: { ADMIN: true, LEADS_MANAGER: false },
  meta: { ADMIN: true, LEADS_MANAGER: true },
  coupons: { ADMIN: true, LEADS_MANAGER: false },
  delete_leads: { ADMIN: true, LEADS_MANAGER: true },
  recycle_bin: { ADMIN: true, LEADS_MANAGER: false },
  orders: { ADMIN: true, LEADS_MANAGER: false },
  export: { ADMIN: true, LEADS_MANAGER: false },
  purge: { ADMIN: false, LEADS_MANAGER: false },
  activity: { ADMIN: false, LEADS_MANAGER: false },
  users: { ADMIN: false, LEADS_MANAGER: false },
  settings: { ADMIN: false, LEADS_MANAGER: false },
};

/** Merge a stored matrix with defaults and force locked rows to their fixed values. */
export function normalizeMatrix(input: unknown): PermissionMatrix {
  const out = JSON.parse(JSON.stringify(DEFAULT_MATRIX)) as PermissionMatrix;
  const src = (input && typeof input === "object" ? input : {}) as Record<string, any>;
  for (const row of PERMISSION_ROWS) {
    if (row.locked === "always") {
      out[row.key] = { ADMIN: true, LEADS_MANAGER: true };
      continue;
    }
    if (row.locked === "super_admin_only") {
      out[row.key] = { ADMIN: false, LEADS_MANAGER: false };
      continue;
    }
    if (row.locked === "admin_always") {
      const lm = src[row.key]?.LEADS_MANAGER;
      out[row.key] = { ADMIN: true, LEADS_MANAGER: typeof lm === "boolean" ? lm : out[row.key].LEADS_MANAGER };
      continue;
    }
    const v = src[row.key];
    if (v && typeof v === "object") {
      if (typeof v.ADMIN === "boolean") out[row.key].ADMIN = v.ADMIN;
      if (typeof v.LEADS_MANAGER === "boolean") out[row.key].LEADS_MANAGER = v.LEADS_MANAGER;
    }
  }
  return out;
}

export function hasPerm(role: CrmRole, key: PermKey, matrix: PermissionMatrix): boolean {
  if (role === "SUPER_ADMIN") return true;
  return !!matrix[key]?.[role];
}

export type PermSet = Record<PermKey, boolean>;

export function permSetFor(role: CrmRole, matrix: PermissionMatrix): PermSet {
  const out = {} as PermSet;
  for (const row of PERMISSION_ROWS) out[row.key] = hasPerm(role, row.key, matrix);
  return out;
}

export const ROLE_LABEL: Record<CrmRole, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  LEADS_MANAGER: "Leads Manager",
};

export const LOCKOUT_OPTIONS: { minutes: number; label: string }[] = [
  { minutes: 1, label: "1 minute" },
  { minutes: 2, label: "2 minutes" },
  { minutes: 5, label: "5 minutes" },
  { minutes: 10, label: "10 minutes" },
  { minutes: 20, label: "20 minutes" },
  { minutes: 30, label: "30 minutes" },
  { minutes: 45, label: "45 minutes" },
  { minutes: 60, label: "60 minutes" },
  { minutes: 120, label: "2 hours" },
  { minutes: 300, label: "5 hours" },
  { minutes: 480, label: "8 hours" },
  { minutes: 720, label: "12 hours" },
  { minutes: 960, label: "16 hours" },
  { minutes: 1080, label: "18 hours" },
  { minutes: 1440, label: "24 hours" },
];

export function lockoutLabel(minutes: number) {
  return LOCKOUT_OPTIONS.find((o) => o.minutes === minutes)?.label || `${minutes} minutes`;
}

export interface CrmConfig {
  crmTitle: string;
  alertEmail: string;
  pollingSeconds: number;
  audioChimeEnabled: boolean;
  inactivityMinutes: number;
  failedLoginThreshold: number;
  /** How long an Admin / Leads Manager is locked after too many failed sign-ins. Super Admin is never locked. */
  lockoutMinutes: number;
}

export const DEFAULT_CONFIG: CrmConfig = {
  crmTitle: "AI STUDIO INDIA – Enterprise CRM",
  alertEmail: "info@quickuppaistudio.in",
  pollingSeconds: 10,
  audioChimeEnabled: true,
  inactivityMinutes: 10,
  failedLoginThreshold: 3,
  lockoutMinutes: 2,
};

export function normalizeConfig(input: unknown): CrmConfig {
  const src = (input && typeof input === "object" ? input : {}) as Record<string, any>;
  const pick = <T,>(v: unknown, allowed: T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);
  return {
    crmTitle: typeof src.crmTitle === "string" && src.crmTitle.trim() ? src.crmTitle.trim().slice(0, 120) : DEFAULT_CONFIG.crmTitle,
    alertEmail: typeof src.alertEmail === "string" && src.alertEmail.includes("@") ? src.alertEmail.trim() : DEFAULT_CONFIG.alertEmail,
    pollingSeconds: pick(Number(src.pollingSeconds), [10, 30, 60], DEFAULT_CONFIG.pollingSeconds),
    audioChimeEnabled: typeof src.audioChimeEnabled === "boolean" ? src.audioChimeEnabled : DEFAULT_CONFIG.audioChimeEnabled,
    inactivityMinutes: pick(Number(src.inactivityMinutes), [10, 20, 30], DEFAULT_CONFIG.inactivityMinutes),
    failedLoginThreshold: pick(Number(src.failedLoginThreshold), [3, 5], DEFAULT_CONFIG.failedLoginThreshold),
    lockoutMinutes: pick(Number(src.lockoutMinutes), LOCKOUT_OPTIONS.map((o) => o.minutes), DEFAULT_CONFIG.lockoutMinutes),
  };
}
