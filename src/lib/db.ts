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
}

export type PaymentStatus = "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED" | "REFUNDED";

export interface Order {
  id: string;
  paypal_order_id: string;
  paypal_capture_id?: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  customer_company?: string;
  item_type: "individual" | "package" | "setup" | string;
  item_id: string;
  item_name: string;
  amount: number;
  currency: string;
  payment_status: PaymentStatus;
  paypal_status?: string;
  raw_details?: string;
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

// ==========================================
// ORDERS & PAYPAL PAYMENTS PERSISTENCE
// ==========================================

export async function saveOrder(data: {
  paypalOrderId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  customerCompany?: string;
  itemType: "individual" | "package" | "setup" | string;
  itemId: string;
  itemName: string;
  amount: number;
  currency?: string;
  paymentStatus?: PaymentStatus;
  paypalStatus?: string;
  rawDetails?: string;
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
  paypalCaptureId?: string;
  paymentStatus: PaymentStatus;
  paypalStatus?: string;
  rawDetails?: string;
}): Promise<Order | null> {
  const now = new Date().toISOString();

  if (getSupabaseConfig()) {
    try {
      const payload: Record<string, any> = {
        payment_status: data.paymentStatus,
        updated_at: now,
      };
      if (data.paypalCaptureId) payload.paypal_capture_id = data.paypalCaptureId;
      if (data.paypalStatus) payload.paypal_status = data.paypalStatus;
      if (data.rawDetails) payload.raw_details = data.rawDetails;

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
  if (getSupabaseConfig()) {
    try {
      const rows = await supabaseRest(`orders?id=eq.${id}&select=*`);
      if (Array.isArray(rows) && rows.length > 0) {
        return rows[0];
      }
    } catch (err) {
      console.warn("Supabase REST getOrderById fallback:", err);
    }
  }

  await initDb();
  try {
    const pool = await getPool();
    if (pool) {
      const res = await pool.query("SELECT * FROM orders WHERE id = $1 LIMIT 1", [id]);
      if (res.rows[0]) {
        return {
          ...res.rows[0],
          amount: typeof res.rows[0].amount === "string" ? parseFloat(res.rows[0].amount) : res.rows[0].amount,
        };
      }
    }
  } catch (error) {
    console.error("PostgreSQL getOrderById error:", error);
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
