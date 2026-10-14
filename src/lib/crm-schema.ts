// CRM schema extensions. Executed automatically on the direct PostgreSQL pool
// (local development). For Supabase (production, REST API) run the same SQL from
// `supabase-schema.sql` once in the Supabase SQL Editor.
export const CRM_SCHEMA_SQL = `
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS project_status VARCHAR(32) DEFAULT 'New';
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS channel VARCHAR(32);
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS campaign VARCHAR(255);
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS ad_set VARCHAR(255);
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS form_name VARCHAR(255);
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(255);
  ALTER TABLE leads ALTER COLUMN source TYPE VARCHAR(64);
  CREATE INDEX IF NOT EXISTS idx_leads_deleted_at ON leads (deleted_at);

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
  CREATE INDEX IF NOT EXISTS idx_crm_activity_created_at ON crm_activity_logs (created_at DESC);

  CREATE TABLE IF NOT EXISTS crm_settings (
    key VARCHAR(64) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
`;
