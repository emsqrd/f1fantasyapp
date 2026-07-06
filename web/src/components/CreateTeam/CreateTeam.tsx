import { useAuth } from '@/hooks/useAuth';
import { useLiveRegion } from '@/hooks/useLiveRegion';
import { createTeam, teamQueries } from '@/services/teamService';
import { profileQueries } from '@/services/userProfileService';
import { type CreateTeamFormData, createTeamFormSchema } from '@/validations/teamSchemas';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { AppContainer } from '../AppContainer/AppContainer';
import { FormFieldInput } from '../FormField/FormField';
import { InlineError } from '../InlineError/InlineError';
import { LiveRegion } from '../LiveRegion/LiveRegion';
import { LoadingButton } from '../LoadingButton/LoadingButton';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

export function CreateTeam() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const { message, announce } = useLiveRegion();
  const search = useSearch({ from: '/_authenticated/create-team' });

  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: profile } = useQuery({ ...profileQueries.current(), enabled: !!user });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateTeamFormData>({
    resolver: zodResolver(createTeamFormSchema),
    mode: 'onBlur',
    defaultValues: {
      teamName: '',
    },
  });

  const onSubmit = async (formData: CreateTeamFormData) => {
    setError(null);

    try {
      const createdTeam = await createTeam({
        name: formData.teamName,
      });

      // POST /teams returns a slimmer team than GET /me/team (id/name/owner only —
      // no budget or roster), so it must not be cached as the team query's value.
      // Evict the whole team namespace — the `null` cached for a no-team user
      // and the no-team Home summary — so the destination's requireTeam refetches
      // the full team and Home refetches the now-present summary. The profile
      // refresh updates hasTeam for dependent UI.
      queryClient.removeQueries({ queryKey: teamQueries.all });
      void queryClient.invalidateQueries({ queryKey: profileQueries.current().queryKey });

      // Navigate - TanStack Router handles navigation transitions
      if (search.redirect) {
        // When redirecting to an external path, use the string
        await navigate({ to: search.redirect });
      } else {
        // When going to default route, use type-safe routing
        await navigate({ to: '/team/$teamId', params: { teamId: String(createdTeam.id) } });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create team';
      setError(errorMessage);
      announce(errorMessage);
    }
  };

  if (profile?.hasTeam) {
    return (
      <AppContainer maxWidth="md">
        <div className="flex w-full items-center justify-center p-8 md:min-h-screen">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-center text-3xl font-bold">Pump the Brakes</CardTitle>
              <p className="text-muted-foreground text-center">
                You can only have one team per season and you've already got one.
              </p>
            </CardHeader>
          </Card>
        </div>
      </AppContainer>
    );
  }

  return (
    <AppContainer maxWidth="md">
      <div className="flex w-full items-center justify-center p-8 md:min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-3xl font-bold">Create Your Team</CardTitle>
            <p className="text-muted-foreground text-center">
              Choose a name for your fantasy F1 team
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <LiveRegion message={message} />
              {error && <InlineError message={error} />}
              <FormFieldInput
                label="Team Name"
                id="teamName"
                required
                error={errors.teamName?.message}
                register={register('teamName')}
                placeholder="Enter your team name"
                helpText="You can change this later"
              />

              <div className="flex justify-end pt-2">
                <LoadingButton
                  isLoading={isSubmitting}
                  className="min-w-32"
                  type="submit"
                  loadingText="Creating..."
                >
                  Create Team
                </LoadingButton>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppContainer>
  );
}
