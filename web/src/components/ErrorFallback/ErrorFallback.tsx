import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  error: Error | null;
  onReset?: () => void;
  secondaryAction?: ReactNode;
}

// Displays user-friendly error UI with optional retry functionality
export function ErrorFallback({ error, onReset, secondaryAction }: Props) {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md p-6">
        <div className="flex flex-col items-center space-y-4 text-center">
          <AlertCircle className="text-destructive h-12 w-12" aria-hidden="true" />
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold">Something went wrong</h2>
            <p className="text-muted-foreground">
              We encountered an unexpected error. Please try refreshing the page.
            </p>
            {error && (
              <details className="mt-4 text-left">
                <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-sm">
                  Error details
                </summary>
                <pre className="bg-muted mt-2 overflow-auto rounded p-2 text-xs">
                  {error.message}
                </pre>
              </details>
            )}
          </div>
          {(onReset || secondaryAction) && (
            <div className="flex flex-wrap items-center justify-center gap-3">
              {onReset && (
                <Button onClick={onReset} variant="default">
                  Try again
                </Button>
              )}
              {secondaryAction}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
