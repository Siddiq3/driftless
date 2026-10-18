import type { v1 } from '@siddiq3/driftless-contracts';
import type { Daily, TrackingHealth } from 'tracking-android';
import { achievements } from '../src/goals/achievements';
import { canUseViewGoals, dayResult, progress } from '../src/goals/progress';

const IG = 'com.instagram.android';
const health = (validated = false): TrackingHealth => ({
  engineVersion: 1,
  implemented: true,
  rulesVersion: 1,
  disclosureAccepted: true,
  serviceEnabled: true,
  serviceRunning: true,
  lastConnectedMs: 0,
  lastEventMs: 0,
  heartbeatMinutesToday: 0,
  usageAccessGranted: true,
  debugBuild: false,
  apps: [{ package: IG, label: 'IG', installed: true, version: '1', validated }],
});
const daily = (localDate: string, minutes: number, views = 0): Daily => ({
  localDate,
  heartbeatMinutes: 900,
  coverage: 0.95,
  apps: [{ package: IG, views, adViews: 0, surfaceMs: 0, unknownMs: 0, usageMs: minutes * 60_000 }],
});
const goal = (metric: v1.Goal['metric'], dailyLimit: number, enabled = true): v1.Goal => ({
  goalId: `${metric}-goal`,
  metric,
  dailyLimit,
  enabled,
  rev: 1,
});

describe('dayResult', () => {
  it('kept when within the minutes goal', () => {
    expect(dayResult(daily('2026-10-18', 20), health(), [goal('minutes', 30)]).outcome).toBe(
      'kept',
    );
  });
  it('breached when over', () => {
    expect(dayResult(daily('2026-10-18', 31), health(), [goal('minutes', 30)]).outcome).toBe(
      'breached',
    );
  });
  it('a video goal is unknown while accuracy is unconfirmed — never "kept" on untrusted numbers', () => {
    expect(dayResult(daily('2026-10-18', 10, 5), health(false), [goal('views', 50)]).outcome).toBe(
      'unknown',
    );
    expect(dayResult(daily('2026-10-18', 10, 5), health(true), [goal('views', 50)]).outcome).toBe(
      'kept',
    );
  });
  it('any breach across goals breaches the day; disabled goals are ignored', () => {
    const goals = [goal('minutes', 30), goal('views', 3, true)];
    expect(dayResult(daily('2026-10-18', 10, 5), health(true), goals).outcome).toBe('breached');
    expect(
      dayResult(daily('2026-10-18', 10, 5), health(true), [
        goal('minutes', 30),
        goal('views', 3, false),
      ]).outcome,
    ).toBe('kept');
  });
  it('no goals → unknown', () => {
    expect(dayResult(daily('2026-10-18', 10), health(), []).outcome).toBe('unknown');
  });
});

describe('progress', () => {
  const minutesByDate: Record<string, number> = {
    '2026-10-14': 20,
    '2026-10-15': 25,
    '2026-10-16': 50, // breach
    '2026-10-17': 10,
    '2026-10-18': 5, // today, in progress
  };
  const read = (d: string): Daily =>
    d in minutesByDate
      ? daily(d, minutesByDate[d]!)
      : { localDate: d, heartbeatMinutes: 0, coverage: 0, apps: [] };
  const h = { ...health(), usageAccessGranted: false };

  it('computes streak, Wick and today from real outcomes', () => {
    // Without Usage Access, minutes come from the counter: build dailies with counter time instead.
    const readCounter = (d: string): Daily => {
      const x = read(d);
      return { ...x, apps: x.apps.map((a) => ({ ...a, surfaceMs: a.usageMs, usageMs: 0 })) };
    };
    const p = progress(readCounter, h, [goal('minutes', 30)], '2026-10-18', 10);
    expect(p.today.outcome).toBe('kept');
    expect(p.streak).toEqual({ current: 1, best: 2 });
    expect(p.wick.points).toBe(3); // 14, 15, 17 — today not yet counted
    expect(p.days).toHaveLength(10);
  });

  it('achievements are earned only from tracked, kept days', () => {
    const p = progress(read, health(), [goal('minutes', 30)], '2026-10-18', 10);
    const earned = achievements(p)
      .filter((a) => a.earned)
      .map((a) => a.id);
    expect(earned).toContain('first_day');
    expect(earned).not.toContain('streak_7');
  });
});

it('view goals unlock only with a validated app version', () => {
  expect(canUseViewGoals(health(false))).toBe(false);
  expect(canUseViewGoals(health(true))).toBe(true);
});
