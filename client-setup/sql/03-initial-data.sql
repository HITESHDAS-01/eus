-- =============================================================================
-- 03-initial-data.sql
-- ---------------------------------------------------------------------------
-- Seeds the new client's database with org-specific settings.
--
-- !! EDIT THE "EDIT ME" SECTION BELOW BEFORE RUNNING !!
--
-- The first admin user is created separately (see CHECKLIST.md Phase 3) —
-- this file has no FK dependencies, so it can be run any time after the
-- schema is in place.
--
-- Run AFTER 01-schema.sql and 02-storage.sql.
-- Idempotent — safe to re-run.
-- =============================================================================


-- ===========================================================================
-- EDIT ME — Org-specific text settings
-- ===========================================================================
-- The member_code_prefix appears in every member code (e.g. ABC/052026/C/001)
-- and every EMI code (ABC/EMI/C/052026/001). Use the client's short name in
-- CAPS, 2-5 letters. NO spaces or slashes. Must match VITE_ORG_SHORT in Vercel.

INSERT INTO app_text_settings (key, value) VALUES
  ('member_code_prefix', 'EUS')              -- ← CHANGE to client prefix
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;


-- ===========================================================================
-- Default numeric settings — fine for most cooperative societies.
-- Change only if the client has different rules.
-- ===========================================================================
INSERT INTO settings (key, value) VALUES
  -- ROI / interest rates (% per annum, flat)
  ('roi_category_b',          '36'),  -- Cat B (investor) ROI
  ('roi_category_c_24',       '16'),  -- Cat C, 24-month term ROI
  ('roi_category_c_36',       '27'),  -- Cat C, 36-month term ROI
  -- Loan rules
  ('loan_eligibility_percent','80'),  -- Max member loan = 80% of net savings
  -- Penalty rules for late installments
  ('penalty_percentage',      '5'),   -- 5% penalty on overdue amount
  ('monthly_due_day',         '15'),  -- Installments due by 15th of each month
  ('grace_period_days',       '3')    -- 3 days grace before penalty kicks in
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;


-- ===========================================================================
-- Verification (optional) — uncomment to sanity-check
-- ===========================================================================
-- SELECT * FROM app_text_settings;
-- SELECT * FROM settings ORDER BY key;


-- =============================================================================
-- DONE.
-- Next: create the first admin user (CHECKLIST.md Phase 3), then deploy the
-- Edge Functions (edge-functions-deploy.md).
-- =============================================================================
