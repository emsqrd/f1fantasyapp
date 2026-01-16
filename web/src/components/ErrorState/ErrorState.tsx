import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

interface Props {
  message: string;
  onRetry?: () => void;
}

// Full-page error display for data fetching failures
export function ErrorState({ message, onRetry }: Props) {
  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center space-y-4 p-8 text-center"
      role="alert"
    >
      <AlertCircle className="text-destructive h-12 w-12" aria-hidden="true" />
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Error</h2>
        <p className="text-muted-foreground">{message}</p>
      </div>
      {onRetry && (
        <Button onClick={onRetry} variant="default">
          Try again
        </Button>
      )}
    </div>
  );
}
