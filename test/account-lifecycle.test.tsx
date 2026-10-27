jest.mock('@/ui/StartupScreen', () => ({
  StartupScreen: () =>
    require('react').createElement(require('react-native').Text, null, 'Opening ScrollSnooze'),
}));
jest.mock('@/data/accountReady', () => ({
  accountReady: jest.fn().mockResolvedValue(false),
  markAccountReady: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/sync/accountBackup', () => ({
  backupAccount: jest.fn().mockResolvedValue({ state: 'saved', message: 'Saved' }),
}));
jest.mock('@/sync/accountUsage', () => ({
  installAccountUsage: jest.fn().mockResolvedValue(undefined),
}));
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { accountReady, markAccountReady } from '@/data/accountReady';
import { backupAccount } from '@/sync/accountBackup';
import { ApiError } from '@/api/client';
import { AccountBoundary } from '@/auth/account';
import { createApiClient } from '@/api/client';
import { resolvePersonalAccount, selectPersonalSession } from '@/data/session';

const mockToken = jest.fn(async () => 'fixture-token');
const mockSignOut = jest.fn();
let mockStatus = 'signedIn';
jest.mock('@/auth/session', () => ({
  useSession: () => ({ status: mockStatus, getAccessToken: mockToken, signOut: mockSignOut }),
}));
jest.mock('@/config/env', () => ({
  APP_VERSION: '0.1.0',
  readEnv: () => ({ apiUrl: 'https://fixture.invalid' }),
}));
jest.mock('@/api/client', () => ({
  ...jest.requireActual('@/api/client'),
  createApiClient: jest.fn(),
}));
jest.mock('@/data/session', () => ({
  resolvePersonalAccount: jest.fn(),
  selectPersonalSession: jest.fn(),
}));
jest.mock('tracking-android', () => ({ Tracking: { setEntitlement: jest.fn() } }));
jest.mock('expo-crypto', () => ({ randomUUID: () => '00000000-0000-4000-8000-000000000009' }));
jest.mock('@/ui/kit', () => {
  const React = require('react');
  const { View, Text, Pressable, TextInput } = require('react-native');
  return {
    Field: ({ label, ...props }: { label: string }) =>
      React.createElement(TextInput, { accessibilityLabel: label, ...props }),
    Screen: View,
    Notice: ({ body }: { body: string }) => React.createElement(Text, null, body),
    Button: ({ label, onPress }: { label: string; onPress: () => void }) =>
      React.createElement(Pressable, { accessibilityLabel: label, onPress }),
  };
});
const incarnation = '00000000-0000-4000-8000-000000000001';
let state: { state: string; incarnation: string | null };
let root: ReactTestRenderer;
const discovery = { accountState: jest.fn(), registerAccount: jest.fn() };
const bound = {
  getMe: jest.fn(),
  deleteAccount: jest.fn(),
  getAccountUsage: jest.fn(),
  configureAccountUsage: jest.fn(),
};
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(accountReady).mockResolvedValue(false);
  mockStatus = 'signedIn';
  state = { state: 'legacy_quarantined', incarnation: null };
  discovery.accountState.mockImplementation(async () => state);
  discovery.registerAccount.mockImplementation(async () => {
    state = { state: 'active', incarnation };
    return state;
  });
  bound.getAccountUsage.mockResolvedValue({
    policy: { incarnation, tz: 'UTC', activeFromMs: Date.now() + 86400000, rev: 1, policies: [] },
    snapshot: null,
    serverTimeMs: Date.now(),
  });
  bound.configureAccountUsage.mockResolvedValue({
    policy: { incarnation, tz: 'UTC', activeFromMs: Date.now() + 86400000, rev: 1, policies: [] },
    snapshot: null,
    serverTimeMs: Date.now(),
  });
  bound.getMe.mockResolvedValue({ data: { userId: 'stable-user', incarnation } });
  bound.deleteAccount.mockImplementation(async () => {
    state = { state: 'deleted', incarnation };
    return { state: 'completed' };
  });
  jest.mocked(resolvePersonalAccount).mockResolvedValue({} as never);
  jest.mocked(selectPersonalSession).mockResolvedValue();
  jest
    .mocked(createApiClient)
    .mockImplementation((o) => ({ ...(o.incarnation ? bound : discovery) }) as never);
});
afterEach(async () => {
  if (root) await act(async () => root.unmount());
});
const mount = async () => {
  await act(async () => {
    root = create(
      <AccountBoundary>
        <Text>private screens</Text>
      </AccountBoundary>,
    );
  });
};
const visible = () => JSON.stringify(root.toJSON());
const press = async (label: string) => {
  await act(async () => root.root.findByProps({ accessibilityLabel: label }).props.onPress());
};

it('requires explicit timezone confirmation for an existing Phase 1 incarnation without registering it again', async () => {
  state = { state: 'active', incarnation };
  bound.getAccountUsage
    .mockResolvedValueOnce({ policy: null, snapshot: null, serverTimeMs: Date.now() })
    .mockResolvedValueOnce({ policy: null, snapshot: null, serverTimeMs: Date.now() });
  await mount();
  expect(visible()).not.toContain('private screens');
  await press('Confirm fixed timezone');
  expect(discovery.registerAccount).not.toHaveBeenCalled();
  expect(bound.configureAccountUsage).toHaveBeenCalledWith(
    expect.objectContaining({ expectedRev: 0, limits: {}, tz: expect.any(String) }),
  );
  expect(visible()).toContain('private screens');
});

test('Google sign-in leaves legacy data quarantined until explicit empty registration', async () => {
  await mount();
  expect(visible()).not.toContain('private screens');
  expect(discovery.registerAccount).not.toHaveBeenCalled();
  expect(resolvePersonalAccount).not.toHaveBeenCalled();
  await press('Create account');
  expect(discovery.registerAccount).toHaveBeenCalledWith(
    '00000000-0000-4000-8000-000000000009',
    null,
  );
  expect(resolvePersonalAccount).toHaveBeenCalledWith(
    'stable-user',
    incarnation,
    expect.any(Function),
    true,
  );
  expect(visible()).toContain('private screens');
});

test('active account screens and backup stay unmounted until local incarnation selection completes', async () => {
  state = { state: 'active', incarnation };
  let finish!: () => void;
  jest.mocked(resolvePersonalAccount).mockImplementationOnce(
    () =>
      new Promise((r) => {
        finish = () => r({} as never);
      }),
  );
  await mount();
  expect(visible()).not.toContain('private screens');
  await act(async () => finish());
  expect(visible()).toContain('private screens');
  expect(discovery.registerAccount).not.toHaveBeenCalled();
});

test('interrupted deletion resumes against its old incarnation before fresh registration is offered', async () => {
  state = { state: 'deleting', incarnation };
  await mount();
  expect(visible()).not.toContain('private screens');
  await press('Resume deletion');
  expect(bound.deleteAccount).toHaveBeenCalledTimes(1);
  expect(createApiClient).toHaveBeenCalledWith(expect.objectContaining({ incarnation }));
  expect(discovery.registerAccount).not.toHaveBeenCalled();
  expect(resolvePersonalAccount).not.toHaveBeenCalled();
  await press('Create account');
  expect(discovery.registerAccount).toHaveBeenCalledWith(expect.any(String), incarnation);
});

test('failed lifecycle discovery exposes no account dataset or registration side effect', async () => {
  discovery.accountState.mockRejectedValueOnce(new Error('offline'));
  await mount();
  expect(visible()).toContain('phone data is retained');
  expect(visible()).not.toContain('private screens');
  expect(resolvePersonalAccount).not.toHaveBeenCalled();
  expect(discovery.registerAccount).not.toHaveBeenCalled();
});

test('registration failure exposes no private screens and retries the same operation', async () => {
  discovery.registerAccount.mockRejectedValueOnce(new Error('response unavailable'));
  await mount();
  await press('Create account');
  expect(visible()).toContain('response unavailable');
  expect(visible()).not.toContain('private screens');
  expect(resolvePersonalAccount).not.toHaveBeenCalled();
  await press('Create account');
  expect(discovery.registerAccount.mock.calls[1]).toEqual(discovery.registerAccount.mock.calls[0]);
  expect(visible()).toContain('private screens');
});
test('a late lifecycle result after session expiry cannot bind or mount the old dataset', async () => {
  let finish!: (state: { state: string; incarnation: string }) => void;
  discovery.accountState.mockImplementationOnce(
    () =>
      new Promise((r) => {
        finish = r;
      }),
  );
  await mount();
  mockStatus = 'signedOut';
  // Signed-out children represent the guest app; the real SessionProvider selects its guest
  // scope before publishing signedOut (covered independently by google-session tests).
  await act(async () => {
    root.update(
      <AccountBoundary>
        <Text>guest screens</Text>
      </AccountBoundary>,
    );
  });
  await act(async () => finish({ state: 'active', incarnation }));
  expect(resolvePersonalAccount).not.toHaveBeenCalled();
  expect(visible()).not.toContain('private screens');
  expect(visible()).toContain('guest screens');
});

test('existing account discovery outage recovers with Retry without registration', async () => {
  state = { state: 'active', incarnation };
  discovery.accountState.mockRejectedValueOnce(new ApiError(null, 'network', 'offline'));
  await mount();
  expect(visible()).not.toContain('private screens');
  await press('Retry');
  expect(visible()).toContain('private screens');
  expect(discovery.registerAccount).not.toHaveBeenCalled();
});

test.each(['profile', 'storage', 'usage', 'restore'])(
  'retries a failed %s bootstrap step without account creation',
  async (stage) => {
    state = { state: 'active', incarnation };
    const operation =
      stage === 'profile'
        ? bound.getMe
        : stage === 'storage'
          ? jest.mocked(resolvePersonalAccount)
          : stage === 'usage'
            ? bound.getAccountUsage
            : jest.mocked(backupAccount);
    operation.mockRejectedValueOnce(new ApiError(503, 'unavailable', 'fixture failure'));
    await mount();
    expect(visible()).not.toContain('private screens');
    await press('Retry');
    expect(visible()).toContain('private screens');
    expect(discovery.registerAccount).not.toHaveBeenCalled();
  },
);

test('does not mount empty screens while a partial restore is pending', async () => {
  state = { state: 'active', incarnation };
  jest.mocked(backupAccount).mockResolvedValueOnce({ state: 'pending', message: 'More history' });
  await mount();
  expect(visible()).not.toContain('private screens');
  await press('Retry');
  expect(visible()).toContain('private screens');
});

test('incompatible bootstrap response asks for an update without endless Retry', async () => {
  discovery.accountState.mockRejectedValueOnce(new ApiError(200, 'contract_mismatch', 'bad shape'));
  await mount();
  expect(visible()).toContain('incompatible');
  expect(root.root.findAllByProps({ accessibilityLabel: 'Retry' })).toHaveLength(0);
  expect(discovery.registerAccount).not.toHaveBeenCalled();
});

test('returning initialized account opens without waiting for uploads or cloud history', async () => {
  state = { state: 'active', incarnation };
  jest.mocked(accountReady).mockResolvedValue(true);
  jest.mocked(backupAccount).mockRejectedValueOnce(new Error('background outage'));
  await mount();
  expect(visible()).toContain('private screens');
  expect(backupAccount).not.toHaveBeenCalled();
  expect(discovery.registerAccount).not.toHaveBeenCalled();
  jest.mocked(backupAccount).mockReset().mockResolvedValue({ state: 'saved', message: 'Saved' });
});
test('first completed restore marks only the verified local incarnation ready', async () => {
  state = { state: 'active', incarnation };
  await mount();
  expect(backupAccount).toHaveBeenCalledTimes(1);
  expect(markAccountReady).toHaveBeenCalledWith(expect.anything(), expect.any(Function));
});
