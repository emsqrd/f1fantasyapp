import { InlineError } from '@/components/InlineError/InlineError';
import { LiveRegion } from '@/components/LiveRegion/LiveRegion';
import { LoadingButton } from '@/components/LoadingButton/LoadingButton';
import { CheckEmailNotice } from '@/components/auth/CheckEmailNotice/CheckEmailNotice';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useLiveRegion } from '@/hooks/useLiveRegion';
import { resendConfirmation } from '@/lib/auth-resend';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';

const CONFIRMATION_ERROR_MESSAGES = {
  expired: 'This confirmation link is no longer valid. Sign up again to receive a new one.',
  generic: "We couldn't confirm your email. Please try signing up again.",
} as const;

export function SignUpForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const { signUp, startAuthTransition, completeAuthTransition } = useAuth();

  const navigate = useNavigate();
  const search = useSearch({ from: '/_unauthenticated/sign-up' });
  const { confirmationError } = search;
  const confirmationErrorMessage =
    confirmationError && CONFIRMATION_ERROR_MESSAGES[confirmationError];
  const destination = search.redirect ?? '/';
  const emailRedirectTo = `${window.location.origin}${destination}`;

  const completeSignUp = async () => {
    startAuthTransition();
    try {
      await navigate({ to: destination });
    } finally {
      completeAuthTransition();
    }
  };

  const { message, announce } = useLiveRegion();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Client-side validation
    if (!displayName.trim()) {
      const errorMessage = 'Display name is required';
      setError(errorMessage);
      announce(errorMessage);
      setIsLoading(false);
      return;
    }

    if (displayName.trim().length > 50) {
      const errorMessage = 'Display name must be less than 50 characters';
      setError(errorMessage);
      announce(errorMessage);
      setIsLoading(false);
      return;
    }

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

    try {
      const { session } = await signUp(email, password, { displayName }, { emailRedirectTo });

      if (!session) {
        setAwaitingConfirmation(true);
        return;
      }

      await completeSignUp();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sign up failed';
      setError(errorMessage);
      announce(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex w-full items-center justify-center p-4 sm:p-8 md:min-h-screen">
      <div className="w-full max-w-md space-y-4">
        {awaitingConfirmation ? (
          <CheckEmailNotice
            email={email}
            onVerified={completeSignUp}
            onResend={() => resendConfirmation(email, { emailRedirectTo })}
          />
        ) : (
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Create Account</CardTitle>
              <CardDescription>Join the F1 Fantasy Sports App</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <LiveRegion message={message} />
                {confirmationErrorMessage && <InlineError message={confirmationErrorMessage} />}
                {error && <InlineError message={error} />}

                <div className="space-y-2">
                  <Label htmlFor="display-name">Display Name</Label>
                  <Input
                    id="display-name"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                    autoComplete="name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
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
                  loadingText="Creating account..."
                >
                  Sign Up
                </LoadingButton>
              </form>
            </CardContent>
          </Card>
        )}
        <div className="text-center">
          <Button variant="link" asChild className="text-sm">
            <Link to="/sign-in" search={{ redirect: search.redirect }}>
              Already have an account? Sign in
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
