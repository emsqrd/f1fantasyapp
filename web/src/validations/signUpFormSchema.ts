import { z } from 'zod';

import { checkPasswordsMatch, confirmPasswordSchema, passwordSchema } from './passwordPolicy';

export const signUpFormSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(1, 'Enter a display name')
      .max(50, 'Display name must be 50 characters or fewer'),

    email: z
      .string()
      .trim()
      .min(1, 'Enter your email')
      .pipe(z.email('Enter a valid email address')),

    password: passwordSchema,

    confirmPassword: confirmPasswordSchema,
  })
  .superRefine(checkPasswordsMatch);

export type SignUpFormData = z.infer<typeof signUpFormSchema>;
