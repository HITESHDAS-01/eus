-- ===========================================================================
-- Fix: Atomic member-code generation to eliminate parallel-import race condition
-- ===========================================================================
-- The previous generate_member_code() trigger used SELECT COUNT(*) + 1 which
-- is not atomic under parallel execution. Two concurrent inserts with the
-- same join month + category could read the same count, generate the same
-- code, and hit the UNIQUE constraint on member_code.
--
-- Fix: introduce a counter table with INSERT ON CONFLICT DO UPDATE, which is
-- atomic in PostgreSQL. Each category+month pair gets its own counter row
-- that is incremented safely even under heavy parallel load.
-- ===========================================================================

-- 1. Counter table -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS member_code_counters (
    category   TEXT NOT NULL,
    month_year TEXT NOT NULL,
    seq        INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (category, month_year)
);

ALTER TABLE member_code_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "member_code_counters_select_all" ON member_code_counters
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "member_code_counters_service_full" ON member_code_counters
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- 2. Updated trigger ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_member_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    month_year_str TEXT;
    seq_num        INTEGER;
    prefix         TEXT;
    new_code       TEXT;
BEGIN
    SELECT value INTO prefix FROM app_text_settings WHERE key = 'member_code_prefix';
    IF prefix IS NULL THEN
        prefix := 'EUS';
    END IF;

    month_year_str := to_char(NEW.join_date, 'MMYYYY');

    LOOP
        -- Atomic increment: INSERT a new row or INCREMENT the existing one.
        INSERT INTO member_code_counters (category, month_year, seq)
        VALUES (NEW.category, month_year_str, 1)
        ON CONFLICT (category, month_year)
        DO UPDATE SET seq = member_code_counters.seq + 1
        RETURNING seq INTO seq_num;

        new_code := prefix || '/' || month_year_str || '/' || NEW.category || '/' || lpad(seq_num::TEXT, 3, '0');

        -- If the code doesn't exist yet, use it. Otherwise loop and try next.
        EXIT WHEN NOT EXISTS (SELECT 1 FROM members WHERE member_code = new_code);
    END LOOP;

    NEW.member_code := new_code;
    RETURN NEW;
END;
$$;

-- 3. Seed the counter table with current member counts so existing codes are
--    respected and new imports continue from the correct sequence number.
INSERT INTO member_code_counters (category, month_year, seq)
SELECT
    category,
    to_char(join_date, 'MMYYYY') AS month_year,
    COUNT(*)::INTEGER
FROM members
GROUP BY category, to_char(join_date, 'MMYYYY')
ON CONFLICT (category, month_year) DO NOTHING;
