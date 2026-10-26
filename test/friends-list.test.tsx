import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { FriendsList } from '@/social/FriendsList';
import type { ApiClient } from '@/api/client';
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: () => true },
  useFocusEffect: (fn: () => () => void) => require('react').useEffect(fn, [fn]),
}));
jest.mock('@/ui/Icon', () => ({ Icon: () => null }));
jest.mock('@/ui/kit', () => {
  const { Text, View, Pressable } = require('react-native');
  return {
    Screen: View,
    T: Text,
    LoadingState: () => null,
    Notice: ({ body }: { body: string }) => <Text>{body}</Text>,
    Button: ({ label, onPress }: { label: string; onPress: () => void }) => (
      <Pressable accessibilityLabel={label} onPress={onPress} />
    ),
  };
});
const friend = {
  userId: 'friend-id',
  handle: 'garage',
  displayName: 'Study Garage',
  status: 'accepted',
  since: '2026-10-26T00:00:00Z',
};
const api = { friends: jest.fn(), removeFriend: jest.fn() };
let tree: ReactTestRenderer;
const control = (label: string) =>
  tree.root.findAll(
    (n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function',
  )[0];
const tap = async (label: string) => {
  await act(async () => {
    await control(label)!.props.onPress();
  });
};
beforeEach(async () => {
  jest.clearAllMocks();
  api.friends.mockResolvedValue([friend]);
  api.removeFriend.mockResolvedValue(undefined);
  await act(async () => {
    tree = create(<FriendsList api={api as unknown as ApiClient} />);
  });
});
afterEach(async () => {
  await act(async () => tree.unmount());
});
test('options open the named friend sheet and cancellation never removes a friendship', async () => {
  await tap('Options for Study Garage');
  expect(JSON.stringify(tree.toJSON())).toContain('stops your battle');
  expect(api.removeFriend).not.toHaveBeenCalled();
  await tap('Close friend options');
  expect(api.removeFriend).not.toHaveBeenCalled();
});
test('delete targets the selected stable friend ID and removes the row after success', async () => {
  await tap('Options for Study Garage');
  await tap('Delete friend');
  expect(api.removeFriend).toHaveBeenCalledWith('friend-id');
  expect(control('Options for Study Garage')).toBeUndefined();
});
test('a failed removal keeps the friend and offers retry', async () => {
  api.removeFriend.mockRejectedValueOnce(new Error('offline'));
  await tap('Options for Study Garage');
  await tap('Delete friend');
  expect(JSON.stringify(tree.toJSON())).toContain('Your friend could not be removed');
  expect(control('Delete friend')).toBeDefined();
  expect(control('Options for Study Garage')).toBeDefined();
});
