import {
  addDays,
  computeStreaks,
  evaluateDay,
  wickState,
  type DayOutcome,
  type WickState,
} from '@siddiq3/driftless-contracts/domain';
import type { v1 } from '@siddiq3/driftless-contracts';
import type { Daily, TrackingHealth, PersonalMeasurement } from 'tracking-android';
import { recordedMeasurement } from '@/data/measurement';

export type DayResult = {
  localDate: string;
  outcome: DayOutcome;
  minutes: number | null;
  views: number | null;
  measurementStatus?: PersonalMeasurement['status'];
};

const RANK: Record<DayOutcome, number> = { kept: 0, unknown: 1, breached: 2 };

/** Combines all enabled goals for one day: any breach breaches, any unknown is unknown. */
export function dayResult(
  daily: Daily,
  health: TrackingHealth,
  goals: v1.Goal[],
  measurement?: Pick<PersonalMeasurement, 'views' | 'minutes'> & {
    status?: PersonalMeasurement['status'];
  },
): DayResult {
  // Same honesty rules as sync: unvalidated video counts are null, never trusted for goals.
  const a = measurement ?? recordedMeasurement(daily, health);
  const usage = {
    localDate: daily.localDate,
    views: a.views,
    minutes: a.minutes,
  };
  const active = goals.filter((g) => g.enabled);
  let outcome: DayOutcome = active.length === 0 ? 'unknown' : 'kept';
  for (const g of active) {
    const o = evaluateDay(
      {
        ...usage,
        views:
          g.metric === 'views' && !health.apps.some((app) => app.installed && app.validated)
            ? null
            : usage.views,
      },
      { metric: g.metric, dailyLimit: g.dailyLimit },
    );
    if (RANK[o] > RANK[outcome]) outcome = o;
  }
  return {
    localDate: daily.localDate,
    outcome,
    minutes: a.minutes,
    views: a.views,
    measurementStatus: 'status' in a ? a.status : undefined,
  };
}

export type Progress = {
  today: DayResult;
  days: DayResult[]; // oldest → newest, includes today
  streak: { current: number; best: number };
  wick: WickState;
};

export function progress(
  readDay: (localDate: string) => Daily,
  health: TrackingHealth,
  goals: v1.Goal[],
  today: string,
  window = 60,
  readMeasurement?: (date: string) => Pick<PersonalMeasurement, 'views' | 'minutes'>,
): Progress {
  const days = Array.from({ length: window }, (_, i) => addDays(today, i - (window - 1))).map((d) =>
    dayResult(readDay(d), health, goals, readMeasurement?.(d)),
  );
  const outcomes = new Map(days.map((d) => [d.localDate, d.outcome]));
  // Exclude today from Wick until it is over, unless already breached (mirrors streak rules).
  const settled = days
    .filter((d) => d.localDate !== today || d.outcome === 'breached')
    .map((d) => d.outcome);
  return {
    today: days.at(-1)!,
    days,
    streak: computeStreaks(outcomes, today),
    wick: wickState(settled),
  };
}

/** Whether video-goal results have an installed accuracy-validated counting source. */
export function canUseViewGoals(health: TrackingHealth): boolean {
  return health.apps.some((a) => a.installed && a.validated);
}
