import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { defaultAuthedDestination } from '@/lib/router-context';
import { useNavigate, useRouteContext, useSearch } from '@tanstack/react-router';

function resolveNextDestination(next: string | undefined): string | null {
  if (!next) return null;
  try {
    const url = new URL(next, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    return url.pathname + url.search;
  } catch {
    return null;
  }
}

export function ConfirmedNotice() {
  const navigate = useNavigate();
  const search = useSearch({ from: '/auth/confirm' });
  const { teamContext } = useRouteContext({ from: '/auth/confirm' });

  const handleContinue = async () => {
    const internalNext = resolveNextDestination(search.next);
    const destination = internalNext ?? defaultAuthedDestination(teamContext);
    await navigate({ to: destination });
  };

  return (
    <div className="flex w-full items-center justify-center p-4 sm:p-8 md:min-h-screen">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h2 className="text-2xl font-semibold tracking-tight">Email confirmed</h2>
          <p className="text-muted-foreground text-sm">
            You're all set. Click continue to head into F1 Fantasy.
          </p>
        </CardHeader>
        <CardContent>
          <Button type="button" className="w-full" onClick={handleContinue}>
            Continue
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
