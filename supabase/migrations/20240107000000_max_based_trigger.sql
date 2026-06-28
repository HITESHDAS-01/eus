-- ===========================================================================
-- Fix: Derive member code from MAX() on members table (no counter table)
-- ===========================================================================
-- Problem: The member_code_counters table required manual reset when all
-- members were deleted. This migration replaces it with a trigger that
-- reads the highest existing code per category directly from the members
-- table. Deleting members automatically "resets" the numbering.
-- ===========================================================================

-- 1. Drop the counter table (no longer needed) -----------------------------
DROP TABLE IF EXISTS member_code_counters;

-- 2. Replace trigger with MAX()-based version ------------------------------
CREATE OR REPLACE FUNCTION public.generate_member_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    month_year_str TEXT;
    seq_num        INTEGER;
    prefix         TEXT;
    new_code       TEXT;
    max_seq        INTEGER;
BEGIN
    SELECT value INTO prefix FROM app_text_settings WHERE key = 'member_code_prefix';
    IF prefix IS NULL THEN
        prefix := 'EUS';
    END IF;

    month_year_str := to_char(NEW.join_date, 'MMYYYY');

    -- Find the highest existing sequential number across ALL months for this category
    SELECT COALESCE(
        MAX((regexp_replace(member_code, '^.*/', '', 'g'))::INTEGER),
        0
    ) INTO max_seq
    FROM members
    WHERE category = NEW.category
      AND member_code IS NOT NULL;

    seq_num := max_seq + 1;
    new_code := prefix || '/' || month_year_str || '/' || NEW.category || '/' || lpad(seq_num::TEXT, 3, '0');

    -- Collision safety loop (shouldn't be needed but just in case)
    WHILE EXISTS (SELECT 1 FROM members WHERE member_code = new_code) LOOP
        seq_num := seq_num + 1;
        new_code := prefix || '/' || month_year_str || '/' || NEW.category || '/' || lpad(seq_num::TEXT, 3, '0');
    END LOOP;

    NEW.member_code := new_code;
    RETURN NEW;
END;
$$;

-- 3. Re-create the trigger (drop first to ensure it points to the new function)
DROP TRIGGER IF EXISTS trg_generate_member_code ON members;
CREATE TRIGGER trg_generate_member_code
  BEFORE INSERT ON members
  FOR EACH ROW EXECUTE FUNCTION generate_member_code();
