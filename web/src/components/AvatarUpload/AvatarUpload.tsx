import { useAvatarUpload } from '@/hooks/useAvatarUpload';
import { cn } from '@/lib/utils';
import { Camera, CircleUserIcon, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';

interface AvatarUploadProps {
  userId: string;
  currentAvatarUrl?: string;
  onAvatarChange: (url: string) => void;
  onError?: (error: string) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-12 w-12',
  md: 'h-16 w-16',
  lg: 'h-20 w-20',
};

const iconSizes = {
  sm: 48,
  md: 64,
  lg: 80,
};

export function AvatarUpload({
  userId,
  currentAvatarUrl = '',
  onAvatarChange,
  onError,
  size = 'lg',
  className,
}: AvatarUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [displayUrl, setDisplayUrl] = useState<string | undefined>(currentAvatarUrl || undefined);

  // Sync displayUrl when currentAvatarUrl changes from parent
  useEffect(() => {
    setDisplayUrl(currentAvatarUrl || undefined);
  }, [currentAvatarUrl]);

  const { uploadState, uploadAvatar } = useAvatarUpload({
    userId,
    onSuccess: (url) => {
      // Preload the new image before switching
      setIsImageLoading(true);
      const img = new Image();
      img.onload = () => {
        setDisplayUrl(url);
        setIsImageLoading(false);
        onAvatarChange(url);
      };
      img.onerror = () => {
        setIsImageLoading(false);
        onError?.('Failed to load new avatar image');
      };
      img.src = url;
    },
    onError: (error) => {
      setIsImageLoading(false);
      onError?.(error);
    },
  });

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Upload the file
    uploadAvatar(file);
  };

  const isLoading = uploadState.uploading || isImageLoading;

  return (
    <div className={cn('group relative', className)}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
        aria-label="Upload avatar image"
      />

      {/* Avatar Display */}
      <Avatar className={cn(sizeClasses[size], 'relative')}>
        <AvatarImage src={displayUrl} alt="Current avatar" />

        <AvatarFallback className="flex w-full items-center justify-center">
          <CircleUserIcon size={iconSizes[size]} className="text-muted-foreground" />
        </AvatarFallback>

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
            <Loader2 className="h-6 w-6 animate-spin text-white" />
          </div>
        )}
      </Avatar>

      {/* Upload/Edit Button */}
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className={cn(
          'absolute -right-1 -bottom-1 h-8 w-8 rounded-full p-0',
          'opacity-0 transition-opacity group-hover:opacity-100',
          'focus-visible:opacity-100',
        )}
        onClick={() => fileInputRef.current?.click()}
        disabled={uploadState.uploading}
        aria-label="Change avatar"
      >
        <Camera className="h-4 w-4" />
      </Button>

      {/* Error Display */}
      {uploadState.error && (
        <p className="text-destructive absolute top-full mt-1 text-xs">{uploadState.error}</p>
      )}
    </div>
  );
}
