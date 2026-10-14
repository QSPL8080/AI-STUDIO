-- ====================================================================
-- QUICKUPP AI STUDIO - FRESH START (ONE-TIME DATA WIPE)
-- Run AFTER supabase-schema.sql, in Supabase → SQL Editor.
--
-- Permanently deletes ALL leads (website + Meta + Recycle Bin), ALL orders
-- and the CRM activity history. Cannot be undone.
-- Keeps CRM users and settings.
--
-- (Same as CRM Settings → Access All Records → "Delete all data".)
-- ====================================================================

BEGIN;
DELETE FROM public.leads;
DELETE FROM public.orders;
DELETE FROM public.crm_activity_logs;
COMMIT;

-- Check: all three should be 0
SELECT
  (SELECT COUNT(*) FROM public.leads)              AS leads,
  (SELECT COUNT(*) FROM public.orders)             AS orders,
  (SELECT COUNT(*) FROM public.crm_activity_logs)  AS activity_logs;
