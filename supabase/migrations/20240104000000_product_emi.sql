-- =============================================================================
-- PRODUCT EMI / ELECTRONICS FINANCE
-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Vendors (electronics shops / dukans we pay on behalf of the customer)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vendors (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  address     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vendors_admin" ON vendors;
CREATE POLICY "vendors_admin" ON vendors
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- 2. EMI Customers (external public who take product EMI from us — not EUS
--    members, no login)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS emi_customers (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_code         TEXT UNIQUE,
  full_name             TEXT NOT NULL,
  phone                 TEXT,
  address               TEXT,
  father_husband_name   TEXT,
  date_of_birth         DATE,
  aadhaar_vid           TEXT,
  pan_number            TEXT,
  occupation            TEXT,
  monthly_income        NUMERIC,
  nominee_name          TEXT,
  photo_url             TEXT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE emi_customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "emi_customers_admin" ON emi_customers;
CREATE POLICY "emi_customers_admin" ON emi_customers
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Auto-generate customer_code in format EUS/MMYYYY/NNN
CREATE OR REPLACE FUNCTION set_emi_customer_code() RETURNS TRIGGER AS $$
DECLARE
  v_year_month TEXT;
  v_count      INT;
BEGIN
  IF NEW.customer_code IS NULL OR NEW.customer_code = '' THEN
    v_year_month := to_char(COALESCE(NEW.created_at, NOW()), 'MMYYYY');
    SELECT COUNT(*) + 1 INTO v_count
    FROM emi_customers
    WHERE to_char(created_at, 'MMYYYY') = v_year_month;
    NEW.customer_code := 'EUS/' || v_year_month || '/' || LPAD(v_count::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_emi_customer_code ON emi_customers;
CREATE TRIGGER trg_set_emi_customer_code
  BEFORE INSERT ON emi_customers
  FOR EACH ROW EXECUTE FUNCTION set_emi_customer_code();

-- ---------------------------------------------------------------------------
-- 3. EMI Loans (product purchased via EMI, vendor paid upfront by us)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS emi_loans (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_code              TEXT UNIQUE,
  customer_id            UUID NOT NULL REFERENCES emi_customers(id) ON DELETE RESTRICT,
  vendor_id              UUID NOT NULL REFERENCES vendors(id)       ON DELETE RESTRICT,
  product_name           TEXT NOT NULL,
  product_category       TEXT,                   -- 'Mobile', 'Laptop', etc. (free text)
  product_price          NUMERIC NOT NULL CHECK (product_price > 0),
  downpayment            NUMERIC NOT NULL DEFAULT 0 CHECK (downpayment >= 0),
  financed_amount        NUMERIC NOT NULL CHECK (financed_amount > 0),
  interest_rate          NUMERIC NOT NULL CHECK (interest_rate >= 0),  -- annual %, flat
  tenure_months          INT     NOT NULL CHECK (tenure_months > 0),
  emi_amount             NUMERIC NOT NULL,
  total_payable          NUMERIC NOT NULL,
  total_interest         NUMERIC NOT NULL,
  vendor_paid_amount     NUMERIC NOT NULL,
  vendor_paid_date       DATE    NOT NULL,
  vendor_invoice_number  TEXT,
  disbursed_date         DATE    NOT NULL,
  first_emi_date         DATE    NOT NULL,
  remaining_principal    NUMERIC NOT NULL,
  status                 TEXT    NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active', 'closed', 'defaulted', 'foreclosed')),
  notes                  TEXT,
  created_by             UUID,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emi_loans_customer  ON emi_loans(customer_id);
CREATE INDEX IF NOT EXISTS idx_emi_loans_vendor    ON emi_loans(vendor_id);
CREATE INDEX IF NOT EXISTS idx_emi_loans_status    ON emi_loans(status);

ALTER TABLE emi_loans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "emi_loans_admin" ON emi_loans;
CREATE POLICY "emi_loans_admin" ON emi_loans
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Auto-generate loan_code in format EUS/MMYYYY/NNN
CREATE OR REPLACE FUNCTION set_emi_loan_code() RETURNS TRIGGER AS $$
DECLARE
  v_year_month TEXT;
  v_count      INT;
BEGIN
  IF NEW.loan_code IS NULL OR NEW.loan_code = '' THEN
    v_year_month := to_char(COALESCE(NEW.disbursed_date, NOW()::date), 'MMYYYY');
    SELECT COUNT(*) + 1 INTO v_count
    FROM emi_loans
    WHERE to_char(disbursed_date, 'MMYYYY') = v_year_month;
    NEW.loan_code := 'EUS/' || v_year_month || '/' || LPAD(v_count::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_emi_loan_code ON emi_loans;
CREATE TRIGGER trg_set_emi_loan_code
  BEFORE INSERT ON emi_loans
  FOR EACH ROW EXECUTE FUNCTION set_emi_loan_code();

-- ---------------------------------------------------------------------------
-- 4. EMI Payments (each monthly EMI collected from customer)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS emi_payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id             UUID NOT NULL REFERENCES emi_loans(id) ON DELETE CASCADE,
  amount_paid         NUMERIC NOT NULL CHECK (amount_paid > 0),
  principal_portion   NUMERIC NOT NULL DEFAULT 0 CHECK (principal_portion >= 0),
  interest_portion    NUMERIC NOT NULL DEFAULT 0 CHECK (interest_portion >= 0),
  penalty_portion     NUMERIC NOT NULL DEFAULT 0 CHECK (penalty_portion >= 0),
  payment_date        DATE NOT NULL,
  due_date            DATE NOT NULL,
  month_year          DATE NOT NULL,
  receipt_number      TEXT UNIQUE NOT NULL,
  payment_method      TEXT,                      -- 'cash' / 'upi' / 'bank' / 'other'
  notes               TEXT,
  created_by          UUID,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emi_payments_loan ON emi_payments(loan_id);

ALTER TABLE emi_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "emi_payments_admin" ON emi_payments;
CREATE POLICY "emi_payments_admin" ON emi_payments
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- 5. Atomic record_emi_payment RPC
--    Locks the loan row, validates the principal portion against the
--    outstanding balance, inserts the payment, updates remaining_principal,
--    and auto-closes the loan when fully repaid. Mirrors record_loan_repayment.
-- ---------------------------------------------------------------------------
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
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_remaining  NUMERIC;
  v_new_rem    NUMERIC;
  v_new_status TEXT;
BEGIN
  SELECT remaining_principal INTO v_remaining
  FROM emi_loans
  WHERE id = p_loan_id
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
