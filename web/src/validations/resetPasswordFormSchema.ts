import { z } from 'zod';

import { checkPasswordsMatch, confirmPasswordSchema, passwordSchema } from './passwordPolicy';

export const resetPasswordFormSchema = z
  .object({
    password: passwordSchema,

    confirmPassword: confirmPasswordSchema,
  })
  .superRefine(checkPasswordsMatch);

export type ResetPasswordFormData = z.infer<typeof resetPasswordFormSchema>;
