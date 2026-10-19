import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { router } from 'expo-router';
import { Tracking } from 'tracking-android';
import Disclosure from '../app/disclosure';

jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));
jest.mock('tracking-android', () => ({
  Tracking: { setDisclosureAccepted: jest.fn(), openAccessibilityGuide: jest.fn() },
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('@/permissions/AccessibilityWalkthrough', () => ({
  AccessibilityWalkthrough: () => null,
}));
jest.mock('@/ui/kit', () => ({
  T: require('react-native').Text,
  Notice: ({ body }: { body: string }) =>
    require('react').createElement(require('react-native').Text, null, body),
}));
jest.mock('@/onboarding/Visuals', () => ({
  SETUP_COLORS: {},
  SetupButton: ({ label, onPress }: { label: string; onPress: () => void }) =>
    require('react').createElement(require('react-native').Pressable, {
      accessibilityLabel: label,
      onPress,
    }),
}));
let tree: ReactTestRenderer;
async function tap(label: string) {
  await act(async () => {
    tree.root
      .findAll(
        (node) =>
          node.props.accessibilityLabel === label && typeof node.props.onPress === 'function',
      )[0]!
      .props.onPress();
  });
}
beforeEach(async () => {
  jest.clearAllMocks();
  (Tracking.openAccessibilityGuide as jest.Mock).mockImplementation(() => undefined);
  await act(async () => {
    tree = create(<Disclosure />);
  });
});
afterEach(async () => {
  await act(async () => tree.unmount());
});
it('opens the guide only after explicit counting consent', async () => {
  expect(Tracking.openAccessibilityGuide).not.toHaveBeenCalled();
  await tap('Got it · I agree');
  expect(Tracking.setDisclosureAccepted).toHaveBeenCalledWith(true);
  expect((Tracking.setDisclosureAccepted as jest.Mock).mock.invocationCallOrder[0]!).toBeLessThan(
    (Tracking.openAccessibilityGuide as jest.Mock).mock.invocationCallOrder[0]!,
  );
  expect(router.back).toHaveBeenCalledTimes(1);
});
it('allows leaving without consent or opening settings', async () => {
  await tap('Not now');
  expect(Tracking.setDisclosureAccepted).not.toHaveBeenCalled();
  expect(Tracking.openAccessibilityGuide).not.toHaveBeenCalled();
  expect(router.back).toHaveBeenCalledTimes(1);
});
it('keeps the guide open and reports a Settings launch failure', async () => {
  (Tracking.openAccessibilityGuide as jest.Mock).mockImplementation(() => {
    throw new Error('Settings unavailable');
  });
  await tap('Got it · I agree');
  expect(router.back).not.toHaveBeenCalled();
  expect(JSON.stringify(tree.toJSON())).toContain('Android settings could not be opened');
});
