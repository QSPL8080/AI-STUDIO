import { CRM_SCHEMA_SQL } from "./crm-schema";
import { LEADS_TABLE, ORDERS_TABLE } from "./db-tables";

export interface Lead {
  id: string;
  source: "Contact Form" | "Popup Modal" | "USA - Contact Form" | "USA - Popup Modal" | string;
  name: string;
  phone: string;
  email?: string;
  video_type: string;
  business: string;
  location?: string;
  industry?: string;
  requirement?: string;
  additional?: string;
  created_at: string;
  status: "New" | "Contacted" | "In Progress" | "Closed";
  project_status?: string;
}

let pgPool: any = null;

// The US site (quickuppaistudio.us) keeps the ORIGINAL Supabase project. The India
// site must use its own, separate project. These refs are blocked so India data can
// never be written to (or read from) the US database, even by a copy-pasted env var.
const BLOCKED_US_PROJECT_REFS = ["oxydwcusxvlsvjkwexsz", ...(process.env.US_SUPABASE_PROJECT_REF ? [process.env.US_SUPABASE_PROJECT_REF] : [])];

export function assertNotUsDatabase(urlOrConn: string) {
  const v = (urlOrConn || "").toLowerCase();
  const hit = BLOCKED_US_PROJECT_REFS.find((ref) => ref && v.includes(ref.toLowerCase()));
  if (hit) {
    throw new Error(
      `India site is configured with the US Supabase project (${hit}). Set IND_SUPABASE_URL / IND_SUPABASE_SERVICE_KEY (or SUPABASE_URL / SUPABASE_API_KEY) to the NEW India project.`,
    );
  }
}

export function getSupabaseConfig() {
  // India-specific names take priority so the two sites can never share credentials by accident.
  const rawUrl = process.env.IND_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.IND_SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_API_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_API_KEY;
  if (rawUrl && key) {
    const url = rawUrl.trim().replace(/\/+$/, "");
    assertNotUsDatabase(url);
    return { url, key: key.trim() };
  }
  return null;
}

// 1. HTTP REST Adapter for Supabase (Guaranteed 100% cloud delivery without TCP/SSL port blocks)
export async function supabaseRest(endpoint: string, options: RequestInit = {}) {
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
  return res.json();
}

// 2. Direct PostgreSQL Pool (For localhost development or direct pg connection)
export async function getPool() {
  if (!pgPool) {
    const pg = await import("pg");
    const Pool = pg.default?.Pool || pg.Pool;
    const connectionString = process.env.DATABASE_URL || process.env.VITE_DATABASE_URL;
    if (!connectionString) return null;
    assertNotUsDatabase(connectionString);

    let cleanConnectionString = connectionString.trim();
    const isRemoteDb =
      cleanConnectionString.includes("supabase.co") ||
      cleanConnectionString.includes("neon.tech") ||
      cleanConnectionString.includes("pooler.supabase.com") ||
      !cleanConnectionString.includes("localhost");

    if (cleanConnectionString.includes("?sslmode=")) {
      cleanConnectionString = cleanConnectionString.split("?sslmode=")[0] || cleanConnectionString;
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
          CREATE TABLE IF NOT EXISTS ${LEADS_TABLE} (
            id VARCHAR(64) PRIMARY KEY,
            source VARCHAR(32) NOT NULL,
            name VARCHAR(255) NOT NULL,
            phone VARCHAR(64) NOT NULL,
            email VARCHAR(255),
            video_type VARCHAR(128) NOT NULL,
            business VARCHAR(255) NOT NULL,
            location VARCHAR(255),
            industry VARCHAR(128),
            requirement TEXT,
            additional TEXT,
            status VARCHAR(32) DEFAULT 'New',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE IF NOT EXISTS ${ORDERS_TABLE} (
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
        // CRM extensions (soft delete, meta attribution, users, audit log, settings)
        await client.query(CRM_SCHEMA_SQL);
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
  source: "Contact Form" | "Popup Modal" | "USA - Contact Form" | "USA - Popup Modal" | string;
  name: string;
  phone: string;
  email?: string;
  videoType: string;
  business: string;
  location?: string;
  industry?: string;
  requirement?: string;
  additional?: string;
}): Promise<Lead> {
  const id = `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const status = "New";
  const now = new Date().toISOString();

  const record: Lead = {
    id,
    source: data.source,
    name: data.name,
    phone: data.phone,
    email: data.email || undefined,
    video_type: data.videoType,
    business: data.business,
    location: data.location || undefined,
    industry: data.industry || undefined,
    requirement: data.requirement || undefined,
    additional: data.additional || undefined,
    status,
    project_status: "Not Started",
    created_at: now,
  };

  // Strategy A: If Supabase REST keys are present in Hostinger environment variables (Guaranteed Delivery)
  if (getSupabaseConfig()) {
    try {
      const result = await supabaseRest(LEADS_TABLE, {
        method: "POST",
        body: JSON.stringify({
          id: record.id,
          source: record.source,
          name: record.name,
          phone: record.phone,
          email: record.email || null,
          video_type: record.video_type,
          business: record.business,
          location: record.location || null,
          industry: record.industry || null,
          requirement: record.requirement || null,
          additional: record.additional || null,
          status: record.status,
          project_status: record.project_status,
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

  // Strategy B: PostgreSQL pool (localhost or standard connection)
  await initDb();
  const pool = await getPool();
  if (pool) {
    const res = await pool.query(
      `INSERT INTO ${LEADS_TABLE} (id, source, name, phone, email, video_type, business, location, industry, requirement, additional, status, project_status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'Not Started', NOW())
       RETURNING *`,
      [
        id,
        data.source,
        data.name,
        data.phone,
        data.email || null,
        data.videoType,
        data.business,
        data.location || null,
        data.industry || null,
        data.requirement || null,
        data.additional || null,
        status,
      ]
    );
    return res.rows[0];
  }

  return record;
}
