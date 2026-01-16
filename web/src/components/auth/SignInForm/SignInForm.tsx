import { InlineError } from '@/components/InlineError/InlineError';
import { LiveRegion } from '@/components/LiveRegion/LiveRegion';
import { LoadingButton } from '@/components/LoadingButton/LoadingButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useLiveRegion } from '@/hooks/useLiveRegion';
import { Link } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';

export function SignInForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signIn } = useAuth();

  const { message, announce } = useLiveRegion();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await signIn(email, password);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? `Login failed: ${error.message}` : 'Login Failed';
      setError(errorMessage);
      announce(errorMessage);
    } finally {
      setIsLoading(false);
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
            <form onSubmit={handleSubmit} className="space-y-4">
              <LiveRegion message={message} />
              {error && <InlineError message={error} />}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <LoadingButton
                type="submit"
                className="w-full"
                isLoading={isLoading}
                loadingText="Signing in..."
              >
                Sign In
              </LoadingButton>
            </form>
          </CardContent>
        </Card>
        <div className="text-center">
          <Button variant="link" asChild className="text-sm">
            <Link to="/sign-up">Don't have an account? Sign up</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
