import { candidateCount } from '@/tracking/candidateCount';
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
