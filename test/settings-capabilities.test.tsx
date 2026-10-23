import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AppState, Platform, Text } from 'react-native';
import type { v1 } from '@siddiq3/driftless-contracts';
import Settings from '../app/settings';
import { ApiError, createApiClient } from '../src/api/client';
import { syncGoals, cancelGoalSync } from '../src/goals/sync';
import { cacheEntitlement } from '../src/billing/pro';
import { Tracking } from 'tracking-android';

jest.mock('expo-router', () => ({
  Redirect: () => null,
  router: { push: jest.fn() },
  useFocusEffect: (fn: () => void) => require('react').useEffect(fn, [fn]),
}));
jest.mock('@/auth/session', () => ({
  useSession: () => ({ status: 'signedIn', getAccessToken: jest.fn(), signOut: jest.fn() }),
}));
jest.mock('@/config/env', () => ({
  APP_VERSION: '1',
  readEnv: () => ({ apiUrl: 'https://example.test' }),
}));
jest.mock('@/api/client', () => ({
  ...jest.requireActual('@/api/client'),
  createApiClient: jest.fn(),
}));
jest.mock('@/api/useApi', () => ({
  useApi: () => require('@/api/client').createApiClient(),
}));
jest.mock('@/billing/pro', () => ({ cacheEntitlement: jest.fn() }));
jest.mock('@/goals/sync', () => ({ syncGoals: jest.fn(), cancelGoalSync: jest.fn() }));
jest.mock('@/sync/push', () => ({ registerPush: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/sync/run', () => ({ syncNow: jest.fn().mockResolvedValue({ kind: 'idle' }) }));
jest.mock('tracking-android', () => ({
  Tracking: {
    health: jest.fn(),
    runtimeSupport: () => ({ counting: true, minutes: true, blocking: true }),
  },
}));
jest.mock('@/ui/kit', () => {
  const { Text, View, Pressable } = require('react-native');
  const React = require('react');
  return {
    T: Text,
    Details: View,
    Section: View,
    Screen: View,
    Toggle: View,
    Notice: ({ body }: { body: string }) => React.createElement(Text, null, body),
    Button: ({ label, onPress }: { label: string; onPress: () => void }) =>
      React.createElement(Pressable, { accessibilityLabel: label, onPress }),
  };
});
const me: v1.MeResponse = {
  userId: 'user-a',
  profile: {
    handle: null,
    displayName: null,
    tz: 'UTC',
    locale: 'en',
    rev: 1,
    consent: { cloudSync: true, shareWithFriends: true },
  },
  entitlement: { tier: 'free', state: 'none', source: 'none', expiresAt: null, verifiedAt: null },
  capabilities: {
    videoCounting: false,
    minutesTracking: false,
    blocking: false,
    schedules: false,
    advancedAnalytics: false,
    socialSharingOfUsage: true,
  },
};
const healthy = {
  implemented: true,
  serviceEnabled: true,
  serviceRunning: true,
  disclosureAccepted: true,
  usageAccessGranted: true,
  apps: [
    {
      package: 'com.instagram.android',
      label: 'Instagram',
      installed: true,
      version: '1',
      validated: false,
    },
  ],
};
const getMe = jest.fn();
let tree: ReactTestRenderer;
let onAppState: (state: string) => void;
const contents = () =>
  tree.root
    .findAllByType(Text)
    .map((node) => node.props.children)
    .flat(Infinity)
    .join(' ');
const mount = async () => {
  await act(async () => {
    tree = create(<Settings />);
  });
};
beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'android');
  jest.useFakeTimers();
  jest.clearAllMocks();
  getMe.mockReset().mockResolvedValue({ data: me, etag: '"1"' });
  jest
    .mocked(createApiClient)
    .mockReturnValue({ getMe } as unknown as ReturnType<typeof createApiClient>);
  jest.mocked(syncGoals).mockResolvedValue(undefined);
  jest.mocked(Tracking.health).mockReturnValue(healthy as ReturnType<typeof Tracking.health>);
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, fn) => {
    onAppState = fn as typeof onAppState;
    return { remove: jest.fn() };
  });
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  jest.restoreAllMocks();
  jest.useRealTimers();
});
it('shows goal backup failure independently from successful usage sync and supports retry', async () => {
  jest.mocked(syncGoals).mockRejectedValueOnce(new Error('server validation failed'));
  await mount();
  expect(contents()).toContain('Goal backup failed: server validation failed');
  expect(contents()).toContain('Up to date');
  await act(async () =>
    tree.root
      .findAll(
        (n) =>
          n.props.accessibilityLabel === 'Retry backup' && typeof n.props.onPress === 'function',
      )[0]!
      .props.onPress(),
  );
  expect(jest.mocked(syncGoals)).toHaveBeenCalledTimes(2);
  expect(contents()).toContain('Goals backed up');
});
it('reports local readiness during a backend outage, and refreshes revoked permissions on return', async () => {
  getMe.mockRejectedValue(new ApiError(null, 'network', 'offline'));
  await mount();
  expect(contents()).toContain('local app minutes available');
  expect(contents()).toContain('Backend status unavailable');
  expect(syncGoals).not.toHaveBeenCalled();
  jest
    .mocked(Tracking.health)
    .mockReturnValue({ ...healthy, usageAccessGranted: false } as ReturnType<
      typeof Tracking.health
    >);
  await act(async () => onAppState('active'));
  expect(contents()).toContain('Usage Access permission required');
  expect(contents()).not.toContain('local app minutes available');
});
it('cancels goal synchronization when cloud consent is switched off', async () => {
  await mount();
  getMe.mockResolvedValue({
    data: {
      ...me,
      profile: { ...me.profile, consent: { cloudSync: false, shareWithFriends: false } },
    },
  });
  await act(async () => onAppState('active'));
  expect(cancelGoalSync).toHaveBeenCalled();
  expect(syncGoals).toHaveBeenCalledTimes(1);
});
it('does not let an old profile response overwrite a newer offline result', async () => {
  let finish!: (value: { data: v1.MeResponse }) => void;
  getMe
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockRejectedValue(new ApiError(null, 'network', 'offline'));
  await mount();
  await act(async () => onAppState('active'));
  await act(async () => finish({ data: me }));
  expect(contents()).toContain('Backend status unavailable');
  expect(syncGoals).not.toHaveBeenCalled();
});

it('a missing entitlement bridge does not misreport a working backend as offline', async () => {
  jest.mocked(cacheEntitlement).mockImplementationOnce(() => {
    throw new Error('native bridge unavailable');
  });
  await mount();
  expect(contents()).toContain('Welcome');
  expect(contents()).not.toContain('Cloud features are unavailable');
  expect(syncGoals).toHaveBeenCalled();
});
