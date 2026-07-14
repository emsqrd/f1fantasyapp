import { InlineError } from '@/components/InlineError/InlineError';
import { LiveRegion } from '@/components/LiveRegion/LiveRegion';
import { LoadingButton } from '@/components/LoadingButton/LoadingButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLiveRegion } from '@/hooks/useLiveRegion';
import { completePasswordReset, verifyRecoveryToken } from '@/lib/auth-password';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { type SyntheticEvent, useRef, useState } from 'react';

export function ResetPasswordForm() {
  const search = useSearch({ from: '/reset-password' });
  // What this reset attempt holds, not a live read of the URL: the first submit
  // spends the token, so the params keep carrying one long after it is dead.
  const [recoveryToken] = useState(() =>
    search.type === 'recovery' ? (search.token_hash ?? null) : null,
  );
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenRejected, setTokenRejected] = useState(false);
  const hasSpentToken = useRef(false);
  const navigate = useNavigate();
  const { message, announce } = useLiveRegion();

  // A link that carried nothing spendable and one gotrue refused are the same
  // dead end with the same remedy, so they read the same.
  if (!recoveryToken || tokenRejected) {
    return (
      <div className="flex w-full items-center justify-center p-4 sm:p-8 md:min-h-screen">
        <Card className="w-full max-w-md" role="alert">
          <CardHeader>
            <CardTitle>We couldn't use that reset link</CardTitle>
            <CardDescription>
              Reset links can only be used once, and they expire 60 minutes after they're sent.
              Request a new one to finish resetting your password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/forgot-password">Request a new link</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      const errorMessage = 'Passwords do not match';
      setError(errorMessage);
      announce(errorMessage);
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      const errorMessage = 'Password must be at least 6 characters';
      setError(errorMessage);
      announce(errorMessage);
      setIsLoading(false);
      return;
    }

    if (!hasSpentToken.current) {
      try {
        await verifyRecoveryToken(recoveryToken);
      } catch {
        setTokenRejected(true);
        setIsLoading(false);
        return;
      }

      // Don't re-verify a rejected password
      hasSpentToken.current = true;
    }

    try {
      await completePasswordReset(password);
      // Send them into the app, not to sign-in, after a successful reset.
      await navigate({ to: '/', replace: true });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Password reset failed';
      setError(errorMessage);
      announce(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex w-full items-center justify-center p-4 sm:p-8 md:min-h-screen">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Set a new password</CardTitle>
          <CardDescription>Choose a new password for your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <LiveRegion message={message} />
            {error && <InlineError message={error} />}

            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>

            <LoadingButton
              type="submit"
              className="w-full"
              isLoading={isLoading}
              loadingText="Updating password..."
            >
              Update password
            </LoadingButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
