import type { Progress } from './progress';

export type Achievement = { id: string; title: string; detail: string; earned: boolean };

/** Derived from real outcomes only — nothing is awarded for days that weren't tracked. */
export function achievements(p: Progress): Achievement[] {
  const kept = p.wick.points;
  const best = p.streak.best;
  return [
    {
      id: 'first_day',
      title: 'First steady day',
      detail: 'Keep your goal for one full day',
      earned: kept >= 1,
    },
    { id: 'streak_3', title: 'Three in a row', detail: 'A 3-day streak', earned: best >= 3 },
    { id: 'streak_7', title: 'A calm week', detail: 'A 7-day streak', earned: best >= 7 },
    { id: 'streak_30', title: 'Month of focus', detail: 'A 30-day streak', earned: best >= 30 },
    { id: 'points_10', title: 'Steady glow', detail: '10 days kept in total', earned: kept >= 10 },
    { id: 'points_50', title: 'Beacon', detail: '50 days kept in total', earned: kept >= 50 },
  ];
}
