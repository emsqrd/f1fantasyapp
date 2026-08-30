import { z } from 'zod';

export const signInFormSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email').pipe(z.email('Enter a valid email address')),

  password: z.string().min(1, 'Enter a password'),
});

export type SignInFormData = z.infer<typeof signInFormSchema>;
