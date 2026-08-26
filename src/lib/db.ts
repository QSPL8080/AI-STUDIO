import { Pool } from "pg";

export interface Lead {
  id: string;
  source: "Contact Form" | "Popup Modal";
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
}

// PostgreSQL connection config (User password: 8080, DB: "ai studio" / "aistudio")
const connectionString =
  process.env.DATABASE_URL ||
  "postgres://postgres:8080@localhost:5432/ai_studio";

const isRemoteDb =
  connectionString.includes("supabase.co") ||
  connectionString.includes("neon.tech") ||
  connectionString.includes("pooler.supabase.com") ||
  !connectionString.includes("localhost");

export const pool = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30000,
  ...(isRemoteDb ? { ssl: { rejectUnauthorized: false } } : {}),
});

let isInitialized = false;

export async function initDb() {
  if (isInitialized) return;
  try {
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS leads (
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
      `);
      isInitialized = true;
      console.log("✅ PostgreSQL: 'leads' table verified/initialized successfully.");
    } finally {
      client.release();
    }
  } catch (error) {
    console.warn("⚠️ PostgreSQL init warning (will retry on next request):", error);
  }
}

export async function saveLead(data: {
  source: "Contact Form" | "Popup Modal";
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
  await initDb();
  const id = `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const status = "New";
  const now = new Date().toISOString();

  try {
    const res = await pool.query(
      `INSERT INTO leads (id, source, name, phone, email, video_type, business, location, industry, requirement, additional, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
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
  } catch (error) {
    console.error("PostgreSQL Insert error:", error);
    throw error;
  }
}

export async function getLeads(): Promise<Lead[]> {
  await initDb();
  try {
    const res = await pool.query("SELECT * FROM leads ORDER BY created_at DESC");
    return res.rows;
  } catch (error) {
    console.error("PostgreSQL Select error:", error);
    return [];
  }
}

export async function updateLeadStatus(id: string, status: Lead["status"]): Promise<boolean> {
  await initDb();
  try {
    const res = await pool.query("UPDATE leads SET status = $1 WHERE id = $2", [status, id]);
    return (res.rowCount ?? 0) > 0;
  } catch (error) {
    console.error("PostgreSQL Update error:", error);
    return false;
  }
}

export async function deleteLead(id: string): Promise<boolean> {
  await initDb();
  try {
    const res = await pool.query("DELETE FROM leads WHERE id = $1", [id]);
    return (res.rowCount ?? 0) > 0;
  } catch (error) {
    console.error("PostgreSQL Delete error:", error);
    return false;
  }
}
