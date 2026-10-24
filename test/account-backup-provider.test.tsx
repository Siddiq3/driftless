import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AppState, Text } from 'react-native';
import type { ApiClient } from '../src/api/client';
import { AccountBackupProvider, useAccountBackup } from '../src/sync/AccountBackupProvider';
import { backupAccount } from '../src/sync/accountBackup';
let mockApi: ApiClient | null = null;
let mockGeneration = 0;
jest.mock('@/auth/session', () => ({
  useSession: () => ({ status: mockApi ? 'signedIn' : 'signedOut', displayName: 'Test User' }),
}));
jest.mock('@/api/useApi', () => ({ useApi: () => mockApi }));
jest.mock('@/billing/cache', () => ({ entitlementGeneration: () => mockGeneration }));
jest.mock('@/sync/accountBackup', () => ({ backupAccount: jest.fn() }));
let state: ReturnType<typeof useAccountBackup>;
function Status() {
  state = useAccountBackup();
  return <Text>{state.status.message}</Text>;
}
let tree: ReactTestRenderer;
let onAppState: (value: string) => void;
const mount = async () => {
  await act(async () => {
    tree = create(
      <AccountBackupProvider>
        <Status />
      </AccountBackupProvider>,
    );
  });
};
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockApi = null;
  mockGeneration = 0;
  Object.defineProperty(AppState, 'currentState', {
    configurable: true,
    writable: true,
    value: 'active',
  });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, fn) => {
    onAppState = fn as typeof onAppState;
    return { remove: jest.fn() };
  });
  jest.mocked(backupAccount).mockResolvedValue({ state: 'saved', message: 'Saved' });
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  jest.restoreAllMocks();
  jest.useRealTimers();
});
it('keeps guests local and starts backup on login without visiting Settings', async () => {
  await mount();
  expect(backupAccount).not.toHaveBeenCalled();
  mockApi = {} as ApiClient;
  await act(async () =>
    tree.update(
      <AccountBackupProvider>
        <Status />
      </AccountBackupProvider>,
    ),
  );
  expect(backupAccount).toHaveBeenCalledTimes(1);
  expect(state.status.message).toBe('Saved');
});
it('automatically retries offline backup after returning to the app', async () => {
  mockApi = {} as ApiClient;
  jest.mocked(backupAccount).mockRejectedValueOnce(new Error('Offline; data kept locally'));
  await mount();
  expect(state.status.state).toBe('pending');
  await act(async () => {
    jest.advanceTimersByTime(20000);
    onAppState('active');
  });
  expect(state.status.state).toBe('saved');
});
it('invalidates an in-flight upload and its status immediately when the session generation changes', async () => {
  mockApi = {} as ApiClient;
  let finish!: (value: { state: 'saved'; message: string }) => void;
  let allowed!: () => boolean;
  jest.mocked(backupAccount).mockImplementationOnce((_api, guard) => {
    allowed = guard;
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  await mount();
  expect(allowed()).toBe(true);
  mockGeneration++;
  expect(allowed()).toBe(false);
  mockApi = null;
  await act(async () => {
    tree.update(
      <AccountBackupProvider>
        <Status />
      </AccountBackupProvider>,
    );
    finish({ state: 'saved', message: 'OLD ACCOUNT' });
  });
  expect(state.status.state).toBe('local');
});
it('pauses all automatic retries before explicit deletion', async () => {
  mockApi = {} as ApiClient;
  await mount();
  await act(async () => state.pause());
  await act(async () => {
    jest.advanceTimersByTime(120000);
    onAppState('active');
  });
  expect(backupAccount).toHaveBeenCalledTimes(1);
  expect(state.status.state).toBe('paused');
});
