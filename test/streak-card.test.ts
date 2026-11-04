import { nextStage, streakSummary } from '../src/goals/streakCard';
import type { Progress } from '../src/goals/progress';

function p(over: Partial<Progress> & { outcome?: Progress['today']['outcome'] } = {}): Progress {
  return {
    today: { localDate: '2026-11-04', minutes: 10, views: 5, outcome: over.outcome ?? 'kept' },
    days: [],
    streak: { current: 0, best: 0 },
    wick: { stage: 'ember', glow: 0.5, points: 0 },
    ...over,
  };
}

describe('next Wick stage', () => {
  it('counts kept days to the next threshold', () => {
    expect(nextStage(0)).toEqual({ stage: 'spark', remaining: 3, ratio: 0 });
    expect(nextStage(4)).toMatchObject({ stage: 'flicker', remaining: 6 });
    expect(nextStage(4)!.ratio).toBeCloseTo(1 / 7);
  });
  it('stops at the final stage', () => {
    expect(nextStage(100)).toBeNull();
    expect(nextStage(240)).toBeNull();
  });
});

describe('streak summary', () => {
  it('invites a first streak without shaming', () => {
    const s = streakSummary(p());
    expect(s).toMatchObject({ current: 0, pose: 'fresh' });
    expect(s.headline).toMatch(/start a streak/);
    expect(s.earned).toEqual([]);
    expect(s.upcoming?.id).toBe('first_day');
  });
  it('turns sleepy after a breach and frames tomorrow as a fresh start', () => {
    const s = streakSummary(p({ outcome: 'breached', streak: { current: 0, best: 4 } }));
    expect(s.pose).toBe('drained');
    expect(s.headline).toMatch(/fresh start/);
  });
  it('celebrates a long streak and lists earned achievements', () => {
    const s = streakSummary(
      p({
        streak: { current: 8, best: 8 },
        wick: { stage: 'flicker', glow: 1, points: 12 },
      }),
    );
    expect(s.pose).toBe('focused');
    expect(s.headline).toBe('8 days in a row. Nice!');
    expect(s.earned.map((a) => a.id)).toEqual(['first_day', 'streak_3', 'streak_7', 'points_10']);
    expect(s.next).toMatchObject({ stage: 'glow', remaining: 13 });
  });
});
