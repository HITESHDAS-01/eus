-- ===========================================================================
-- EUS / cooperative-savings template — initial schema
-- ===========================================================================
-- Conventions:
--   * All access goes through RLS. Service-role bypasses RLS (used by the
--     `admin-create-member` Edge Function for provisioning auth.users entries).
--   * `profiles.role` is the source of truth for admin vs member.
--   * Members are real auth.users — their login email is synthetic
--     (member_code@members.local). RLS uses auth.uid() = members.id.
--   * Audit-log triggers fire on every write to financial tables.
-- ===========================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
CREATE TABLE profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name   TEXT NOT NULL,
    phone       TEXT UNIQUE,
    photo_url   TEXT,
    role        TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- members
-- ---------------------------------------------------------------------------
CREATE TABLE members (
    id                       UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    member_code              TEXT UNIQUE NOT NULL,
    category                 TEXT NOT NULL CHECK (category IN ('A', 'B', 'C')),
    initial_investment       NUMERIC NOT NULL DEFAULT 0,
    monthly_installment      NUMERIC,
    join_date                DATE NOT NULL DEFAULT CURRENT_DATE,
    chosen_term_months       INTEGER,
    maturity_date            DATE,
    status                   TEXT NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active', 'inactive', 'matured', 'withdrawn', 'closed')),
    loan_interest_rate       NUMERIC NOT NULL DEFAULT 2.0,
    early_withdrawal_flag    BOOLEAN NOT NULL DEFAULT false,
    withdrawal_date          DATE
);

-- ---------------------------------------------------------------------------
-- savings_installments
-- ---------------------------------------------------------------------------
CREATE TABLE savings_installments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id       UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    amount          NUMERIC NOT NULL,
    penalty         NUMERIC NOT NULL DEFAULT 0,
    payment_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date        DATE NOT NULL,
    receipt_number  TEXT UNIQUE NOT NULL,
    month_year      DATE NOT NULL,
    created_by      UUID NOT NULL REFERENCES profiles(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- loans
-- ---------------------------------------------------------------------------
CREATE TABLE loans (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id           UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    principal_amount    NUMERIC NOT NULL,
    interest_rate       NUMERIC NOT NULL,
    disbursed_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    remaining_principal NUMERIC NOT NULL,
    approved_by         UUID NOT NULL REFERENCES profiles(id)
);

-- ---------------------------------------------------------------------------
-- loan_repayments
-- ---------------------------------------------------------------------------
CREATE TABLE loan_repayments (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_id             UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    amount_paid         NUMERIC NOT NULL,
    principal_portion   NUMERIC NOT NULL,
    interest_portion    NUMERIC NOT NULL,
    payment_date        DATE NOT NULL DEFAULT CURRENT_DATE,
    receipt_number      TEXT UNIQUE NOT NULL,
    created_by          UUID NOT NULL REFERENCES profiles(id)
);

-- ---------------------------------------------------------------------------
-- audit_logs
-- ---------------------------------------------------------------------------
CREATE TABLE audit_logs (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id    UUID REFERENCES profiles(id),
    action      TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    table_name  TEXT NOT NULL,
    record_id   UUID NOT NULL,
    old_data    JSONB,
    new_data    JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- settings
-- ---------------------------------------------------------------------------
CREATE TABLE settings (
    id          SERIAL PRIMARY KEY,
    key         TEXT UNIQUE NOT NULL,
    value       NUMERIC NOT NULL,
    updated_by  UUID REFERENCES profiles(id),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO settings (key, value) VALUES
    ('penalty_percentage',       5),
    ('loan_eligibility_percent', 80),
    ('monthly_due_day',          10),
    ('roi_category_b',           36),
    ('roi_category_c_24',        16),
    ('roi_category_c_36',        27);

-- ---------------------------------------------------------------------------
-- Indices on FK columns to keep lookups fast at scale
-- ---------------------------------------------------------------------------
CREATE INDEX idx_members_status         ON members(status);
CREATE INDEX idx_members_category       ON members(category);
CREATE INDEX idx_savings_member_id      ON savings_installments(member_id);
CREATE INDEX idx_savings_month_year     ON savings_installments(month_year);
CREATE INDEX idx_loans_member_id        ON loans(member_id);
CREATE INDEX idx_loans_status           ON loans(status);
CREATE INDEX idx_repayments_loan_id     ON loan_repayments(loan_id);
CREATE INDEX idx_audit_table_record     ON audit_logs(table_name, record_id);
CREATE INDEX idx_audit_admin_id         ON audit_logs(admin_id);

-- ===========================================================================
-- Helper: is_admin(uid)  — used by every policy. SECURITY DEFINER to avoid
-- recursive RLS lookups against the profiles table itself.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.is_admin(uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles WHERE id = uid AND role = 'admin'
    );
$$;

REVOKE ALL ON FUNCTION public.is_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated;

-- ===========================================================================
-- Row-level security
-- ===========================================================================
ALTER TABLE profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE members              ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans                ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_repayments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings             ENABLE ROW LEVEL SECURITY;

-- profiles ------------------------------------------------------------------
CREATE POLICY "profiles_select_own_or_admin" ON profiles
    FOR SELECT TO authenticated
    USING (id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "profiles_update_own_or_admin" ON profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid() OR public.is_admin(auth.uid()))
    WITH CHECK (
        -- Members cannot self-promote: only admins may change the role column.
        (id = auth.uid() AND role = (SELECT role FROM profiles WHERE id = auth.uid()))
        OR public.is_admin(auth.uid())
    );

CREATE POLICY "profiles_admin_full" ON profiles
    FOR ALL TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

-- members -------------------------------------------------------------------
CREATE POLICY "members_select_own_or_admin" ON members
    FOR SELECT TO authenticated
    USING (id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "members_admin_full" ON members
    FOR ALL TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

-- savings_installments ------------------------------------------------------
CREATE POLICY "savings_select_own_or_admin" ON savings_installments
    FOR SELECT TO authenticated
    USING (member_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "savings_admin_full" ON savings_installments
    FOR ALL TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

-- loans ---------------------------------------------------------------------
CREATE POLICY "loans_select_own_or_admin" ON loans
    FOR SELECT TO authenticated
    USING (member_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "loans_admin_full" ON loans
    FOR ALL TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

-- loan_repayments -----------------------------------------------------------
CREATE POLICY "repayments_select_own_or_admin" ON loan_repayments
    FOR SELECT TO authenticated
    USING (
        public.is_admin(auth.uid())
        OR EXISTS (
            SELECT 1 FROM loans
            WHERE loans.id = loan_repayments.loan_id
              AND loans.member_id = auth.uid()
        )
    );

CREATE POLICY "repayments_admin_full" ON loan_repayments
    FOR ALL TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

-- audit_logs (read-only for admins, write via trigger only) -----------------
CREATE POLICY "audit_admin_select" ON audit_logs
    FOR SELECT TO authenticated
    USING (public.is_admin(auth.uid()));

-- settings ------------------------------------------------------------------
CREATE POLICY "settings_select_all" ON settings
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "settings_admin_full" ON settings
    FOR ALL TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

-- ===========================================================================
-- Audit log trigger
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    admin_uuid UUID := auth.uid();
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (admin_id, action, table_name, record_id, new_data)
        VALUES (admin_uuid, 'INSERT', TG_TABLE_NAME, NEW.id, row_to_json(NEW)::jsonb);
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (admin_id, action, table_name, record_id, old_data, new_data)
        VALUES (admin_uuid, 'UPDATE', TG_TABLE_NAME, NEW.id, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (admin_id, action, table_name, record_id, old_data)
        VALUES (admin_uuid, 'DELETE', TG_TABLE_NAME, OLD.id, row_to_json(OLD)::jsonb);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER audit_members_trigger    AFTER INSERT OR UPDATE OR DELETE ON members              FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_savings_trigger    AFTER INSERT OR UPDATE OR DELETE ON savings_installments FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_loans_trigger      AFTER INSERT OR UPDATE OR DELETE ON loans                FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_repayments_trigger AFTER INSERT OR UPDATE OR DELETE ON loan_repayments      FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- ===========================================================================
-- Member-code auto-generation (EUS/MMYYYY/<cat>/<seq>)
-- The org prefix is read from the `member_code_prefix` setting at INSERT
-- time so future clients can use their own prefix without code changes.
-- ===========================================================================
INSERT INTO settings (key, value) VALUES ('member_code_prefix_placeholder', 0)
    ON CONFLICT (key) DO NOTHING;

-- Store text prefixes in a separate small table to avoid mixing types in
-- the numeric `settings` table.
CREATE TABLE IF NOT EXISTS app_text_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
INSERT INTO app_text_settings (key, value) VALUES ('member_code_prefix', 'EUS')
    ON CONFLICT (key) DO NOTHING;

ALTER TABLE app_text_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "text_settings_select_all" ON app_text_settings
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "text_settings_admin_full" ON app_text_settings
    FOR ALL TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.generate_member_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    month_year_str TEXT;
    seq_num        INTEGER;
    prefix         TEXT;
BEGIN
    SELECT value INTO prefix FROM app_text_settings WHERE key = 'member_code_prefix';
    IF prefix IS NULL THEN
        prefix := 'EUS';
    END IF;

    month_year_str := to_char(NEW.join_date, 'MMYYYY');

    SELECT COUNT(*) + 1 INTO seq_num
    FROM members
    WHERE category = NEW.category
      AND to_char(join_date, 'MMYYYY') = month_year_str;

    NEW.member_code := prefix || '/' || month_year_str || '/' || NEW.category || '/' || lpad(seq_num::TEXT, 3, '0');
    RETURN NEW;
END;
$$;

CREATE TRIGGER set_member_code BEFORE INSERT ON members
    FOR EACH ROW WHEN (NEW.member_code IS NULL)
    EXECUTE FUNCTION public.generate_member_code();

-- ===========================================================================
-- Admin bootstrap helpers
-- ---------------------------------------------------------------------------
-- After signing up the first admin via the Supabase dashboard (Auth → Users →
-- "Add user"), the operator runs:
--     SELECT public.promote_to_admin('first.admin@example.com');
-- This sets profile.role = 'admin' for that user (creating the profile row
-- if it doesn't already exist).
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.promote_to_admin(target_email TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_uid UUID;
BEGIN
    SELECT id INTO target_uid FROM auth.users WHERE email = target_email;
    IF target_uid IS NULL THEN
        RAISE EXCEPTION 'No auth.users row found for email %', target_email;
    END IF;

    INSERT INTO profiles (id, full_name, role)
    VALUES (target_uid, COALESCE((SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = target_uid), 'Administrator'), 'admin')
    ON CONFLICT (id) DO UPDATE SET role = 'admin';

    RETURN target_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.promote_to_admin(TEXT) FROM PUBLIC;
-- Only the service_role (used in seed scripts / SQL editor) may call this.
GRANT EXECUTE ON FUNCTION public.promote_to_admin(TEXT) TO service_role;

-- ===========================================================================
-- org_profile  (single-row table for editable org details surfaced in admin UI)
-- ===========================================================================
CREATE TABLE org_profile (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    logo_url    TEXT,
    email       TEXT,
    phone       TEXT,
    address     TEXT,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO org_profile (name, logo_url, email, phone, address)
VALUES (
    'Ekata Unnayan Sanstha',
    'https://i.ibb.co/xKRYj0f4/euslogo.png',
    'info@example.org',
    '+91 9999999999',
    'Update via Admin → Settings → Organization'
);

ALTER TABLE org_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_profile_select_all" ON org_profile
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "org_profile_admin_full" ON org_profile
    FOR ALL TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

-- ===========================================================================
-- Storage bucket for member photos
-- ---------------------------------------------------------------------------
-- The Supabase Storage bucket itself must be created via the dashboard or CLI
-- (the storage API is not available from raw SQL in fresh projects). See
-- README → "Storage setup".
-- ===========================================================================
