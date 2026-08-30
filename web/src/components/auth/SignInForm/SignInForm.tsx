import { FormFieldInput, FormFieldPassword } from '@/components/FormField/FormField';
import { InlineError } from '@/components/InlineError/InlineError';
import { LiveRegion } from '@/components/LiveRegion/LiveRegion';
import { LoadingButton } from '@/components/LoadingButton/LoadingButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useLiveRegion } from '@/hooks/useLiveRegion';
import { type SignInFormData, signInFormSchema } from '@/validations/signInFormSchema';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

export function SignInForm() {
  const [error, setError] = useState<string | null>(null);
  const { signIn, startAuthTransition, completeAuthTransition } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ from: '/_unauthenticated/sign-in' });

  const { message, announce } = useLiveRegion();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInFormData>({
    resolver: zodResolver(signInFormSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (formData: SignInFormData) => {
    setError(null);

    try {
      await signIn(formData.email, formData.password);
      startAuthTransition();

      if (search.redirect) {
        await navigate({ to: search.redirect });
      } else {
        await navigate({ to: '/' });
      }
      completeAuthTransition();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? `Login failed: ${error.message}` : 'Login Failed';
      setError(errorMessage);
      announce(errorMessage);
    }
  };

  return (
    <div className="flex w-full items-center justify-center p-8 md:min-h-screen">
      <div className="w-full max-w-md space-y-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
            <CardDescription>Sign in to access your F1 fantasy league</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <LiveRegion message={message} />
              {error && <InlineError message={error} />}

              <FormFieldInput
                label="Email"
                id="email"
                type="email"
                autoComplete="email"
                error={errors.email?.message}
                register={register('email')}
              />

              <FormFieldPassword
                label="Password"
                id="password"
                autoComplete="current-password"
                error={errors.password?.message}
                labelAction={
                  <Button variant="link" asChild className="h-auto p-0 text-sm">
                    <Link to="/forgot-password">Forgot password?</Link>
                  </Button>
                }
                register={register('password')}
              />

              <LoadingButton
                type="submit"
                className="w-full"
                isLoading={isSubmitting}
                loadingText="Signing in..."
              >
                Sign In
              </LoadingButton>
            </form>
          </CardContent>
        </Card>
        <div className="text-center">
          <Button variant="link" asChild className="text-sm">
            <Link to="/sign-up" search={{ redirect: search.redirect }}>
              Don't have an account? Sign up
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
