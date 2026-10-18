import {
  addDays,
  computeStreaks,
  evaluateDay,
  wickState,
  type DayOutcome,
  type WickState,
} from '@siddiq3/driftless-contracts/domain';
import type { v1 } from '@siddiq3/driftless-contracts';
import type { Daily, TrackingHealth } from 'tracking-android';
import { aggregateDay } from '../sync/aggregate';

export type DayResult = {
  localDate: string;
  outcome: DayOutcome;
  minutes: number | null;
  views: number | null;
};

const RANK: Record<DayOutcome, number> = { kept: 0, unknown: 1, breached: 2 };

/** Combines all enabled goals for one day: any breach breaches, any unknown is unknown. */
export function dayResult(daily: Daily, health: TrackingHealth, goals: v1.Goal[]): DayResult {
  // Same honesty rules as sync: unvalidated video counts are null, never trusted for goals.
  const a = aggregateDay(daily, health, 'local', 'UTC');
  const usage = {
    localDate: daily.localDate,
    views: a.views,
    minutes: a.minutes,
    coverage: a.coverage,
  };
  const active = goals.filter((g) => g.enabled);
  let outcome: DayOutcome = active.length === 0 ? 'unknown' : 'kept';
  for (const g of active) {
    const o = evaluateDay(usage, { metric: g.metric, dailyLimit: g.dailyLimit });
    if (RANK[o] > RANK[outcome]) outcome = o;
  }
  return { localDate: daily.localDate, outcome, minutes: a.minutes, views: a.views };
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
): Progress {
  const days = Array.from({ length: window }, (_, i) => addDays(today, i - (window - 1))).map((d) =>
    dayResult(readDay(d), health, goals),
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

/** Whether a video-count goal can be offered: only once some installed app version is validated. */
export function canUseViewGoals(health: TrackingHealth): boolean {
  return health.apps.some((a) => a.installed && a.validated);
}
