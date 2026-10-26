import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AppState } from 'react-native';
import Challenges from '../app/challenges';
import { ApiError } from '@/api/client';
const id = '00000000-0000-4000-8000-000000000001';
const mockApi = {
  battleInbox: jest.fn(),
  leaderboard: jest.fn(),
  joinChallenge: jest.fn(),
  battleScoreConsent: jest.fn(),
  respondBattle: jest.fn(),
  leaveChallenge: jest.fn(),
};
let mockBackupStatus = { state: 'local' };
jest.mock('@/api/useApi', () => ({ useApi: () => mockApi }));
jest.mock('@/auth/session', () => ({ useSession: () => ({ status: 'signedIn' }) }));
jest.mock('@/sync/AccountBackupProvider', () => ({
  useAccountBackup: () => ({ status: mockBackupStatus }),
}));
jest.mock('@/social/battleRequests', () => ({ createBattle: jest.fn() }));
jest.mock('@/social/BattleInbox', () => ({
  BattleInbox: () => null,
  invitationLabel: { pending: 'Invitation pending', accepted: 'Battle accepted' },
}));
jest.mock('@/sync/run', () => ({ currentTimeZone: () => 'UTC' }));
jest.mock('@/ui/Focus', () => ({ VisualBanner: () => null }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useLocalSearchParams: () => ({}),
  useFocusEffect: (fn: () => void) => require('react').useEffect(fn, [fn]),
}));
jest.mock('@/ui/kit', () => {
  const React = require('react'),
    { View, Text, Pressable, TextInput } = require('react-native');
  return {
    Screen: View,
    Section: View,
    Card: View,
    T: Text,
    Notice: ({ title, body }: any) => React.createElement(Text, null, title + ' ' + body),
    Button: ({ label, onPress }: any) =>
      React.createElement(Pressable, { accessibilityLabel: label, onPress }),
    Field: (props: any) => React.createElement(TextInput, props),
    EmptyState: ({ body }: any) => React.createElement(Text, null, body),
    LoadingState: ({ label }: any) => React.createElement(Text, null, label),
  };
});
let tree: ReactTestRenderer;
const mount = async () => {
  await act(async () => {
    tree = create(<Challenges />);
  });
};
const visible = () => JSON.stringify(tree.toJSON());
const press = async (label: string) =>
  act(async () => tree.root.findByProps({ accessibilityLabel: label }).props.onPress());
beforeEach(() => {
  jest.clearAllMocks();
  mockBackupStatus = { state: 'local' };
  mockApi.battleInbox.mockResolvedValue({
    challenges: [
      {
        challengeId: id,
        title: 'Scroll battle',
        metric: 'fewest_views',
        startDate: '2026-10-26',
        endDate: '2026-11-01',
        tz: 'UTC',
        maxMembers: 2,
        memberCount: 2,
        invitationState: 'accepted',
        myScoreConsent: true,
      },
    ],
    invitations: [],
  });
  mockApi.leaderboard.mockResolvedValue({
    challengeId: id,
    asOf: '2026-10-26',
    entries: [],
    participants: [
      { userId: 'friend', handle: 'bestie', status: 'no_data', availableDays: 0, expectedDays: 1 },
    ],
  });
  mockApi.joinChallenge.mockResolvedValue({ challengeId: id });
  mockApi.battleScoreConsent.mockResolvedValue({ challengeId: id });
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  jest.useRealTimers();
});
it('supports video challenges and shows missing scores without inventing zero', async () => {
  await mount();
  expect(visible()).not.toContain('Video-count challenges aren’t available yet');
  expect(
    tree.root.findAllByProps({ accessibilityLabel: 'Fewest videos a day' }).length,
  ).toBeGreaterThan(0);
  expect(visible()).toContain('Waiting for recorded activity');
  expect(mockApi.battleInbox).toHaveBeenCalledTimes(1);
  expect(mockApi.leaderboard).toHaveBeenCalledTimes(1);
});
it('joining supplies battle-only consent and refreshes the feed and selected leaderboard', async () => {
  await mount();
  await act(async () =>
    tree.root
      .findByProps({ placeholder: 'paste the code your friend shared' })
      .props.onChangeText(id),
  );
  await press('Join');
  expect(mockApi.joinChallenge).toHaveBeenCalledWith(id, true, expect.any(Function));
  expect(mockApi.battleInbox).toHaveBeenCalledTimes(2);
  expect(mockApi.leaderboard).toHaveBeenCalledTimes(2);
});
it('polls a single selected leaderboard every minute and shows delayed scores', async () => {
  jest.useFakeTimers();
  const previous = AppState.currentState;
  AppState.currentState = 'active';
  try {
    await mount();
    mockApi.leaderboard.mockResolvedValue({
      challengeId: id,
      asOf: '2026-10-26',
      entries: [{ userId: 'friend', handle: 'bestie', rank: 1, score: 42 }],
      participants: [
        { userId: 'friend', handle: 'bestie', status: 'ready', availableDays: 1, expectedDays: 2 },
      ],
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(60_000);
    });
    expect(mockApi.leaderboard).toHaveBeenCalledTimes(2);
    expect(visible()).toContain('42');
    expect(visible()).toContain('Provisional result');
    await act(async () => tree.unmount());
    await jest.advanceTimersByTimeAsync(120_000);
    expect(mockApi.leaderboard).toHaveBeenCalledTimes(2);
  } finally {
    AppState.currentState = previous;
  }
});
it('refreshes visible scores after account backup reports a successful upload', async () => {
  await mount();
  mockBackupStatus = { state: 'saved' };
  await act(async () => tree.update(<Challenges />));
  expect(mockApi.leaderboard).toHaveBeenCalledTimes(2);
});
it('revokes only battle score consent and refreshes the current data', async () => {
  await mount();
  await press('Stop sharing my battle score');
  expect(mockApi.battleScoreConsent).toHaveBeenCalledWith(id, false, expect.any(Function));
  expect(mockApi.battleInbox).toHaveBeenCalledTimes(2);
});
it('keeps the last board with an explicit stale-data message during a network failure', async () => {
  await mount();
  mockApi.leaderboard.mockRejectedValueOnce(new Error('offline'));
  await press('Refresh scores');
  expect(visible()).toContain('last loaded scores may be out of date');
  expect(visible()).toContain('Waiting for recorded activity');
});

it('discards cached scores when the backend withdraws access', async () => {
  mockApi.leaderboard.mockResolvedValueOnce({
    challengeId: id,
    asOf: '2026-10-26',
    entries: [{ userId: 'friend', handle: 'bestie', rank: 1, score: 42 }],
    participants: [],
  });
  await mount();
  expect(tree.root.findAll((n) => n.props.children === 42).length).toBeGreaterThan(0);
  mockApi.leaderboard.mockRejectedValueOnce(new ApiError(404, 'not_found', 'unavailable'));
  await press('Refresh scores');
  expect(tree.root.findAll((n) => n.props.children === 42)).toHaveLength(0);
  expect(visible()).toContain('no longer available to this account');
});
