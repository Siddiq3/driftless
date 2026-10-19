import { activityBounds, activityData } from '@/activity/model';
import type { Daily, TrackingHealth, WrapDetails } from 'tracking-android';
const health = {
  usageAccessGranted: true,
  apps: [
    { package: 'instagram', label: 'Instagram', installed: true, validated: true },
    { package: 'youtube', label: 'YouTube', installed: true, validated: true },
  ],
} as TrackingHealth;
const daily = (localDate: string, views = 1): Daily => ({
  localDate,
  heartbeatMinutes: 20,
  coverage: 1,
  apps: [
    { package: 'instagram', views, adViews: 0, surfaceMs: 60000, unknownMs: 0, usageMs: 120000 },
  ],
});
const noDetails: WrapDetails = { available: false, days: [] };
test('daily and weekly navigation uses calendar boundaries and excludes future dates', () => {
  expect(activityBounds('daily', 1, '2026-01-01').from).toBe('2025-12-31');
  expect(activityBounds('weekly', 0, '2026-10-19')).toEqual({
    from: '2026-10-19',
    to: '2026-10-25',
    dates: ['2026-10-19'],
  });
  expect(activityBounds('weekly', 1, '2026-10-19').dates).toHaveLength(7);
  expect(activityBounds('weekly', 0, '2026-10-18').from).toBe('2026-10-12');
});
test('daily hourly bars are trusted only when their sum equals the confirmed count', () => {
  const hours = Array(24).fill(0);
  hours[0] = 1;
  const result = activityData('daily', 0, '2026-10-19', health, daily, {
    available: true,
    days: [{ localDate: '2026-10-19', hourlyViews: hours, sessions: [] }],
  });
  expect(result.bars[0]!.value).toBe(1);
  expect(result.bars[1]!.value).toBe(0);
  expect(result.views.value).toBe(1);
  expect(result.minutes.value).toBe(2);
  expect(result.apps.map((a) => a.views)).toEqual([1, 0]);
  const missing = activityData('daily', 0, '2026-10-19', health, daily, noDetails);
  expect(missing.views.value).toBe(1);
  expect(missing.bars.every((b) => b.value === null)).toBe(true);
  hours[0] = 2;
  expect(
    activityData('daily', 0, '2026-10-19', health, daily, {
      available: true,
      days: [{ localDate: '2026-10-19', hourlyViews: hours, sessions: [] }],
    }).hourlyAvailable,
  ).toBe(false);
});
test('partial weekly sums retain tracked-day coverage and future days remain unknown', () => {
  const result = activityData(
    'weekly',
    0,
    '2026-10-21',
    health,
    (d) =>
      d.endsWith('20') ? { localDate: d, heartbeatMinutes: 0, coverage: 0, apps: [] } : daily(d, 4),
    noDetails,
  );
  expect(result.views).toEqual({ value: 8, days: 2 });
  expect(result.expectedDays).toBe(3);
  expect(result.bars.map((b) => b.value)).toEqual([4, null, 4, null, null, null, null]);
  expect(result.apps[0]!.views).toBe(8);
});
test('unvalidated counts and unmeasured time never become zero', () => {
  const result = activityData(
    'daily',
    0,
    '2026-10-19',
    {
      ...health,
      usageAccessGranted: false,
      apps: health.apps.map((a) => ({ ...a, validated: false })),
    },
    (d) => ({ ...daily(d, 0), heartbeatMinutes: 0 }),
    noDetails,
  );
  expect(result.views.value).toBeNull();
  expect(result.minutes.value).toBeNull();
  expect(result.apps.every((a) => a.views === null)).toBe(true);
});
