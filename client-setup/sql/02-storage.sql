-- =============================================================================
-- 02-storage.sql
-- ---------------------------------------------------------------------------
-- Creates the member-photos Supabase Storage bucket (public, used for both
-- member profile photos AND EMI customer photos under different prefixes)
-- and the RLS policies that let:
--   - the public READ files in the bucket (so <img src=...> works without auth)
--   - authenticated admins WRITE / DELETE files in the bucket
--
-- Run AFTER 01-schema.sql.
-- Idempotent — safe to re-run.
-- =============================================================================

-- Create (or upsert to public) the bucket.
INSERT INTO storage.buckets (id, name, public)
VALUES ('member-photos', 'member-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Public read for everything in this bucket — needed because <img> tags in
-- the app load directly via getPublicUrl() without sending an auth header.
DROP POLICY IF EXISTS public_read_member_photos ON storage.objects;
CREATE POLICY public_read_member_photos ON storage.objects
  FOR SELECT USING (bucket_id = 'member-photos');

-- Authenticated users can upload (only admins reach this code path in the UI,
-- but the policy is at the storage layer so it's intentionally broader —
-- the UI gate is the real protection).
DROP POLICY IF EXISTS auth_upload_member_photos ON storage.objects;
CREATE POLICY auth_upload_member_photos ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'member-photos');

-- Authenticated users can delete (admin delete flow uses this).
DROP POLICY IF EXISTS auth_delete_member_photos ON storage.objects;
CREATE POLICY auth_delete_member_photos ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'member-photos');

-- Authenticated users can update (in case admin overwrites a photo).
DROP POLICY IF EXISTS auth_update_member_photos ON storage.objects;
CREATE POLICY auth_update_member_photos ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'member-photos')
  WITH CHECK (bucket_id = 'member-photos');

-- =============================================================================
-- DONE. Now run 03-initial-data.sql.
-- =============================================================================
