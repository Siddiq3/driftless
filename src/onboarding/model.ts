import { z } from 'zod';

export const ANSWERS = {
  occupation: ['school', 'college', 'work', 'other'],
  apps: ['instagram', 'youtube', 'facebook', 'snapchat', 'moj', 'sharechat', 'other'],
  priorities: ['study', 'work', 'sleep', 'movement', 'relationships', 'creativity'],
  when: ['morning', 'breaks', 'evening', 'night'],
  feelings: ['tired', 'distracted', 'regretful', 'fine'],
  usage: ['under1', '1to3', '3to5', '5to7', 'over7'],
} as const;

export const AnswersSchema = z.object({
  occupation: z.enum(ANSWERS.occupation).optional(),
  apps: z.array(z.enum(ANSWERS.apps)).max(7).default([]),
  priorities: z.array(z.enum(ANSWERS.priorities)).max(6).default([]),
  when: z.enum(ANSWERS.when).optional(),
  feelings: z.array(z.enum(ANSWERS.feelings)).max(4).default([]),
  usage: z.enum(ANSWERS.usage).optional(),
});
export type SetupAnswers = z.infer<typeof AnswersSchema>;
export const EMPTY_ANSWERS: SetupAnswers = { apps: [], priorities: [], feelings: [] };
export const PlanSchema = z.object({
  metric: z.enum(['minutes', 'views']),
  dailyLimit: z.number().int().min(1).max(2000),
});
export type SetupPlan = z.infer<typeof PlanSchema>;

export const REEL_LIMITS = [25, 50, 100, 150] as const;

/** Legacy minutes drafts remain readable; new onboarding always sets a reels target. */
export function reelsSetupPlan(plan?: SetupPlan): SetupPlan {
  return plan?.metric === 'views' ? { ...plan } : { metric: 'views', dailyLimit: 50 };
}

/** Keep persisted step IDs stable while skipping the retired income question. */
export function activeSetupStep(target: number, direction: 'next' | 'back' = 'next') {
  return target === 7 ? (direction === 'back' ? 6 : 8) : target;
}

export const LAST_STEP = 15;
export const SetupRecordSchema = z.object({
  version: z.literal(1),
  completed: z.boolean(),
  step: z.number().int().min(0).max(LAST_STEP),
  answers: AnswersSchema,
  plan: PlanSchema,
});
export type SetupRecord = z.infer<typeof SetupRecordSchema>;

/** Midpoints are only onboarding estimates, never measured activity or tracked history. */
export function estimateTime(answers: SetupAnswers, plan: SetupPlan) {
  if (!answers.usage) return null;
  const hours = { under1: 0.5, '1to3': 2, '3to5': 4, '5to7': 6, over7: 8 }[answers.usage];
  return {
    hoursPerDay: hours,
    hoursPerWeek: hours * 7,
    possibleMinutesPerDay:
      plan.metric === 'minutes' ? Math.max(0, hours * 60 - plan.dailyLimit) : null,
  };
}

export const PRIORITY_LABELS = {
  study: 'study',
  work: 'work',
  sleep: 'rest',
  movement: 'movement',
  relationships: 'your people',
  creativity: 'creating',
} as const;
