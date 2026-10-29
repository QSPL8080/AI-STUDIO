// CRM schema extensions. Executed automatically on the direct PostgreSQL pool
// (local development). For Supabase (production, REST API) run the same SQL from
// `supabase-schema.sql` once in the Supabase SQL Editor.
import { LEADS_TABLE } from "./db-tables";

export const CRM_SCHEMA_SQL = `
  ALTER TABLE ${LEADS_TABLE} ADD COLUMN IF NOT EXISTS project_status VARCHAR(32) DEFAULT 'Not Started';
  ALTER TABLE ${LEADS_TABLE} ADD COLUMN IF NOT EXISTS channel VARCHAR(32);
  ALTER TABLE ${LEADS_TABLE} ADD COLUMN IF NOT EXISTS campaign VARCHAR(255);
  ALTER TABLE ${LEADS_TABLE} ADD COLUMN IF NOT EXISTS ad_set VARCHAR(255);
  ALTER TABLE ${LEADS_TABLE} ADD COLUMN IF NOT EXISTS form_name VARCHAR(255);
  ALTER TABLE ${LEADS_TABLE} ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
  ALTER TABLE ${LEADS_TABLE} ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(255);
  ALTER TABLE ${LEADS_TABLE} ALTER COLUMN source TYPE VARCHAR(64);
  ALTER TABLE ${LEADS_TABLE} ADD COLUMN IF NOT EXISTS handled_by VARCHAR(255);
  ALTER TABLE ${LEADS_TABLE} ADD COLUMN IF NOT EXISTS closed_by VARCHAR(255);
  ALTER TABLE ${LEADS_TABLE} ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE;
  ALTER TABLE ${LEADS_TABLE} ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE;
  ALTER TABLE ${LEADS_TABLE} ADD COLUMN IF NOT EXISTS handled_by_id VARCHAR(64);
  ALTER TABLE ${LEADS_TABLE} ADD COLUMN IF NOT EXISTS closed_by_id VARCHAR(64);
  CREATE INDEX IF NOT EXISTS idx_ind_leads_deleted_at ON ${LEADS_TABLE} (deleted_at);

  CREATE TABLE IF NOT EXISTS crm_users (
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

  CREATE TABLE IF NOT EXISTS crm_activity_logs (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(32) NOT NULL,
    actor_email VARCHAR(255),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
  ALTER TABLE crm_activity_logs ADD COLUMN IF NOT EXISTS lead_id VARCHAR(64);
  CREATE INDEX IF NOT EXISTS idx_crm_activity_created_at ON crm_activity_logs (created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_crm_activity_lead_id ON crm_activity_logs (lead_id);

  CREATE TABLE IF NOT EXISTS crm_settings (
    key VARCHAR(64) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS ind_coupons (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(64) NOT NULL UNIQUE,
    discount_percent INTEGER NOT NULL,
    max_uses INTEGER NOT NULL DEFAULT 1,
    times_used INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    used_by_email VARCHAR(255),
    used_at TIMESTAMP WITH TIME ZONE,
    order_id VARCHAR(64),
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_ind_coupons_code ON ind_coupons (code);
  CREATE INDEX IF NOT EXISTS idx_ind_coupons_active ON ind_coupons (active);

  CREATE TABLE IF NOT EXISTS crm_lead_files (
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
  CREATE INDEX IF NOT EXISTS idx_crm_lead_files_lead ON crm_lead_files (lead_id);
  CREATE TABLE IF NOT EXISTS crm_lead_file_chunks (
    file_id VARCHAR(64) NOT NULL,
    idx INTEGER NOT NULL,
    data TEXT NOT NULL,
    PRIMARY KEY (file_id, idx)
  );

  CREATE TABLE IF NOT EXISTS crm_payment_links (
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
  CREATE INDEX IF NOT EXISTS idx_crm_payment_links_lead ON crm_payment_links (lead_id);
  CREATE INDEX IF NOT EXISTS idx_crm_payment_links_order ON crm_payment_links (order_id);
  CREATE INDEX IF NOT EXISTS idx_crm_payment_links_created ON crm_payment_links (created_at DESC);
`;
