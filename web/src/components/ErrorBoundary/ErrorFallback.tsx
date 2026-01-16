import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

interface Props {
  error: Error | null;
  onReset?: () => void;
  level?: 'page' | 'section';
}

// Displays user-friendly error UI with optional retry functionality
export function ErrorFallback({ error, onReset, level = 'page' }: Props) {
  const isPageLevel = level === 'page';

  return (
    <div
      className={`flex items-center justify-center ${isPageLevel ? 'min-h-screen' : 'min-h-[400px]'} bg-background p-4`}
    >
      <Card className="w-full max-w-md p-6">
        <div className="flex flex-col items-center space-y-4 text-center">
          <AlertCircle className="text-destructive h-12 w-12" aria-hidden="true" />
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold">Something went wrong</h2>
            <p className="text-muted-foreground">
              {isPageLevel
                ? 'We encountered an unexpected error. Please try refreshing the page.'
                : 'We encountered an unexpected error in this section.'}
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
          {onReset && (
            <Button onClick={onReset} variant="default">
              Try again
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
