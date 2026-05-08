-- Server-side enforcement of file size + MIME type for the avatars bucket.
-- Mirrors the client validation in web/src/hooks/useAvatarUpload.ts.
UPDATE storage.buckets
SET file_size_limit = 5242880,                                          -- 5 MB
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'avatars';
