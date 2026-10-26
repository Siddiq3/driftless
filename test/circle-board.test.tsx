import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AppState, Clipboard, Linking, Share } from 'react-native';
import { router } from 'expo-router';
import { CircleBoard } from '../src/social/CircleBoard';
import { ApiError } from '../src/api/client';
import { shuffledInvitePrompts } from '../src/social/invitePrompts';
let mockStatus = 'signedOut';
const mockSignIn = jest.fn();
jest.mock('expo-crypto', () => ({ randomUUID: () => '12345678-1234-4234-8234-123456789012' }));
const mockApi = {
  patchMe: jest.fn(),
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
    displayName: mockStatus === 'signedIn' ? 'Siddiq Kolimi' : null,
  }),
}));
jest.mock('expo-font', () => ({ useFonts: () => [true] }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (callback: () => () => void) => require('react').useEffect(callback, [callback]),
}));
const mockSync = jest.fn();
jest.mock('@/sync/AccountBackupProvider', () => ({
  useAccountBackup: () => ({
    retry: async () => {
      const outcome = await mockSync();
      return outcome?.kind !== 'deferred' && outcome?.kind !== 'rejected';
    },
  }),
}));
jest.mock('@/sync/run', () => ({
  currentTimeZone: () => 'Asia/Kolkata',
  syncNow: (...args: unknown[]) => mockSync(...args),
}));
jest.mock('tracking-android', () => ({
  Tracking: {
    refreshUsage: jest.fn(),
    daily: () => ({
      heartbeatMinutes: 1,
      apps: [{ package: 'com.instagram.android', views: 12, surfaceMs: 1000 }],
    }),
    health: () => ({
      serviceRunning: true,
      apps: [{ package: 'com.instagram.android', installed: true }],
    }),
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
  mockApi.patchMe.mockResolvedValue({
    data: { profile: { handle: 'siddiq_12345678', displayName: 'Siddiq Kolimi', rev: 2 } },
  });
  jest.spyOn(Clipboard, 'setString').mockImplementation(() => undefined);
  jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  mockApi.getMe.mockResolvedValue({
    data: {
      profile: {
        handle: 'test_user',
        displayName: 'Siddiq Kolimi',
        rev: 1,
        consent: { cloudSync: true, shareWithFriends: true },
      },
    },
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
it('opens the invite sheet after login and shares only when requested', async () => {
  mockStatus = 'signedIn';
  await mount();
  await tap(inviteLabels()[0]!);
  expect(mockApi.createInvite).toHaveBeenCalledTimes(1);
  expect(Share.share).not.toHaveBeenCalled();
  expect(JSON.stringify(tree.toJSON())).toContain('battle more');
  await tap('More sharing options');
  expect(Share.share).toHaveBeenCalledWith({
    message: expect.stringContaining('driftless://friends?invite=FRIENDCODE'),
  });
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
  expect(labelText('Your daily count')).toBe('12');
  expect(labelText('Daily count for bestie')).toBe('0');
});
it('replaces old cloud counts with a clearly local count when requests fail or sharing is off', async () => {
  mockStatus = 'signedIn';
  await mount();
  expect(labelText('Your daily count')).toBe('12');
  mockApi.friendsDaily.mockRejectedValueOnce(new Error('offline'));
  await tap('Previous day');
  expect(labelText('Your daily count')).toBe('12');
  expect(JSON.stringify(tree.toJSON())).not.toContain('Your saved count');
  mockApi.friendsDaily.mockRejectedValueOnce(
    new ApiError(403, 'consent_required', 'Sharing is off'),
  );
  await tap('Next day');
  expect(labelText('Your daily count')).toBe('12');
  expect(JSON.stringify(tree.toJSON())).not.toContain('Your saved count');
  expect(JSON.stringify(tree.toJSON())).toContain('Choose to share your progress');
});
it('updates comparisons automatically without a manual sync control', async () => {
  mockStatus = 'signedIn';
  await mount();
  expect(mockApi.friendsDaily).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(tree.toJSON())).not.toContain('Sync and refresh counts');
  expect(mockSync).not.toHaveBeenCalled();
});
it('treats sharing consent as an optional setting and opens the existing Friends controls', async () => {
  mockStatus = 'signedIn';
  mockApi.friendsDaily.mockRejectedValueOnce(
    new ApiError(403, 'consent_required', 'Turn on cloud backup and share progress'),
  );
  await mount();
  expect(JSON.stringify(tree.toJSON())).not.toContain('Turn on cloud backup');
  expect(JSON.stringify(tree.toJSON())).toContain('Choose to share your progress');
  expect(labelText('Your daily count')).toBe('12');
  await tap('Manage sharing');
  expect(JSON.stringify(tree.toJSON())).toContain('Your friends');
  expect(mockApi.patchMe).not.toHaveBeenCalled();
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
  expect(labelText('Your daily count')).toBe('12');
  await act(async () =>
    resolveOld({ localDate: oldDate, self: { status: 'eligible', views: 999 }, friends: [] }),
  );
  expect(labelText('Your daily count')).toBe('12');
});
it('keeps your local count visible when the server has no eligible comparison count', async () => {
  mockStatus = 'signedIn';
  mockApi.friendsDaily.mockImplementation(async (date: string) => ({
    localDate: date,
    self: { status: 'unavailable', views: null },
    friends: [],
  }));
  await mount();
  expect(labelText('Your daily count')).toBe('12');
  expect(JSON.stringify(tree.toJSON())).not.toContain('Your saved count');
});
it('allocates a handle automatically using the Google name, without a handle form', async () => {
  mockStatus = 'signedIn';
  mockApi.getMe.mockResolvedValue({
    data: { profile: { handle: null, displayName: null, rev: 1 } },
  });
  await mount();
  await tap(inviteLabels()[0]!);
  expect(mockApi.patchMe).toHaveBeenCalledWith(
    { displayName: 'Siddiq Kolimi', handle: 'siddiqkoli_12345678' },
    1,
    expect.any(Function),
  );
  expect(mockApi.createInvite).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(tree.toJSON())).not.toContain('Choose a handle');
  expect(JSON.stringify(tree.toJSON())).toContain('Siddiq Kolimi');
  expect(Share.share).not.toHaveBeenCalled();
});
it('copies a working installed-app link and opens Instagram only after a user action', async () => {
  mockStatus = 'signedIn';
  await mount();
  await tap(inviteLabels()[0]!);
  await tap('Copy invite link');
  expect(Clipboard.setString).toHaveBeenCalledWith('driftless://friends?invite=FRIENDCODE');
  await tap('Share on Instagram');
  expect(Linking.openURL).toHaveBeenCalledWith('instagram://app');
  expect(mockApi.createInvite).toHaveBeenCalledTimes(1);
});
it('does not reveal a late invitation after switching to a different account', async () => {
  mockStatus = 'signedIn';
  let finish!: (value: unknown) => void;
  mockApi.createInvite.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await mount();
  await tap(inviteLabels()[0]!);
  mockStatus = 'signedOut';
  await act(async () => tree.update(<CircleBoard friendsPanel={null} />));
  await act(async () => finish({ code: 'OLDCODE' }));
  expect(JSON.stringify(tree.toJSON())).not.toContain('OLDCODE');
  expect(Share.share).not.toHaveBeenCalled();
});
it('does not open a fallback share sheet after sign-out while WhatsApp is opening', async () => {
  mockStatus = 'signedIn';
  let failOpen!: (error: Error) => void;
  jest.mocked(Linking.openURL).mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        failOpen = reject;
      }),
  );
  await mount();
  await tap(inviteLabels()[0]!);
  let sharing!: Promise<void>;
  await act(async () => {
    sharing = tree.root
      .findAll(
        (node) =>
          node.props.accessibilityLabel === 'Share on WhatsApp' &&
          typeof node.props.onPress === 'function',
      )[0]!
      .props.onPress();
  });
  mockStatus = 'signedOut';
  await act(async () => tree.update(<CircleBoard friendsPanel={null} />));
  await act(async () => {
    failOpen(new Error('unavailable'));
    await sharing;
  });
  expect(Share.share).not.toHaveBeenCalled();
});

it('checks friend counts again automatically after a connection failure', async () => {
  const previousState = AppState.currentState;
  AppState.currentState = 'active';
  jest.useFakeTimers();
  try {
    mockStatus = 'signedIn';
    mockApi.friendsDaily.mockRejectedValueOnce(new Error('offline'));
    await mount();
    expect(JSON.stringify(tree.toJSON())).toContain('We’ll check again automatically');
    expect(labelText('Your daily count')).toBe('12');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(60_000);
    });
    expect(mockApi.friendsDaily).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(tree.toJSON())).not.toContain('We’ll check again automatically');
  } finally {
    AppState.currentState = previousState;
    jest.useRealTimers();
  }
});
