import type { UserProfile } from '@/contracts/UserProfile';
import { useAuth } from '@/hooks/useAuth';
import { useLiveRegion } from '@/hooks/useLiveRegion';
import { avatarEvents } from '@/lib/avatarEvents';
import { userProfileService } from '@/services/userProfileService';
import {
  type UserProfileFormData,
  userProfileFormSchema,
} from '@/validations/userProfileFormSchema';
import { zodResolver } from '@hookform/resolvers/zod';
import { getRouteApi } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { AppContainer } from '../AppContainer/AppContainer';
import { AvatarUpload } from '../AvatarUpload/AvatarUpload';
import { FormFieldInput } from '../FormField/FormField';
import { InlineError } from '../InlineError/InlineError';
import { InlineSuccess } from '../InlineSuccess/InlineSuccess';
import { LiveRegion } from '../LiveRegion/LiveRegion';
import { LoadingButton } from '../LoadingButton/LoadingButton';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

/**
 * Get the route API for the account route to access loader data
 * Route path is '/account' (child of pathless 'authenticated' layout)
 */
const routeApi = getRouteApi('/_authenticated/account');

export function Account() {
  const { user } = useAuth();
  // Get loader data from route - profile is fetched before component renders
  const { userProfile: initialProfile } = routeApi.useLoaderData();

  // Local state for profile updates (avatar changes, form submissions)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(initialProfile);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { message, announce } = useLiveRegion();

  // Destructure with defaults for form initialization
  const { displayName = '', firstName = '', lastName = '', email = '' } = initialProfile || {};

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<UserProfileFormData>({
    resolver: zodResolver(userProfileFormSchema),
    mode: 'onBlur', // Validate on blur for better UX
    defaultValues: {
      displayName,
      firstName,
      lastName,
      email,
    },
  });

  // Sync local state when loader data changes (e.g., user switches accounts)
  useEffect(() => {
    setUserProfile(initialProfile);
    // Reset form with new user's data
    reset({
      displayName: initialProfile?.displayName || '',
      firstName: initialProfile?.firstName || '',
      lastName: initialProfile?.lastName || '',
      email: initialProfile?.email || '',
    });
  }, [initialProfile, reset]);

  const handleAvatarChange = async (avatarUrl: string) => {
    if (!userProfile) return;

    try {
      const updatedProfile = await userProfileService.updateUserProfile({
        ...userProfile,
        avatarUrl,
      });

      setUserProfile(updatedProfile);
      // Emit avatar change event so PageHeader updates immediately
      avatarEvents.emit(avatarUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update avatar';
      // Keep toast for avatar upload - it's a background operation
      toast.error(message);
    }
  };

  const onSubmit = async (formData: UserProfileFormData) => {
    if (!userProfile) return;

    // Early return if nothing changed - silent, no feedback needed
    if (!isDirty) {
      return;
    }

    setError(null);
    setSuccessMessage(null);

    try {
      const updatedProfile = await userProfileService.updateUserProfile({
        ...userProfile,
        ...formData,
      });

      setUserProfile(updatedProfile);

      // Reset form state to mark it as clean
      reset(formData);

      const success = 'Profile updated successfully';
      setSuccessMessage(success);
      announce(success);

      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update profile';
      setError(errorMessage);
      announce(errorMessage);
    }
  };

  return (
    <AppContainer
      maxWidth="sm"
      className="flex w-full items-center justify-center p-8 md:min-h-screen"
    >
      <div className="w-full max-w-md space-y-4">
        <Card className="w-full max-w-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-2xl">Profile Information</CardTitle>
            <AvatarUpload
              userId={user?.id || ''}
              currentAvatarUrl={userProfile?.avatarUrl || ''}
              onAvatarChange={handleAvatarChange}
              onError={toast.error}
              size="lg"
            />
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
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
          </CardContent>
        </Card>
      </div>
    </AppContainer>
  );
}
