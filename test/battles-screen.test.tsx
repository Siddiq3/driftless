import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { router } from 'expo-router';
import { ApiError } from '../src/api/client';
import { BattleAcceptance } from '@/social/BattleAcceptance';
import { clearInvite, rememberInvite } from '@/social/pendingInvite';
import Challenges from '../app/challenges';
const mockApi = { battleInvite: jest.fn(), acceptBattleInvite: jest.fn() };
let mockSignedIn = true;
jest.mock('@/api/useApi', () => ({ useApi: () => (mockSignedIn ? mockApi : null) }));
jest.mock('@/auth/session', () => ({
  useSession: () => ({ status: mockSignedIn ? 'signedIn' : 'signedOut', displayName: 'Kolimi' }),
}));
const mockEnsure = jest.fn().mockResolvedValue({});
jest.mock('@/social/profile', () => ({
  ensureSocialProfile: (...args: unknown[]) => mockEnsure(...args),
}));
jest.mock('@/social/pendingInvite', () => ({
  rememberInvite: jest.fn().mockResolvedValue(undefined),
  clearInvite: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn() },
  Redirect: ({ href }: { href: string }) =>
    require('react').createElement(require('react-native').Text, null, href),
}));
jest.mock('@/ui/kit', () => {
  const { View, Text, Pressable } = require('react-native');
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
const mount = async () => {
  await act(async () => {
    tree = create(<BattleAcceptance code="ABCDEFGHJK" />);
  });
};
beforeEach(() => {
  jest.clearAllMocks();
  mockSignedIn = true;
  mockApi.battleInvite.mockResolvedValue({ isSelf: false });
  mockApi.acceptBattleInvite.mockResolvedValue({ ok: true });
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
it('keeps an invitation until explicit acceptance then opens the leaderboard', async () => {
  await mount();
  expect(rememberInvite).toHaveBeenCalledWith('ABCDEFGHJK');
  expect(JSON.stringify(tree.toJSON())).toContain('A friend invited you');
  expect(mockApi.acceptBattleInvite).not.toHaveBeenCalled();
  await tap('Accept Invitation');
  expect(mockApi.acceptBattleInvite).toHaveBeenCalledWith('ABCDEFGHJK', expect.any(Function));
  expect(clearInvite).toHaveBeenCalledWith('ABCDEFGHJK');
  expect(router.replace).toHaveBeenCalledWith('/friends');
});
it('later dismisses the invitation without accepting or sharing', async () => {
  await mount();
  await tap('I’ll do it later');
  expect(clearInvite).toHaveBeenCalledWith('ABCDEFGHJK');
  expect(mockApi.acceptBattleInvite).not.toHaveBeenCalled();
});
it('keeps failed acceptance visible and retryable', async () => {
  mockApi.acceptBattleInvite.mockRejectedValueOnce(new Error('Expired invitation'));
  await mount();
  await tap('Accept Invitation');
  expect(JSON.stringify(tree.toJSON())).toContain('Expired invitation');
  expect(clearInvite).not.toHaveBeenCalled();
  expect(router.replace).not.toHaveBeenCalled();
});
it('signed-out users can sign in while retaining the invitation', async () => {
  mockSignedIn = false;
  await mount();
  expect(control('Accept Invitation')).toBeUndefined();
  await tap('Sign in to accept');
  expect(router.push).toHaveBeenCalledWith('/welcome');
  expect(clearInvite).not.toHaveBeenCalled();
});
it('legacy challenges links redirect to the leaderboard', async () => {
  await act(async () => {
    tree = create(<Challenges />);
  });
  expect(JSON.stringify(tree.toJSON())).toContain('/friends');
});

it('explains what accepting shares before anything is accepted', async () => {
  await mount();
  const shown = JSON.stringify(tree.toJSON());
  for (const words of [
    'check who sent you this link',
    'daily Reels and Shorts',
    'experimental',
    'Google account name',
    'delete the friend',
  ])
    expect(shown).toContain(words);
  expect(mockApi.acceptBattleInvite).not.toHaveBeenCalled();
});
it('accepting saves the Google sign-up name first', async () => {
  await mount();
  await tap('Accept Invitation');
  expect(mockEnsure).toHaveBeenCalledWith(mockApi, 'Kolimi', expect.any(Function));
});
it.each([
  ['already used', new ApiError(409, 'invite_used', 'used')],
  ['expired or malformed', new ApiError(404, 'not_found', 'missing')],
])('a link that is %s stops reopening and offers no acceptance', async (_name, error) => {
  mockApi.battleInvite.mockRejectedValueOnce(error);
  await mount();
  expect(JSON.stringify(tree.toJSON())).toContain('Ask your friend for a new link');
  expect(clearInvite).toHaveBeenCalledWith('ABCDEFGHJK');
  expect(control('Accept Invitation')).toBeUndefined();
});
it('losing the race for a link shows it as used', async () => {
  mockApi.acceptBattleInvite.mockRejectedValueOnce(new ApiError(409, 'invite_used', 'used'));
  await mount();
  await tap('Accept Invitation');
  expect(JSON.stringify(tree.toJSON())).toContain('Ask your friend for a new link');
  expect(clearInvite).toHaveBeenCalledWith('ABCDEFGHJK');
  expect(router.replace).not.toHaveBeenCalled();
});
it('never shows an inviter name before acceptance, even if an old server sends one', async () => {
  mockApi.battleInvite.mockResolvedValue({ inviterName: 'Study Garage', isSelf: false });
  await mount();
  expect(JSON.stringify(tree.toJSON())).not.toContain('Study Garage');
  await tap('Accept Invitation');
  expect(JSON.stringify(tree.toJSON())).not.toContain('Study Garage');
  expect(router.replace).toHaveBeenCalledWith('/friends');
});
