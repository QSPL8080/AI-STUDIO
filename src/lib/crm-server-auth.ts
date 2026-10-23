// Server-only: password hashing, signed session tokens, seeding and session checks.
import { createHmac, createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { dbInsert, dbSelect, dbUpdate, getSetting, newId } from "./crm-db";
import {
  LOCKOUT_OPTIONS,
  normalizeConfig,
  normalizeMatrix,
  permSetFor,
  type CrmConfig,
  type CrmRole,
  type PermKey,
  type PermSet,
  type PermissionMatrix,
} from "./crm-permissions";

export interface CrmUserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: CrmRole;
  status: "ACTIVE" | "INACTIVE";
  is_protected: boolean;
  token_version: number;
  failed_attempts: number;
  locked_until: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

// Old login spelling kept working so nobody is locked out.
const EMAIL_ALIASES: Record<string, string> = {
  "sa@aistudo.in": "sa@aistudio.in",
};

export function normalizeEmail(email: string) {
  const e = (email || "").trim().toLowerCase();
  return EMAIL_ALIASES[e] || e;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = (stored || "").split("$");
  if (scheme !== "scrypt" || !salt || !hash || !password) return false;
  const a = Buffer.from(hash, "hex");
  const b = scryptSync(password, salt, 64);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function validatePasswordStrength(password: string): string | null {
  if (!password || password.length < 6) return "Password must be at least 6 characters.";
  if (password.length > 128) return "Password is too long.";
  return null;
}

function sessionSecret() {
  const explicit = process.env["CRM_SESSION_SECRET"];
  if (explicit && explicit.length >= 16) return explicit;
  // Derived from the database secret so tokens can't be forged without server access.
  const base =
    process.env["IND_SUPABASE_SERVICE_KEY"] ||
    process.env["SUPABASE_API_KEY"] ||
    process.env["SUPABASE_SERVICE_ROLE_KEY"] ||
    process.env["DATABASE_URL"] ||
    "quickupp-local-dev";
  return createHash("sha256").update(`quickupp-crm-session|${base}`).digest("hex");
}

function b64url(s: string) {
  return Buffer.from(s).toString("base64url");
}

export function signToken(user: Pick<CrmUserRow, "id" | "token_version">): string {
  const payload = b64url(JSON.stringify({ uid: user.id, tv: user.token_version, iat: Date.now() }));
  const sig = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function readToken(token: string): { uid: string; tv: number; iat: number } | null {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (Date.now() - Number(data.iat) > SESSION_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

let seedChecked = false;
/** First run only: if the users table is empty, create the Super Admin and the test Admin. */
export async function ensureSeedUsers() {
  if (seedChecked) return;
  const existing = await dbSelect<CrmUserRow>("crm_users", { columns: ["id"], limit: 1 });
  if (existing.length === 0) {
    const now = new Date().toISOString();
    await dbInsert("crm_users", {
      id: newId("usr"),
      name: "Super Admin",
      email: "sa@aistudio.in",
      password_hash: hashPassword("Anay@8080"),
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      is_protected: true,
      token_version: 1,
      failed_attempts: 0,
      created_at: now,
      updated_at: now,
    });
    await dbInsert("crm_users", {
      id: newId("usr"),
      name: "Test Admin",
      email: "test@aistudio.in",
      password_hash: hashPassword("Test@123"),
      role: "ADMIN",
      status: "ACTIVE",
      is_protected: false,
      token_version: 1,
      failed_attempts: 0,
      created_at: now,
      updated_at: now,
    });
  }
  seedChecked = true;
}

export async function findUserByEmail(email: string) {
  const rows = await dbSelect<CrmUserRow>("crm_users", { filters: [{ col: "email", op: "eq", value: normalizeEmail(email) }] });
  return rows[0] || null;
}

export async function findUserById(id: string) {
  const rows = await dbSelect<CrmUserRow>("crm_users", { filters: [{ col: "id", op: "eq", value: id }] });
  return rows[0] || null;
}

export async function loadMatrix(): Promise<PermissionMatrix> {
  return normalizeMatrix(await getSetting("rbac_matrix"));
}

export async function loadConfig(): Promise<CrmConfig> {
  return normalizeConfig(await getSetting("crm_config"));
}

export interface SessionContext {
  user: CrmUserRow;
  matrix: PermissionMatrix;
  perms: PermSet;
  isSuperAdmin: boolean;
}

export class CrmAuthError extends Error {
  code: "UNAUTHENTICATED" | "FORBIDDEN";
  constructor(code: "UNAUTHENTICATED" | "FORBIDDEN", message: string) {
    super(message);
    this.code = code;
  }
}

/** Validates the token against the database on every call: deleted, deactivated
 * or password-changed users are signed out immediately. */
export async function requireSession(token: string, perm?: PermKey): Promise<SessionContext> {
  const data = readToken(token);
  if (!data) throw new CrmAuthError("UNAUTHENTICATED", "Your session has expired. Please sign in again.");
  const user = await findUserById(data.uid);
  if (!user) throw new CrmAuthError("UNAUTHENTICATED", "This account no longer exists.");
  if (user.status !== "ACTIVE") throw new CrmAuthError("UNAUTHENTICATED", "This account has been deactivated by the Super Admin.");
  if (Number(user.token_version) !== Number(data.tv))
    throw new CrmAuthError("UNAUTHENTICATED", "Your password was changed. Please sign in again.");
  const matrix = await loadMatrix();
  const perms = permSetFor(user.role, matrix);
  if (perm && !perms[perm]) throw new CrmAuthError("FORBIDDEN", "You don't have permission for this action.");
  return { user, matrix, perms, isSuperAdmin: user.role === "SUPER_ADMIN" };
}

export async function requireSuperAdmin(token: string): Promise<SessionContext> {
  const ctx = await requireSession(token);
  if (!ctx.isSuperAdmin) throw new CrmAuthError("FORBIDDEN", "Only the Super Admin can do this.");
  return ctx;
}

export function publicUser(u: CrmUserRow) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    isProtected: !!u.is_protected,
    createdAt: u.created_at,
    lastLoginAt: u.last_login_at,
    lockedUntil: u.locked_until && new Date(u.locked_until).getTime() > Date.now() ? new Date(u.locked_until).toISOString() : null,
  };
}

/** Records a failed sign-in.
 *  `failed_attempts` counts every wrong password since the last successful sign-in (or unlock).
 *  Every `threshold` failures the account is locked; each new lock lasts longer than the last:
 *  it starts at `firstLockMinutes` and steps up through LOCKOUT_OPTIONS (e.g. 2 → 5 → 10 → 20 min …),
 *  capped at the longest option. The Super Admin is never locked. */
export async function bumpLoginFailure(user: CrmUserRow, threshold: number, firstLockMinutes: number) {
  const total = Number(user.failed_attempts || 0) + 1;
  const isSuperAdmin = user.role === "SUPER_ADMIN";
  const attemptInRound = ((total - 1) % threshold) + 1; // 1..threshold
  const remaining = threshold - attemptInRound; // attempts left before lock
  const locked = !isSuperAdmin && remaining === 0;
  const lockNumber = Math.floor(total / threshold); // 1st, 2nd, 3rd lock …
  let lockMinutes = 0;
  let lockedUntil: string | null = null;
  if (locked) {
    const minutesList = LOCKOUT_OPTIONS.map((o) => o.minutes);
    const startIdx = Math.max(0, minutesList.indexOf(firstLockMinutes));
    lockMinutes = minutesList[Math.min(startIdx + lockNumber - 1, minutesList.length - 1)]!;
    lockedUntil = new Date(Date.now() + lockMinutes * 60 * 1000).toISOString();
  }
  const patch: { failed_attempts: number; locked_until?: string | null } = { failed_attempts: total };
  if (locked) patch.locked_until = lockedUntil;
  await dbUpdate("crm_users", [{ col: "id", op: "eq", value: user.id }], patch);
  return { total, attemptInRound, remaining, locked, lockNumber, lockMinutes, lockedUntil };
}
