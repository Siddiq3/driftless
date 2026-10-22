import { protectionStatus } from '../src/billing/protectionStatus';
import { DEFAULT_BLOCKING } from '../src/billing/blocking';
import type { BlockingConfig, TrackingHealth } from 'tracking-android';
jest.mock('tracking-android', () => ({ Tracking: {} }));
const config: BlockingConfig = {
  ...DEFAULT_BLOCKING,
  enabled: true,
  apps: ['youtube'],
  dailyMinutes: null,
  enforceVideoGoal: true,
};
const health: TrackingHealth = {
  implemented: true,
  engineVersion: 2,
  rulesVersion: 5,
  disclosureAccepted: true,
  serviceEnabled: true,
  serviceRunning: true,
  blockingEntitled: true,
  feedLimitsImplemented: true,
  usageAccessGranted: true,
  debugBuild: false,
  lastConnectedMs: 0,
  lastEventMs: 0,
  heartbeatMinutesToday: 1,
  apps: [
    {
      package: 'youtube',
      label: 'YouTube',
      installed: true,
      validated: true,
      version: '1',
      videoDetectionImplemented: true,
    },
  ],
};
test('a saved goal alone never implies active protection', () => {
  expect(protectionStatus({ ...config, enabled: false }, health, 50)).toMatchObject({
    title: 'Protection inactive',
    body: expect.stringContaining('Limits are saved'),
  });
  expect(protectionStatus(config, health, null).body).toContain('Save and enable');
});
test.each([
  [{ serviceEnabled: false }, 'Permission required'],
  [{ disclosureAccepted: false }, 'Permission required'],
  [{ serviceRunning: false }, 'Tracking service unavailable'],
  [{ implemented: false }, 'Tracking service unavailable'],
  [{ blockingEntitled: false }, 'Pro verification required'],
])('reports the native gate %j', (override, reason) => {
  expect(protectionStatus(config, { ...health, ...override }, 50).body).toContain(reason);
});
test('distinguishes disabled experimental detection, enabled experiment, and unsupported app', () => {
  const candidate = { ...health, apps: [{ ...health.apps[0]!, validated: false }] };
  expect(protectionStatus(config, candidate, 50).body).toContain('enforcement is inactive');
  expect(
    protectionStatus({ ...config, allowUnvalidatedCounts: true }, candidate, 50),
  ).toMatchObject({
    title: 'Protection needs attention',
    body: expect.stringContaining('Experimental feed detection is enabled'),
  });
  expect(
    protectionStatus(
      config,
      { ...health, apps: [{ ...health.apps[0]!, videoDetectionImplemented: false }] },
      50,
    ).body,
  ).toContain('unsupported');
});
test('ready means configured intervention, never a promise that a feed is currently blocked', () => {
  expect(protectionStatus(config, health, 50)).toMatchObject({
    title: 'Protection active',
    body: expect.stringContaining('when their conditions are met'),
  });
});
test('whole-app minute rules do not require approved feed detection', () => {
  const h = {
    ...health,
    apps: [{ ...health.apps[0]!, validated: false, videoDetectionImplemented: false }],
  };
  expect(
    protectionStatus(
      { ...config, enforceVideoGoal: false, feedOnly: false, dailyMinutes: 30 },
      h,
      null,
    ).title,
  ).toBe('Protection active');
  expect(
    protectionStatus(
      { ...config, enforceVideoGoal: false, feedOnly: false, dailyMinutes: 30 },
      { ...h, usageAccessGranted: false },
      null,
    ).body,
  ).toContain('not complete app minutes');
});
