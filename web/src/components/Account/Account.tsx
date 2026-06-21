import type { UserProfile } from '@/contracts/UserProfile';
import { useAuth } from '@/hooks/useAuth';
import { useLiveRegion } from '@/hooks/useLiveRegion';
import { avatarEvents } from '@/lib/avatarEvents';
import { profileQueries, userProfileService } from '@/services/userProfileService';
import {
  type UserProfileFormData,
  userProfileFormSchema,
} from '@/validations/userProfileFormSchema';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { AppContainer } from '../AppContainer/AppContainer';
import { AvatarUpload } from '../AvatarUpload/AvatarUpload';
import { FormFieldInput } from '../FormField/FormField';
import { InlineError } from '../InlineError/InlineError';
import { InlineSuccess } from '../InlineSuccess/InlineSuccess';
import { LiveRegion } from '../LiveRegion/LiveRegion';
import { LoadingButton } from '../LoadingButton/LoadingButton';
import { Card, CardContent, CardHeader } from '../ui/card';

export function Account() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: userProfile } = useSuspenseQuery(profileQueries.current());

  const handleAvatarChange = async (avatarUrl: string) => {
    if (!userProfile) return;

    try {
      await userProfileService.updateUserProfile({ ...userProfile, avatarUrl });
      avatarEvents.emit(avatarUrl);
      await queryClient.invalidateQueries({ queryKey: profileQueries.current().queryKey });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update avatar';
      toast.error(message);
    }
  };

  const handleProfileSubmit = async (formData: UserProfileFormData) => {
    if (!userProfile) return;

    await userProfileService.updateUserProfile({ ...userProfile, ...formData });
    await queryClient.invalidateQueries({ queryKey: profileQueries.current().queryKey });
  };

  return (
    <AppContainer
      maxWidth="sm"
      className="flex w-full items-center justify-center p-8 md:min-h-screen"
    >
      <div className="w-full max-w-md space-y-4">
        <Card className="w-full max-w-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h2 className="text-2xl leading-none font-semibold">Profile Information</h2>
            <AvatarUpload
              userId={user?.id || ''}
              currentAvatarUrl={userProfile?.avatarUrl || ''}
              onAvatarChange={handleAvatarChange}
              onError={toast.error}
              size="lg"
            />
          </CardHeader>
          <CardContent className="space-y-4">
            <AccountForm profile={userProfile} onSubmit={handleProfileSubmit} />
          </CardContent>
        </Card>
      </div>
    </AppContainer>
  );
}

interface AccountFormProps {
  profile: UserProfile | null;
  onSubmit: (data: UserProfileFormData) => Promise<void>;
}

export function AccountForm({ profile, onSubmit }: AccountFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { message, announce } = useLiveRegion();

  const { displayName = '', firstName = '', lastName = '', email = '' } = profile || {};

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<UserProfileFormData>({
    resolver: zodResolver(userProfileFormSchema),
    mode: 'onBlur',
    values: {
      displayName,
      firstName,
      lastName,
      email,
    },
  });

  const handleFormSubmit = async (formData: UserProfileFormData) => {
    if (!isDirty) return;

    setError(null);
    setSuccessMessage(null);

    try {
      await onSubmit(formData);
      reset(formData);

      const success = 'Profile updated successfully';
      setSuccessMessage(success);
      announce(success);

      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update profile';
      setError(errorMessage);
      announce(errorMessage);
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4" noValidate>
      <LiveRegion message={message} />
      {error && <InlineError message={error} />}
      {successMessage && <InlineSuccess message={successMessage} />}
      <FormFieldInput
        label="Display Name"
        id="displayName"
        required
        error={errors.displayName?.message}
        helpText="Display name appears throughout the app."
        register={register('displayName')}
        placeholder="Enter your display name"
      />

      <FormFieldInput
        label="Email"
        id="email"
        type="email"
        required
        error={errors.email?.message}
        register={register('email')}
        placeholder="Enter your email address"
      />

      <FormFieldInput
        label="First Name"
        id="firstName"
        error={errors.firstName?.message}
        register={register('firstName')}
        placeholder="Enter your first name"
      />

      <FormFieldInput
        label="Last Name"
        id="lastName"
        error={errors.lastName?.message}
        register={register('lastName')}
        placeholder="Enter your last name"
      />

      <div className="flex justify-end pt-2">
        <LoadingButton
          isLoading={isSubmitting}
          className="min-w-20"
          type="submit"
          loadingText="Saving..."
        >
          Save
        </LoadingButton>
      </div>
    </form>
  );
}
