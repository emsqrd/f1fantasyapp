import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

export const PASSWORD_HINT = `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;

export const passwordSchema = z
  .string()
  .min(1, { message: 'Enter a password', abort: true })
  .min(PASSWORD_MIN_LENGTH, 'Password is too short')
  .max(PASSWORD_MAX_LENGTH, `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer`);

export const confirmPasswordSchema = z.string().min(1, 'Confirm your password');

export function checkPasswordsMatch(
  values: { password: string; confirmPassword: string },
  ctx: z.RefinementCtx,
) {
  // An empty confirm field already reports its own message; don't stack on it.
  if (values.confirmPassword && values.password !== values.confirmPassword) {
    ctx.addIssue({
      code: 'custom',
      message: 'Passwords do not match',
      path: ['confirmPassword'],
    });
  }
}
