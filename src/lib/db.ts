export type LeadStatus = "New" | "Contacted" | "In Progress" | "Hold" | "Closed";
export type ProjectStatus = "Hold" | "In Progress" | "Delivered";

export interface Lead {
  id: string;
  source: "Contact Form" | "Popup Modal" | "USA - Contact Form" | "USA - Popup Modal" | "Manual" | "Meta" | string;
  name: string;
  phone: string;
  email?: string;
  video_type: string;
  video_quantity?: number | string;
  business: string;
  location?: string;
  industry?: string;
  requirement?: string;
  additional?: string;
  created_at: string;
  status: LeadStatus;
  project_status?: ProjectStatus;
  notes?: string;
  closed_by?: string;
  closed_at?: string;
  delivery_date?: string;
  delivered_at?: string;
  meeting_date?: string;
  meeting_time?: string;
  meeting_status?: string;
  meeting_link?: string;
  meeting_type?: string;
  assigned_admin?: string;
  deleted_at?: string | null;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: "super_admin" | "admin";
  status: "active" | "inactive";
  created_at: string;
  last_login_at?: string;
}

export interface ActivityLog {
  id: string;
  lead_id?: string;
  action: string;
  details: string;
  performed_by: string;
  user_role: string;
  created_at: string;
}

export interface LoginLog {
  id: string;
  email: string;
  role: string;
  ip_address: string;
  location?: string;
  user_agent: string;
  created_at: string;
  status: "success" | "failed";
}

export interface CalendlyMeeting {
  id: string;
  lead_id?: string;
  client_name: string;
  email: string;
  phone?: string;
  meeting_date: string;
  meeting_time: string;
  meeting_status: "scheduled" | "upcoming" | "completed" | "rescheduled" | "cancelled" | string;
  meeting_link: string;
  meeting_type?: string;
  assigned_admin?: string;
  notes?: string;
  created_at: string;
  cancelled_at?: string;
}

export interface CRMNotification {
  id: string;
  type:
    | "meeting_new"
    | "meeting_upcoming"
    | "meeting_rescheduled"
    | "meeting_cancelled"
    | "meeting_completed"
    | "lead_new"
    | "lead_meta"
    | "lead_manual"
    | "lead_status"
    | "lead_closed"
    | "project_status"
    | "project_delivered"
    | string;
  title: string;
  message: string;
  entity_id?: string;
  actor?: string;
  is_read: boolean;
  created_at: string;
}

export type PaymentStatus = "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED" | "REFUNDED";

export interface Order {
  id: string;
  paypal_order_id: string;
  paypal_capture_id?: string | undefined;
  customer_name: string;
  customer_email: string;
  customer_phone?: string | undefined;
  customer_company?: string | undefined;
  item_type: "individual" | "package" | "setup" | string;
  item_id: string;
  item_name: string;
  amount: number;
  currency: string;
  payment_status: PaymentStatus;
  paypal_status?: string | undefined;
  raw_details?: string | undefined;
  created_at: string;
  updated_at: string;
}

let pgPool: any = null;

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_API_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_API_KEY;
  if (url && key) {
    return { url, key };
  }
  return null;
}

// 1. HTTP REST Adapter for Supabase (Guaranteed 100% cloud delivery without TCP/SSL port blocks)
async function supabaseRest(endpoint: string, options: RequestInit = {}) {
  const config = getSupabaseConfig();
  if (!config) return null;
  const res = await fetch(`${config.url}/rest/v1/${endpoint}`, {
    ...options,
    headers: {
      "apikey": config.key,
      "Authorization": `Bearer ${config.key}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Supabase REST Error (${res.status}): ${txt}`);
  }
  const txt = await res.text();
  if (!txt || txt.trim() === "") return [];
  try {
    return JSON.parse(txt);
  } catch {
    return [];
  }
}

// 2. Direct PostgreSQL Pool (For localhost development or direct pg connection)
async function getPool() {
  if (!pgPool) {
    const pg = await import("pg");
    const Pool = pg.default?.Pool || pg.Pool;
    const connectionString = process.env.DATABASE_URL || process.env.VITE_DATABASE_URL;
    if (!connectionString) return null;

    let cleanConnectionString = connectionString.trim();
    const isRemoteDb =
      cleanConnectionString.includes("supabase.co") ||
      cleanConnectionString.includes("neon.tech") ||
      cleanConnectionString.includes("pooler.supabase.com") ||
      !cleanConnectionString.includes("localhost");

    if (cleanConnectionString.includes("?sslmode=")) {
      cleanConnectionString = cleanConnectionString.split("?sslmode=")[0];
    } else if (cleanConnectionString.includes("&sslmode=")) {
      cleanConnectionString = cleanConnectionString.replace(/&sslmode=[^&]+/, "");
    }

    pgPool = new Pool({
      connectionString: cleanConnectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: isRemoteDb ? { rejectUnauthorized: false } : undefined,
    });
  }
  return pgPool;
}

let isInitialized = false;

export async function initDb() {
  if (isInitialized) return;
  try {
    const pool = await getPool();
    if (pool) {
      const client = await pool.connect();
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS leads (
            id VARCHAR(64) PRIMARY KEY,
            source VARCHAR(64) NOT NULL,
            name VARCHAR(255) NOT NULL,
            phone VARCHAR(64) NOT NULL,
            email VARCHAR(255),
            video_type VARCHAR(128) NOT NULL,
            video_quantity VARCHAR(64),
            business VARCHAR(255) NOT NULL,
            location VARCHAR(255),
            industry VARCHAR(128),
            requirement TEXT,
            additional TEXT,
            status VARCHAR(32) DEFAULT 'New',
            project_status VARCHAR(32) DEFAULT 'In Progress',
            notes TEXT,
            closed_by VARCHAR(255),
            closed_at TIMESTAMP WITH TIME ZONE,
            delivery_date VARCHAR(64),
            delivered_at TIMESTAMP WITH TIME ZONE,
            meeting_date VARCHAR(64),
            meeting_time VARCHAR(64),
            meeting_status VARCHAR(64),
            meeting_link TEXT,
            meeting_type VARCHAR(128),
            assigned_admin VARCHAR(255),
            deleted_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );

          ALTER TABLE leads ADD COLUMN IF NOT EXISTS video_quantity VARCHAR(64);
          ALTER TABLE leads ADD COLUMN IF NOT EXISTS project_status VARCHAR(32) DEFAULT 'In Progress';
          ALTER TABLE leads ADD COLUMN IF NOT EXISTS notes TEXT;
          ALTER TABLE leads ADD COLUMN IF NOT EXISTS closed_by VARCHAR(255);
          ALTER TABLE leads ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE;
          ALTER TABLE leads ADD COLUMN IF NOT EXISTS delivery_date VARCHAR(64);
          ALTER TABLE leads ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE;
          ALTER TABLE leads ADD COLUMN IF NOT EXISTS meeting_date VARCHAR(64);
          ALTER TABLE leads ADD COLUMN IF NOT EXISTS meeting_time VARCHAR(64);
          ALTER TABLE leads ADD COLUMN IF NOT EXISTS meeting_status VARCHAR(64);
          ALTER TABLE leads ADD COLUMN IF NOT EXISTS meeting_link TEXT;
          ALTER TABLE leads ADD COLUMN IF NOT EXISTS meeting_type VARCHAR(128);
          ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_admin VARCHAR(255);
          ALTER TABLE leads ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

          CREATE TABLE IF NOT EXISTS admin_users (
            id VARCHAR(64) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            role VARCHAR(32) DEFAULT 'admin',
            status VARCHAR(32) DEFAULT 'active',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            last_login_at TIMESTAMP WITH TIME ZONE
          );

          CREATE TABLE IF NOT EXISTS activity_logs (
            id VARCHAR(64) PRIMARY KEY,
            lead_id VARCHAR(64),
            action VARCHAR(128) NOT NULL,
            details TEXT,
            performed_by VARCHAR(255) NOT NULL,
            user_role VARCHAR(64),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE IF NOT EXISTS login_logs (
            id VARCHAR(64) PRIMARY KEY,
            email VARCHAR(255) NOT NULL,
            role VARCHAR(64),
            ip_address VARCHAR(128),
            location VARCHAR(255),
            user_agent TEXT,
            status VARCHAR(32) DEFAULT 'success',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE IF NOT EXISTS calendly_meetings (
            id VARCHAR(64) PRIMARY KEY,
            lead_id VARCHAR(64),
            client_name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL,
            phone VARCHAR(64),
            meeting_date VARCHAR(64) NOT NULL,
            meeting_time VARCHAR(64) NOT NULL,
            meeting_status VARCHAR(64) DEFAULT 'scheduled',
            meeting_link TEXT,
            meeting_type VARCHAR(128),
            assigned_admin VARCHAR(255),
            notes TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE IF NOT EXISTS crm_notifications (
            id VARCHAR(64) PRIMARY KEY,
            type VARCHAR(64) NOT NULL,
            title VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            entity_id VARCHAR(64),
            actor VARCHAR(255),
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE IF NOT EXISTS orders (
            id VARCHAR(64) PRIMARY KEY,
            paypal_order_id VARCHAR(128) NOT NULL UNIQUE,
            paypal_capture_id VARCHAR(128),
            customer_name VARCHAR(255) NOT NULL,
            customer_email VARCHAR(255) NOT NULL,
            customer_phone VARCHAR(64),
            customer_company VARCHAR(255),
            item_type VARCHAR(64) NOT NULL,
            item_id VARCHAR(128) NOT NULL,
            item_name VARCHAR(255) NOT NULL,
            amount NUMERIC(10, 2) NOT NULL,
            currency VARCHAR(16) DEFAULT 'USD',
            payment_status VARCHAR(32) DEFAULT 'PENDING',
            paypal_status VARCHAR(64),
            raw_details TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `);
        isInitialized = true;
      } finally {
        client.release();
      }
    }
  } catch (error) {
    console.warn("PostgreSQL init warning:", error);
  }
}

export async function saveLead(data: {
  source: string;
  name: string;
  phone: string;
  email?: string;
  videoType: string;
  videoQuantity?: number | string;
  business: string;
  location?: string;
  industry?: string;
  requirement?: string;
  additional?: string;
  status?: LeadStatus;
  projectStatus?: ProjectStatus;
  notes?: string;
  deliveryDate?: string;
  meetingDate?: string;
  meetingTime?: string;
  meetingLink?: string;
  assignedAdmin?: string;
}): Promise<Lead> {
  const id = `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const status: LeadStatus = data.status || "New";
  const projectStatus: ProjectStatus = data.projectStatus || "In Progress";
  const now = new Date().toISOString();

  const record: Lead = {
    id,
    source: data.source,
    name: data.name,
    phone: data.phone,
    email: data.email || undefined,
    video_type: data.videoType,
    video_quantity: data.videoQuantity || undefined,
    business: data.business,
    location: data.location || undefined,
    industry: data.industry || undefined,
    requirement: data.requirement || undefined,
    additional: data.additional || undefined,
    status,
    project_status: projectStatus,
    notes: data.notes || undefined,
    delivery_date: data.deliveryDate || undefined,
    meeting_date: data.meetingDate || undefined,
    meeting_time: data.meetingTime || undefined,
    meeting_link: data.meetingLink || undefined,
    assigned_admin: data.assignedAdmin || undefined,
    created_at: now,
  };

  // Strategy A: Supabase REST
  if (getSupabaseConfig()) {
    try {
      const result = await supabaseRest("leads", {
        method: "POST",
        body: JSON.stringify({
          id: record.id,
          source: record.source,
          name: record.name,
          phone: record.phone,
          email: record.email || null,
          video_type: record.video_type,
          video_quantity: record.video_quantity || null,
          business: record.business,
          location: record.location || null,
          industry: record.industry || null,
          requirement: record.requirement || null,
          additional: record.additional || null,
          status: record.status,
          project_status: record.project_status || "In Progress",
          notes: record.notes || null,
          delivery_date: record.delivery_date || null,
          meeting_date: record.meeting_date || null,
          meeting_time: record.meeting_time || null,
          meeting_link: record.meeting_link || null,
          assigned_admin: record.assigned_admin || null,
          created_at: record.created_at,
        }),
      });
      if (Array.isArray(result) && result.length > 0) {
        return result[0];
      }
      return record;
    } catch (supabaseError) {
      console.warn("Supabase REST failed, falling back to PostgreSQL pool:", supabaseError);
    }
  }

  // Strategy B: PostgreSQL pool
  await initDb();
  const pool = await getPool();
  if (pool) {
    const res = await pool.query(
      `INSERT INTO leads (id, source, name, phone, email, video_type, video_quantity, business, location, industry, requirement, additional, status, project_status, notes, delivery_date, meeting_date, meeting_time, meeting_link, assigned_admin, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW())
       RETURNING *`,
      [
        id,
        data.source,
        data.name,
        data.phone,
        data.email || null,
        data.videoType,
        data.videoQuantity ? String(data.videoQuantity) : null,
        data.business,
        data.location || null,
        data.industry || null,
        data.requirement || null,
        data.additional || null,
        status,
        projectStatus,
        data.notes || null,
        data.deliveryDate || null,
        data.meetingDate || null,
        data.meetingTime || null,
        data.meetingLink || null,
        data.assignedAdmin || null,
      ]
    );
    return res.rows[0];
  }

  return record;
}

export async function getLeads(includeDeleted = false): Promise<Lead[]> {
  // Strategy A: Supabase REST
  if (getSupabaseConfig()) {
    try {
      const endpoint = includeDeleted
        ? "leads?select=*&order=created_at.desc"
        : "leads?deleted_at=is.null&select=*&order=created_at.desc";
      const rows = await supabaseRest(endpoint);
      if (Array.isArray(rows)) {
        return rows as Lead[];
      }
    } catch (err) {
      console.warn("Supabase REST getLeads fallback:", err);
    }
  }

  // Strategy B: PostgreSQL pool
  await initDb();
  try {
    const pool = await getPool();
    if (pool) {
      const query = includeDeleted
        ? "SELECT * FROM leads ORDER BY created_at DESC"
        : "SELECT * FROM leads WHERE deleted_at IS NULL ORDER BY created_at DESC";
      const res = await pool.query(query);
      return res.rows;
    }
  } catch (error) {
    console.error("PostgreSQL Select error:", error);
  }
  return [];
}

export async function updateLead(id: string, updates: Partial<Lead>): Promise<boolean> {
  if (getSupabaseConfig()) {
    try {
      await supabaseRest(`leads?id=eq.${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      return true;
    } catch (err) {
      console.warn("Supabase REST updateLead fallback:", err);
    }
  }

  await initDb();
  try {
    const pool = await getPool();
    if (pool) {
      const fields = Object.keys(updates);
      if (fields.length === 0) return true;
      const setClauses = fields.map((f, i) => `${f} = $${i + 1}`).join(", ");
      const values = fields.map((f) => (updates as any)[f]);
      const res = await pool.query(`UPDATE leads SET ${setClauses} WHERE id = $${fields.length + 1}`, [
        ...values,
        id,
      ]);
      return (res.rowCount ?? 0) > 0;
    }
  } catch (error) {
    console.error("PostgreSQL updateLead error:", error);
  }
  return false;
}

export async function updateLeadStatus(
  id: string,
  status: Lead["status"],
  meta?: { closed_by?: string; delivery_date?: string; closed_at?: string }
): Promise<boolean> {
  const payload: Partial<Lead> = { status };
  if (status === "Closed") {
    payload.closed_by = meta?.closed_by || "Admin";
    payload.closed_at = meta?.closed_at || new Date().toISOString();
    if (meta?.delivery_date) {
      payload.delivery_date = meta.delivery_date;
    }
  }
  return updateLead(id, payload);
}

export async function updateProjectStatus(
  id: string,
  project_status: ProjectStatus,
  delivery_date?: string
): Promise<boolean> {
  const payload: Partial<Lead> = { project_status };
  if (project_status === "Delivered") {
    payload.delivered_at = new Date().toISOString();
    if (delivery_date) {
      payload.delivery_date = delivery_date;
    }
  }
  return updateLead(id, payload);
}

export async function softDeleteLead(id: string): Promise<boolean> {
  return updateLead(id, { deleted_at: new Date().toISOString() });
}

export async function restoreLead(id: string): Promise<boolean> {
  return updateLead(id, { deleted_at: null });
}

export async function permanentDeleteLead(id: string): Promise<boolean> {
  let ok = false;
  if (getSupabaseConfig()) {
    try {
      await supabaseRest(`leads?id=eq.${id}`, {
        method: "DELETE",
      });
      ok = true;
    } catch (err) {
      console.warn("Supabase REST delete fallback:", err);
    }
  }

  await initDb();
  try {
    const pool = await getPool();
    if (pool) {
      const res = await pool.query("DELETE FROM leads WHERE id = $1", [id]);
      if ((res.rowCount ?? 0) > 0) ok = true;
    }
  } catch (error) {
    console.error("PostgreSQL Delete error:", error);
  }
  return ok;
}

export async function emptyRecycleBin(): Promise<number> {
  let deletedCount = 0;
  if (getSupabaseConfig()) {
    try {
      await supabaseRest(`leads?deleted_at=not.is.null`, { method: "DELETE" });
    } catch (err) {
      console.warn("Supabase emptyRecycleBin fallback:", err);
    }
  }

  await initDb();
  try {
    const pool = await getPool();
    if (pool) {
      const res = await pool.query("DELETE FROM leads WHERE deleted_at IS NOT NULL");
      deletedCount = res.rowCount ?? 0;
    }
  } catch (error) {
    console.error("PostgreSQL emptyRecycleBin error:", error);
  }
  return deletedCount;
}

// ==========================================
// ACTIVITY LOGS
// ==========================================
export async function addActivityLog(data: {
  lead_id?: string;
  action: string;
  details: string;
  performed_by: string;
  user_role: string;
}): Promise<ActivityLog> {
  const id = `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const record: ActivityLog = {
    id,
    lead_id: data.lead_id || undefined,
    action: data.action,
    details: data.details,
    performed_by: data.performed_by,
    user_role: data.user_role,
    created_at: now,
  };

  if (getSupabaseConfig()) {
    try {
      await supabaseRest("activity_logs", {
        method: "POST",
        body: JSON.stringify(record),
      });
      return record;
    } catch (e) {
      console.warn("Supabase activity_log fallback:", e);
    }
  }

  await initDb();
  try {
    const pool = await getPool();
    if (pool) {
      await pool.query(
        "INSERT INTO activity_logs (id, lead_id, action, details, performed_by, user_role, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW())",
        [id, data.lead_id || null, data.action, data.details, data.performed_by, data.user_role]
      );
    }
  } catch (err) {
    console.error("PostgreSQL addActivityLog error:", err);
  }
  return record;
}

export async function getActivityLogs(limit = 100): Promise<ActivityLog[]> {
  if (getSupabaseConfig()) {
    try {
      const rows = await supabaseRest(`activity_logs?select=*&order=created_at.desc&limit=${limit}`);
      if (Array.isArray(rows)) return rows as ActivityLog[];
    } catch (e) {
      console.warn("Supabase getActivityLogs fallback:", e);
    }
  }

  await initDb();
  try {
    const pool = await getPool();
    if (pool) {
      const res = await pool.query("SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT $1", [limit]);
      return res.rows;
    }
  } catch (err) {
    console.error("PostgreSQL getActivityLogs error:", err);
  }
  return [];
}

// ==========================================
// LOGIN & SECURITY LOGS
// ==========================================
export async function addLoginLog(data: {
  email: string;
  role: string;
  ip_address: string;
  location?: string;
  user_agent: string;
  status?: "success" | "failed";
}): Promise<LoginLog> {
  const id = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const record: LoginLog = {
    id,
    email: data.email,
    role: data.role,
    ip_address: data.ip_address,
    location: data.location || "Unknown",
    user_agent: data.user_agent,
    status: data.status || "success",
    created_at: now,
  };

  if (getSupabaseConfig()) {
    try {
      await supabaseRest("login_logs", {
        method: "POST",
        body: JSON.stringify(record),
      });
      return record;
    } catch (e) {
      console.warn("Supabase login_logs fallback:", e);
    }
  }

  await initDb();
  try {
    const pool = await getPool();
    if (pool) {
      await pool.query(
        "INSERT INTO login_logs (id, email, role, ip_address, location, user_agent, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())",
        [id, data.email, data.role, data.ip_address, data.location || null, data.user_agent, data.status || "success"]
      );
    }
  } catch (err) {
    console.error("PostgreSQL addLoginLog error:", err);
  }
  return record;
}

export async function getLoginLogs(limit = 100): Promise<LoginLog[]> {
  if (getSupabaseConfig()) {
    try {
      const rows = await supabaseRest(`login_logs?select=*&order=created_at.desc&limit=${limit}`);
      if (Array.isArray(rows)) return rows as LoginLog[];
    } catch (e) {
      console.warn("Supabase getLoginLogs fallback:", e);
    }
  }

  await initDb();
  try {
    const pool = await getPool();
    if (pool) {
      const res = await pool.query("SELECT * FROM login_logs ORDER BY created_at DESC LIMIT $1", [limit]);
      return res.rows;
    }
  } catch (err) {
    console.error("PostgreSQL getLoginLogs error:", err);
  }
  return [];
}

// ==========================================
// ADMIN USER MANAGEMENT (SUPER ADMIN)
// ==========================================
export async function getAdminUsers(): Promise<AdminUser[]> {
  if (getSupabaseConfig()) {
    try {
      const rows = await supabaseRest("admin_users?select=*&order=created_at.desc");
      if (Array.isArray(rows)) return rows as AdminUser[];
    } catch (e) {
      console.warn("Supabase getAdminUsers fallback:", e);
    }
  }

  await initDb();
  try {
    const pool = await getPool();
    if (pool) {
      const res = await pool.query("SELECT id, name, email, role, status, created_at, last_login_at FROM admin_users ORDER BY created_at DESC");
      return res.rows;
    }
  } catch (err) {
    console.error("PostgreSQL getAdminUsers error:", err);
  }
  return [];
}

export async function saveAdminUser(user: {
  name: string;
  email: string;
  password: string;
  role: "super_admin" | "admin";
  status?: "active" | "inactive";
}): Promise<AdminUser> {
  const id = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const record: AdminUser = {
    id,
    name: user.name,
    email: user.email.toLowerCase().trim(),
    password: user.password,
    role: user.role,
    status: user.status || "active",
    created_at: now,
  };

  if (getSupabaseConfig()) {
    try {
      const rows = await supabaseRest("admin_users", {
        method: "POST",
        body: JSON.stringify(record),
      });
      if (Array.isArray(rows) && rows[0]) return rows[0];
      return record;
    } catch (e) {
      console.warn("Supabase saveAdminUser fallback:", e);
    }
  }

  await initDb();
  try {
    const pool = await getPool();
    if (pool) {
      const res = await pool.query(
        `INSERT INTO admin_users (id, name, email, password, role, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password = EXCLUDED.password, role = EXCLUDED.role, status = EXCLUDED.status
         RETURNING *`,
        [id, record.name, record.email, record.password, record.role, record.status]
      );
      return res.rows[0];
    }
  } catch (err) {
    console.error("PostgreSQL saveAdminUser error:", err);
  }
  return record;
}

export async function updateAdminUserStatus(id: string, status: "active" | "inactive"): Promise<boolean> {
  let ok = false;
  if (getSupabaseConfig()) {
    try {
      await supabaseRest(`admin_users?id=eq.${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      ok = true;
    } catch (e) {
      console.warn("Supabase updateAdminUserStatus fallback:", e);
    }
  }

  await initDb();
  try {
    const pool = await getPool();
    if (pool) {
      const res = await pool.query("UPDATE admin_users SET status = $1 WHERE id = $2", [status, id]);
      if ((res.rowCount ?? 0) > 0) ok = true;
    }
  } catch (err) {
    console.error("PostgreSQL updateAdminUserStatus error:", err);
  }
  return ok;
}

export async function deleteAdminUser(id: string): Promise<boolean> {
  let ok = false;
  if (getSupabaseConfig()) {
    try {
      await supabaseRest(`admin_users?id=eq.${id}`, { method: "DELETE" });
      ok = true;
    } catch (e) {
      console.warn("Supabase deleteAdminUser fallback:", e);
    }
  }

  await initDb();
  try {
    const pool = await getPool();
    if (pool) {
      const res = await pool.query("DELETE FROM admin_users WHERE id = $1", [id]);
      if ((res.rowCount ?? 0) > 0) ok = true;
    }
  } catch (err) {
    console.error("PostgreSQL deleteAdminUser error:", err);
  }
  return ok;
}

// ==========================================
// CALENDLY MEETINGS
// ==========================================
export async function saveCalendlyMeeting(data: {
  lead_id?: string;
  client_name: string;
  email: string;
  phone?: string;
  meeting_date: string;
  meeting_time: string;
  meeting_status?: string;
  meeting_link: string;
  meeting_type?: string;
  assigned_admin?: string;
  notes?: string;
}): Promise<CalendlyMeeting> {
  const id = `meet_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const record: CalendlyMeeting = {
    id,
    lead_id: data.lead_id || undefined,
    client_name: data.client_name,
    email: data.email,
    phone: data.phone || undefined,
    meeting_date: data.meeting_date,
    meeting_time: data.meeting_time,
    meeting_status: (data.meeting_status as any) || "scheduled",
    meeting_link: data.meeting_link,
    meeting_type: data.meeting_type || "Video Strategy Call",
    assigned_admin: data.assigned_admin || undefined,
    notes: data.notes || undefined,
    created_at: now,
  };

  if (getSupabaseConfig()) {
    try {
      // Check for duplicate meeting by email, date, and time
      const existing = await supabaseRest(
        `calendly_meetings?email=eq.${encodeURIComponent(data.email)}&meeting_date=eq.${encodeURIComponent(
          data.meeting_date
        )}&meeting_time=eq.${encodeURIComponent(data.meeting_time)}&select=*`
      );
      if (Array.isArray(existing) && existing.length > 0) {
        const existingMeeting = existing[0];
        const updated = await supabaseRest(`calendly_meetings?id=eq.${existingMeeting.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            meeting_status: data.meeting_status || existingMeeting.meeting_status,
            meeting_link: data.meeting_link || existingMeeting.meeting_link,
            notes: data.notes || existingMeeting.notes,
          }),
        });
        if (Array.isArray(updated) && updated[0]) return updated[0];
        return existingMeeting;
      }

      const rows = await supabaseRest("calendly_meetings", {
        method: "POST",
        body: JSON.stringify(record),
      });
      if (Array.isArray(rows) && rows[0]) return rows[0];
      return record;
    } catch (e) {
      console.warn("Supabase saveCalendlyMeeting fallback:", e);
    }
  }

  await initDb();
  try {
    const pool = await getPool();
    if (pool) {
      const existingRes = await pool.query(
        `SELECT * FROM calendly_meetings WHERE email = $1 AND meeting_date = $2 LIMIT 1`,
        [data.email, data.meeting_date]
      );
      if (existingRes.rows.length > 0) {
        const existingMeeting = existingRes.rows[0];
        const updateRes = await pool.query(
          `UPDATE calendly_meetings 
           SET meeting_status = COALESCE($1, meeting_status), 
               meeting_link = COALESCE($2, meeting_link), 
               meeting_time = COALESCE($3, meeting_time), 
               notes = COALESCE($4, notes),
               client_name = COALESCE($5, client_name)
           WHERE id = $6 RETURNING *`,
          [
            data.meeting_status || null,
            data.meeting_link || null,
            data.meeting_time || null,
            data.notes || null,
            data.client_name || null,
            existingMeeting.id,
          ]
        );
        return updateRes.rows[0] || existingMeeting;
      }

      const res = await pool.query(
        `INSERT INTO calendly_meetings (id, lead_id, client_name, email, phone, meeting_date, meeting_time, meeting_status, meeting_link, meeting_type, assigned_admin, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
         RETURNING *`,
        [
          id,
          data.lead_id || null,
          data.client_name,
          data.email,
          data.phone || null,
          data.meeting_date,
          data.meeting_time,
          data.meeting_status || "scheduled",
          data.meeting_link,
          data.meeting_type || "Video Strategy Call",
          data.assigned_admin || null,
          data.notes || null,
        ]
      );
      return res.rows[0];
    }
  } catch (err) {
    console.error("PostgreSQL saveCalendlyMeeting error:", err);
  }
  return record;
}

export async function getCalendlyMeetings(): Promise<CalendlyMeeting[]> {
  if (getSupabaseConfig()) {
    try {
      const rows = await supabaseRest("calendly_meetings?select=*&order=created_at.desc");
      if (Array.isArray(rows)) return rows as CalendlyMeeting[];
    } catch (e) {
      console.warn("Supabase getCalendlyMeetings fallback:", e);
    }
  }

  await initDb();
  try {
    const pool = await getPool();
    if (pool) {
      const res = await pool.query("SELECT * FROM calendly_meetings ORDER BY created_at DESC");
      return res.rows;
    }
  } catch (err) {
    console.error("PostgreSQL getCalendlyMeetings error:", err);
  }
  return [];
}

export async function updateCalendlyMeetingStatus(
  id: string,
  status: string,
  notes?: string,
  cancelled_at?: string
): Promise<boolean> {
  const cancelTimestamp = status === "cancelled" ? (cancelled_at || new Date().toISOString()) : null;
  let ok = false;
  if (getSupabaseConfig()) {
    try {
      const updateData: any = { meeting_status: status };
      if (notes) updateData.notes = notes;
      if (cancelTimestamp) updateData.cancelled_at = cancelTimestamp;
      await supabaseRest(`calendly_meetings?id=eq.${id}`, {
        method: "PATCH",
        body: JSON.stringify(updateData),
      });
      ok = true;
    } catch (e) {
      console.warn("Supabase updateCalendlyMeetingStatus fallback:", e);
    }
  }

  await initDb();
  try {
    const pool = await getPool();
    if (pool) {
      if (notes) {
        await pool.query("UPDATE calendly_meetings SET meeting_status = $1, notes = $2, cancelled_at = $3 WHERE id = $4", [status, notes, cancelTimestamp, id]);
      } else {
        await pool.query("UPDATE calendly_meetings SET meeting_status = $1, cancelled_at = $2 WHERE id = $3", [status, cancelTimestamp, id]);
      }
      ok = true;
    }
  } catch (err) {
    console.error("PostgreSQL updateCalendlyMeetingStatus error:", err);
  }
  return ok;
}

export async function updateCalendlyMeetingDetails(
  id: string,
  updates: Partial<CalendlyMeeting>
): Promise<boolean> {
  if (updates.meeting_status === "cancelled" && !updates.cancelled_at) {
    updates.cancelled_at = new Date().toISOString();
  }
  let ok = false;
  if (getSupabaseConfig()) {
    try {
      await supabaseRest(`calendly_meetings?id=eq.${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      ok = true;
    } catch (e) {
      console.warn("Supabase updateCalendlyMeetingDetails fallback:", e);
    }
  }

  await initDb();
  try {
    const pool = await getPool();
    if (pool) {
      const fields: string[] = [];
      const values: any[] = [];
      let i = 1;
      if (updates.client_name !== undefined) { fields.push(`client_name = $${i++}`); values.push(updates.client_name); }
      if (updates.email !== undefined) { fields.push(`email = $${i++}`); values.push(updates.email); }
      if (updates.phone !== undefined) { fields.push(`phone = $${i++}`); values.push(updates.phone); }
      if (updates.meeting_date !== undefined) { fields.push(`meeting_date = $${i++}`); values.push(updates.meeting_date); }
      if (updates.meeting_time !== undefined) { fields.push(`meeting_time = $${i++}`); values.push(updates.meeting_time); }
      if (updates.meeting_status !== undefined) { fields.push(`meeting_status = $${i++}`); values.push(updates.meeting_status); }
      if (updates.meeting_link !== undefined) { fields.push(`meeting_link = $${i++}`); values.push(updates.meeting_link); }
      if (updates.meeting_type !== undefined) { fields.push(`meeting_type = $${i++}`); values.push(updates.meeting_type); }
      if (updates.assigned_admin !== undefined) { fields.push(`assigned_admin = $${i++}`); values.push(updates.assigned_admin); }
      if (updates.notes !== undefined) { fields.push(`notes = $${i++}`); values.push(updates.notes); }
      if (updates.cancelled_at !== undefined) { fields.push(`cancelled_at = $${i++}`); values.push(updates.cancelled_at); }
      if (fields.length > 0) {
        values.push(id);
        await pool.query(`UPDATE calendly_meetings SET ${fields.join(", ")} WHERE id = $${i}`, values);
      }
      ok = true;
    }
  } catch (err) {
    console.error("PostgreSQL updateCalendlyMeetingDetails error:", err);
  }
  return ok;
}

export async function deleteCalendlyMeeting(id: string): Promise<boolean> {
  let ok = false;
  if (getSupabaseConfig()) {
    try {
      await supabaseRest(`calendly_meetings?id=eq.${id}`, { method: "DELETE" });
      ok = true;
    } catch (e) {
      console.warn("Supabase deleteCalendlyMeeting fallback:", e);
    }
  }

  await initDb();
  try {
    const pool = await getPool();
    if (pool) {
      const res = await pool.query("DELETE FROM calendly_meetings WHERE id = $1", [id]);
      if ((res.rowCount ?? 0) > 0) ok = true;
    }
  } catch (err) {
    console.error("PostgreSQL deleteCalendlyMeeting error:", err);
  }
  return ok;
}

// ==========================================
// CRM NOTIFICATIONS PERSISTENCE
// ==========================================

export async function saveCRMNotification(data: {
  type: string;
  title: string;
  message: string;
  entity_id?: string;
  actor?: string;
}): Promise<CRMNotification> {
  const id = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const record: CRMNotification = {
    id,
    type: data.type,
    title: data.title,
    message: data.message,
    entity_id: data.entity_id,
    actor: data.actor || "System",
    is_read: false,
    created_at: now,
  };

  if (getSupabaseConfig()) {
    try {
      const rows = await supabaseRest("crm_notifications", {
        method: "POST",
        body: JSON.stringify(record),
      });
      if (Array.isArray(rows) && rows[0]) return rows[0] as CRMNotification;
    } catch (e) {
      console.warn("Supabase saveCRMNotification fallback:", e);
    }
  }

  await initDb();
  try {
    const pool = await getPool();
    if (pool) {
      const res = await pool.query(
        `INSERT INTO crm_notifications (id, type, title, message, entity_id, actor, is_read, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         RETURNING *`,
        [id, data.type, data.title, data.message, data.entity_id || null, data.actor || "System", false]
      );
      return res.rows[0];
    }
  } catch (err) {
    console.error("PostgreSQL saveCRMNotification error:", err);
  }
  return record;
}

export async function getCRMNotifications(limit = 50): Promise<CRMNotification[]> {
  if (getSupabaseConfig()) {
    try {
      const rows = await supabaseRest(`crm_notifications?select=*&order=created_at.desc&limit=${limit}`);
      if (Array.isArray(rows)) return rows as CRMNotification[];
    } catch (e) {
      console.warn("Supabase getCRMNotifications fallback:", e);
    }
  }

  await initDb();
  try {
    const pool = await getPool();
    if (pool) {
      const res = await pool.query("SELECT * FROM crm_notifications ORDER BY created_at DESC LIMIT $1", [limit]);
      return res.rows;
    }
  } catch (err) {
    console.error("PostgreSQL getCRMNotifications error:", err);
  }
  return [];
}

export async function markNotificationRead(id: string): Promise<boolean> {
  if (getSupabaseConfig()) {
    try {
      await supabaseRest(`crm_notifications?id=eq.${id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_read: true }),
      });
      return true;
    } catch (e) {
      console.warn("Supabase markNotificationRead fallback:", e);
    }
  }

  await initDb();
  try {
    const pool = await getPool();
    if (pool) {
      await pool.query("UPDATE crm_notifications SET is_read = TRUE WHERE id = $1", [id]);
      return true;
    }
  } catch (err) {
    console.error("PostgreSQL markNotificationRead error:", err);
  }
  return false;
}

export async function markAllNotificationsRead(): Promise<boolean> {
  if (getSupabaseConfig()) {
    try {
      await supabaseRest("crm_notifications?is_read=eq.false", {
        method: "PATCH",
        body: JSON.stringify({ is_read: true }),
      });
      return true;
    } catch (e) {
      console.warn("Supabase markAllNotificationsRead fallback:", e);
    }
  }

  await initDb();
  try {
    const pool = await getPool();
    if (pool) {
      await pool.query("UPDATE crm_notifications SET is_read = TRUE WHERE is_read = FALSE");
      return true;
    }
  } catch (err) {
    console.error("PostgreSQL markAllNotificationsRead error:", err);
  }
  return false;
}

export async function clearNotifications(): Promise<boolean> {
  if (getSupabaseConfig()) {
    try {
      await supabaseRest("crm_notifications", { method: "DELETE" });
      return true;
    } catch (e) {
      console.warn("Supabase clearNotifications fallback:", e);
    }
  }

  await initDb();
  try {
    const pool = await getPool();
    if (pool) {
      await pool.query("DELETE FROM crm_notifications");
      return true;
    }
  } catch (err) {
    console.error("PostgreSQL clearNotifications error:", err);
  }
  return false;
}

// Backward-compatible alias for deleteLead
export async function deleteLead(id: string): Promise<boolean> {
  return softDeleteLead(id);
}

// ==========================================
// ORDERS & PAYPAL PAYMENTS PERSISTENCE
// ==========================================

export async function saveOrder(data: {
  paypalOrderId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | undefined;
  customerCompany?: string | undefined;
  itemType: "individual" | "package" | "setup" | string;
  itemId: string;
  itemName: string;
  amount: number;
  currency?: string | undefined;
  paymentStatus?: PaymentStatus | undefined;
  paypalStatus?: string | undefined;
  rawDetails?: string | undefined;
}): Promise<Order> {
  const id = `order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const status: PaymentStatus = data.paymentStatus || "PENDING";
  const currency = data.currency || "USD";

  const record: Order = {
    id,
    paypal_order_id: data.paypalOrderId,
    customer_name: data.customerName,
    customer_email: data.customerEmail,
    customer_phone: data.customerPhone || undefined,
    customer_company: data.customerCompany || undefined,
    item_type: data.itemType,
    item_id: data.itemId,
    item_name: data.itemName,
    amount: data.amount,
    currency,
    payment_status: status,
    paypal_status: data.paypalStatus || "CREATED",
    raw_details: data.rawDetails || undefined,
    created_at: now,
    updated_at: now,
  };

  // Strategy A: Supabase REST
  if (getSupabaseConfig()) {
    try {
      const result = await supabaseRest("orders", {
        method: "POST",
        body: JSON.stringify({
          id: record.id,
          paypal_order_id: record.paypal_order_id,
          customer_name: record.customer_name,
          customer_email: record.customer_email,
          customer_phone: record.customer_phone || null,
          customer_company: record.customer_company || null,
          item_type: record.item_type,
          item_id: record.item_id,
          item_name: record.item_name,
          amount: record.amount,
          currency: record.currency,
          payment_status: record.payment_status,
          paypal_status: record.paypal_status || null,
          raw_details: record.raw_details || null,
          created_at: record.created_at,
          updated_at: record.updated_at,
        }),
      });
      if (Array.isArray(result) && result.length > 0) {
        return result[0];
      }
      return record;
    } catch (supabaseError) {
      console.warn("Supabase REST saveOrder failed, falling back to PostgreSQL pool:", supabaseError);
    }
  }

  // Strategy B: PostgreSQL Pool
  await initDb();
  const pool = await getPool();
  if (pool) {
    const res = await pool.query(
      `INSERT INTO orders (id, paypal_order_id, customer_name, customer_email, customer_phone, customer_company, item_type, item_id, item_name, amount, currency, payment_status, paypal_status, raw_details, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
       RETURNING *`,
      [
        id,
        record.paypal_order_id,
        record.customer_name,
        record.customer_email,
        record.customer_phone || null,
        record.customer_company || null,
        record.item_type,
        record.item_id,
        record.item_name,
        record.amount,
        record.currency,
        record.payment_status,
        record.paypal_status || null,
        record.raw_details || null,
      ]
    );
    return res.rows[0];
  }

  return record;
}

export async function updateOrderPayment(data: {
  paypalOrderId: string;
  paypalCaptureId?: string | undefined;
  paymentStatus: PaymentStatus;
  paypalStatus?: string | undefined;
  rawDetails?: string | undefined;
}): Promise<Order | null> {
  const now = new Date().toISOString();

  if (getSupabaseConfig()) {
    try {
      const payload: Record<string, any> = {
        payment_status: data.paymentStatus,
        updated_at: now,
      };
      if (data.paypalCaptureId) payload["paypal_capture_id"] = data.paypalCaptureId;
      if (data.paypalStatus) payload["paypal_status"] = data.paypalStatus;
      if (data.rawDetails) payload["raw_details"] = data.rawDetails;

      const rows = await supabaseRest(`orders?paypal_order_id=eq.${data.paypalOrderId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      if (Array.isArray(rows) && rows.length > 0) {
        return rows[0];
      }
    } catch (err) {
      console.warn("Supabase REST updateOrderPayment fallback:", err);
    }
  }

  await initDb();
  try {
    const pool = await getPool();
    if (pool) {
      const res = await pool.query(
        `UPDATE orders
         SET payment_status = $1,
             paypal_capture_id = COALESCE($2, paypal_capture_id),
             paypal_status = COALESCE($3, paypal_status),
             raw_details = COALESCE($4, raw_details),
             updated_at = NOW()
         WHERE paypal_order_id = $5
         RETURNING *`,
        [
          data.paymentStatus,
          data.paypalCaptureId || null,
          data.paypalStatus || null,
          data.rawDetails || null,
          data.paypalOrderId,
        ]
      );
      return res.rows[0] || null;
    }
  } catch (error) {
    console.error("PostgreSQL updateOrderPayment error:", error);
  }
  return null;
}

export async function getOrders(): Promise<Order[]> {
  // Strategy A: Supabase REST
  if (getSupabaseConfig()) {
    try {
      const rows = await supabaseRest("orders?select=*&order=created_at.desc");
      if (Array.isArray(rows)) {
        return rows as Order[];
      }
    } catch (err) {
      console.warn("Supabase REST getOrders fallback:", err);
    }
  }

  // Strategy B: PostgreSQL pool
  await initDb();
  try {
    const pool = await getPool();
    if (pool) {
      const res = await pool.query("SELECT * FROM orders ORDER BY created_at DESC");
      return res.rows.map((r: any) => ({
        ...r,
        amount: typeof r.amount === "string" ? parseFloat(r.amount) : r.amount,
      }));
    }
  } catch (error) {
    console.error("PostgreSQL Select Orders error:", error);
  }
  return [];
}

export async function getOrderById(id: string): Promise<Order | null> {
  return getOrderByAnyId(id);
}

export async function getOrderByAnyId(identifier: string): Promise<Order | null> {
  const cleanId = identifier.trim();
  if (getSupabaseConfig()) {
    try {
      const rows = await supabaseRest(
        `orders?or=(id.eq.${cleanId},paypal_order_id.eq.${cleanId},paypal_capture_id.eq.${cleanId})&select=*&limit=1`
      );
      if (Array.isArray(rows) && rows.length > 0) {
        return rows[0];
      }
    } catch (err) {
      console.warn("Supabase REST getOrderByAnyId fallback:", err);
    }
  }

  await initDb();
  try {
    const pool = await getPool();
    if (pool) {
      const res = await pool.query(
        "SELECT * FROM orders WHERE id = $1 OR paypal_order_id = $1 OR paypal_capture_id = $1 LIMIT 1",
        [cleanId]
      );
      if (res.rows[0]) {
        return {
          ...res.rows[0],
          amount: typeof res.rows[0].amount === "string" ? parseFloat(res.rows[0].amount) : res.rows[0].amount,
        };
      }
    }
  } catch (error) {
    console.error("PostgreSQL getOrderByAnyId error:", error);
  }
  return null;
}

export async function updateOrderStatus(id: string, status: PaymentStatus): Promise<boolean> {
  if (getSupabaseConfig()) {
    try {
      await supabaseRest(`orders?id=eq.${id}`, {
        method: "PATCH",
        body: JSON.stringify({ payment_status: status, updated_at: new Date().toISOString() }),
      });
      return true;
    } catch (err) {
      console.warn("Supabase REST updateOrderStatus fallback:", err);
    }
  }

  await initDb();
  try {
    const pool = await getPool();
    if (pool) {
      const res = await pool.query("UPDATE orders SET payment_status = $1, updated_at = NOW() WHERE id = $2", [status, id]);
      return (res.rowCount ?? 0) > 0;
    }
  } catch (error) {
    console.error("PostgreSQL updateOrderStatus error:", error);
  }
  return false;
}

export async function deleteOrder(id: string): Promise<boolean> {
  if (getSupabaseConfig()) {
    try {
      await supabaseRest(`orders?id=eq.${id}`, {
        method: "DELETE",
      });
      return true;
    } catch (err) {
      console.warn("Supabase REST deleteOrder fallback:", err);
    }
  }

  await initDb();
  try {
    const pool = await getPool();
    if (pool) {
      const res = await pool.query("DELETE FROM orders WHERE id = $1", [id]);
      return (res.rowCount ?? 0) > 0;
    }
  } catch (error) {
    console.error("PostgreSQL deleteOrder error:", error);
  }
  return false;
}
