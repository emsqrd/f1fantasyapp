-- Address Supabase database linter security warnings reported by
-- mcp__supabase__get_advisors / dashboard advisor.

-- Pin search_path on the RLS event-trigger function (lint 0011).
ALTER FUNCTION public.enable_rls_on_new_public_tables()
    SET search_path = pg_catalog, public;

-- Avatars: storage.objects SELECT scoped to the owning user (lint 0025).
-- Supabase Storage uploads use INSERT ... RETURNING *, which Postgres
-- enforces against SELECT policies. Public CDN reads via
-- /storage/v1/object/public/... bypass RLS for public buckets.
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;

DROP POLICY IF EXISTS "Users can read their own avatar" ON storage.objects;
CREATE POLICY "Users can read their own avatar"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Remove RPC surface for the auth.users trigger function (lints 0028, 0029).
-- The trigger fires automatically on INSERT INTO auth.users; no role needs
-- EXECUTE via PostgREST.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
