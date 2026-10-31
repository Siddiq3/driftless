import React from 'react';
import { Linking } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { router } from 'expo-router';
import Help, { ISSUES, supportEmailUrl } from '../app/help';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.mock('expo-font', () => ({ useFonts: () => [true] }));
jest.mock('expo-constants', () => ({ expoConfig: { version: '1.2.3' } }));
jest.mock('tracking-android', () => ({
  Tracking: { health: () => ({ serviceEnabled: true, serviceRunning: true }) },
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('@/ui/Icon', () => ({ Icon: () => null }));
jest.mock('@/ui/kit', () => ({
  T: require('react-native').Text,
  Notice: ({ body }: { body: string }) =>
    require('react').createElement(require('react-native').Text, null, body),
}));
jest.mock('@/onboarding/Visuals', () => ({
  SETUP_COLORS: {},
  SetupButton: ({
    label,
    onPress,
    disabled,
  }: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
  }) =>
    require('react').createElement(require('react-native').Pressable, {
      accessibilityLabel: label,
      accessibilityState: { disabled },
      onPress: disabled ? undefined : onPress,
    }),
}));

let tree: ReactTestRenderer;
const text = () => JSON.stringify(tree.toJSON());
const node = (label: string) => tree.root.findAll((n) => n.props.accessibilityLabel === label)[0]!;
async function tap(label: string) {
  await act(async () => {
    await node(label).props.onPress();
  });
}

beforeEach(async () => {
  jest.clearAllMocks();
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  await act(async () => {
    tree = create(<Help />);
  });
});
afterEach(() => tree.unmount());

it('lists only ScrollSnooze features and no subscription option', async () => {
  await tap('Report an issue');
  await tap('Continue');
  for (const issue of ISSUES) expect(text()).toContain(issue);
  expect(text()).not.toMatch(/subscription/i);
});

it('needs a choice before continuing', () => {
  expect(node('Continue').props.onPress).toBeUndefined();
});

it('reports an issue by email with app details the user can see', async () => {
  await tap('Report an issue');
  await tap('Continue');
  await tap('Permission issue');
  await tap('Continue');
  await act(async () => node('Message').props.onChangeText('It stopped counting'));
  await tap('Send');
  const url = decodeURIComponent((Linking.openURL as jest.Mock).mock.calls[0][0]);
  expect(url).toContain('ScrollSnooze: Report an issue – Permission issue');
  expect(url).toContain('It stopped counting');
  expect(url).toContain('App version: 1.2.3');
  expect(url).toContain('Counting permission: on');
  expect(router.back).toHaveBeenCalled();
});

it('ideas skip the issue list and include no device details', async () => {
  await tap('Share an idea');
  await tap('Continue');
  expect(text()).toContain('What’s your idea?');
  expect(
    decodeURIComponent(supportEmailUrl('Share an idea', null, 'Dark widget', false)),
  ).not.toContain('App version');
});

it('shows the address when no email app opens', async () => {
  (Linking.openURL as jest.Mock).mockRejectedValue(new Error('none'));
  await tap('Appreciate the team');
  await tap('Continue');
  await act(async () => node('Message').props.onChangeText('Love it'));
  await tap('Send');
  expect(text()).toContain('No email app found');
});
