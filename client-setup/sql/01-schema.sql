-- =============================================================================
-- 01-schema.sql
-- ---------------------------------------------------------------------------
-- Full schema for the EUS web app. Idempotent — safe to run on a fresh DB
-- and safe to re-run (uses IF NOT EXISTS / OR REPLACE everywhere).
--
-- Run this once on a brand-new Supabase project, in the SQL Editor.
-- Followed by:
--   02-storage.sql    — storage bucket + policies
--   03-initial-data.sql — default settings + first admin user
--
-- Contents:
--   - helper functions (is_admin)
--   - core tables (profiles, members, savings_installments, loans, loan_repayments)
--   - settings tables (settings, app_text_settings)
--   - product-EMI tables (vendors, emi_customers, emi_loans, emi_payments)
--   - auto-code triggers (members, emi_customers, emi_loans)
--   - atomic RPCs (record_loan_repayment, record_emi_payment)
--   - row-level security policies on every table
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin(uid UUID) RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = uid AND role = 'admin');
$$;

-- ---------------------------------------------------------------------------
-- Core tables
-- ---------------------------------------------------------------------------

-- profiles — extends auth.users with display info + role.
-- The id column == auth.users.id (1:1).
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name           TEXT,
  phone               TEXT,
  photo_url           TEXT,
  role                TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  -- Personal info (KYC for both members and used by EMI flow)
  address             TEXT,
  father_husband_name TEXT,
  gender              TEXT,
  date_of_birth       DATE,
  aadhaar_vid         TEXT,
  nominee_name        TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- members — cooperative society membership row
CREATE TABLE IF NOT EXISTS members (
  id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  member_code         TEXT UNIQUE,
  category            TEXT NOT NULL CHECK (category IN ('A', 'B', 'C')),
  status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'inactive', 'matured', 'withdrawn', 'closed')),
  join_date           DATE NOT NULL DEFAULT CURRENT_DATE,
  initial_investment  NUMERIC(14,2) NOT NULL DEFAULT 0,
  monthly_installment NUMERIC(14,2),
  chosen_term_months  INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_members_category   ON members(category);
CREATE INDEX IF NOT EXISTS idx_members_status     ON members(status);
CREATE INDEX IF NOT EXISTS idx_members_join_date  ON members(join_date);

-- savings_installments — monthly savings deposits by members (Cat A, C)
CREATE TABLE IF NOT EXISTS savings_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id      UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  amount         NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  penalty        NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (penalty >= 0),
  payment_date   DATE NOT NULL,
  due_date       DATE NOT NULL,
  month_year     DATE NOT NULL,  -- always the 1st of the month this installment is FOR
  receipt_number TEXT UNIQUE NOT NULL,
  created_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_si_member        ON savings_installments(member_id);
CREATE INDEX IF NOT EXISTS idx_si_payment_date  ON savings_installments(payment_date);
CREATE INDEX IF NOT EXISTS idx_si_month_year    ON savings_installments(month_year);

-- loans — member loans against savings (flat interest)
CREATE TABLE IF NOT EXISTS loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id           UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  principal_amount    NUMERIC(14,2) NOT NULL CHECK (principal_amount > 0),
  interest_rate       NUMERIC(6,2)  NOT NULL,
  remaining_principal NUMERIC(14,2) NOT NULL,
  status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'closed')),
  disbursed_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_loans_member ON loans(member_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);

-- loan_repayments — payments received against member loans
CREATE TABLE IF NOT EXISTS loan_repayments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id           UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  amount_paid       NUMERIC(14,2) NOT NULL CHECK (amount_paid > 0),
  principal_portion NUMERIC(14,2) NOT NULL DEFAULT 0,
  interest_portion  NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_date      DATE NOT NULL,
  receipt_number    TEXT UNIQUE NOT NULL,
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lr_loan ON loan_repayments(loan_id);

-- settings — numeric config (ROI rates, penalty %, due day, etc.)
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- app_text_settings — string config (member_code_prefix, org tagline, etc.)
CREATE TABLE IF NOT EXISTS app_text_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- Product-EMI tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name    TEXT NOT NULL,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS emi_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_code       TEXT UNIQUE,
  full_name           TEXT NOT NULL,
  phone               TEXT,
  address             TEXT,
  father_husband_name TEXT,
  date_of_birth       DATE,
  aadhaar_vid         TEXT,
  pan_number          TEXT,
  occupation          TEXT,
  monthly_income      NUMERIC(14,2),
  nominee_name        TEXT,
  photo_url           TEXT,
  notes               TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS emi_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_code             TEXT UNIQUE,
  customer_id           UUID NOT NULL REFERENCES emi_customers(id) ON DELETE RESTRICT,
  vendor_id             UUID NOT NULL REFERENCES vendors(id)        ON DELETE RESTRICT,
  product_name          TEXT NOT NULL,
  product_category      TEXT,
  product_price         NUMERIC(14,2) NOT NULL CHECK (product_price > 0),
  downpayment           NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (downpayment >= 0),
  financed_amount       NUMERIC(14,2) NOT NULL,
  interest_rate         NUMERIC(6,2)  NOT NULL,   -- annual %, flat
  tenure_months         INT           NOT NULL CHECK (tenure_months > 0),
  emi_amount            NUMERIC(14,2) NOT NULL,
  total_payable         NUMERIC(14,2) NOT NULL,
  total_interest        NUMERIC(14,2) NOT NULL,
  vendor_paid_amount    NUMERIC(14,2) NOT NULL,
  vendor_paid_date      DATE NOT NULL,
  vendor_invoice_number TEXT,
  disbursed_date        DATE NOT NULL,
  first_emi_date        DATE NOT NULL,
  remaining_principal   NUMERIC(14,2) NOT NULL,
  status                TEXT NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'closed', 'defaulted', 'foreclosed')),
  notes                 TEXT,
  created_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_emi_loans_customer ON emi_loans(customer_id);
CREATE INDEX IF NOT EXISTS idx_emi_loans_vendor   ON emi_loans(vendor_id);
CREATE INDEX IF NOT EXISTS idx_emi_loans_status   ON emi_loans(status);

CREATE TABLE IF NOT EXISTS emi_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id           UUID NOT NULL REFERENCES emi_loans(id) ON DELETE CASCADE,
  amount_paid       NUMERIC(14,2) NOT NULL CHECK (amount_paid > 0),
  principal_portion NUMERIC(14,2) NOT NULL DEFAULT 0,
  interest_portion  NUMERIC(14,2) NOT NULL DEFAULT 0,
  penalty_portion   NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_date      DATE NOT NULL,
  due_date          DATE NOT NULL,
  month_year        DATE NOT NULL,
  receipt_number    TEXT UNIQUE NOT NULL,
  payment_method    TEXT,
  notes             TEXT,
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_emi_payments_loan ON emi_payments(loan_id);

-- ---------------------------------------------------------------------------
-- Auto-code triggers
-- ---------------------------------------------------------------------------

-- Members: <prefix>/MMYYYY/<cat>/<seq>  e.g. EUS/052026/C/001
-- Prefix is read from app_text_settings.member_code_prefix (set in 03-initial-data.sql).
-- Uses MAX() on the members table to find the next sequence number per category.
-- Deleting members automatically resets the numbering.

CREATE OR REPLACE FUNCTION generate_member_code() RETURNS TRIGGER AS $$
DECLARE
  v_prefix     TEXT;
  v_year_month TEXT;
  v_seq        INT;
  v_code       TEXT;
  v_max_seq    INT;
BEGIN
  IF NEW.member_code IS NULL OR NEW.member_code = '' THEN
    SELECT value INTO v_prefix FROM app_text_settings WHERE key = 'member_code_prefix';
    IF v_prefix IS NULL THEN v_prefix := 'EUS'; END IF;
    v_year_month := to_char(COALESCE(NEW.join_date, CURRENT_DATE), 'MMYYYY');

    -- Find highest existing sequence number across ALL months for this category
    SELECT COALESCE(
      MAX((regexp_replace(member_code, '^.*/', '', 'g'))::INTEGER),
      0
    ) INTO v_max_seq
    FROM members
    WHERE category = NEW.category
      AND member_code IS NOT NULL;

    v_seq := v_max_seq + 1;
    v_code := v_prefix || '/' || v_year_month || '/' || NEW.category || '/' || LPAD(v_seq::text, 3, '0');

    -- Collision safety loop (shouldn't be needed but just in case)
    WHILE EXISTS (SELECT 1 FROM members WHERE member_code = v_code) LOOP
      v_seq := v_seq + 1;
      v_code := v_prefix || '/' || v_year_month || '/' || NEW.category || '/' || LPAD(v_seq::text, 3, '0');
    END LOOP;

    NEW.member_code := v_code;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_member_code ON members;
CREATE TRIGGER trg_generate_member_code
  BEFORE INSERT ON members
  FOR EACH ROW EXECUTE FUNCTION generate_member_code();

-- EMI customers: EUS/EMI/C/MMYYYY/NNN
-- NOTE: the "EUS" portion here is the brand-prefix from the codebase, hardcoded.
--       If a client wants their own prefix in EMI codes too, edit the literal
--       'EUS/EMI/C/' below to their prefix.
CREATE OR REPLACE FUNCTION set_emi_customer_code() RETURNS TRIGGER AS $$
DECLARE
  v_prefix     TEXT;
  v_year_month TEXT;
  v_count      INT;
BEGIN
  IF NEW.customer_code IS NULL OR NEW.customer_code = '' THEN
    SELECT value INTO v_prefix FROM app_text_settings WHERE key = 'member_code_prefix';
    IF v_prefix IS NULL THEN v_prefix := 'EUS'; END IF;
    v_year_month := to_char(COALESCE(NEW.created_at, NOW()), 'MMYYYY');
    SELECT COUNT(*) + 1 INTO v_count
    FROM emi_customers
    WHERE to_char(created_at, 'MMYYYY') = v_year_month;
    NEW.customer_code := v_prefix || '/EMI/C/' || v_year_month || '/' || LPAD(v_count::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_emi_customer_code ON emi_customers;
CREATE TRIGGER trg_set_emi_customer_code
  BEFORE INSERT ON emi_customers
  FOR EACH ROW EXECUTE FUNCTION set_emi_customer_code();

-- EMI loans: EUS/EMI/L/MMYYYY/NNN
CREATE OR REPLACE FUNCTION set_emi_loan_code() RETURNS TRIGGER AS $$
DECLARE
  v_prefix     TEXT;
  v_year_month TEXT;
  v_count      INT;
BEGIN
  IF NEW.loan_code IS NULL OR NEW.loan_code = '' THEN
    SELECT value INTO v_prefix FROM app_text_settings WHERE key = 'member_code_prefix';
    IF v_prefix IS NULL THEN v_prefix := 'EUS'; END IF;
    v_year_month := to_char(COALESCE(NEW.disbursed_date, NOW()::date), 'MMYYYY');
    SELECT COUNT(*) + 1 INTO v_count
    FROM emi_loans
    WHERE to_char(disbursed_date, 'MMYYYY') = v_year_month;
    NEW.loan_code := v_prefix || '/EMI/L/' || v_year_month || '/' || LPAD(v_count::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_emi_loan_code ON emi_loans;
CREATE TRIGGER trg_set_emi_loan_code
  BEFORE INSERT ON emi_loans
  FOR EACH ROW EXECUTE FUNCTION set_emi_loan_code();

-- ---------------------------------------------------------------------------
-- Atomic RPCs
-- ---------------------------------------------------------------------------

-- Member loan repayment — locks the loan row, validates, inserts repayment,
-- updates remaining_principal + status atomically.
CREATE OR REPLACE FUNCTION record_loan_repayment(
  p_loan_id           UUID,
  p_amount_paid       NUMERIC,
  p_principal_portion NUMERIC,
  p_interest_portion  NUMERIC,
  p_payment_date      DATE,
  p_receipt_number    TEXT,
  p_created_by        UUID
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_remaining  NUMERIC;
  v_new_rem    NUMERIC;
  v_new_status TEXT;
BEGIN
  SELECT remaining_principal INTO v_remaining
  FROM loans WHERE id = p_loan_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Loan not found: %', p_loan_id;
  END IF;
  IF p_principal_portion > v_remaining THEN
    RAISE EXCEPTION 'Principal repayment (%) exceeds outstanding balance (%)',
      p_principal_portion, v_remaining;
  END IF;

  v_new_rem    := GREATEST(0, v_remaining - p_principal_portion);
  v_new_status := CASE WHEN v_new_rem <= 0 THEN 'closed' ELSE 'active' END;

  INSERT INTO loan_repayments (
    loan_id, amount_paid, principal_portion, interest_portion,
    payment_date, receipt_number, created_by
  ) VALUES (
    p_loan_id, p_amount_paid, p_principal_portion, p_interest_portion,
    p_payment_date, p_receipt_number, p_created_by
  );

  UPDATE loans
  SET remaining_principal = v_new_rem,
      status              = v_new_status
  WHERE id = p_loan_id;
END;
$$;

-- EMI payment — same pattern as record_loan_repayment but for emi_loans.
CREATE OR REPLACE FUNCTION record_emi_payment(
  p_loan_id           UUID,
  p_amount_paid       NUMERIC,
  p_principal_portion NUMERIC,
  p_interest_portion  NUMERIC,
  p_penalty_portion   NUMERIC,
  p_payment_date      DATE,
  p_due_date          DATE,
  p_month_year        DATE,
  p_receipt_number    TEXT,
  p_payment_method    TEXT,
  p_notes             TEXT,
  p_created_by        UUID
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_remaining  NUMERIC;
  v_new_rem    NUMERIC;
  v_new_status TEXT;
BEGIN
  SELECT remaining_principal INTO v_remaining
  FROM emi_loans WHERE id = p_loan_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EMI loan not found: %', p_loan_id;
  END IF;
  IF p_principal_portion > v_remaining THEN
    RAISE EXCEPTION 'Principal portion (%) exceeds outstanding balance (%)',
      p_principal_portion, v_remaining;
  END IF;

  v_new_rem    := GREATEST(0, v_remaining - p_principal_portion);
  v_new_status := CASE WHEN v_new_rem <= 0 THEN 'closed' ELSE 'active' END;

  INSERT INTO emi_payments (
    loan_id, amount_paid, principal_portion, interest_portion, penalty_portion,
    payment_date, due_date, month_year, receipt_number, payment_method, notes, created_by
  ) VALUES (
    p_loan_id, p_amount_paid, p_principal_portion, p_interest_portion, p_penalty_portion,
    p_payment_date, p_due_date, p_month_year, p_receipt_number, p_payment_method, p_notes, p_created_by
  );

  UPDATE emi_loans
  SET remaining_principal = v_new_rem,
      status              = v_new_status,
      updated_at          = NOW()
  WHERE id = p_loan_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Pattern:
--   - Admins (profiles.role = 'admin') can do everything via is_admin() helper.
--   - Members can read their own row in profiles + members + their related rows.
--   - settings / app_text_settings: public read (UI reads ROI %, due day etc.),
--     admin write.
-- ---------------------------------------------------------------------------

ALTER TABLE profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE members             ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans               ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_repayments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_text_settings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors             ENABLE ROW LEVEL SECURITY;
ALTER TABLE emi_customers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE emi_loans           ENABLE ROW LEVEL SECURITY;
ALTER TABLE emi_payments        ENABLE ROW LEVEL SECURITY;

-- profiles: members can read/update their own; admins do everything
DROP POLICY IF EXISTS profiles_self_read   ON profiles;
DROP POLICY IF EXISTS profiles_self_update ON profiles;
DROP POLICY IF EXISTS profiles_admin       ON profiles;
CREATE POLICY profiles_self_read   ON profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY profiles_self_update ON profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY profiles_admin       ON profiles FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- members: member can read own row; admin everything
DROP POLICY IF EXISTS members_self_read ON members;
DROP POLICY IF EXISTS members_admin     ON members;
CREATE POLICY members_self_read ON members FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY members_admin     ON members FOR ALL    TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- savings_installments: member can read own; admin everything
DROP POLICY IF EXISTS si_self_read ON savings_installments;
DROP POLICY IF EXISTS si_admin     ON savings_installments;
CREATE POLICY si_self_read ON savings_installments FOR SELECT TO authenticated USING (member_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY si_admin     ON savings_installments FOR ALL    TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- loans: member can read own; admin everything
DROP POLICY IF EXISTS loans_self_read ON loans;
DROP POLICY IF EXISTS loans_admin     ON loans;
CREATE POLICY loans_self_read ON loans FOR SELECT TO authenticated USING (member_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY loans_admin     ON loans FOR ALL    TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- loan_repayments: member can read own (via loan); admin everything
DROP POLICY IF EXISTS lr_self_read ON loan_repayments;
DROP POLICY IF EXISTS lr_admin     ON loan_repayments;
CREATE POLICY lr_self_read ON loan_repayments FOR SELECT TO authenticated USING (
  EXISTS(SELECT 1 FROM loans WHERE loans.id = loan_repayments.loan_id AND (loans.member_id = auth.uid() OR public.is_admin(auth.uid())))
);
CREATE POLICY lr_admin     ON loan_repayments FOR ALL    TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- settings / app_text_settings: public read (UI reads ROI etc.), admin write
DROP POLICY IF EXISTS settings_public_read ON settings;
DROP POLICY IF EXISTS settings_admin       ON settings;
CREATE POLICY settings_public_read ON settings FOR SELECT TO authenticated USING (true);
CREATE POLICY settings_admin       ON settings FOR ALL    TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS app_text_settings_public_read ON app_text_settings;
DROP POLICY IF EXISTS app_text_settings_admin       ON app_text_settings;
CREATE POLICY app_text_settings_public_read ON app_text_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY app_text_settings_admin       ON app_text_settings FOR ALL    TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Product-EMI tables: admin-only
DROP POLICY IF EXISTS vendors_admin       ON vendors;
DROP POLICY IF EXISTS emi_customers_admin ON emi_customers;
DROP POLICY IF EXISTS emi_loans_admin     ON emi_loans;
DROP POLICY IF EXISTS emi_payments_admin  ON emi_payments;
CREATE POLICY vendors_admin       ON vendors       FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY emi_customers_admin ON emi_customers FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY emi_loans_admin     ON emi_loans     FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY emi_payments_admin  ON emi_payments  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- External-investments + external-loans tables
-- ---------------------------------------------------------------------------
-- Used by the Investments and ExternalLoans admin pages. These track money
-- the cooperative invests externally (e.g. business deposits) and loans the
-- cooperative gives to non-members (with their own bookkeeping).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS external_investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  type              TEXT NOT NULL,
  principal_amount  NUMERIC(14,2) NOT NULL,
  expected_roi      NUMERIC(6,2),
  start_date        DATE NOT NULL,
  maturity_date     DATE,
  payout_frequency  TEXT,
  status            TEXT NOT NULL DEFAULT 'Active',
  notes             TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS investment_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_id UUID NOT NULL REFERENCES external_investments(id) ON DELETE CASCADE,
  amount        NUMERIC(14,2) NOT NULL,
  return_date   DATE NOT NULL,
  description   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inv_returns_investment ON investment_returns(investment_id);

CREATE TABLE IF NOT EXISTS ext_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_name     TEXT NOT NULL,
  phone             TEXT,
  address           TEXT,
  id_proof          TEXT,
  principal_amount  NUMERIC(14,2) NOT NULL,
  interest_rate     NUMERIC(6,2)  NOT NULL,
  start_date        DATE NOT NULL,
  status            TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ext_loan_txns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id        UUID NOT NULL REFERENCES ext_loans(id) ON DELETE CASCADE,
  type           TEXT NOT NULL,        -- 'Interest Due' | 'Interest Paid' | 'Principal Paid'
  amount         NUMERIC(14,2) NOT NULL,
  txn_date       DATE NOT NULL,
  receipt_number TEXT,
  notes          TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ext_loan_txns_loan ON ext_loan_txns(loan_id);

-- RLS — admin-only for all four
ALTER TABLE external_investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE investment_returns   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ext_loans            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ext_loan_txns        ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ext_investments_admin    ON external_investments;
DROP POLICY IF EXISTS investment_returns_admin ON investment_returns;
DROP POLICY IF EXISTS ext_loans_admin          ON ext_loans;
DROP POLICY IF EXISTS ext_loan_txns_admin      ON ext_loan_txns;
CREATE POLICY ext_investments_admin    ON external_investments FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY investment_returns_admin ON investment_returns   FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY ext_loans_admin          ON ext_loans            FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY ext_loan_txns_admin      ON ext_loan_txns        FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- =============================================================================
-- DONE. Now run 02-storage.sql and 03-initial-data.sql.
-- =============================================================================
