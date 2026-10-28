import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { SetupFlow } from '../src/onboarding/SetupFlow';
import { EMPTY_ANSWERS, type SetupRecord } from '../src/onboarding/model';

const mockSave = jest.fn().mockResolvedValue(undefined);
const mockSetup = { save: mockSave };
let mockSession = { status: 'signedOut', googleSupported: true, signIn: jest.fn() };
jest.mock('@/auth/session', () => ({ useSession: () => mockSession }));
jest.mock('@/onboarding/context', () => ({ useOnboarding: () => mockSetup }));
jest.mock('expo-font', () => ({ useFonts: () => [true] }));
jest.mock('expo-router', () => ({ router: {}, useFocusEffect: () => undefined }));
jest.mock('tracking-android', () => ({ Tracking: {} }));
jest.mock('@/db', () => ({ getDb: jest.fn() }));
jest.mock('@/goals/store', () => ({ loadGoals: jest.fn() }));
jest.mock('@/ui/motion', () => ({ useDataMotion: () => ({}) }));
jest.mock('@/ui/BrainCharacter', () => ({ BrainCharacter: () => null }));
jest.mock('@/ui/Icon', () => ({ AppIcon: () => null, Icon: () => null }));
jest.mock('@/onboarding/GetStartedScreen', () => ({ GetStartedScreen: () => null }));
jest.mock('@/onboarding/QuestionContent', () => ({ QuestionContent: () => null }));
jest.mock('@/permissions/PermissionChecklist', () => ({
  PermissionChecklist: () => null,
  PermissionHelpButton: () => null,
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/ui/kit', () => ({
  T: require('react-native').Text,
  Details: require('react-native').View,
  Notice: () => null,
}));
jest.mock('@/onboarding/Visuals', () => ({
  SETUP_COLORS: {},
  SetupButton: () => null,
  WidgetPreview: () => null,
  ChallengeArtwork: () => null,
  PrivacyArtwork: () => null,
}));
const initial: SetupRecord = {
  version: 1,
  completed: false,
  step: 10,
  answers: EMPTY_ANSWERS,
  plan: { metric: 'views', dailyLimit: 50 },
};
let tree: ReactTestRenderer;
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
beforeEach(() => {
  mockSave.mockClear();
  mockSession = { status: 'signedOut', googleSupported: true, signIn: jest.fn() };
});
it('advances only when sign-in succeeds, preserving setup answers', async () => {
  await act(async () => {
    tree = create(<SetupFlow initial={initial} />);
  });
  expect(mockSave).not.toHaveBeenCalled();
  mockSession = { ...mockSession, status: 'signedIn' };
  await act(async () => tree.update(<SetupFlow initial={initial} />));
  expect(mockSave).toHaveBeenCalledWith({ ...initial, step: 11 });
  expect(JSON.stringify(tree.toJSON())).not.toContain('Your account');
});
it('skips a restored account step for an already signed-in user', async () => {
  mockSession = { ...mockSession, status: 'signedIn' };
  await act(async () => {
    tree = create(<SetupFlow initial={initial} />);
  });
  expect(mockSave).toHaveBeenCalledTimes(1);
  expect(mockSave).toHaveBeenCalledWith({ ...initial, step: 11 });
});
