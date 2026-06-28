-- ===========================================================================
-- Fix: Global counter per category (not per-month)
-- ===========================================================================
-- The previous counter table used (category, month_year) as the key, causing
-- member codes to restart from 001 each month. This migration changes the
-- key to just (category) so the sequence continues across all months:
--   EUS/032026/C/001 ... EUS/032026/C/025
--   EUS/042026/C/026 ... EUS/042026/C/048
--   EUS/052026/C/049 ...
-- ===========================================================================

-- 1. Recreate counter table with category-only key ---------------------------
DROP TABLE IF EXISTS member_code_counters;
CREATE TABLE member_code_counters (
    category TEXT PRIMARY KEY,
    seq      INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE member_code_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "member_code_counters_select_all" ON member_code_counters
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "member_code_counters_service_full" ON member_code_counters
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- 2. Updated trigger: counter key is just category ---------------------------
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
        INSERT INTO member_code_counters (category, seq)
        VALUES (NEW.category, 1)
        ON CONFLICT (category)
        DO UPDATE SET seq = member_code_counters.seq + 1
        RETURNING seq INTO seq_num;

        new_code := prefix || '/' || month_year_str || '/' || NEW.category || '/' || lpad(seq_num::TEXT, 3, '0');

        EXIT WHEN NOT EXISTS (SELECT 1 FROM members WHERE member_code = new_code);
    END LOOP;

    NEW.member_code := new_code;
    RETURN NEW;
END;
$$;

-- 3. Seed from highest existing code per category ----------------------------
INSERT INTO member_code_counters (category, seq)
SELECT
    category,
    COALESCE(
        MAX((regexp_match(member_code, '/(\d+)$'))[1])::INTEGER,
        0
    )
FROM members
WHERE member_code IS NOT NULL
GROUP BY category
ON CONFLICT (category) DO NOTHING;
