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
import { AppState } from 'react-native';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { accountReady, markAccountReady } from '@/data/accountReady';
import { backupAccount } from '@/sync/accountBackup';
import { ApiError } from '@/api/client';
import { AccountBoundary, firstRestoreSettled } from '@/auth/account';
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
let mockDeleting = false;
let mockVerified: { owner: string; userId: string; incarnation: string } | null = null;
const mockForget = jest.fn(async () => undefined);
const mockRemember = jest.fn(async () => undefined);
jest.mock('@/auth/verifiedAccount', () => ({
  readVerifiedAccount: async () => mockVerified,
  rememberVerifiedAccount: (...a: unknown[]) =>
    (mockRemember as (...x: unknown[]) => unknown)(...a),
  forgetVerifiedAccount: () => mockForget(),
  isDeletingAccount: () => mockDeleting,
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
const discovery = { accountState: jest.fn(), registerAccount: jest.fn(), getMe: jest.fn() };
const bound = {
  primeStartupReads: jest.fn(),
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
  discovery.getMe.mockImplementation((...args: unknown[]) => bound.getMe(...args));
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

it('automatically initializes a missing timezone on an existing account without registering again', async () => {
  state = { state: 'active', incarnation };
  bound.getAccountUsage.mockResolvedValueOnce({
    policy: null,
    snapshot: null,
    serverTimeMs: Date.now(),
  });
  await mount();
  expect(discovery.registerAccount).not.toHaveBeenCalled();
  expect(bound.configureAccountUsage).toHaveBeenCalledWith(
    { expectedRev: 0, limits: {}, tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' },
    expect.any(Function),
  );
  expect(visible()).toContain('private screens');
});

test('Google sign-in automatically registers an account and selects only its verified dataset', async () => {
  await mount();
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

test('interrupted deletion requires recovery and explicit creation before fresh registration', async () => {
  state = { state: 'deleting', incarnation };
  await mount();
  expect(visible()).not.toContain('private screens');
  await press('Resume deletion');
  expect(bound.deleteAccount).toHaveBeenCalledTimes(1);
  expect(createApiClient).toHaveBeenCalledWith(expect.objectContaining({ incarnation }));
  expect(discovery.registerAccount).not.toHaveBeenCalled();
  await press('Create a new account');
  expect(discovery.registerAccount).toHaveBeenCalledWith(expect.any(String), incarnation);
  expect(visible()).toContain('private screens');
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
  expect(visible()).toContain('phone data is retained');
  expect(visible()).not.toContain('private screens');
  expect(resolvePersonalAccount).not.toHaveBeenCalled();
  await press('Retry');
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

test('an unfinished restore opens the app and is not marked complete', async () => {
  state = { state: 'active', incarnation };
  jest.mocked(backupAccount).mockResolvedValueOnce({ state: 'pending', message: 'More history' });
  await mount();
  expect(visible()).toContain('private screens');
  expect(visible()).not.toContain('Account preparation could not finish');
  expect(markAccountReady).not.toHaveBeenCalled();
});

test('a local restore failure opens the app instead of a dead end', async () => {
  state = { state: 'active', incarnation };
  jest.mocked(backupAccount).mockRejectedValueOnce(new Error('Guest goals are awaiting'));
  await mount();
  expect(visible()).toContain('private screens');
  expect(markAccountReady).not.toHaveBeenCalled();
});

test('an account error during restore still stops with its message', async () => {
  state = { state: 'active', incarnation };
  jest.mocked(backupAccount).mockRejectedValueOnce(new ApiError(401, 'unauthorized', 'expired'));
  await mount();
  expect(visible()).not.toContain('private screens');
  expect(visible()).toContain('Your Google session needs refreshing');
});

test('a slow restore stops waiting and can still finish afterwards', async () => {
  let finish = () => {};
  let done = false;
  const slow = new Promise<void>((resolve) => {
    finish = resolve;
  }).then(() => {
    done = true;
  });
  await firstRestoreSettled(slow, 1);
  expect(done).toBe(false);
  finish();
  await slow;
  expect(done).toBe(true);
});

describe('returning user', () => {
  afterEach(() => {
    mockVerified = null;
    jest.mocked(accountReady).mockResolvedValue(false);
    discovery.accountState.mockReset().mockImplementation(async () => state);
  });
  const returning = () => {
    mockVerified = { owner: 'g', userId: 'u', incarnation };
    jest.mocked(accountReady).mockResolvedValue(true);
  };

  test('opens saved data without waiting for the server', async () => {
    returning();
    discovery.accountState.mockImplementation(() => new Promise(() => {}));
    await mount();
    expect(visible()).toContain('private screens');
    expect(backupAccount).not.toHaveBeenCalled();
  });

  test('stays open offline', async () => {
    returning();
    discovery.accountState.mockRejectedValue(new ApiError(null, 'network', 'offline'));
    await mount();
    expect(visible()).toContain('private screens');
    expect(mockForget).not.toHaveBeenCalled();
  });

  test('a deleted account signs out to the home screen', async () => {
    returning();
    mockSignOut.mockResolvedValueOnce(undefined);
    state = { state: 'deleted', incarnation };
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
    await mount();
    expect(mockForget).toHaveBeenCalledTimes(1);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  test('a deletion running on this phone is left to finish', async () => {
    returning();
    mockDeleting = true;
    state = { state: 'deleted', incarnation };
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
    await mount();
    mockDeleting = false;
    expect(mockForget).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(visible()).toContain('private screens');
  });

  test('an unfinished restore still takes the full path', async () => {
    mockVerified = { owner: 'g', userId: 'u', incarnation };
    jest.mocked(accountReady).mockResolvedValue(false);
    state = { state: 'active', incarnation };
    await mount();
    expect(backupAccount).toHaveBeenCalled();
  });
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
test('a confirmed account is remembered only once it is ready', async () => {
  state = { state: 'active', incarnation };
  mockRemember.mockClear();
  await mount();
  expect(mockRemember).not.toHaveBeenCalled();
});
test('first completed restore marks only the verified local incarnation ready', async () => {
  state = { state: 'active', incarnation };
  await mount();
  expect(backupAccount).toHaveBeenCalledTimes(1);
  expect(markAccountReady).toHaveBeenCalledWith(expect.anything(), expect.any(Function));
});

test('new accounts initialize their timezone automatically without showing the registration form', async () => {
  bound.getAccountUsage.mockResolvedValueOnce({
    policy: null,
    snapshot: null,
    serverTimeMs: Date.now(),
  });
  await mount();
  expect(bound.configureAccountUsage).toHaveBeenCalledWith(
    { tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', limits: {}, expectedRev: 0 },
    expect.any(Function),
  );
  expect(visible()).toContain('private screens');
  expect(visible()).not.toContain('Create account');
  expect(root.root.findAllByProps({ accessibilityLabel: 'Fixed account timezone' })).toHaveLength(
    0,
  );
});

test('returning accounts preserve saved timezone and restore data without registration', async () => {
  state = { state: 'active', incarnation };
  await mount();
  expect(bound.configureAccountUsage).not.toHaveBeenCalled();
  expect(discovery.registerAccount).not.toHaveBeenCalled();
  expect(backupAccount).toHaveBeenCalledTimes(1);
  expect(visible()).toContain('private screens');
});

test('previously deleted accounts require explicit creation and retain the incarnation guard', async () => {
  state = { state: 'deleted', incarnation };
  await mount();
  expect(discovery.registerAccount).not.toHaveBeenCalled();
  expect(resolvePersonalAccount).not.toHaveBeenCalled();
  expect(visible()).not.toContain('private screens');
  await press('Create a new account');
  expect(discovery.registerAccount).toHaveBeenCalledWith(expect.any(String), incarnation);
  expect(visible()).toContain('private screens');
});

test('concurrent registration discovers the winning account without creating another dataset', async () => {
  discovery.registerAccount.mockImplementationOnce(async () => {
    state = { state: 'active', incarnation };
    throw new ApiError(409, 'registration_conflict', 'already registered');
  });
  await mount();
  expect(discovery.accountState).toHaveBeenCalledTimes(2);
  expect(discovery.registerAccount).toHaveBeenCalledTimes(1);
  expect(visible()).toContain('private screens');
});

test('timezone setup failure can resume without registering an active account again', async () => {
  bound.getAccountUsage.mockResolvedValue({
    policy: null,
    snapshot: null,
    serverTimeMs: Date.now(),
  });
  bound.configureAccountUsage.mockRejectedValueOnce(new ApiError(503, 'unavailable', 'offline'));
  await mount();
  expect(visible()).not.toContain('private screens');
  expect(resolvePersonalAccount).not.toHaveBeenCalled();
  await press('Retry');
  expect(discovery.registerAccount).toHaveBeenCalledTimes(1);
  expect(visible()).toContain('private screens');
});

test('registration completing after sign-out cannot configure or select the old account', async () => {
  let finish!: (value: { state: string; incarnation: string }) => void;
  discovery.registerAccount.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await mount();
  mockStatus = 'signedOut';
  await act(async () => {
    root.update(
      <AccountBoundary>
        <Text>guest screens</Text>
      </AccountBoundary>,
    );
  });
  await act(async () => finish({ state: 'active', incarnation }));
  expect(bound.getAccountUsage).not.toHaveBeenCalled();
  expect(bound.configureAccountUsage).not.toHaveBeenCalled();
  expect(resolvePersonalAccount).not.toHaveBeenCalled();
  expect(visible()).toContain('guest screens');
});

test('incomplete timezone setup stays retryable instead of leaving an empty screen', async () => {
  const incomplete = { policy: null, snapshot: null, serverTimeMs: Date.now() };
  bound.getAccountUsage.mockResolvedValueOnce(incomplete);
  bound.configureAccountUsage.mockResolvedValueOnce(incomplete);
  await mount();
  expect(visible()).not.toContain('private screens');
  expect(resolvePersonalAccount).not.toHaveBeenCalled();
  await press('Retry');
  expect(discovery.registerAccount).toHaveBeenCalledTimes(1);
  expect(visible()).toContain('private screens');
});

test('starts profile and lifecycle reads together but never opens private data before verification', async () => {
  state = { state: 'active', incarnation };
  let finish!: (value: typeof state) => void;
  discovery.accountState.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await mount();
  expect(discovery.getMe).toHaveBeenCalledTimes(1);
  expect(resolvePersonalAccount).not.toHaveBeenCalled();
  expect(visible()).not.toContain('private screens');
  await act(async () => finish(state));
  expect(visible()).toContain('private screens');
  expect(bound.getMe).toHaveBeenCalledTimes(1);
});

test('does not reuse a speculative profile from an older incarnation', async () => {
  state = { state: 'active', incarnation };
  discovery.getMe.mockResolvedValueOnce({
    data: { userId: 'old-user', incarnation: '00000000-0000-4000-8000-000000000099' },
  });
  await mount();
  expect(resolvePersonalAccount).toHaveBeenCalledWith(
    'stable-user',
    incarnation,
    expect.any(Function),
    true,
  );
  expect(visible()).toContain('private screens');
});

test('does not postpone allowance verification while a slow profile read is in flight', async () => {
  state = { state: 'active', incarnation };
  let finish!: (value: unknown) => void;
  discovery.getMe.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await mount();
  expect(bound.getAccountUsage).toHaveBeenCalledTimes(1);
  expect(resolvePersonalAccount).not.toHaveBeenCalled();
  await act(async () => finish({ data: { userId: 'stable-user', incarnation } }));
  expect(visible()).toContain('private screens');
});

test('hands startup reads to the verified bound account only after allowance installation', async () => {
  state = { state: 'active', incarnation };
  jest.mocked(accountReady).mockResolvedValue(true);
  await mount();
  expect(bound.primeStartupReads).toHaveBeenCalledWith(
    expect.objectContaining({ data: expect.objectContaining({ incarnation }) }),
    expect.objectContaining({ policy: expect.objectContaining({ incarnation }) }),
    expect.any(Number),
  );
  expect(visible()).toContain('private screens');
});
