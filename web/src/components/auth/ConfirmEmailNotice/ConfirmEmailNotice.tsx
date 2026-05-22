import { LoadingButton } from '@/components/LoadingButton/LoadingButton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { defaultAuthedDestination } from '@/lib/router-context';
import { supabase } from '@/lib/supabase';
import { useNavigate, useRouteContext, useSearch } from '@tanstack/react-router';
import { useState } from 'react';

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

export function ConfirmEmailNotice() {
  const navigate = useNavigate();
  const search = useSearch({ from: '/auth/confirm' });
  const { teamContext } = useRouteContext({ from: '/auth/confirm' });
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const handleContinue = async () => {
    if (submitting) return;
    setSubmitting(true);

    // verifyOtp runs on this click, not on page load. The signup token is
    // one-time: an email-security scanner that prefetches the link would burn
    // it before the user ever arrives if verification happened on load.
    if (!user && search.token_hash && search.type) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: search.token_hash,
        type: search.type,
      });
      if (error) {
        const confirmationError = error.code === 'otp_expired' ? 'expired' : 'generic';
        await navigate({ to: '/sign-up', search: { confirmationError }, replace: true });
        return;
      }
    }

    const internalNext = resolveNextDestination(search.next);
    const destination = internalNext ?? defaultAuthedDestination(teamContext);
    await navigate({ to: destination, replace: true });
  };

  return (
    <div className="flex w-full items-center justify-center p-4 sm:p-8 md:min-h-screen">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h2 className="text-2xl font-semibold tracking-tight">Confirm your email</h2>
          <p className="text-muted-foreground text-sm">
            Click continue to confirm your email and head into F1 Fantasy.
          </p>
        </CardHeader>
        <CardContent>
          <LoadingButton
            type="button"
            className="w-full"
            onClick={handleContinue}
            isLoading={submitting}
            loadingText="Confirming..."
          >
            Continue
          </LoadingButton>
        </CardContent>
      </Card>
    </div>
  );
}
