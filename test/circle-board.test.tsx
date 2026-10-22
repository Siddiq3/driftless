import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Share } from 'react-native';
import { router } from 'expo-router';
import { CircleBoard } from '../src/social/CircleBoard';
import { ApiError } from '../src/api/client';
import { shuffledInvitePrompts } from '../src/social/invitePrompts';
let mockStatus = 'signedOut';
const mockSignIn = jest.fn();
const mockApi = {
  friends: jest.fn(async () => []),
  friendsDaily: jest.fn(),
  getMe: jest.fn(),
  createInvite: jest.fn(),
  createChallenge: jest.fn(),
};
jest.mock('@/api/useApi', () => ({ useApi: () => (mockStatus === 'signedIn' ? mockApi : null) }));
jest.mock('@/auth/session', () => ({
  useSession: () => ({
    status: mockStatus,
    googleSupported: true,
    signIn: mockSignIn,
    error: null,
  }),
}));
jest.mock('expo-font', () => ({ useFonts: () => [true] }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (callback: () => () => void) => require('react').useEffect(callback, [callback]),
}));
const mockSync = jest.fn();
jest.mock('@/sync/run', () => ({
  currentTimeZone: () => 'Asia/Kolkata',
  syncNow: (...args: unknown[]) => mockSync(...args),
}));
jest.mock('tracking-android', () => ({
  Tracking: {
    daily: () => ({ heartbeatMinutes: 1, apps: [{ views: 12 }] }),
    health: () => ({ serviceRunning: true }),
  },
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
  useSafeAreaInsets: () => ({ top: 0, bottom: 24, left: 0, right: 0 }),
}));
jest.mock('@/ui/Icon', () => ({ Icon: () => null }));
jest.mock('@/ui/kit', () => {
  const { View, Text, Pressable } = require('react-native');
  return {
    Screen: View,
    Details: View,
    T: Text,
    Notice: ({ body }: { body: string }) => require('react').createElement(Text, null, body),
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
const inviteLabels = () => [
  ...new Set(
    tree.root
      .findAll(
        (node) =>
          typeof node.props.onPress === 'function' &&
          node.props.accessibilityLabel?.startsWith('Invite your '),
      )
      .map((node) => node.props.accessibilityLabel as string),
  ),
];
beforeEach(() => {
  mockStatus = 'signedOut';
  mockSignIn.mockResolvedValue(undefined);
  jest.clearAllMocks();
  jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  mockApi.createInvite.mockResolvedValue({ code: 'FRIENDCODE' });
  mockApi.createChallenge.mockResolvedValue({ challengeId: 'battle-123' });
  mockApi.friends.mockResolvedValue([]);
  mockApi.friendsDaily.mockImplementation(async (date: string) => ({
    localDate: date,
    self: { status: 'eligible', views: 7, updatedAt: '2026-10-21T00:00:00Z' },
    friends: [],
  }));
  mockApi.getMe.mockResolvedValue({
    data: { profile: { consent: { cloudSync: true, shareWithFriends: true } } },
  });
  mockSync.mockResolvedValue({ kind: 'sent' });
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  jest.restoreAllMocks();
});
it('requires login before sharing invites or viewing battles', async () => {
  await mount();
  await tap(inviteLabels()[0]!);
  await tap('View your battles');
  expect(router.push).toHaveBeenCalledWith('/welcome');
  expect(mockApi.createInvite).not.toHaveBeenCalled();
  expect(mockApi.createChallenge).not.toHaveBeenCalled();
  expect(Share.share).not.toHaveBeenCalled();
});
it('opens the reference sign-in sheet for a guest invite and calls the Google sign-in flow', async () => {
  await mount();
  await tap(inviteLabels()[0]!);
  expect(router.push).not.toHaveBeenCalled();
  expect(JSON.stringify(tree.toJSON())).toContain('to invite a friend');
  await tap('Continue with Google');
  expect(mockSignIn).toHaveBeenCalledTimes(1);
  expect(mockApi.createInvite).not.toHaveBeenCalled();
  expect(Share.share).not.toHaveBeenCalled();
  await tap('Close sign-in');
  expect(
    tree.root.findAll((node) => node.props.accessibilityLabel === 'Continue with Google'),
  ).toHaveLength(0);
});
it('shares a personal invite only after login', async () => {
  mockStatus = 'signedIn';
  await mount();
  await tap(inviteLabels()[0]!);
  expect(mockApi.createInvite).toHaveBeenCalledTimes(1);
  expect(Share.share).toHaveBeenCalledWith({ message: expect.stringContaining('FRIENDCODE') });
});
it('opens the battles screen without a standalone battle creation button', async () => {
  mockStatus = 'signedIn';
  await mount();
  expect(
    tree.root.findAll((node) => node.props.accessibilityLabel === 'Start a 2-person battle'),
  ).toHaveLength(0);
  await tap('View your battles');
  expect(mockApi.createChallenge).not.toHaveBeenCalled();
  expect(Share.share).not.toHaveBeenCalled();
  expect(router.push).toHaveBeenCalledWith('/challenges');
});
it('shows four invites alongside You and keeps them stable while opening sign-in', async () => {
  await mount();
  const labels = inviteLabels();
  expect(labels).toHaveLength(4);
  await tap(labels[0]!);
  expect(inviteLabels()).toEqual(labels);
  await tap('Close sign-in');
  expect(inviteLabels()).toEqual(labels);
});
it('changes the ordering on the next visit even if randomness repeats', () => {
  jest.spyOn(Math, 'random').mockReturnValue(0.5);
  const first = shuffledInvitePrompts();
  const second = shuffledInvitePrompts(first);
  expect(second).toHaveLength(4);
  expect(new Set(second.map((row) => row.label)).size).toBe(4);
  expect(second).not.toEqual(first);
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

const labelText = (label: string) =>
  tree.root.findAll((node) => node.props.accessibilityLabel?.startsWith(`${label}:`))[0]!.props
    .children;
it('shows cloud-eligible totals rather than the local candidate count, including real zero', async () => {
  mockStatus = 'signedIn';
  const friend = {
    userId: 'friend',
    handle: 'bestie',
    displayName: null,
    status: 'accepted',
    since: '2026-10-21T00:00:00Z',
  };
  mockApi.friendsDaily.mockImplementation(async (date: string) => ({
    localDate: date,
    self: { status: 'eligible', views: 7 },
    friends: [{ ...friend, daily: { status: 'eligible', views: 0 } }],
  }));
  await mount();
  expect(labelText('Your daily count')).toBe('7');
  expect(labelText('Daily count for bestie')).toBe('0');
});
it('clears old counts when a date request fails and when sharing is withdrawn', async () => {
  mockStatus = 'signedIn';
  await mount();
  expect(labelText('Your daily count')).toBe('7');
  mockApi.friendsDaily.mockRejectedValueOnce(new Error('offline'));
  await tap('Previous day');
  expect(labelText('Your daily count')).toBe('—');
  mockApi.friendsDaily.mockRejectedValueOnce(
    new ApiError(403, 'consent_required', 'Sharing is off'),
  );
  await tap('Next day');
  expect(labelText('Your daily count')).toBe('—');
  expect(JSON.stringify(tree.toJSON())).toContain('Sharing is off');
});
it('checks consent before uploading and refreshes only after successful sync', async () => {
  mockStatus = 'signedIn';
  await mount();
  mockApi.getMe.mockResolvedValueOnce({
    data: { profile: { consent: { cloudSync: false, shareWithFriends: false } } },
  });
  await tap('Sync and refresh counts');
  expect(mockSync).not.toHaveBeenCalled();
  const reads = mockApi.friendsDaily.mock.calls.length;
  await tap('Sync and refresh counts');
  expect(mockSync).toHaveBeenCalledWith({ usageSync: expect.any(Function) });
  expect(mockApi.friendsDaily.mock.calls.length).toBeGreaterThan(reads);
});
it('ignores a delayed response from the previously selected date', async () => {
  mockStatus = 'signedIn';
  let resolveOld!: (value: unknown) => void;
  let oldDate = '';
  mockApi.friendsDaily.mockImplementationOnce((date: string) => {
    oldDate = date;
    return new Promise((resolve) => {
      resolveOld = resolve;
    });
  });
  await mount();
  await tap('Previous day');
  expect(labelText('Your daily count')).toBe('7');
  await act(async () =>
    resolveOld({ localDate: oldDate, self: { status: 'eligible', views: 999 }, friends: [] }),
  );
  expect(labelText('Your daily count')).toBe('7');
});
it('does not start an upload when sign-out happens during the consent check', async () => {
  mockStatus = 'signedIn';
  let resolveMe!: (value: unknown) => void;
  mockApi.getMe.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveMe = resolve;
      }),
  );
  await mount();
  let pending!: Promise<void>;
  await act(async () => {
    pending = tree.root
      .findAll(
        (node) =>
          node.props.accessibilityLabel === 'Sync and refresh counts' &&
          typeof node.props.onPress === 'function',
      )[0]!
      .props.onPress();
  });
  mockStatus = 'signedOut';
  await act(async () => tree.update(<CircleBoard friendsPanel={null} />));
  await act(async () => {
    resolveMe({ data: { profile: { consent: { cloudSync: true, shareWithFriends: true } } } });
    await pending;
  });
  expect(mockSync).not.toHaveBeenCalled();
});
