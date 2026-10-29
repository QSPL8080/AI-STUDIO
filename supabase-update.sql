-- Quickupp AI Studio India CRM: one-time update for an EXISTING Supabase database.
-- Safe to run more than once (nothing is deleted, existing data is kept).
-- Supabase -> SQL Editor -> paste -> Run.

-- 1. Lead columns used by the CRM (who handled / closed / delivered, Meta fields, recycle bin)
ALTER TABLE public.ind_leads ADD COLUMN IF NOT EXISTS project_status VARCHAR(32) DEFAULT 'Not Started';
ALTER TABLE public.ind_leads ADD COLUMN IF NOT EXISTS channel VARCHAR(32);
ALTER TABLE public.ind_leads ADD COLUMN IF NOT EXISTS campaign VARCHAR(255);
ALTER TABLE public.ind_leads ADD COLUMN IF NOT EXISTS ad_set VARCHAR(255);
ALTER TABLE public.ind_leads ADD COLUMN IF NOT EXISTS form_name VARCHAR(255);
ALTER TABLE public.ind_leads ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.ind_leads ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(255);
ALTER TABLE public.ind_leads ADD COLUMN IF NOT EXISTS handled_by VARCHAR(255);
ALTER TABLE public.ind_leads ADD COLUMN IF NOT EXISTS handled_by_id VARCHAR(64);
ALTER TABLE public.ind_leads ADD COLUMN IF NOT EXISTS closed_by VARCHAR(255);
ALTER TABLE public.ind_leads ADD COLUMN IF NOT EXISTS closed_by_id VARCHAR(64);
ALTER TABLE public.ind_leads ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.ind_leads ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS idx_ind_leads_deleted_at ON public.ind_leads (deleted_at);
ALTER TABLE public.crm_activity_logs ADD COLUMN IF NOT EXISTS lead_id VARCHAR(64);

-- 2. Lead attachments (PNG, JPG, PDF, DOC/DOCX, CSV, max 10 MB each)
CREATE TABLE IF NOT EXISTS public.crm_lead_files (
    id VARCHAR(64) PRIMARY KEY,
    lead_id VARCHAR(64) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(128) NOT NULL,
    size_bytes INTEGER NOT NULL,
    chunk_count INTEGER NOT NULL,
    complete BOOLEAN NOT NULL DEFAULT FALSE,
    uploaded_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_crm_lead_files_lead ON public.crm_lead_files (lead_id);
CREATE TABLE IF NOT EXISTS public.crm_lead_file_chunks (
    file_id VARCHAR(64) NOT NULL,
    idx INTEGER NOT NULL,
    data TEXT NOT NULL,
    PRIMARY KEY (file_id, idx)
);
ALTER TABLE public.crm_lead_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_lead_file_chunks ENABLE ROW LEVEL SECURITY;

-- 3. Admin / Super Admin generated customer payment links (24-hour links, PayU).
--    Orders and payments themselves stay in ind_orders; this table only tracks the links.
CREATE TABLE IF NOT EXISTS public.crm_payment_links (
    id VARCHAR(64) PRIMARY KEY,
    lead_id VARCHAR(64) NOT NULL,
    order_id VARCHAR(64) NOT NULL,
    lead_source VARCHAR(16) NOT NULL,
    service_id VARCHAR(64) NOT NULL,
    qty INTEGER NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    total_amount NUMERIC(10, 2) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(64) NOT NULL,
    customer_company VARCHAR(255),
    status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
    paid_plan VARCHAR(16),
    attempts TEXT,
    created_by_id VARCHAR(64),
    created_by_name VARCHAR(255),
    created_by_email VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancelled_by VARCHAR(255),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_crm_payment_links_lead ON public.crm_payment_links (lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_payment_links_order ON public.crm_payment_links (order_id);
CREATE INDEX IF NOT EXISTS idx_crm_payment_links_created ON public.crm_payment_links (created_at DESC);
ALTER TABLE public.crm_payment_links ENABLE ROW LEVEL SECURITY;

-- 4. Make the Supabase API see the changes right away
NOTIFY pgrst, 'reload schema';
