import { brainPresentation, countBrainMood } from '../src/ui/brainState';
import type { ProgressState } from '../src/goals/useProgress';

function sample(): Extract<ProgressState, { state: 'ok' }> {
  return {
    state: 'ok',
    today: '2026-10-19',
    daily: { localDate: '2026-10-19', apps: [] },
    health: {
      engineVersion: 1,
      rulesVersion: 1,
      implemented: true,
      disclosureAccepted: true,
      serviceEnabled: true,
      serviceRunning: true,
      usageAccessGranted: true,
      debugBuild: false,
      apps: [
        { package: 'youtube', label: 'YouTube', installed: true, version: '1', validated: true },
      ],
    },
    goals: [{ goalId: 'minutes', metric: 'minutes', dailyLimit: 30, enabled: true, rev: 1 }],
    p: {
      today: { localDate: '2026-10-19', minutes: 12, views: 10, outcome: 'kept' },
      days: [],
      streak: { current: 0, best: 0 },
      wick: { stage: 'ember', glow: 0, points: 0 },
    },
  };
}

describe('brain presentation follows trustworthy activity', () => {
  it('leaves unknown activity unknown', () => {
    const s = sample();
    s.p.today.minutes = null;
    s.p.today.views = null;
    expect(brainPresentation(s)).toMatchObject({ ratio: null, remaining: null });
  });
  it('does not claim tracking while the service is stopped', () => {
    const s = sample();
    s.health.serviceRunning = false;
    expect(brainPresentation(s).mood).toBe('unavailable');
  });
  it('keeps an unavailable native engine visibly unavailable', () => {
    const s = sample();
    s.health.implemented = false;
    expect(brainPresentation(s).mood).toBe('unavailable');
  });
  it('keeps unvalidated counting idle while measurements are unknown', () => {
    const s = sample();
    s.health.apps[0]!.validated = false;
    s.p.today.views = null;
    s.p.today.minutes = null;
    expect(brainPresentation(s)).toMatchObject({ mood: 'idle', ratio: null });
  });
  it('does not celebrate reaching a daily cap', () => {
    const s = sample();
    s.p.today.minutes = 30;
    s.p.streak.current = 7;
    expect(brainPresentation(s)).toMatchObject({ mood: 'limit-reached', remaining: 0, ratio: 1 });
  });
  it('uses the highest measured goal ratio, including a second breached goal', () => {
    const s = sample();
    s.goals.push({ goalId: 'views', metric: 'views', dailyLimit: 5, enabled: true, rev: 1 });
    expect(brainPresentation(s)).toMatchObject({
      mood: 'limit-reached',
      ratio: 2,
      goal: { metric: 'views' },
    });
  });
  it('signals high usage at 80% of allowance', () => {
    const s = sample();
    s.p.today.minutes = 24;
    expect(brainPresentation(s).mood).toBe('high-usage');
  });
  it('recognizes completed-day streak milestones below the allowance', () => {
    const s = sample();
    s.p.streak.current = 7;
    expect(brainPresentation(s).mood).toBe('goal-reached');
  });
  it('does not invent a goal or ratio when all goals are disabled', () => {
    const s = sample();
    s.goals[0]!.enabled = false;
    expect(brainPresentation(s)).toMatchObject({ goal: undefined, ratio: null, remaining: null });
  });
  it('keeps loading and errors unavailable', () => {
    expect(brainPresentation({ state: 'loading' }).mood).toBe('unavailable');
    expect(brainPresentation({ state: 'error', message: 'storage unavailable' }).mood).toBe(
      'unavailable',
    );
  });
});

describe('home character matches the popup count mood', () => {
  function counted(views: number) {
    const s = sample();
    s.goals = [{ goalId: 'views', metric: 'views', dailyLimit: 50, enabled: true, rev: 1 }];
    s.daily.apps = [
      {
        package: 'youtube',
        views,
        adViews: 0,
        surfaceMs: 1000,
        unknownMs: 0,
        usageMs: 1000,
      },
    ];
    return s;
  }
  it('becomes drained exactly at the saved video limit', () => {
    expect(countBrainMood(counted(49))).toBe('happy');
    expect(countBrainMood(counted(50))).toBe('drained');
    expect(countBrainMood(counted(51))).toBe('drained');
    expect(countBrainMood(counted(0))).toBe('happy');
  });
  it('uses saved local counts even with unvalidated results or a stopped service', () => {
    const s = counted(50);
    s.health.apps[0]!.validated = false;
    s.health.serviceRunning = false;
    s.p.today.views = null;
    expect(countBrainMood(s)).toBe('drained');
    expect(s.p.today.views).toBeNull();
  });
  it('ignores disabled and minutes limits and chooses the smallest enabled video limit', () => {
    const s = counted(50);
    s.goals[0]!.enabled = false;
    s.goals.push({ goalId: 'minutes', metric: 'minutes', dailyLimit: 1, enabled: true, rev: 1 });
    expect(countBrainMood(s)).toBe('happy');
    s.goals.push({ goalId: 'views-2', metric: 'views', dailyLimit: 100, enabled: true, rev: 1 });
    expect(countBrainMood(s)).toBe('happy');
    s.goals[0]!.enabled = true;
    expect(countBrainMood(s)).toBe('drained');
  });
  it('keeps loading and missing engine state unknown', () => {
    expect(countBrainMood({ state: 'loading' })).toBe('unknown');
    const s = counted(50);
    s.health.implemented = false;
    expect(countBrainMood(s)).toBe('unknown');
  });
});
