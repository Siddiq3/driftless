import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AppState, BackHandler, Modal, Text } from 'react-native';
import { AppUpdateBoundary } from '@/updates/AppUpdateBoundary';
import { AppUpdates, type UpdateState } from '../modules/app-updates-android/src';
import { UpdateRequiredScreen } from '@/updates/UpdateRequiredScreen';

jest.mock('../modules/app-updates-android/src', () => ({
  AppUpdates: { cachedState: jest.fn(), check: jest.fn(), startUpdate: jest.fn() },
}));
jest.mock('@/ui/motion', () => ({ useReducedMotion: () => true }));
jest.mock('@/ui/StartupScreen', () => ({
  StartupScreen: () =>
    require('react').createElement(require('react-native').Text, null, 'Preparing app'),
}));
jest.mock('@/updates/UpdateRequiredScreen', () => ({
  UpdateRequiredScreen: ({ message }: { message: string | null }) =>
    require('react').createElement(require('react-native').Text, null, 'Required update ', message),
}));
const current: UpdateState = {
  supported: true,
  required: false,
  installedVersion: 1,
  requiredVersion: 0,
  inProgress: false,
};
const required: UpdateState = { ...current, required: true, requiredVersion: 2 };
let root: ReactTestRenderer;
let cached: UpdateState;
beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  cached = current;
  jest.mocked(AppUpdates.cachedState).mockImplementation(() => cached);
  jest.mocked(AppUpdates.check).mockImplementation(async () => cached);
  jest.mocked(AppUpdates.startUpdate).mockResolvedValue('cancelled');
});
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  jest.useRealTimers();
  jest.restoreAllMocks();
});
const visible = () => JSON.stringify(root.toJSON());
async function mount() {
  await act(async () => {
    root = create(
      <AppUpdateBoundary>
        <Text>App navigation</Text>
      </AppUpdateBoundary>,
    );
  });
}
const screen = () => root.root.findByType(UpdateRequiredScreen);

test('current Play installs open after checking and unsupported installs skip Play checks', async () => {
  await mount();
  expect(visible()).toContain('App navigation');
  await act(async () => root.unmount());
  cached = { ...current, supported: false };
  jest.mocked(AppUpdates.check).mockClear();
  await mount();
  expect(visible()).toContain('App navigation');
  expect(AppUpdates.check).not.toHaveBeenCalled();
});
test('a newly available update replaces navigation with a non-dismissable modal', async () => {
  const back = jest.spyOn(BackHandler, 'addEventListener');
  jest.mocked(AppUpdates.check).mockResolvedValue(required);
  await mount();
  expect(visible()).not.toContain('App navigation');
  const modal = root.root.findByType(Modal);
  await act(async () => modal.props.onRequestClose());
  expect(screen()).toBeDefined();
  expect(
    back.mock.calls.find(([name]) => name === 'hardwareBackPress')![1](undefined as never),
  ).toBe(true);
});
test('a cached requirement blocks immediately before any network result', async () => {
  cached = required;
  jest.mocked(AppUpdates.check).mockImplementation(() => new Promise(() => {}));
  await mount();
  expect(screen()).toBeDefined();
  expect(visible()).not.toContain('App navigation');
  await act(async () => jest.advanceTimersByTime(8000));
  expect(screen()).toBeDefined();
});
test('cancelling the Play update keeps the gate and allows another explicit attempt', async () => {
  cached = required;
  await mount();
  await act(async () => screen().props.onUpdate());
  expect(AppUpdates.startUpdate).toHaveBeenCalledTimes(1);
  expect(visible()).toContain('still needed');
  expect(visible()).not.toContain('App navigation');
  await act(async () => screen().props.onUpdate());
  expect(AppUpdates.startUpdate).toHaveBeenCalledTimes(2);
});
test.each(['completed', 'store'] as const)(
  'Play result %s never proves installation',
  async (result) => {
    cached = required;
    jest.mocked(AppUpdates.startUpdate).mockResolvedValue(result);
    await mount();
    await act(async () => screen().props.onUpdate());
    expect(screen()).toBeDefined();
    expect(visible()).not.toContain('App navigation');
  },
);
test('a failed Play launch stays blocked and exposes a retryable error', async () => {
  cached = required;
  jest.mocked(AppUpdates.startUpdate).mockRejectedValue(new Error('unavailable'));
  await mount();
  await act(async () => screen().props.onUpdate());
  expect(visible()).toContain('could not open');
  expect(screen().props.busy).toBe(false);
});
test('returning from Play unlocks only after the installed version reaches the required build', async () => {
  const listen = jest.spyOn(AppState, 'addEventListener');
  cached = required;
  await mount();
  cached = { ...current, installedVersion: 2 };
  await act(async () => listen.mock.calls[0]![1]('active'));
  expect(visible()).toContain('App navigation');
});
test('failed or unavailable checks cannot revoke a previously detected requirement', async () => {
  const listen = jest.spyOn(AppState, 'addEventListener');
  cached = required;
  await mount();
  jest.mocked(AppUpdates.check).mockResolvedValue(current);
  await act(async () => listen.mock.calls[0]![1]('active'));
  expect(screen()).toBeDefined();
  jest.mocked(AppUpdates.check).mockRejectedValue(new Error('offline'));
  await act(async () => listen.mock.calls[0]![1]('active'));
  expect(screen()).toBeDefined();
});
test('an unknown offline check allows use after timeout but a late detected update still blocks', async () => {
  let finish!: (state: UpdateState) => void;
  jest.mocked(AppUpdates.check).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await mount();
  expect(visible()).toContain('Preparing app');
  await act(async () => jest.advanceTimersByTime(8000));
  expect(visible()).toContain('App navigation');
  await act(async () => finish(required));
  expect(screen()).toBeDefined();
});
test('foregrounding a running app detects a new release without restarting it', async () => {
  const listen = jest.spyOn(AppState, 'addEventListener');
  await mount();
  cached = required;
  await act(async () => listen.mock.calls[0]![1]('active'));
  expect(screen()).toBeDefined();
});
test('double taps start only one Play flow', async () => {
  cached = required;
  let finish!: (result: 'cancelled') => void;
  jest.mocked(AppUpdates.startUpdate).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await mount();
  await act(async () => {
    screen().props.onUpdate();
    screen().props.onUpdate();
  });
  expect(AppUpdates.startUpdate).toHaveBeenCalledTimes(1);
  await act(async () => finish('cancelled'));
});
