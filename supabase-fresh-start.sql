-- ====================================================================
-- QUICKUPP AI STUDIO INDIA - FRESH START (wipe INDIA data only)
-- Deletes all India leads, India orders and India CRM activity history.
-- Does NOT touch the US tables (leads, orders, admin_users).
-- Keeps India CRM users and settings.
-- ====================================================================

DELETE FROM public.ind_leads;
DELETE FROM public.ind_orders;
DELETE FROM public.crm_activity_logs;

SELECT
  (SELECT COUNT(*) FROM public.ind_leads)         AS india_leads,
  (SELECT COUNT(*) FROM public.ind_orders)        AS india_orders,
  (SELECT COUNT(*) FROM public.crm_activity_logs) AS activity_logs;
