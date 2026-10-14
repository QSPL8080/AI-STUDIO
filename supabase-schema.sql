-- ====================================================================
-- QUICKUPP AI STUDIO - SUPABASE & POSTGRESQL DATABASE SCHEMA
-- Compatible with both Local PostgreSQL (localhost:5432) and Cloud Supabase.
-- Safe to run more than once (every statement is idempotent).
--
-- HOW TO APPLY ON SUPABASE: Dashboard → SQL Editor → paste this file → Run.
-- The app talks to Supabase with SUPABASE_API_KEY, which must be the
-- SECRET / service_role key (it bypasses RLS). Never put it in frontend code.
-- ====================================================================

-- 1. LEADS (website contact form, popup, manual entries and Meta Ads leads)
CREATE TABLE IF NOT EXISTS public.leads (
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- CRM columns: project status, Meta attribution and soft delete (Recycle Bin)
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS project_status VARCHAR(32) DEFAULT 'New';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS channel VARCHAR(32);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS campaign VARCHAR(255);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ad_set VARCHAR(255);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS form_name VARCHAR(255);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(255);
ALTER TABLE public.leads ALTER COLUMN source TYPE VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads (status);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON public.leads (phone);
CREATE INDEX IF NOT EXISTS idx_leads_deleted_at ON public.leads (deleted_at);

-- 2. ORDERS & PAYMENTS (PayPal checkout)
CREATE TABLE IF NOT EXISTS public.orders (
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

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (payment_status);

-- 3. CRM USERS (Super Admin, Admins, Leads Managers)
-- Passwords are stored as scrypt hashes. The app creates the first two
-- accounts automatically on first sign-in when this table is empty:
--   sa@aistudio.in   (Super Admin)
--   test@aistudio.in (Admin)
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

-- 4. CRM ACTIVITY HISTORY / AUDIT LOG
CREATE TABLE IF NOT EXISTS public.crm_activity_logs (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(32) NOT NULL,
    actor_email VARCHAR(255),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_crm_activity_created_at ON public.crm_activity_logs (created_at DESC);

-- 5. CRM SETTINGS (permissions matrix + general/security settings as JSON)
CREATE TABLE IF NOT EXISTS public.crm_settings (
    key VARCHAR(64) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. ROW LEVEL SECURITY
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
-- CRM tables: RLS on with NO public policies → only the server (secret /
-- service_role key) can read or write them. Password hashes are never public.
ALTER TABLE public.crm_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_settings ENABLE ROW LEVEL SECURITY;

-- Allow website visitors to insert leads anonymously via Contact Form / Popup Modal
DROP POLICY IF EXISTS "Public insert leads" ON public.leads;
CREATE POLICY "Public insert leads" ON public.leads
    FOR INSERT
    TO public
    WITH CHECK (true);

-- Allow authenticated / service / anon read & update for CRM Dashboard
DROP POLICY IF EXISTS "Allow select leads" ON public.leads;
CREATE POLICY "Allow select leads" ON public.leads
    FOR SELECT
    TO public
    USING (true);

DROP POLICY IF EXISTS "Allow update leads" ON public.leads;
CREATE POLICY "Allow update leads" ON public.leads
    FOR UPDATE
    TO public
    USING (true);

DROP POLICY IF EXISTS "Allow delete leads" ON public.leads;
CREATE POLICY "Allow delete leads" ON public.leads
    FOR DELETE
    TO public
    USING (true);

-- Orders RLS policies
DROP POLICY IF EXISTS "Allow all orders access" ON public.orders;
CREATE POLICY "Allow all orders access" ON public.orders
    FOR ALL
    TO public
    USING (true);
