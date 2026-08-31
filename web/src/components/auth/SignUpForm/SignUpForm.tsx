import { FormFieldInput, FormFieldPassword } from '@/components/FormField/FormField';
import { InlineError } from '@/components/InlineError/InlineError';
import { LiveRegion } from '@/components/LiveRegion/LiveRegion';
import { LoadingButton } from '@/components/LoadingButton/LoadingButton';
import { CheckEmailNotice } from '@/components/auth/CheckEmailNotice/CheckEmailNotice';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useLiveRegion } from '@/hooks/useLiveRegion';
import { resendConfirmation } from '@/lib/auth-resend';
import { PASSWORD_HINT } from '@/validations/passwordPolicy';
import { type SignUpFormData, signUpFormSchema } from '@/validations/signUpFormSchema';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

const CONFIRMATION_ERROR_MESSAGES = {
  expired: 'This confirmation link is no longer valid. Sign up again to receive a new one.',
  generic: "We couldn't confirm your email. Please try signing up again.",
} as const;

export function SignUpForm() {
  const [error, setError] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const { signUp, startAuthTransition, completeAuthTransition } = useAuth();

  const navigate = useNavigate();
  const search = useSearch({ from: '/_unauthenticated/sign-up' });
  const { confirmationError } = search;
  const confirmationErrorMessage =
    confirmationError && CONFIRMATION_ERROR_MESSAGES[confirmationError];
  const destination = search.redirect ?? '/';
  const emailRedirectTo = `${window.location.origin}${destination}`;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpFormSchema),
    defaultValues: {
      displayName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const completeSignUp = async () => {
    startAuthTransition();
    try {
      await navigate({ to: destination });
    } finally {
      completeAuthTransition();
    }
  };

  const { message, announce, clear: clearAnnouncement } = useLiveRegion();

  const onSubmit = async (formData: SignUpFormData) => {
    try {
      const { session } = await signUp(
        formData.email,
        formData.password,
        { displayName: formData.displayName },
        { emailRedirectTo },
      );

      if (!session) {
        setPendingEmail(formData.email);
        return;
      }

      await completeSignUp();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sign up failed';
      setError(errorMessage);
      announce(errorMessage);
    }
  };

  return (
    <div className="flex w-full items-center justify-center p-4 sm:p-8 md:min-h-screen">
      <div className="w-full max-w-md space-y-4">
        {pendingEmail !== null ? (
          <CheckEmailNotice
            email={pendingEmail}
            onVerified={completeSignUp}
            onResend={() => resendConfirmation(pendingEmail, { emailRedirectTo })}
          />
        ) : (
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Create Account</CardTitle>
              <CardDescription>Join the F1 Fantasy Sports App</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(event) => {
                  setError(null);
                  clearAnnouncement();
                  void handleSubmit(onSubmit)(event);
                }}
                className="space-y-4"
                noValidate
              >
                <LiveRegion message={message} />
                {confirmationErrorMessage && <InlineError message={confirmationErrorMessage} />}
                {error && <InlineError message={error} />}

                <FormFieldInput
                  label="Display Name"
                  id="display-name"
                  autoComplete="name"
                  error={errors.displayName?.message}
                  register={register('displayName')}
                />

                <FormFieldInput
                  label="Email"
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  error={errors.email?.message}
                  register={register('email')}
                />

                <FormFieldPassword
                  label="Password"
                  id="signup-password"
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
