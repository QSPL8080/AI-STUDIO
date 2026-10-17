-- ====================================================================
-- QUICKUPP AI STUDIO INDIA - SUPABASE SCHEMA
--
-- IMPORTANT: The US site (aistudio.us) uses the SAME Supabase project with
-- its own `leads`, `orders` and `admin_users` tables. The India site and CRM
-- use ONLY the tables below (ind_* and crm_*). Nothing here touches US data.
--
-- Safe to run more than once. Supabase -> SQL Editor -> paste -> Run.
-- SUPABASE_API_KEY on the server must be the secret / service_role key.
-- ====================================================================

-- 1. INDIA LEADS (website contact form, popup, manual entries, Meta Ads)
CREATE TABLE IF NOT EXISTS public.ind_leads (
    id VARCHAR(64) PRIMARY KEY,
    source VARCHAR(64) NOT NULL,
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
    project_status VARCHAR(32) DEFAULT 'Not Started',
    channel VARCHAR(32),
    campaign VARCHAR(255),
    ad_set VARCHAR(255),
    form_name VARCHAR(255),
    handled_by VARCHAR(255),
    closed_by VARCHAR(255),
    closed_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ind_leads_created_at ON public.ind_leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ind_leads_deleted_at ON public.ind_leads (deleted_at);

-- 2. INDIA ORDERS & PAYMENTS (PayPal checkout on the India site)
CREATE TABLE IF NOT EXISTS public.ind_orders (
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
CREATE INDEX IF NOT EXISTS idx_ind_orders_created_at ON public.ind_orders (created_at DESC);

-- 3. INDIA CRM USERS (Super Admin, Admins, Leads Managers - scrypt password hashes)
CREATE TABLE IF NOT EXISTS public.crm_users (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(32) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    is_protected BOOLEAN NOT NULL DEFAULT FALSE,
    token_version INTEGER NOT NULL DEFAULT 1,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. INDIA CRM ACTIVITY HISTORY
CREATE TABLE IF NOT EXISTS public.crm_activity_logs (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(32) NOT NULL,
    actor_email VARCHAR(255),
    description TEXT,
    lead_id VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.crm_activity_logs ADD COLUMN IF NOT EXISTS lead_id VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_crm_activity_created_at ON public.crm_activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_activity_lead_id ON public.crm_activity_logs (lead_id);

-- 5. INDIA CRM SETTINGS
CREATE TABLE IF NOT EXISTS public.crm_settings (
    key VARCHAR(64) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. SECURITY: RLS on, no public policies -> only the India server (secret key) can access.
ALTER TABLE public.ind_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ind_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_settings ENABLE ROW LEVEL SECURITY;

-- 7. Make the Supabase REST API see the new tables immediately
NOTIFY pgrst, 'reload schema';
