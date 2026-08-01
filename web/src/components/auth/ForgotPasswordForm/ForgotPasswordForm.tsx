import { InlineError } from '@/components/InlineError/InlineError';
import { LiveRegion } from '@/components/LiveRegion/LiveRegion';
import { LoadingButton } from '@/components/LoadingButton/LoadingButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLiveRegion } from '@/hooks/useLiveRegion';
import { sendPasswordResetEmail } from '@/lib/auth-password';
import * as Sentry from '@sentry/react';
import { isAuthApiError, isAuthRetryableFetchError } from '@supabase/supabase-js';
import { Link } from '@tanstack/react-router';
import { Mail } from 'lucide-react';
import { type SyntheticEvent, useState } from 'react';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { message, announce } = useLiveRegion();

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await sendPasswordResetEmail(email);
      setSubmitted(true);
    } catch (err) {
      // A no-response failure is account-independent, so it's safe to show. Any
      // HTTP status could reveal the account exists so every status looks like
      // a successful send.
      if (isAuthRetryableFetchError(err) && err.status === 0) {
        const failure = "We couldn't reach the server. Check your connection and try again.";
        setError(failure);
        announce(failure);
      } else {
        if (!(isAuthApiError(err) && err.code === 'over_email_send_rate_limit')) {
          Sentry.captureException(err, {
            tags: { component: 'ForgotPasswordForm', operation: 'sendPasswordResetEmail' },
          });
        }
        setSubmitted(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex w-full items-center justify-center p-8 md:min-h-screen">
        <div className="w-full max-w-md space-y-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Check your email</CardTitle>
              <CardDescription>
                If an account exists for{' '}
                <span className="text-foreground font-medium">{email}</span>, we sent a password
                reset link.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/50 text-muted-foreground flex items-start gap-2.5 rounded-md p-3 text-sm">
                <Mail className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <p>Don't see it? Check your spam folder.</p>
              </div>
            </CardContent>
          </Card>
          <div className="text-center">
            <Button variant="link" asChild className="text-sm">
              <Link to="/sign-in">Back to sign in</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full items-center justify-center p-8 md:min-h-screen">
      <div className="w-full max-w-md space-y-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Reset your password</CardTitle>
            <CardDescription>
              Enter your email and we'll send you a link to reset your password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <LiveRegion message={message} />
              {error && <InlineError message={error} />}
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <LoadingButton
                type="submit"
                className="w-full"
                isLoading={isLoading}
                loadingText="Sending..."
              >
                Send reset link
              </LoadingButton>
            </form>
          </CardContent>
        </Card>
        <div className="text-center">
          <Button variant="link" asChild className="text-sm">
            <Link to="/sign-in">Back to sign in</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
