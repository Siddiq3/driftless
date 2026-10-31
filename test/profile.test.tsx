import React from 'react';
import { Platform } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { router } from 'expo-router';
import Profile from '../app/profile';
import Legal from '../app/legal';
import { staysInApp } from '../app/legal-doc';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useFocusEffect: (fn: () => void) => require('react').useEffect(fn, []),
}));
jest.mock('react-native-webview', () => ({ WebView: () => null }));
jest.mock('expo-font', () => ({ useFonts: () => [true] }));
jest.mock('@/config/website', () => ({
  websiteLinks: () => ({
    terms: 'https://example.com/terms/',
    privacy: 'https://example.com/privacy/',
    deletion: '',
    support: '',
  }),
}));
jest.mock('@/config/env', () => ({ APP_VERSION: '1.2.3' }));
jest.mock('@/auth/session', () => ({
  useSession: () => ({ status: 'signedOut', signIn: jest.fn(() => Promise.resolve()) }),
}));
jest.mock('tracking-android', () => ({
  Tracking: {
    floatingCountPreferences: () => ({ size: 40, pausedUntil: 0 }),
    floatingCountCustomizationSupported: () => true,
    widgetSupported: () => true,
    requestCountWidget: () => true,
  },
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('@/ui/BrainCharacter', () => ({ BrainCharacter: () => null }));
jest.mock('@/ui/Icon', () => ({ Icon: () => null }));
jest.mock('@/ui/kit', () => ({
  T: require('react-native').Text,
  Toggle: () => null,
  Notice: ({ body }: { body: string }) =>
    require('react').createElement(require('react-native').Text, null, body),
}));
jest.mock('@/onboarding/Visuals', () => ({ SETUP_COLORS: {} }));

let tree: ReactTestRenderer;
const text = () => JSON.stringify(tree.toJSON());
const tap = async (label: string) =>
  act(async () => {
    tree.root.findAll((n) => n.props.accessibilityLabel === label)[0]!.props.onPress();
  });

beforeEach(() => Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' }));
afterEach(async () => {
  await act(async () => tree.unmount());
});

it('profile offers only current features, with no Pro, refund or language', async () => {
  await act(async () => {
    tree = create(<Profile />);
  });
  for (const label of [
    'Log in or create an account',
    'Widgets',
    'Friends',
    'Send Feedback',
    'Legal',
    'Small',
  ])
    expect(text()).toContain(label);
  expect(text()).not.toMatch(/Pro\b|80%|Refund|Language/);
  await tap('Your data & privacy');
  expect(router.push).toHaveBeenCalledWith('/privacy');
  await tap('Send Feedback');
  expect(router.push).toHaveBeenCalledWith('/help');
  await tap('Counter size: Small');
  expect(router.push).toHaveBeenCalledWith('/counter-size');
});

it('legal opens each page on an in-app screen, without a refund policy', async () => {
  await act(async () => {
    tree = create(<Legal />);
  });
  expect(text()).not.toMatch(/Refund|Your data/);
  await tap('Privacy Policy');
  expect(router.push).toHaveBeenCalledWith({ pathname: '/legal-doc', params: { doc: 'privacy' } });
});

it('only the exact published page stays in the app', () => {
  const page = 'https://example.com/privacy/';
  expect(staysInApp('https://example.com/privacy', page)).toBe(true);
  expect(staysInApp('https://example.com/terms/', page)).toBe(false);
  expect(staysInApp('https://evil.example/privacy/', page)).toBe(false);
  expect(staysInApp('mailto:a@b.c', page)).toBe(false);
});

it('counter size saves the chosen size and shows only the needed controls', async () => {
  const Tracking = require('tracking-android').Tracking;
  Tracking.floatingCountEnabled = () => true;
  Tracking.health = () => ({ disclosureAccepted: true });
  Tracking.setFloatingCountSize = jest.fn();
  const CounterSize = require('../app/counter-size').default;
  await act(async () => {
    tree = create(<CounterSize />);
  });
  expect(text()).toContain('Show counter on Reels & Shorts');
  for (const label of ['Small', 'Medium', 'Large']) expect(text()).toContain(label);
  expect(text()).not.toMatch(/drag to the pause target|could not be identified/);
  await tap('Large');
  expect(Tracking.setFloatingCountSize).toHaveBeenCalledWith(72);
});
