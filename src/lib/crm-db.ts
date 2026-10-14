// Server-only data access for the CRM. Works against Supabase REST (production)
// or a direct PostgreSQL pool (local development) — same API for both.
import { getPool, getSupabaseConfig, initDb } from "./db";

type Primitive = string | number | boolean;
export type Filter =
  | { col: string; op: "eq"; value: Primitive }
  | { col: string; op: "in"; value: Primitive[] }
  | { col: string; op: "is_null" }
  | { col: string; op: "not_null" };

const IDENT = /^[a-z_][a-z0-9_]*$/;
function ident(name: string) {
  if (!IDENT.test(name)) throw new Error(`Invalid identifier: ${name}`);
  return name;
}

function restFilters(filters: Filter[]) {
  return filters.map((f) => {
    const c = ident(f.col);
    if (f.op === "eq") return `${c}=eq.${encodeURIComponent(String(f.value))}`;
    if (f.op === "in")
      return `${c}=in.(${f.value.map((v) => `"${encodeURIComponent(String(v).replace(/"/g, ""))}"`).join(",")})`;
    if (f.op === "is_null") return `${c}=is.null`;
    return `${c}=not.is.null`;
  });
}

function pgWhere(filters: Filter[], startIndex = 1) {
  const parts: string[] = [];
  const params: unknown[] = [];
  let i = startIndex;
  for (const f of filters) {
    const c = ident(f.col);
    if (f.op === "eq") {
      parts.push(`${c} = $${i++}`);
      params.push(f.value);
    } else if (f.op === "in") {
      parts.push(`${c} = ANY($${i++})`);
      params.push(f.value);
    } else if (f.op === "is_null") parts.push(`${c} IS NULL`);
    else parts.push(`${c} IS NOT NULL`);
  }
  return { sql: parts.length ? ` WHERE ${parts.join(" AND ")}` : "", params };
}

async function rest(endpoint: string, init: RequestInit = {}) {
  const cfg = getSupabaseConfig()!;
  const res = await fetch(`${cfg.url}/rest/v1/${endpoint}`, {
    ...init,
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...((init.headers as Record<string, string>) || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    if (text.includes("PGRST205") || text.includes("PGRST204") || text.includes("42703")) {
      throw new Error(
        "CRM database is not set up yet: run supabase-schema.sql in Supabase → SQL Editor (same project as SUPABASE_URL), then try again.",
      );
    }
    throw new Error(`Database error (${res.status}): ${text}`);
  }
  return text ? JSON.parse(text) : [];
}

async function pool() {
  await initDb();
  const p = await getPool();
  if (!p) throw new Error("No database configured. Set SUPABASE_URL + SUPABASE_API_KEY or DATABASE_URL.");
  return p;
}

export async function dbSelect<T = any>(
  table: string,
  opts: { filters?: Filter[]; order?: { col: string; desc?: boolean }; columns?: string[]; limit?: number } = {},
): Promise<T[]> {
  const t = ident(table);
  const filters = opts.filters || [];
  const cols = opts.columns?.length ? opts.columns.map(ident) : null;
  if (getSupabaseConfig()) {
    const qs = [`select=${cols ? cols.join(",") : "*"}`, ...restFilters(filters)];
    if (opts.order) qs.push(`order=${ident(opts.order.col)}.${opts.order.desc ? "desc" : "asc"}`);
    if (opts.limit) qs.push(`limit=${opts.limit}`);
    return (await rest(`${t}?${qs.join("&")}`)) as T[];
  }
  const p = await pool();
  const w = pgWhere(filters);
  let sql = `SELECT ${cols ? cols.join(", ") : "*"} FROM ${t}${w.sql}`;
  if (opts.order) sql += ` ORDER BY ${ident(opts.order.col)} ${opts.order.desc ? "DESC" : "ASC"}`;
  if (opts.limit) sql += ` LIMIT ${Number(opts.limit)}`;
  const res = await p.query(sql, w.params);
  return res.rows as T[];
}

export async function dbInsert<T = any>(table: string, row: Record<string, unknown>): Promise<T> {
  const t = ident(table);
  if (getSupabaseConfig()) {
    const rows = await rest(t, { method: "POST", body: JSON.stringify(row) });
    return (Array.isArray(rows) ? rows[0] : rows) as T;
  }
  const p = await pool();
  const keys = Object.keys(row).map(ident);
  const res = await p.query(
    `INSERT INTO ${t} (${keys.join(", ")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING *`,
    keys.map((k) => row[k]),
  );
  return res.rows[0] as T;
}

/** Insert or replace by primary key `key` column. */
export async function dbUpsert(table: string, row: Record<string, unknown>, keyCol: string): Promise<void> {
  const t = ident(table);
  if (getSupabaseConfig()) {
    await rest(`${t}?on_conflict=${ident(keyCol)}`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(row),
    });
    return;
  }
  const p = await pool();
  const keys = Object.keys(row).map(ident);
  const updates = keys.filter((k) => k !== keyCol).map((k) => `${k} = EXCLUDED.${k}`);
  await p.query(
    `INSERT INTO ${t} (${keys.join(", ")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(", ")})
     ON CONFLICT (${ident(keyCol)}) DO UPDATE SET ${updates.join(", ")}`,
    keys.map((k) => row[k]),
  );
}

export async function dbUpdate<T = any>(table: string, filters: Filter[], patch: Record<string, unknown>): Promise<T[]> {
  const t = ident(table);
  if (!filters.length) throw new Error("Refusing to update without a filter");
  if (getSupabaseConfig()) {
    return (await rest(`${t}?${restFilters(filters).join("&")}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    })) as T[];
  }
  const p = await pool();
  const keys = Object.keys(patch).map(ident);
  const set = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
  const w = pgWhere(filters, keys.length + 1);
  const res = await p.query(`UPDATE ${t} SET ${set}${w.sql} RETURNING *`, [...keys.map((k) => patch[k]), ...w.params]);
  return res.rows as T[];
}

/** Hard delete. Returns number of rows removed from the database. */
export async function dbDelete(table: string, filters: Filter[]): Promise<number> {
  const t = ident(table);
  if (!filters.length) throw new Error("Refusing to delete without a filter (use not_null on the id to delete all)");
  if (getSupabaseConfig()) {
    const rows = await rest(`${t}?${restFilters(filters).join("&")}`, {
      method: "DELETE",
      headers: { Prefer: "return=representation" },
    });
    return Array.isArray(rows) ? rows.length : 0;
  }
  const p = await pool();
  const w = pgWhere(filters);
  const res = await p.query(`DELETE FROM ${t}${w.sql}`, w.params);
  return res.rowCount ?? 0;
}

export function newId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Activity log
// ---------------------------------------------------------------------------
export type ActivityCategory = "LEADS" | "ORDERS" | "USER_ACTIVITY" | "SETTINGS";

export async function logActivity(entry: {
  title: string;
  category: ActivityCategory;
  actorEmail: string;
  description: string;
  leadId?: string;
}) {
  const row: Record<string, unknown> = {
    id: newId("act"),
    title: entry.title,
    category: entry.category,
    actor_email: entry.actorEmail,
    description: entry.description,
    created_at: new Date().toISOString(),
  };
  try {
    await dbInsert("crm_activity_logs", entry.leadId ? { ...row, lead_id: entry.leadId } : row);
  } catch (e) {
    // Older schema without lead_id: still record the entry.
    if (entry.leadId) {
      try {
        await dbInsert("crm_activity_logs", row);
        return;
      } catch {
        /* fall through */
      }
    }
    console.warn("Activity log write failed:", e);
  }
}

/** Update that tolerates optional columns not yet added to the database:
 *  retries with only the required fields if the first attempt fails. */
export async function dbUpdateWithOptional(
  table: string,
  filters: Filter[],
  required: Record<string, unknown>,
  optional: Record<string, unknown>,
) {
  if (!Object.keys(optional).length) return dbUpdate(table, filters, required);
  try {
    return await dbUpdate(table, filters, { ...required, ...optional });
  } catch (e) {
    console.warn(`Optional columns not available on ${table}, retrying without them:`, (e as Error).message);
    if (!Object.keys(required).length) return [];
    return dbUpdate(table, filters, required);
  }
}

/** Insert that tolerates optional columns not yet added to the database. */
export async function dbInsertWithOptional<T = any>(table: string, required: Record<string, unknown>, optional: Record<string, unknown>): Promise<T> {
  try {
    return await dbInsert<T>(table, { ...required, ...optional });
  } catch (e) {
    console.warn(`Optional columns not available on ${table}, retrying without them:`, (e as Error).message);
    return dbInsert<T>(table, required);
  }
}

// ---------------------------------------------------------------------------
// Settings key/value
// ---------------------------------------------------------------------------
export async function getSetting<T = unknown>(key: string): Promise<T | null> {
  const rows = await dbSelect<{ value: string }>("crm_settings", { filters: [{ col: "key", op: "eq", value: key }] });
  if (!rows[0]) return null;
  try {
    return JSON.parse(rows[0].value) as T;
  } catch {
    return null;
  }
}

export async function setSetting(key: string, value: unknown) {
  await dbUpsert("crm_settings", { key, value: JSON.stringify(value), updated_at: new Date().toISOString() }, "key");
}
