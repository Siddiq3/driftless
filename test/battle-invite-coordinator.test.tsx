import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { BattleInviteCoordinator } from '@/social/BattleInviteCoordinator';
import { clearInvite, pendingInvite, rememberInvite } from '@/social/pendingInvite';
import { installReferrer } from '../modules/battle-links/src';
let mockLoad = { state: 'ready', record: { completed: false } },
  mockApi: unknown = null,
  mockPath = '/onboarding';
const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (k: string) => mockStore.get(k) ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => {
    mockStore.set(k, v);
  }),
  deleteItemAsync: jest.fn(async (k: string) => {
    mockStore.delete(k);
  }),
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { apiUrl: 'https://join.example' } } },
}));
jest.mock('expo-linking', () => ({
  getInitialURL: jest.fn().mockResolvedValue(null),
  addEventListener: () => ({ remove: jest.fn() }),
}));
jest.mock('../modules/battle-links/src', () => ({
  installReferrer: jest.fn(),
  installReferrerSupported: () => true,
}));
jest.mock('@/onboarding/context', () => ({ useOnboarding: () => ({ load: mockLoad }) }));
jest.mock('@/api/useApi', () => ({ useApi: () => mockApi }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  usePathname: () => mockPath,
  useRootNavigationState: () => ({ key: 'root' }),
}));
let tree: ReactTestRenderer;
const platform = Platform.OS;
const render = async () => {
  await act(async () => {
    tree = create(<BattleInviteCoordinator />);
  });
};
beforeEach(() => {
  jest.clearAllMocks();
  mockStore.clear();
  mockLoad = { state: 'ready', record: { completed: false } };
  mockApi = null;
  mockPath = '/onboarding';
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  jest.mocked(installReferrer).mockResolvedValue('battle_invite=ABCDEFGHJK');
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  Object.defineProperty(Platform, 'OS', { configurable: true, value: platform });
});
test('Play referral survives setup and login and opens only when both have finished', async () => {
  await render();
  expect(await pendingInvite()).toBe('ABCDEFGHJK');
  expect(router.push).not.toHaveBeenCalled();
  mockLoad = { state: 'ready', record: { completed: true } };
  mockApi = { incarnation: 'a' };
  mockPath = '/friends';
  await act(async () => tree.update(<BattleInviteCoordinator />));
  expect(router.push).toHaveBeenCalledWith('/battle-invite?code=ABCDEFGHJK');
  expect(installReferrer).toHaveBeenCalledTimes(1);
});
test('an already opened link takes precedence over install attribution', async () => {
  await rememberInvite('KLMNPQRSTU');
  await render();
  expect(await pendingInvite()).toBe('KLMNPQRSTU');
});
test('a dismissed referral never reappears after remount', async () => {
  await render();
  await clearInvite('ABCDEFGHJK');
  await act(async () => tree.unmount());
  mockLoad = { state: 'ready', record: { completed: true } };
  mockApi = { incarnation: 'a' };
  await render();
  expect(await pendingInvite()).toBeNull();
  expect(router.push).not.toHaveBeenCalled();
});
test('iPhone preserves an explicit invite without querying Play', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  await rememberInvite('ABCDEFGHJK');
  await render();
  expect(installReferrer).not.toHaveBeenCalled();
  expect(await pendingInvite()).toBe('ABCDEFGHJK');
});
