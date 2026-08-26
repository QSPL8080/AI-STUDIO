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
  return res.json();
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
      } finally {
        client.release();
      }
    }
  } catch (error) {
    console.warn("PostgreSQL init warning:", error);
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
    created_at: now,
  };

  // Strategy A: If Supabase REST keys are present in Hostinger environment variables (Guaranteed Delivery)
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
          business: record.business,
          location: record.location || null,
          industry: record.industry || null,
          requirement: record.requirement || null,
          additional: record.additional || null,
          status: record.status,
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
  }

  return record;
}

export async function getLeads(): Promise<Lead[]> {
  // Strategy A: Supabase REST
  if (getSupabaseConfig()) {
    try {
      const rows = await supabaseRest("leads?select=*&order=created_at.desc");
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
      const res = await pool.query("SELECT * FROM leads ORDER BY created_at DESC");
      return res.rows;
    }
  } catch (error) {
    console.error("PostgreSQL Select error:", error);
  }
  return [];
}

export async function updateLeadStatus(id: string, status: Lead["status"]): Promise<boolean> {
  if (getSupabaseConfig()) {
    try {
      await supabaseRest(`leads?id=eq.${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      return true;
    } catch (err) {
      console.warn("Supabase REST update fallback:", err);
    }
  }

  await initDb();
  try {
    const pool = await getPool();
    if (pool) {
      const res = await pool.query("UPDATE leads SET status = $1 WHERE id = $2", [status, id]);
      return (res.rowCount ?? 0) > 0;
    }
  } catch (error) {
    console.error("PostgreSQL Update error:", error);
  }
  return false;
}

export async function deleteLead(id: string): Promise<boolean> {
  if (getSupabaseConfig()) {
    try {
      await supabaseRest(`leads?id=eq.${id}`, {
        method: "DELETE",
      });
      return true;
    } catch (err) {
      console.warn("Supabase REST delete fallback:", err);
    }
  }

  await initDb();
  try {
    const pool = await getPool();
    if (pool) {
      const res = await pool.query("DELETE FROM leads WHERE id = $1", [id]);
      return (res.rowCount ?? 0) > 0;
    }
  } catch (error) {
    console.error("PostgreSQL Delete error:", error);
  }
  return false;
}
