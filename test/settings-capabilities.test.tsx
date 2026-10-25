jest.mock('@/auth/account', () => ({
  useAccountIncarnation: () => '00000000-0000-4000-8000-000000000099',
}));
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AppState, Platform, Text } from 'react-native';
import type { v1 } from '@siddiq3/driftless-contracts';
import Settings from '../app/settings';
import { ApiError, createApiClient } from '../src/api/client';
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
jest.mock('@/billing/pro', () => ({ cacheEntitlement: jest.fn() }));
const mockRetry = jest.fn().mockResolvedValue(undefined);
let mockBackup = { state: 'saved', message: 'Saved to your account' };
jest.mock('@/sync/AccountBackupProvider', () => ({
  useAccountBackup: () => ({ status: mockBackup, retry: mockRetry }),
}));
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
  incarnation: '00000000-0000-4000-8000-000000000099',
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
  mockBackup = { state: 'saved', message: 'Saved to your account' };
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
it('shows the root backup status and retries through the shared coordinator', async () => {
  mockBackup = { state: 'pending', message: 'Offline; progress is safe on this phone' };
  await mount();
  expect(contents()).toContain(mockBackup.message);
  await act(async () =>
    tree.root
      .findAll(
        (n) =>
          n.props.accessibilityLabel === 'Retry backup' && typeof n.props.onPress === 'function',
      )[0]!
      .props.onPress(),
  );
  expect(mockRetry).toHaveBeenCalledTimes(1);
});
it('reports local readiness during a backend outage, and refreshes revoked permissions on return', async () => {
  getMe.mockRejectedValue(new ApiError(null, 'network', 'offline'));
  await mount();
  expect(contents()).toContain('local app minutes available');
  expect(contents()).toContain('Backend status unavailable');
  jest
    .mocked(Tracking.health)
    .mockReturnValue({ ...healthy, usageAccessGranted: false } as ReturnType<
      typeof Tracking.health
    >);
  await act(async () => onAppState('active'));
  expect(contents()).toContain('Usage Access permission required');
  expect(contents()).not.toContain('local app minutes available');
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
});

it('a missing entitlement bridge does not misreport a working backend as offline', async () => {
  jest.mocked(cacheEntitlement).mockImplementationOnce(() => {
    throw new Error('native bridge unavailable');
  });
  await mount();
  expect(contents()).toContain('Welcome');
  expect(contents()).not.toContain('Cloud features are unavailable');
});

it('has no backup switch or separate enable action', async () => {
  await mount();
  expect(contents()).toContain('Saved to your account');
  expect(tree.root.findAll((n) => n.props.accessibilityLabel === 'Cloud backup')).toHaveLength(0);
  expect(tree.root.findAll((n) => n.props.accessibilityLabel === 'Manage backup')).toHaveLength(0);
});
