import { supabase } from '@/lib/supabase';
import { useCallback, useState } from 'react';

interface UseAvatarUploadProps {
  userId: string;
  bucketName?: string;
  onSuccess?: (url: string) => void;
  onError?: (error: string) => void;
}

interface UploadState {
  uploading: boolean;
  progress: number;
  error: string | null;
}

export function useAvatarUpload({
  userId,
  bucketName = 'avatars',
  onSuccess,
  onError,
}: UseAvatarUploadProps) {
  const [uploadState, setUploadState] = useState<UploadState>({
    uploading: false,
    progress: 0,
    error: null,
  });

  const uploadAvatar = useCallback(
    async (file: File) => {
      if (!file) return;

      // Validate file type and size
      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        const error = 'Please upload a valid image file (JPEG, PNG, or WebP)';
        setUploadState((prev) => ({ ...prev, error }));
        onError?.(error);
        return;
      }

      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        const error = 'File size must be less than 5MB';
        setUploadState((prev) => ({ ...prev, error }));
        onError?.(error);
        return;
      }

      setUploadState({ uploading: true, progress: 0, error: null });

      try {
        // Generate unique filename with timestamp
        const fileExtension = file.name.split('.').pop();
        const fileName = `${userId}-${Date.now()}.${fileExtension}`;
        const filePath = `${userId}/${fileName}`;

        // Upload file to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(filePath, file, {
            cacheControl: '3000',
            upsert: true, // Replace existing file if exists
          });

        if (uploadError) {
          throw uploadError;
        }

        // Get public url
        const {
          data: { publicUrl },
        } = supabase.storage.from(bucketName).getPublicUrl(filePath);

        setUploadState({ uploading: false, progress: 100, error: null });
        onSuccess?.(publicUrl);
        return publicUrl;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Upload failed';
        setUploadState({ uploading: false, progress: 0, error: errorMessage });
        onError?.(errorMessage);
      }
    },
    [userId, bucketName, onSuccess, onError],
  );

  return {
    uploadState,
    uploadAvatar,
    resetError: () => setUploadState((prev) => ({ ...prev, error: null })),
  };
}
