import { z } from 'zod';

export const userProfileFormSchema = z.object({
  displayName: z
    .string()
    .min(1, 'Display name is required')
    .max(50, 'Display name must be less than 50 characters')
    .trim(),

  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(30, 'First name must be less than 30 characters')
    .trim(),

  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(30, 'Last name must be less than 30 characters')
    .trim(),

  email: z.email().max(254, 'Email must be less than 254 characters'),
});

export type UserProfileFormData = z.infer<typeof userProfileFormSchema>;
