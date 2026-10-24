import { aggregateDay } from '@/sync/aggregate';
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
test('daily hourly bars are shown only when their sum equals the saved local count', () => {
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
test('unrecorded counts and unmeasured time never become zero', () => {
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

test.each(['instagram', 'youtube'])('local %s hours do not require an approved version', (pkg) => {
  const unvalidated = { ...health, apps: health.apps.map((app) => ({ ...app, validated: false })) };
  const raw = daily('2026-10-19', 3);
  raw.apps[0]!.package = pkg;
  const hourlyViews = Array<number>(24).fill(0);
  hourlyViews[12] = 3;
  const details = {
    available: true,
    days: [{ localDate: raw.localDate, hourlyViews, sessions: [] }],
  };
  const result = activityData('daily', 0, raw.localDate, unvalidated, () => raw, details);
  expect(result.hourlyAvailable).toBe(true);
  expect(result.bars[12]!.value).toBe(3);
  expect(result.bars.reduce((sum, bar) => sum + (bar.value ?? 0), 0)).toBe(result.views.value);
  expect(result.apps.find((app) => app.package === pkg)!.views).toBe(3);
  expect(unvalidated.apps.every((app) => app.validated === false)).toBe(true);
  expect(aggregateDay(raw, unvalidated, 'phone', 'UTC').views).toBeNull();
  expect(
    activityData('weekly', 0, raw.localDate, unvalidated, () => raw, details).views.value,
  ).toBe(3);
});

test('local totals exclude other packages and are not constrained by the cloud count cap', () => {
  const raw = daily('2026-10-19', 5001);
  raw.apps.push({ ...raw.apps[0]!, package: 'untracked.other', views: 99 });
  const hourlyViews = Array<number>(24).fill(0);
  hourlyViews[0] = 5001;
  const result = activityData('daily', 0, raw.localDate, health, () => raw, {
    available: true,
    days: [{ localDate: raw.localDate, hourlyViews, sessions: [] }],
  });
  expect(result.views.value).toBe(5001);
  expect(result.hourlyAvailable).toBe(true);
  expect(result.apps[0]!.views).toBe(5001);
});

test('missing validation metadata and event-only days still allow local hours without guessing missing data', () => {
  const missing = {
    ...health,
    apps: health.apps.map(({ validated: _validated, ...app }) => app),
  } as TrackingHealth;
  const raw = { ...daily('2026-10-19', 2), heartbeatMinutes: 0 };
  const hourlyViews = Array<number>(24).fill(0);
  hourlyViews[23] = 2;
  const result = activityData('daily', 0, raw.localDate, missing, () => raw, {
    available: true,
    days: [{ localDate: raw.localDate, hourlyViews, sessions: [] }],
  });
  expect(result.views.value).toBe(2);
  expect(result.bars[23]!.value).toBe(2);
  expect(
    activityData('daily', 0, raw.localDate, missing, () => raw, noDetails).hourlyAvailable,
  ).toBe(false);
  expect(
    activityData('daily', 0, raw.localDate, missing, () => raw, {
      available: true,
      days: [{ localDate: raw.localDate, hourlyViews: [2], sessions: [] }],
    }).hourlyAvailable,
  ).toBe(false);
});

test('mixed validated and unvalidated apps share local buckets without promoting the latter to cloud totals', () => {
  const raw = daily('2026-10-19', 2);
  raw.apps.push({ ...raw.apps[0]!, package: 'youtube', views: 3 });
  const mixed = {
    ...health,
    apps: health.apps.map((app) => ({ ...app, validated: app.package === 'instagram' })),
  };
  const hourlyViews = Array<number>(24).fill(0);
  hourlyViews[9] = 2;
  hourlyViews[10] = 3;
  const result = activityData('daily', 0, raw.localDate, mixed, () => raw, {
    available: true,
    days: [{ localDate: raw.localDate, hourlyViews, sessions: [] }],
  });
  expect(result.views.value).toBe(5);
  expect(result.hourlyAvailable).toBe(true);
  expect(result.apps.map((app) => app.views)).toEqual([3, 2]);
  expect(aggregateDay(raw, mixed, 'phone', 'UTC').views).toBe(2);
});
