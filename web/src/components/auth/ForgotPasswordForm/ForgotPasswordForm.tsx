import { InlineError } from '@/components/InlineError/InlineError';
import { LoadingButton } from '@/components/LoadingButton/LoadingButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sendPasswordResetEmail } from '@/lib/auth-password';
import * as Sentry from '@sentry/react';
import { isAuthApiError } from '@supabase/supabase-js';
import { Link, useSearch } from '@tanstack/react-router';
import { Mail } from 'lucide-react';
import { type SyntheticEvent, useState } from 'react';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const search = useSearch({ from: '/_unauthenticated/forgot-password' });

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await sendPasswordResetEmail(email);
    } catch (err) {
      // Surface nothing either way: an unknown address never sends, so it never
      // hits the rate limit — showing a rate-limit error would leak account
      // existence. Rate limit stays silent; unexpected failures are captured but
      // still look like success to the user.
      const isRateLimit = isAuthApiError(err) && err.code === 'over_email_send_rate_limit';
      if (!isRateLimit) {
        Sentry.captureException(err, {
          tags: { component: 'ForgotPasswordForm', operation: 'sendPasswordResetEmail' },
        });
      }
    } finally {
      setIsLoading(false);
      setSubmitted(true);
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
            {search.error === 'expired' && (
              <div className="mb-4">
                <InlineError message="That reset link is no longer valid. Enter your email to request a new one." />
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
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
