import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import * as React from 'react';

interface LoadingButtonProps extends React.ComponentProps<typeof Button> {
  isLoading?: boolean;
  loadingText?: string;
}

// Button with loading state using aria-busy instead of disabled
export function LoadingButton({
  isLoading = false,
  loadingText = 'Loading...',
  children,
  ...props
}: LoadingButtonProps) {
  return (
    <Button aria-busy={isLoading} {...props}>
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          {loadingText}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
