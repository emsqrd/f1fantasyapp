import { ErrorFallback } from '@/components/ErrorFallback/ErrorFallback';
import { Button } from '@/components/ui/button';
import { type ErrorComponentProps, Link, useRouter } from '@tanstack/react-router';

export function RouteErrorComponent({ error }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <ErrorFallback
      error={error}
      // invalidate() re-runs the loader and resets the boundary; reset() only
      // clears the boundary UI, leaving a loader error to re-throw immediately.
      onReset={() => router.invalidate()}
      secondaryAction={
        <Button asChild variant="outline">
          <Link to="/">Go home</Link>
        </Button>
      }
    />
  );
}
