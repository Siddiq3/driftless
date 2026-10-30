import { v1 } from '@siddiq3/driftless-contracts';
import { z } from 'zod';

// Additive personal-history field. Kept compatible with the published 0.4 contract so the
// app does not need a package publication before the API's additive rollout.
export const PersonalAppViewsSchema = z
  .object({
    'com.instagram.android': z.int().min(0).max(100_000).nullable().optional(),
    'com.google.android.youtube': z.int().min(0).max(100_000).nullable().optional(),
  })
  .strict();
export const PersonalDailyAggregateSchema = v1.DailyAggregate.safeExtend({
  personalViews: z.int().min(0).max(100_000).nullable().optional(),
  personalAppViews: PersonalAppViewsSchema.optional(),
})
  .refine(
    (day) =>
      day.platform === 'android' || (day.personalViews == null && day.personalAppViews == null),
    {
      message: 'iOS aggregates cannot carry personal video counts',
      path: ['personalViews'],
    },
  )
  .refine(
    (day) =>
      !day.personalAppViews ||
      day.personalViews == null ||
      Object.values(day.personalAppViews).some((value) => value === null) ||
      Object.values(day.personalAppViews).reduce<number>((sum, value) => sum + (value ?? 0), 0) ===
        day.personalViews,
    { message: 'Platform counts must equal personalViews', path: ['personalAppViews'] },
  );
export type PersonalDailyAggregate = z.infer<typeof PersonalDailyAggregateSchema>;
export const PersonalHistoryResponse = z.object({ days: z.array(PersonalDailyAggregateSchema) });

export const sameAppViews = (a: unknown, b: unknown) =>
  JSON.stringify(Object.entries((a ?? {}) as Record<string, unknown>).sort()) ===
  JSON.stringify(Object.entries((b ?? {}) as Record<string, unknown>).sort());
