-- ====================================================================
-- QUICKUPP AI STUDIO - SUPABASE & POSTGRESQL DATABASE SCHEMA
-- Compatible with both Local PostgreSQL (localhost:5432) and Cloud Supabase
-- ====================================================================

-- 1. LEADS TABLE (Stores all Inbound Inquiries, Contact Forms & Quotes)
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

-- Indexes for lightning-fast CRM queries
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads (status);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON public.leads (phone);

-- 2. ORDERS & PAYMENTS TABLE
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

-- 3. ROW LEVEL SECURITY (RLS) FOR SUPABASE CLOUD
-- Enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

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
