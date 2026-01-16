import { z } from 'zod';

export const createTeamFormSchema = z.object({
  teamName: z
    .string()
    .min(1, 'Team name is required')
    .max(50, 'Team name must be less than 50 characters')
    .trim(),
});

export type CreateTeamFormData = z.infer<typeof createTeamFormSchema>;
