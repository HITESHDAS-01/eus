-- =============================================================================
-- ADD MEMBER PERSONAL INFO COLUMNS
-- Run this in Supabase SQL Editor before deploying the updated Edge Function.
-- =============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS father_husband_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS aadhaar_vid TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nominee_name TEXT;
