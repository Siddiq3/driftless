import { candidateCount, homeAppCount } from '@/tracking/candidateCount';
import type { Daily, TrackingHealth } from 'tracking-android';
const daily: Daily = {
  localDate: '2026-10-19',
  heartbeatMinutes: 1,
  coverage: 1,
  apps: [
    { package: 'youtube', views: 2, adViews: 1, surfaceMs: 5000, unknownMs: 0, usageMs: 5000 },
  ],
};
const health = {
  apps: [{ package: 'youtube', installed: true, validated: false }],
} as TrackingHealth;
test('shows locally recorded candidate videos without including ads', () =>
  expect(candidateCount(daily, health)).toBe(2));
test('never substitutes unknown time, no events or uninstalled-app data for a count', () => {
  expect(candidateCount(null, health)).toBeNull();
  expect(candidateCount(daily, null)).toBeNull();
  expect(candidateCount({ ...daily, heartbeatMinutes: 0 }, health)).toBeNull();
  expect(
    candidateCount({ ...daily, apps: [{ ...daily.apps[0]!, surfaceMs: 0 }] }, health),
  ).toBeNull();
  expect(candidateCount({ ...daily, apps: [{ ...daily.apps[0]!, views: 0 }] }, health)).toBeNull();
  expect(candidateCount(daily, { ...health, apps: [] })).toBeNull();
});

test('home app counts match the unvalidated local total and refresh with new observations', () => {
  expect(homeAppCount(daily, health, 'youtube')).toBe(candidateCount(daily, health));
  const updated = { ...daily, apps: [{ ...daily.apps[0]!, views: 3 }] };
  expect(homeAppCount(updated, health, 'youtube')).toBe(3);
  expect(candidateCount(updated, health)).toBe(3);
});

test('home keeps unavailable counts unknown and does not invent video counts for minutes-only apps', () => {
  expect(homeAppCount(null, health, 'youtube')).toBeNull();
  expect(homeAppCount(daily, null, 'youtube')).toBeNull();
  expect(homeAppCount(daily, health, 'missing')).toBeNull();
  expect(homeAppCount({ ...daily, heartbeatMinutes: 0 }, health, 'youtube')).toBe(2);
  expect(homeAppCount({ ...daily, apps: [] }, health, 'youtube')).toBe(0);
  const minutesOnly = {
    ...health,
    apps: [{ ...health.apps[0]!, videoDetectionImplemented: false }],
  };
  expect(homeAppCount(daily, minutesOnly, 'youtube')).toBeNull();
});
