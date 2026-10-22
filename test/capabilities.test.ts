import type { v1 } from '@siddiq3/driftless-contracts';
import type { TrackingHealth } from 'tracking-android';
import { capabilityReport } from '../src/capabilities/model';
const health: TrackingHealth = {
  engineVersion: 1,
  implemented: true,
  rulesVersion: 1,
  disclosureAccepted: true,
  serviceEnabled: true,
  serviceRunning: true,
  lastConnectedMs: 1,
  lastEventMs: 1,
  heartbeatMinutesToday: 0,
  usageAccessGranted: true,
  debugBuild: false,
  blockingEntitled: true,
  subscriptionRequired: false,
  apps: [
    {
      package: 'com.instagram.android',
      label: 'Instagram',
      installed: true,
      version: '1',
      validated: true,
    },
  ],
};
const me: v1.MeResponse = {
  userId: 'user',
  profile: {
    handle: null,
    displayName: null,
    tz: 'UTC',
    locale: 'en',
    rev: 1,
    consent: { cloudSync: true, shareWithFriends: true },
  },
  entitlement: { tier: 'pro', source: 'play', state: 'active', expiresAt: null, verifiedAt: null },
  capabilities: {
    videoCounting: true,
    minutesTracking: true,
    blocking: true,
    schedules: true,
    advancedAnalytics: true,
    socialSharingOfUsage: true,
  },
};
const support = { counting: true, minutes: true, blocking: true };
const report = (
  h: TrackingHealth | null = health,
  backend: v1.MeResponse | null = me,
  platform = 'android',
) => capabilityReport({ health: h, backend, platform, support });
it('local features do not require a subscription, backend connection or login', () => {
  expect(report(health, null).minutesTracking.available).toBe(true);
  expect(report(health, null).blocking.available).toBe(true);
  expect(
    report(health, { ...me, capabilities: { ...me.capabilities, blocking: false } }).blocking
      .available,
  ).toBe(true);
});
it.each(['serviceEnabled', 'serviceRunning', 'disclosureAccepted', 'implemented'] as const)(
  'fails closed when %s is false',
  (key) => {
    const r = report({ ...health, [key]: false });
    expect(r.videoCounting.available).toBe(false);
    expect(r.blocking.available).toBe(false);
  },
);
it('revoked Usage Access does not claim minutes are available', () => {
  expect(report({ ...health, usageAccessGranted: false }).minutesTracking.available).toBe(false);
});
it('offers app minutes but no video counting for apps without player rules', () => {
  const newPlatforms = ['Facebook Reels', 'Snapchat Spotlight', 'Moj', 'ShareChat'].map(
    (label, i) => ({
      package: `new-platform-${i}`,
      label,
      installed: true,
      version: '1.0',
      validated: false,
      videoDetectionImplemented: false,
    }),
  );
  const r = report({ ...health, apps: newPlatforms });
  expect(r.minutesTracking.available).toBe(true);
  expect(r.videoCounting).toMatchObject({
    available: false,
    detail: 'Short-video detection rules are not configured for the installed apps yet',
  });
});
it('running unapproved versions remain unverified and cannot imply cloud reel scores', () => {
  const r = report({ ...health, apps: [{ ...health.apps[0]!, validated: false }] });
  expect(r.videoCounting).toMatchObject({ available: false });
  expect(r.videoCounting.detail).toContain('cloud video scores unavailable');
  expect(r.socialSharingOfUsage.available).toBe(false);
});
it('no installed targets or missing native health never implies tracking readiness', () => {
  expect(report({ ...health, apps: [] }).videoCounting.available).toBe(false);
  expect(report(null).minutesTracking.available).toBe(false);
  expect(
    capabilityReport({
      platform: 'android',
      health,
      backend: me,
      support: { counting: false, minutes: false, blocking: false },
    }).blocking.available,
  ).toBe(false);
});
it('iOS never advertises unavailable native or social functionality', () => {
  expect(Object.values(report(health, me, 'ios')).every((s) => !s.available)).toBe(true);
});
it('unimplemented analytics stays unavailable even if a backend advertises it', () => {
  expect(report().advancedAnalytics.available).toBe(false);
});
it.each([false, undefined])(
  'native purchase entitlement %s does not restrict included features',
  (blockingEntitled) => {
    expect(report({ ...health, blockingEntitled }).blocking.available).toBe(true);
  },
);
it('configured eligibility distinguishes old binaries from configurable feed limits', () => {
  expect(report().blocking.detail).toContain('feed limits require an updated Android build');
  expect(report({ ...health, feedLimitsImplemented: true }).blocking.detail).toContain(
    'available to configure',
  );
  expect(report().schedules.detail).toContain('requires an enabled rule');
});
it('free users get focus features while sharing still requires consent', () => {
  expect(
    report(health, { ...me, entitlement: { ...me.entitlement, tier: 'free' } }).blocking.available,
  ).toBe(true);
  expect(
    report(health, {
      ...me,
      profile: { ...me.profile, consent: { cloudSync: true, shareWithFriends: false } },
    }).socialSharingOfUsage.available,
  ).toBe(false);
});

test('older binaries must be updated before claiming subscription-free native access', () => {
  expect(report({ ...health, subscriptionRequired: undefined }).blocking.detail).toContain(
    'latest Android build',
  );
});
