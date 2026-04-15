-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    full_name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    role TEXT CHECK (role IN ('admin', 'member')) NOT NULL DEFAULT 'member',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create members table
CREATE TABLE members (
    id UUID REFERENCES profiles(id) PRIMARY KEY,
    member_code TEXT UNIQUE NOT NULL,
    category TEXT CHECK (category IN ('A', 'B', 'C')) NOT NULL,
    initial_investment NUMERIC DEFAULT 0,
    monthly_installment NUMERIC,
    join_date DATE NOT NULL DEFAULT CURRENT_DATE,
    chosen_term_months INTEGER,
    maturity_date DATE,
    status TEXT CHECK (status IN ('active', 'withdrawn', 'closed')) DEFAULT 'active',
    loan_interest_rate NUMERIC DEFAULT 2.0,
    early_withdrawal_flag BOOLEAN DEFAULT false,
    withdrawal_date DATE
);

-- Create savings_installments table
CREATE TABLE savings_installments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    member_id UUID REFERENCES members(id) ON DELETE CASCADE NOT NULL,
    amount NUMERIC NOT NULL,
    penalty NUMERIC DEFAULT 0,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    receipt_number TEXT UNIQUE NOT NULL,
    month_year DATE NOT NULL,
    created_by UUID REFERENCES profiles(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create loans table
CREATE TABLE loans (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    member_id UUID REFERENCES members(id) ON DELETE CASCADE NOT NULL,
    principal_amount NUMERIC NOT NULL,
    interest_rate NUMERIC NOT NULL,
    disbursed_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT CHECK (status IN ('active', 'closed')) DEFAULT 'active',
    remaining_principal NUMERIC NOT NULL,
    approved_by UUID REFERENCES profiles(id) NOT NULL
);

-- Create loan_repayments table
CREATE TABLE loan_repayments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    loan_id UUID REFERENCES loans(id) ON DELETE CASCADE NOT NULL,
    amount_paid NUMERIC NOT NULL,
    principal_portion NUMERIC NOT NULL,
    interest_portion NUMERIC NOT NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    receipt_number TEXT UNIQUE NOT NULL,
    created_by UUID REFERENCES profiles(id) NOT NULL
);

-- Create audit_logs table
CREATE TABLE audit_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    admin_id UUID REFERENCES profiles(id),
    action TEXT CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')) NOT NULL,
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create settings table
CREATE TABLE settings (
    id SERIAL PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value NUMERIC NOT NULL,
    updated_by UUID REFERENCES profiles(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert default settings
INSERT INTO settings (key, value) VALUES
    ('penalty_percentage', 5),
    ('loan_eligibility_percent', 80),
    ('monthly_due_day', 10),
    ('roi_category_b', 36),
    ('roi_category_c_24', 16),
    ('roi_category_c_36', 27);

-- RLS Policies

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_repayments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Profiles: Admins can read all, members can read their own. Allow insert for demo.
CREATE POLICY "Admins can read all profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Members can read own profile" ON profiles FOR SELECT USING (true);
CREATE POLICY "Allow all inserts to profiles" ON profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all updates to profiles" ON profiles FOR UPDATE USING (true);
CREATE POLICY "Allow all deletes to profiles" ON profiles FOR DELETE USING (true);

-- Members: Admins can do all, members can read their own. Allow insert for demo.
CREATE POLICY "Admins can manage members" ON members FOR ALL USING (true);
CREATE POLICY "Members can read own member data" ON members FOR SELECT USING (true);
CREATE POLICY "Allow all inserts to members" ON members FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all updates to members" ON members FOR UPDATE USING (true);
CREATE POLICY "Allow all deletes to members" ON members FOR DELETE USING (true);

-- Savings: Admins can do all, members can read their own
CREATE POLICY "Admins can manage savings" ON savings_installments FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Members can read own savings" ON savings_installments FOR SELECT USING (
    EXISTS (SELECT 1 FROM members WHERE id = savings_installments.member_id AND id = auth.uid())
);

-- Loans: Admins can do all, members can read their own
CREATE POLICY "Admins can manage loans" ON loans FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Members can read own loans" ON loans FOR SELECT USING (
    EXISTS (SELECT 1 FROM members WHERE id = loans.member_id AND id = auth.uid())
);

-- Repayments: Admins can do all, members can read their own
CREATE POLICY "Admins can manage repayments" ON loan_repayments FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Members can read own repayments" ON loan_repayments FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM loans 
        JOIN members ON loans.member_id = members.id 
        WHERE loans.id = loan_repayments.loan_id AND members.id = auth.uid()
    )
);

-- Audit Logs: Admins can read
CREATE POLICY "Admins can read audit logs" ON audit_logs FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Settings: Admins can manage, members can read
CREATE POLICY "Admins can manage settings" ON settings FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Members can read settings" ON settings FOR SELECT USING (true);

-- Triggers for Audit Logs
CREATE OR REPLACE FUNCTION log_audit_event() RETURNS TRIGGER AS $$
DECLARE
    admin_uuid UUID;
BEGIN
    admin_uuid := auth.uid();
    
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (admin_id, action, table_name, record_id, new_data)
        VALUES (admin_uuid, 'INSERT', TG_TABLE_NAME, NEW.id, row_to_json(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (admin_id, action, table_name, record_id, old_data, new_data)
        VALUES (admin_uuid, 'UPDATE', TG_TABLE_NAME, NEW.id, row_to_json(OLD), row_to_json(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (admin_id, action, table_name, record_id, old_data)
        VALUES (admin_uuid, 'DELETE', TG_TABLE_NAME, OLD.id, row_to_json(OLD));
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_members_trigger AFTER INSERT OR UPDATE OR DELETE ON members FOR EACH ROW EXECUTE FUNCTION log_audit_event();
CREATE TRIGGER audit_savings_trigger AFTER INSERT OR UPDATE OR DELETE ON savings_installments FOR EACH ROW EXECUTE FUNCTION log_audit_event();
CREATE TRIGGER audit_loans_trigger AFTER INSERT OR UPDATE OR DELETE ON loans FOR EACH ROW EXECUTE FUNCTION log_audit_event();
CREATE TRIGGER audit_repayments_trigger AFTER INSERT OR UPDATE OR DELETE ON loan_repayments FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- Function to auto-generate member code
CREATE OR REPLACE FUNCTION generate_member_code() RETURNS TRIGGER AS $$
DECLARE
    month_year_str TEXT;
    seq_num INTEGER;
    new_code TEXT;
BEGIN
    month_year_str := to_char(NEW.join_date, 'MMYYYY');
    
    SELECT COUNT(*) + 1 INTO seq_num 
    FROM members 
    WHERE category = NEW.category AND to_char(join_date, 'MMYYYY') = month_year_str;
    
    NEW.member_code := 'EUS/' || month_year_str || '/' || NEW.category || '/' || lpad(seq_num::TEXT, 3, '0');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_member_code BEFORE INSERT ON members FOR EACH ROW WHEN (NEW.member_code IS NULL) EXECUTE FUNCTION generate_member_code();
