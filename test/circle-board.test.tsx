import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AppState, Clipboard, Share } from 'react-native';
import { router } from 'expo-router';
import { CircleBoard } from '@/social/CircleBoard';
import { ApiError } from '@/api/client';
let mockSignedIn = true;
let mockBackupStatus = { state: 'local' };
const mockApi = { incarnation: 'account-a', battleDaily: jest.fn(), createBattleInvite: jest.fn() };
jest.mock('@/api/useApi', () => ({ useApi: () => (mockSignedIn ? mockApi : null) }));
jest.mock('@/auth/session', () => ({
  useSession: () => ({ status: mockSignedIn ? 'signedIn' : 'signedOut', displayName: 'Kolimi' }),
}));
jest.mock('@/sync/AccountBackupProvider', () => ({
  useAccountBackup: () => ({ status: mockBackupStatus }),
}));
jest.mock('@/data/personal', () => ({
  refreshPersonalData: jest.fn(),
  personalDay: () => ({ views: 92 }),
}));
jest.mock('@/social/profile', () => ({
  ensureSocialProfile: jest.fn().mockResolvedValue({ data: { profile: { handle: 'kolimi' } } }),
}));
jest.mock('@/social/pendingInvite', () => ({
  inviteUrl: (code: string) => `https://join.example/join/${code}?utm_content=duel`,
  parseInvite: () => null,
  rememberInvite: jest.fn(),
}));
jest.mock('expo-font', () => ({ useFonts: () => [true] }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (fn: () => () => void) => require('react').useEffect(fn, [fn]),
}));
jest.mock('@/sync/run', () => ({ currentTimeZone: () => 'UTC' }));
jest.mock('@/ui/Icon', () => ({ Icon: () => null }));
jest.mock('@/auth/InviteSignInSheet', () => ({
  InviteSignInSheet: () =>
    require('react').createElement(
      require('react-native').Text,
      null,
      'Sign in to invite a friend',
    ),
}));
jest.mock('@/ui/kit', () => {
  const React = require('react'),
    { View, Text, Pressable, TextInput } = require('react-native');
  return {
    ModalContent: jest.requireActual('@/ui/kit').ModalContent,
    Screen: View,
    T: Text,
    Notice: ({ body }: { body: string }) => <Text>{body}</Text>,
    Field: TextInput,
    Button: ({ label, onPress }: { label: string; onPress: () => void }) => (
      <Pressable accessibilityLabel={label} onPress={onPress} />
    ),
  };
});
let tree: ReactTestRenderer;
const text = () => JSON.stringify(tree.toJSON());
const control = (label: string) =>
  tree.root.findAll(
    (n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function',
  )[0];
const tap = async (label: string) => {
  await act(async () => {
    await control(label)!.props.onPress();
  });
};
const inviteLabel = () =>
  tree.root.findAll(
    (n) =>
      typeof n.props.onPress === 'function' &&
      n.props.accessibilityLabel?.startsWith('Invite your '),
  )[0]!.props.accessibilityLabel;
const daily = (date: string, views: number | null = 0, friend: number | null = 6) => ({
  localDate: date,
  self: {
    status: views === null ? 'unavailable' : 'eligible',
    views,
    updatedAt: views === null ? null : '2026-10-26T00:00:00Z',
  },
  friends: [
    {
      userId: 'friend',
      handle: 'garage',
      displayName: 'Study Garage',
      status: 'accepted',
      since: '2026-10-26T00:00:00Z',
      daily: {
        status: friend === null ? 'unavailable' : 'eligible',
        views: friend,
        updatedAt: friend === null ? null : '2026-10-26T00:00:00Z',
      },
    },
  ],
});
const mount = async () => {
  await act(async () => {
    tree = create(<CircleBoard />);
  });
};
beforeEach(() => {
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
  jest.clearAllMocks();
  mockSignedIn = true;
  mockBackupStatus = { state: 'local' };
  mockApi.battleDaily.mockImplementation(async (date: string) => daily(date));
  mockApi.createBattleInvite.mockResolvedValue({ code: 'ABCDEFGHJK' });
  jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  jest.spyOn(Clipboard, 'setString').mockImplementation(() => undefined);
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  jest.useRealTimers();
  jest.restoreAllMocks();
});
it('ranks daily battle friends and real zero without a challenges screen or creation form', async () => {
  await mount();
  expect(text()).toContain('Your daily count: 0');
  expect(text()).toContain('Daily count for garage: 6');
  expect(text()).toContain('Rank 1');
  expect(text()).not.toContain('View your battles');
  expect(text()).not.toContain('Start battle');
  await tap('Friends');
  expect(router.push).toHaveBeenCalledWith('/friend-list');
});
it('shares only after explicit invitation creation and a share tap', async () => {
  await mount();
  await tap(inviteLabel());
  expect(mockApi.createBattleInvite).not.toHaveBeenCalled();
  expect(Share.share).not.toHaveBeenCalled();
  await tap('Create battle invite');
  expect(mockApi.createBattleInvite).toHaveBeenCalledTimes(1);
  expect(Share.share).not.toHaveBeenCalled();
  await tap('Share invitation');
  expect(Share.share).toHaveBeenCalledWith({
    message: expect.stringContaining(
      'Join me on ScrollSnooze and let’s find out who scrolls less!\nhttps://join.example/join/ABCDEFGHJK?utm_content=duel',
    ),
  });
});
it('missing server observations stay unavailable rather than falling back to a local candidate count', async () => {
  mockApi.battleDaily.mockImplementation(async (date: string) => daily(date, null, null));
  await mount();
  expect(text()).toContain('Your daily count: unavailable');
  expect(text()).toContain('Daily count for garage: unavailable');
  expect(text()).not.toContain('92');
  expect(text()).not.toContain('Rank 1');
});
it('shows a sign-in sheet before a guest can invite', async () => {
  mockSignedIn = false;
  await mount();
  await tap(inviteLabel());
  expect(text()).toContain('Sign in to invite a friend');
  expect(mockApi.createBattleInvite).not.toHaveBeenCalled();
});
it('disables future dates and ignores delayed results from an older selected date', async () => {
  await mount();
  expect(control('Next day')!.props.disabled).toBe(true);
  let resolve!: (v: unknown) => void;
  mockApi.battleDaily.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  await tap('Previous day');
  await tap('Previous day');
  await act(async () => {
    resolve(daily('2026-01-01', 900, 901));
  });
  expect(text()).not.toContain('901');
});
it('refreshes after backup, foreground return and each minute', async () => {
  jest.useFakeTimers();
  await mount();
  const initial = mockApi.battleDaily.mock.calls.length;
  await act(async () => {
    await jest.advanceTimersByTimeAsync(60000);
  });
  expect(mockApi.battleDaily.mock.calls.length).toBe(initial + 1);
  mockBackupStatus = { state: 'saved' };
  await act(async () => tree.update(<CircleBoard />));
  expect(mockApi.battleDaily.mock.calls.length).toBe(initial + 2);
});
it('keeps stale data labeled on network failure and clears it on access loss', async () => {
  jest.useFakeTimers();
  await mount();
  mockApi.battleDaily.mockRejectedValueOnce(new Error('offline'));
  await act(async () => {
    await jest.advanceTimersByTimeAsync(60000);
  });
  expect(text()).toContain('Previously loaded counts may be out of date');
  expect(text()).toContain('Daily count for garage: 6');
  mockApi.battleDaily.mockRejectedValueOnce(new ApiError(403, 'forbidden', 'no access'));
  await act(async () => {
    await jest.advanceTimersByTimeAsync(60000);
  });
  expect(text()).not.toContain('Daily count for garage: 6');
});
