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
it('local minutes do not depend on backend release flags or connectivity', () => {
  expect(report(health, null).minutesTracking.available).toBe(true);
  expect(report(health, null).blocking).toMatchObject({
    available: false,
    detail: 'Backend status unavailable',
  });
  expect(
    report(health, { ...me, capabilities: { ...me.capabilities, blocking: false } }).blocking
      .available,
  ).toBe(false);
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
it('running unapproved versions remain unverified and cannot imply cloud reel scores', () => {
  const r = report({ ...health, apps: [{ ...health.apps[0]!, validated: false }] });
  expect(r.videoCounting).toMatchObject({ available: false });
  expect(r.videoCounting.detail).toContain('unverified');
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
  'expired or old-binary native entitlement %s fails closed',
  (blockingEntitled) => {
    expect(report({ ...health, blockingEntitled }).blocking.available).toBe(false);
  },
);
it('configured eligibility never claims active enforcement or reel blocking', () => {
  expect(report().blocking.detail).toContain('reel-count blocking is not implemented');
  expect(report().schedules.detail).toContain('requires an enabled rule');
});
it('backend eligibility does not override free entitlement or sharing consent', () => {
  expect(
    report(health, { ...me, entitlement: { ...me.entitlement, tier: 'free' } }).blocking.available,
  ).toBe(false);
  expect(
    report(health, {
      ...me,
      profile: { ...me.profile, consent: { cloudSync: true, shareWithFriends: false } },
    }).socialSharingOfUsage.available,
  ).toBe(false);
});
