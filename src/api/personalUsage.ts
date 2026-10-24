import { v1 } from '@siddiq3/driftless-contracts';
import { z } from 'zod';

// Additive personal-history field. Kept compatible with the published 0.4 contract so the
// app does not need a package publication before the API's additive rollout.
export const PersonalDailyAggregateSchema = v1.DailyAggregate.safeExtend({
  personalViews: z.int().min(0).max(100_000).nullable().optional(),
}).refine((day) => day.platform === 'android' || day.personalViews == null, {
  message: 'iOS aggregates cannot carry personal video counts',
  path: ['personalViews'],
});
export type PersonalDailyAggregate = z.infer<typeof PersonalDailyAggregateSchema>;
export const PersonalHistoryResponse = z.object({ days: z.array(PersonalDailyAggregateSchema) });
