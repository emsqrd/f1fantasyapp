import { useLiveRegion } from '@/hooks/useLiveRegion';
import { useTeam } from '@/hooks/useTeam';
import { createTeam } from '@/services/teamService';
import { type CreateTeamFormData, createTeamFormSchema } from '@/validations/teamSchemas';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from '@tanstack/react-router';
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
  const { refreshMyTeam } = useTeam();
  const [error, setError] = useState<string | null>(null);
  const { message, announce } = useLiveRegion();

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

      // Refresh context to update myTeamId
      await refreshMyTeam();

      // Navigate - TanStack Router handles navigation transitions
      navigate({ to: '/team/$teamId', params: { teamId: String(createdTeam.id) } });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create team';
      setError(errorMessage);
      announce(errorMessage);
    }
  };

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
