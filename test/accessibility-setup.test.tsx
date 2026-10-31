import { BackHandler, Platform } from 'react-native';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { router, useLocalSearchParams } from 'expo-router';
import { Tracking } from 'tracking-android';
import Disclosure from '../app/disclosure';
import {
  ACCESSIBILITY_DISCLOSURE,
  ACCESSIBILITY_SHEET_POINTS,
} from '../src/permissions/accessibilityDisclosure';
import { SLIDES } from '../src/permissions/PermissionScreen';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: jest.fn(() => ({})),
}));
jest.mock('tracking-android', () => ({
  Tracking: {
    health: jest.fn(),
    setDisclosureAccepted: jest.fn(),
    openAccessibilityGuide: jest.fn(),
  },
}));
jest.mock('expo-font', () => ({ useFonts: () => [true] }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('@/ios/ScreenTimeScreen', () => ({ ScreenTimeScreen: () => null }));
jest.mock('@/ui/BrainCharacter', () => ({ BrainCharacter: () => null }));
jest.mock('@/ui/motion', () => ({ useReducedMotion: () => true }));
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
jest.mock('@/ui/Icon', () => ({ Icon: () => null }));

const T = Tracking as unknown as Record<string, jest.Mock>;
const fresh = { disclosureAccepted: false, serviceEnabled: false, serviceRunning: false };
let tree: ReactTestRenderer;
const text = () => JSON.stringify(tree.toJSON());
const has = (label: string) =>
  tree.root.findAll(
    (n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function',
  ).length > 0;
async function tap(label: string) {
  await act(async () => {
    tree.root
      .findAll(
        (n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function',
      )[0]!
      .props.onPress();
  });
}
async function open(state: object = fresh, params: object = {}) {
  T.health!.mockReturnValue(state);
  (useLocalSearchParams as jest.Mock).mockReturnValue(params);
  await act(async () => {
    tree = create(<Disclosure />);
  });
}
async function pressBack() {
  const calls = (BackHandler.addEventListener as jest.Mock).mock.calls;
  let handled: boolean | null | undefined;
  await act(async () => {
    handled = (calls[calls.length - 1]![1] as () => boolean)();
  });
  return handled;
}
const expectNoConsent = () => {
  expect(T.setDisclosureAccepted).not.toHaveBeenCalled();
  expect(T.openAccessibilityGuide).not.toHaveBeenCalled();
};

beforeEach(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  jest.clearAllMocks();
  jest.spyOn(BackHandler, 'addEventListener');
  (router.canGoBack as jest.Mock).mockReturnValue(true);
});
afterEach(async () => {
  await act(async () => tree.unmount());
  jest.restoreAllMocks();
});

describe('permission screen', () => {
  it('shows each of the three uses of the one permission, without granting anything', async () => {
    await open();
    for (const [i, { body }] of SLIDES.entries()) {
      await tap(`Show: ${SLIDES[i]!.title}`);
      expect(text()).toContain(body);
    }
    expect(has('Turn on')).toBe(true);
    expect(has('Accept')).toBe(false);
    expectNoConsent();
  });
  it('agreed users go straight to the guide', async () => {
    await open({ ...fresh, disclosureAccepted: true });
    await tap('Turn on');
    expect(T.openAccessibilityGuide).toHaveBeenCalledTimes(1);
    expect(router.back).toHaveBeenCalledTimes(1);
  });
  it('treats unavailable native health as no consent', async () => {
    await open();
    T.health!.mockImplementation(() => {
      throw new Error('unavailable');
    });
    await tap('Turn on');
    expect(has('Accept')).toBe(true);
    expectNoConsent();
  });
});

describe('consent sheet', () => {
  const sheet = async () => {
    await open();
    await tap('Turn on');
  };
  it('shows the V3 summary and expands to the exact full text', async () => {
    await sheet();
    for (const { body } of ACCESSIBILITY_SHEET_POINTS) expect(text()).toContain(body);
    await tap('Read full details');
    for (const { body } of ACCESSIBILITY_DISCLOSURE) expect(text()).toContain(body);
    expect(text()).not.toMatch(/Facebook|Snapchat|ShareChat|Moj|heartbeat|coverage/i);
    expectNoConsent();
  });
  it('agree saves consent before opening the guide, then leaves', async () => {
    await sheet();
    const order: string[] = [];
    T.setDisclosureAccepted!.mockImplementation(() => order.push('consent'));
    T.openAccessibilityGuide!.mockImplementation(() => order.push('guide'));
    await tap('Accept');
    expect(order).toEqual(['consent', 'guide']);
    expect(router.back).toHaveBeenCalledTimes(1);
  });
  it('does not open the guide when saving consent fails', async () => {
    await sheet();
    T.setDisclosureAccepted!.mockImplementation(() => {
      throw new Error('timeout');
    });
    await tap('Accept');
    expect(T.openAccessibilityGuide).not.toHaveBeenCalled();
    expect(text()).toContain('could not be saved');
  });
  it('Deny asks first, and Okay returns to the consent sheet', async () => {
    await sheet();
    await tap('Deny');
    expect(text()).toContain('Not sure about this permission?');
    await tap('Okay, turn it on');
    expect(has('Accept')).toBe(true);
    expectNoConsent();
  });
});

describe('Back', () => {
  it('shows the Not sure sheet, and a second Back leaves without consent', async () => {
    await open();
    expect(await pressBack()).toBe(true);
    expect(text()).toContain('Not sure about this permission?');
    expect(text()).not.toMatch(/Everything stays|never sees/i);
    await pressBack();
    expect(router.back).toHaveBeenCalledTimes(1);
    expectNoConsent();
  });
});

describe('read-only from Privacy', () => {
  it('shows the full text with Close only and no side effects', async () => {
    await open({ ...fresh, disclosureAccepted: true }, { mode: 'read' });
    for (const { body } of ACCESSIBILITY_DISCLOSURE) expect(text()).toContain(body);
    expect(has('Turn on')).toBe(false);
    await tap('Close');
    expectNoConsent();
    expect(router.back).toHaveBeenCalledTimes(1);
  });
});
