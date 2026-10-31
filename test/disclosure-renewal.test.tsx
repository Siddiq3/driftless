import React from 'react';
import { Platform } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { router } from 'expo-router';
import { Tracking } from 'tracking-android';
import { FirstLaunchRedirect } from '../src/onboarding/FirstLaunchRedirect';

let mockPath = '/';
let mockCompleted = true;
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  usePathname: () => mockPath,
  useRootNavigationState: () => ({ key: 'ready' }),
}));
jest.mock('@/onboarding/context', () => ({
  useOnboarding: () => ({
    load: { state: 'ready', record: mockCompleted ? { completed: true } : null },
  }),
}));
jest.mock('tracking-android', () => ({ Tracking: { health: jest.fn() } }));
let tree: ReactTestRenderer;
const health = (accepted = false, renewal = true) =>
  (Tracking.health as jest.Mock).mockReturnValue({
    disclosureAccepted: accepted,
    disclosureRenewalRequired: renewal,
  });
async function mount() {
  await act(async () => {
    tree = create(<FirstLaunchRedirect />);
  });
}
async function route(path: string) {
  mockPath = path;
  await act(async () => tree.update(<FirstLaunchRedirect />));
}
async function restart() {
  await act(async () => tree.unmount());
  mockPath = '/';
  await mount();
}
beforeEach(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  mockPath = '/';
  mockCompleted = true;
  jest.clearAllMocks();
  (router.push as jest.Mock).mockReset();
  health();
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});

it.each(['/home', '/welcome'])(
  'waits for index routing before presenting V2 renewal on %s',
  async (destination) => {
    await mount();
    expect(router.push).not.toHaveBeenCalled();
    await route(destination);
    expect(router.push).toHaveBeenCalledWith('/disclosure');
  },
);
it('does not consider a queued or displaced push to be a shown disclosure', async () => {
  await mount();
  await route('/home');
  expect(router.push).toHaveBeenCalledTimes(1);
  // Another navigation replaces the queued push without ever visiting disclosure.
  await route('/tracking');
  expect(router.push).toHaveBeenCalledTimes(2);
  await route('/disclosure');
  await route('/home');
  expect(router.push).toHaveBeenCalledTimes(2);
});
it('allows a declined renewal to return Home without a redirect loop', async () => {
  await mount();
  await route('/home');
  await route('/disclosure');
  // Not now navigates back and does not modify the old, invalid native acceptance.
  await route('/home');
  await route('/tracking');
  await route('/home');
  expect(router.push).toHaveBeenCalledTimes(1);
});
it('offers renewal again after restarting following a decline', async () => {
  await mount();
  await route('/home');
  await route('/disclosure');
  await route('/home');
  await restart();
  expect(router.push).toHaveBeenCalledTimes(1);
  await route('/home');
  expect(router.push).toHaveBeenCalledTimes(2);
});
it('does not renew V3 consent on launch or restart after accepting', async () => {
  health(true, false);
  await mount();
  await route('/home');
  await restart();
  await route('/home');
  expect(router.push).not.toHaveBeenCalled();
});
it('acceptance followed by return from settings does not reopen renewal', async () => {
  await mount();
  await route('/home');
  await route('/disclosure');
  health(true, false);
  await route('/home');
  expect(router.push).toHaveBeenCalledTimes(1);
  await restart();
  await route('/home');
  expect(router.push).toHaveBeenCalledTimes(1);
});
it('routes fresh installs into onboarding and keeps disclosure reachable before any grant', async () => {
  mockCompleted = false;
  health(false, false);
  await mount();
  expect(router.replace).toHaveBeenCalledWith('/onboarding');
  await route('/onboarding');
  await route('/disclosure');
  await route('/onboarding');
  expect(router.push).not.toHaveBeenCalled();
  expect(router.replace).toHaveBeenCalledTimes(1);
});
it('preserves the manual banner path after first-install onboarding is skipped', async () => {
  health(false, false); // no acceptance to renew; first-time permission choice remains manual
  await mount();
  await route('/welcome');
  await route('/disclosure');
  await route('/welcome');
  expect(router.push).not.toHaveBeenCalled();
});
it('leaves privacy and deletion controls accessible before renewal', async () => {
  mockPath = '/privacy';
  await mount();
  expect(router.push).not.toHaveBeenCalled();
  await route('/home');
  expect(router.push).toHaveBeenCalledWith('/disclosure');
});
it('does not consume renewal after a failed navigation request', async () => {
  (router.push as jest.Mock).mockImplementationOnce(() => {
    throw new Error('Navigation unavailable');
  });
  await mount();
  await route('/home');
  await route('/tracking');
  expect(router.push).toHaveBeenCalledTimes(2);
});
