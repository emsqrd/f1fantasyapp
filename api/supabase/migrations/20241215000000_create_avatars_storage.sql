-- Create avatars storage bucket for user profile pictures
-- This migration sets up the storage bucket and Row Level Security policies
-- for avatar uploads in the F1 Fantasy Sports application

-- Create avatars bucket (public for read access)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Note: RLS is already enabled on storage.objects by default in Supabase
-- No need to run ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to upload their own avatar
-- Users can only upload to folders named with their user ID
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Allow public read access to all avatars
-- This enables avatar images to be displayed publicly
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Policy: Allow users to update their own avatars
-- Users can only update files in folders named with their user ID
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Allow users to delete their own avatars
-- Users can only delete files in folders named with their user ID
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);
