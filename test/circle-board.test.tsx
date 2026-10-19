import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Share } from 'react-native';
import { router } from 'expo-router';
import { CircleBoard } from '../src/social/CircleBoard';
let mockStatus = 'signedOut';
const mockApi = {
  friends: jest.fn(async () => []),
  createInvite: jest.fn(),
  createChallenge: jest.fn(),
};
jest.mock('@/api/useApi', () => ({ useApi: () => (mockStatus === 'signedIn' ? mockApi : null) }));
jest.mock('@/auth/session', () => ({ useSession: () => ({ status: mockStatus }) }));
jest.mock('expo-font', () => ({ useFonts: () => [true] }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (callback: () => () => void) => require('react').useEffect(callback, [callback]),
}));
jest.mock('@/sync/run', () => ({ currentTimeZone: () => 'Asia/Kolkata' }));
jest.mock('tracking-android', () => ({
  Tracking: {
    daily: () => ({ heartbeatMinutes: 1, apps: [{ views: 12 }] }),
    health: () => ({ serviceRunning: true }),
  },
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('@/ui/Icon', () => ({ Icon: () => null }));
jest.mock('@/ui/kit', () => {
  const { View, Text, Pressable } = require('react-native');
  return {
    Screen: View,
    T: Text,
    Notice: Text,
    Button: ({ label, onPress }: { label: string; onPress: () => void }) =>
      require('react').createElement(Pressable, { accessibilityLabel: label, onPress }),
  };
});
let tree: ReactTestRenderer;
const mount = async () => {
  await act(async () => {
    tree = create(<CircleBoard friendsPanel={null} />);
  });
};
const tap = async (label: string) => {
  await act(async () => {
    await tree.root
      .findAll(
        (node) =>
          node.props.accessibilityLabel === label && typeof node.props.onPress === 'function',
      )[0]!
      .props.onPress();
  });
};
beforeEach(() => {
  mockStatus = 'signedOut';
  jest.clearAllMocks();
  jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  mockApi.createInvite.mockResolvedValue({ code: 'FRIENDCODE' });
  mockApi.createChallenge.mockResolvedValue({ challengeId: 'battle-123' });
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  jest.restoreAllMocks();
});
it('requires login before sharing invites or creating a battle', async () => {
  await mount();
  await tap('Invite a Doomscroller');
  await tap('Invite your coolie friend');
  await tap('Start a 2-person battle');
  expect(router.push).toHaveBeenCalledWith('/welcome');
  expect(mockApi.createInvite).not.toHaveBeenCalled();
  expect(mockApi.createChallenge).not.toHaveBeenCalled();
  expect(Share.share).not.toHaveBeenCalled();
});
it('shares a personal invite only after login', async () => {
  mockStatus = 'signedIn';
  await mount();
  await tap('Invite your Bestie');
  expect(mockApi.createInvite).toHaveBeenCalledTimes(1);
  expect(Share.share).toHaveBeenCalledWith({ message: expect.stringContaining('FRIENDCODE') });
});
it('creates a two-person battle with a shareable joining code', async () => {
  mockStatus = 'signedIn';
  await mount();
  await tap('Start a 2-person battle');
  expect(mockApi.createChallenge).toHaveBeenCalledWith(
    expect.objectContaining({ maxMembers: 2, metric: 'fewest_views' }),
  );
  expect(Share.share).toHaveBeenCalledWith({ message: expect.stringContaining('battle-123') });
  expect(router.push).toHaveBeenCalledWith('/challenges');
});
it('allows browsing dates without login and disables future dates', async () => {
  await mount();
  const next = () =>
    tree.root.findAll(
      (node) =>
        node.props.accessibilityLabel === 'Next day' && typeof node.props.onPress === 'function',
    )[0]!;
  expect(next().props.disabled).toBe(true);
  await tap('Previous day');
  expect(next().props.disabled).toBe(false);
  await tap('Next day');
  expect(next().props.disabled).toBe(true);
  expect(router.push).not.toHaveBeenCalled();
});
