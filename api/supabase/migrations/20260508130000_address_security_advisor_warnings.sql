-- Address Supabase database linter security warnings reported by
-- mcp__supabase__get_advisors / dashboard advisor.

-- Pin search_path on the RLS event-trigger function (lint 0011).
ALTER FUNCTION public.enable_rls_on_new_public_tables()
    SET search_path = pg_catalog, public;

-- Drop the broad SELECT policy on the public avatars bucket (lint 0025).
-- Public-bucket URL reads do not require this policy; it only enables
-- clients to list every file in the bucket via the storage API.
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;

-- Remove RPC surface for the auth.users trigger function (lints 0028, 0029).
-- The trigger fires automatically on INSERT INTO auth.users; no role needs
-- EXECUTE via PostgREST.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
