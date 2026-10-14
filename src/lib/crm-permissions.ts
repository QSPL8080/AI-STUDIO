// Shared (client + server) role & permission model for the CRM.
// The server is the source of truth: every CRM server function re-checks these.

export type CrmRole = "SUPER_ADMIN" | "ADMIN" | "LEADS_MANAGER";
export type ManagedRole = Exclude<CrmRole, "SUPER_ADMIN">;

export type PermKey =
  | "leads"
  | "dashboard"
  | "meta"
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
  /** locked rows cannot be changed from the Permissions Matrix */
  locked: "always" | "super_admin_only" | false;
}

export const PERMISSION_ROWS: PermRowDef[] = [
  { key: "leads", module: "Website Leads Management & Status Updating", location: "Leads Management tab", locked: "always" },
  { key: "dashboard", module: "Dashboard & Real-Time Performance Analytics", location: "Dashboard tab", locked: false },
  { key: "meta", module: "Meta Ads Leads Management & Notes", location: "Meta Leads tab", locked: false },
  { key: "delete_leads", module: "Delete Leads (move to Recycle Bin)", location: "Delete buttons on lead tables — soft delete only", locked: false },
  { key: "recycle_bin", module: "Recycle Bin (view & restore leads)", location: "Recycle Bin tab", locked: false },
  { key: "orders", module: "Orders & Payments", location: "Orders tab (still needs the security PIN)", locked: false },
  { key: "export", module: "Export Leads & Campaign Data (CSV)", location: "Export CSV buttons", locked: false },
  { key: "purge", module: "Permanent Delete (leads, orders, users) & Empty Recycle Bin", location: "Irreversible database delete", locked: "super_admin_only" },
  { key: "activity", module: "Activity History / Audit Log", location: "Activity History tab", locked: "super_admin_only" },
  { key: "users", module: "Create, Deactivate, Delete Users & Change Passwords", location: "User Management tab", locked: "super_admin_only" },
  { key: "settings", module: "CRM Settings, Permissions & Access All Records", location: "CRM Settings tab", locked: "super_admin_only" },
];

export const DEFAULT_MATRIX: PermissionMatrix = {
  leads: { ADMIN: true, LEADS_MANAGER: true },
  dashboard: { ADMIN: true, LEADS_MANAGER: false },
  meta: { ADMIN: true, LEADS_MANAGER: true },
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

export interface CrmConfig {
  crmTitle: string;
  alertEmail: string;
  pollingSeconds: number;
  audioChimeEnabled: boolean;
  inactivityMinutes: number;
  failedLoginThreshold: number;
}

export const DEFAULT_CONFIG: CrmConfig = {
  crmTitle: "AI STUDIO INDIA – Enterprise CRM",
  alertEmail: "info@quickuppaistudio.in",
  pollingSeconds: 10,
  audioChimeEnabled: true,
  inactivityMinutes: 10,
  failedLoginThreshold: 3,
};

export function normalizeConfig(input: unknown): CrmConfig {
  const src = (input && typeof input === "object" ? input : {}) as Record<string, any>;
  const pick = <T,>(v: unknown, allowed: T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);
  return {
    crmTitle: typeof src.crmTitle === "string" && src.crmTitle.trim() ? src.crmTitle.trim().slice(0, 120) : DEFAULT_CONFIG.crmTitle,
    alertEmail: typeof src.alertEmail === "string" && src.alertEmail.includes("@") ? src.alertEmail.trim() : DEFAULT_CONFIG.alertEmail,
    pollingSeconds: pick(Number(src.pollingSeconds), [10, 30, 60], DEFAULT_CONFIG.pollingSeconds),
    audioChimeEnabled: typeof src.audioChimeEnabled === "boolean" ? src.audioChimeEnabled : DEFAULT_CONFIG.audioChimeEnabled,
    inactivityMinutes: pick(Number(src.inactivityMinutes), [10, 30, 60], DEFAULT_CONFIG.inactivityMinutes),
    failedLoginThreshold: pick(Number(src.failedLoginThreshold), [3, 5], DEFAULT_CONFIG.failedLoginThreshold),
  };
}
