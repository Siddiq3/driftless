import { STAGE_THRESHOLDS, WICK_STAGES, type WickStage } from '@siddiq3/driftless-contracts/domain';
import type { Progress } from './progress';
import { achievements, type Achievement } from './achievements';

export type MascotPose = 'fresh' | 'focused' | 'tired' | 'drained';

export type StreakSummary = {
  current: number;
  best: number;
  stage: WickStage;
  points: number;
  /** Null once the final stage is reached. */
  next: { stage: WickStage; remaining: number; ratio: number } | null;
  pose: MascotPose;
  headline: string;
  earned: Achievement[];
  upcoming: Achievement | null;
};

/** Stage progress is cumulative kept days, so it only ever moves forward. */
export function nextStage(points: number): StreakSummary['next'] {
  const index = STAGE_THRESHOLDS.findIndex((threshold) => points < threshold);
  if (index === -1) return null;
  const from = STAGE_THRESHOLDS[index - 1] ?? 0;
  const to = STAGE_THRESHOLDS[index]!;
  return {
    stage: WICK_STAGES[index]!,
    remaining: to - points,
    ratio: Math.max(0, Math.min(1, (points - from) / Math.max(1, to - from))),
  };
}

/**
 * Character feedback only. A breach makes the companion sleepy, never "dead": the lowest
 * state still invites tomorrow's fresh start, matching the Wick no-rot rule.
 */
export function streakSummary(p: Progress): StreakSummary {
  const { current, best } = p.streak;
  const today = p.today.outcome;
  const pose: MascotPose =
    today === 'breached'
      ? 'drained'
      : current >= 7
        ? 'focused'
        : current === 0 && best > 0
          ? 'tired'
          : 'fresh';
  const headline =
    today === 'breached'
      ? 'Tomorrow is a fresh start'
      : current === 0
        ? best > 0
          ? 'Keep today’s goal to restart your streak'
          : 'Keep today’s goal to start a streak'
        : current === 1
          ? 'One steady day. Keep it going!'
          : `${current} days in a row. Nice!`;
  const list = achievements(p);
  return {
    current,
    best,
    stage: p.wick.stage,
    points: p.wick.points,
    next: nextStage(p.wick.points),
    pose,
    headline,
    earned: list.filter((a) => a.earned),
    upcoming: list.find((a) => !a.earned) ?? null,
  };
}
