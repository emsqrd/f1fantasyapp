import { z } from 'zod';

export const createLeagueFormSchema = z.object({
  leagueName: z
    .string()
    .min(1, 'League name is required')
    .max(50, 'League name must be less than 50 characters')
    .trim(),

  leagueDescription: z
    .string()
    .max(100, 'League description must be less than 100 characters')
    .trim(),

  leagueIsPrivate: z.boolean(),
});

export type CreateLeagueFormData = z.infer<typeof createLeagueFormSchema>;
