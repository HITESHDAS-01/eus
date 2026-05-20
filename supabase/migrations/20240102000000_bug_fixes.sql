-- =============================================================================
-- BUG FIX MIGRATION
-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add roi_category_b to settings (if not already present)
--    MemberHome reads this key; AdminHome/Reports/StatementModal now read it too.
-- ---------------------------------------------------------------------------
INSERT INTO settings (key, value)
VALUES ('roi_category_b', 36)
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Atomic loan repayment RPC
--    Replaces the two-step (insert repayment → update loan) pattern in Loans.tsx
--    with a single transaction so a network failure can never leave balance corrupt.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION record_loan_repayment(
  p_loan_id          UUID,
  p_amount_paid      NUMERIC,
  p_principal_portion NUMERIC,
  p_interest_portion  NUMERIC,
  p_payment_date     DATE,
  p_receipt_number   TEXT,
  p_created_by       UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_remaining  NUMERIC;
  v_new_rem    NUMERIC;
  v_new_status TEXT;
BEGIN
  -- Lock the loan row to prevent concurrent repayments on the same loan.
  SELECT remaining_principal INTO v_remaining
  FROM loans
  WHERE id = p_loan_id
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

-- ---------------------------------------------------------------------------
-- 3. Fix RLS on external tables (if they already exist from a previous setup)
--    If these tables don't exist yet, the ALTER TABLE lines will error — that's OK,
--    just skip those lines. The setup SQL in the app already has the correct RLS.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  -- external_investments
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'external_investments') THEN
    EXECUTE 'ALTER TABLE external_investments ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE investment_returns   ENABLE ROW LEVEL SECURITY';

    -- Drop old permissive policies if any
    DROP POLICY IF EXISTS "ext_investments_admin" ON external_investments;
    DROP POLICY IF EXISTS "investment_returns_admin" ON investment_returns;

    EXECUTE $p$
      CREATE POLICY "ext_investments_admin" ON external_investments
        FOR ALL TO authenticated
        USING (public.is_admin(auth.uid()))
        WITH CHECK (public.is_admin(auth.uid()))
    $p$;
    EXECUTE $p$
      CREATE POLICY "investment_returns_admin" ON investment_returns
        FOR ALL TO authenticated
        USING (public.is_admin(auth.uid()))
        WITH CHECK (public.is_admin(auth.uid()))
    $p$;
  END IF;

  -- ext_loans / ext_loan_txns
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'ext_loans') THEN
    EXECUTE 'ALTER TABLE ext_loans     ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE ext_loan_txns ENABLE ROW LEVEL SECURITY';

    DROP POLICY IF EXISTS "ext_loans_admin"     ON ext_loans;
    DROP POLICY IF EXISTS "ext_loan_txns_admin" ON ext_loan_txns;

    EXECUTE $p$
      CREATE POLICY "ext_loans_admin" ON ext_loans
        FOR ALL TO authenticated
        USING (public.is_admin(auth.uid()))
        WITH CHECK (public.is_admin(auth.uid()))
    $p$;
    EXECUTE $p$
      CREATE POLICY "ext_loan_txns_admin" ON ext_loan_txns
        FOR ALL TO authenticated
        USING (public.is_admin(auth.uid()))
        WITH CHECK (public.is_admin(auth.uid()))
    $p$;
  END IF;
END;
$$;
