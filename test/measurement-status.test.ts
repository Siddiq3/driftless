import type { Daily, TrackingHealth } from 'tracking-android';
import { recordedMeasurement } from '@/data/measurement';

const app = (over: object = {}) => ({
  package: 'com.instagram.android',
  views: 0,
  adViews: 0,
  surfaceMs: 0,
  unknownMs: 0,
  usageMs: 0,
  ...over,
});
const measure = (row: object, validated: boolean) =>
  recordedMeasurement(
    { apps: [row] } as unknown as Daily,
    {
      usageAccessGranted: false,
      apps: [{ package: 'com.instagram.android', validated }],
    } as unknown as TrackingHealth,
  );

test.each([
  ['a recorded zero on an approved version is verified', app({ surfaceMs: 5000 }), true, 0, 'validated'],
  ['a recorded count on an approved version is verified', app({ views: 4 }), true, 4, 'validated'],
  ['a recorded zero on an unapproved version is experimental', app({ surfaceMs: 5000 }), false, 0, 'experimental'],
  ['a recorded count on an unapproved version is experimental', app({ views: 4 }), false, 4, 'experimental'],
  ['no recorded activity is missing, not zero', app(), true, null, 'unavailable'],
])('%s', (_name, row, validated, views, status) => {
  expect(measure(row, validated)).toMatchObject({ views, status });
});
