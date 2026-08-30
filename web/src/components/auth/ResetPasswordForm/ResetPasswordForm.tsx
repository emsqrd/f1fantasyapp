import { FormFieldPassword } from '@/components/FormField/FormField';
import { InlineError } from '@/components/InlineError/InlineError';
import { LiveRegion } from '@/components/LiveRegion/LiveRegion';
import { LoadingButton } from '@/components/LoadingButton/LoadingButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLiveRegion } from '@/hooks/useLiveRegion';
import { completePasswordReset, verifyRecoveryToken } from '@/lib/auth-password';
import { PASSWORD_HINT } from '@/validations/passwordPolicy';
import {
  type ResetPasswordFormData,
  resetPasswordFormSchema,
} from '@/validations/resetPasswordFormSchema';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Sentry from '@sentry/react';
import { isAuthApiError } from '@supabase/supabase-js';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

export function ResetPasswordForm() {
  const search = useSearch({ from: '/reset-password' });
  // What this reset attempt holds, not a live read of the URL: the first submit
  // spends the token, so the params keep carrying one long after it is dead.
  const [recoveryToken] = useState(() =>
    search.type === 'recovery' ? (search.token_hash ?? null) : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [tokenRejected, setTokenRejected] = useState(false);
  const hasSpentToken = useRef(false);
  const navigate = useNavigate();
  const { message, announce } = useLiveRegion();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

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

  const onSubmit = async (formData: ResetPasswordFormData) => {
    if (!hasSpentToken.current) {
      try {
        await verifyRecoveryToken(recoveryToken);
      } catch (verifyError) {
        // Only an explicit expired/invalid verdict means the token is truly
        // dead. A network or server failure leaves it unspent, so keep the form
        // for a retry instead of sending them to request a new link.
        if (isAuthApiError(verifyError) && verifyError.code === 'otp_expired') {
          setTokenRejected(true);
          return;
        }

        Sentry.captureException(verifyError, {
          tags: { component: 'ResetPasswordForm', operation: 'verifyRecoveryToken' },
        });
        const errorMessage = "Couldn't verify your reset link. Please try again.";
        setError(errorMessage);
        announce(errorMessage);
        return;
      }

      // Don't re-verify a rejected password
      hasSpentToken.current = true;
    }

    try {
      await completePasswordReset(formData.password);
      // Send them into the app, not to sign-in, after a successful reset.
      await navigate({ to: '/', replace: true });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Password reset failed';
      setError(errorMessage);
      announce(errorMessage);
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
          <form
            onSubmit={(event) => {
              if (isSubmitting) {
                event.preventDefault();
                return;
              }

              setError(null);
              void handleSubmit(onSubmit)(event);
            }}
            className="space-y-4"
            noValidate
          >
            <LiveRegion message={message} />
            {error && <InlineError message={error} />}

            <FormFieldPassword
              label="New Password"
              id="new-password"
              autoComplete="new-password"
              helpText={PASSWORD_HINT}
              error={errors.password?.message}
              register={register('password', { deps: 'confirmPassword' })}
            />

            <FormFieldPassword
              label="Confirm Password"
              id="confirm-password"
              autoComplete="new-password"
              error={errors.confirmPassword?.message}
              register={register('confirmPassword')}
            />

            <LoadingButton
              type="submit"
              className="w-full"
              isLoading={isSubmitting}
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
