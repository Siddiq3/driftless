import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import Challenges from '../app/challenges';
import { useApi } from '../src/api/useApi';
import type { ApiClient } from '../src/api/client';

jest.mock('../src/api/useApi', () => ({ useApi: jest.fn() }));
jest.mock('../src/auth/session', () => ({ useSession: () => ({ status: 'signedIn' }) }));
jest.mock('../src/sync/run', () => ({ currentTimeZone: () => 'UTC' }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (fn: () => void) => require('react').useEffect(fn, [fn]),
}));
jest.mock('../src/ui/Focus', () => ({ VisualBanner: () => null }));
jest.mock('../src/ui/Icon', () => ({ Icon: () => null }));
jest.mock('../src/ui/kit', () => {
  const { View, Text, Pressable } = require('react-native');
  return {
    Screen: View, Card: View, Section: View, T: Text, Field: View,
    EmptyState: View, LoadingState: View, Notice: View,
    Button: ({ label, onPress }: { label: string; onPress: () => void }) =>
      require('react').createElement(Pressable, { accessibilityLabel: label, onPress }),
  };
});
const challenge = (title: string) => ({ challengeId: title, title, metric: 'fewest_minutes',
  startDate: '2026-10-23', endDate: '2026-10-29', memberCount: 1, maxMembers: 10 });
const api = (read: jest.Mock) => ({ challenges: read,
  leaderboard: jest.fn().mockResolvedValue({ entries: [] }),
  joinChallenge: jest.fn(), createChallenge: jest.fn(), leaveChallenge: jest.fn(),
}) as unknown as ApiClient;
let tree: ReactTestRenderer;
afterEach(async () => { await act(async () => tree?.unmount()); });

it('clears retained data immediately on account replacement, even if the next read fails', async () => {
  const a = api(jest.fn().mockResolvedValue([challenge('A private week')]));
  jest.mocked(useApi).mockReturnValue(a);
  await act(async () => { tree = create(<Challenges />); });
  expect(JSON.stringify(tree.toJSON())).toContain('A private week');
  const b = api(jest.fn().mockRejectedValue(new Error('offline')));
  jest.mocked(useApi).mockReturnValue(b);
  await act(async () => tree.update(<Challenges />));
  expect(JSON.stringify(tree.toJSON())).not.toContain('A private week');
});
it('ignores a previous account response that arrives after replacement', async () => {
  let finish!: (data: unknown) => void;
  const a = api(jest.fn(() => new Promise((resolve) => { finish = resolve; })));
  jest.mocked(useApi).mockReturnValue(a);
  await act(async () => { tree = create(<Challenges />); });
  const b = api(jest.fn().mockResolvedValue([challenge('B week')]));
  jest.mocked(useApi).mockReturnValue(b);
  await act(async () => tree.update(<Challenges />));
  await act(async () => finish([challenge('A late private week')]));
  expect(JSON.stringify(tree.toJSON())).toContain('B week');
  expect(JSON.stringify(tree.toJSON())).not.toContain('A late private week');
});
it('blocks a second challenge mutation while the first is pending', async () => {
  const current = api(jest.fn().mockResolvedValue([]));
  let finish!: () => void;
  jest.mocked(current.joinChallenge).mockImplementationOnce(() => new Promise((resolve) => {
    finish = () => resolve({} as never);
  }));
  jest.mocked(useApi).mockReturnValue(current);
  await act(async () => { tree = create(<Challenges />); });
  const join = tree.root.findAll((node) => node.props.accessibilityLabel === 'Join')[0]!;
  await act(async () => { void join.props.onPress(); void join.props.onPress(); });
  expect(current.joinChallenge).toHaveBeenCalledTimes(1);
  await act(async () => finish());
});
