import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { router } from 'expo-router';
import { Tracking } from 'tracking-android';
import Blocking from '../app/blocking';
import { DEFAULT_BLOCKING, loadBlocking, saveBlocking } from '../src/billing/blocking';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useFocusEffect: (fn: () => void) => require('react').useEffect(fn, [fn]),
}));
jest.mock('expo-font', () => ({ useFonts: () => [true] }));
jest.mock('../src/db', () => ({ getDb: jest.fn().mockResolvedValue({}) }));
jest.mock('../src/billing/blocking', () => ({
  ...jest.requireActual('../src/billing/blocking'),
  loadBlocking: jest.fn(),
  saveBlocking: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../src/billing/ProtectionNotice', () => ({ ProtectionNotice: () => null }));
jest.mock('tracking-android', () => ({ Tracking: { health: jest.fn() } }));
jest.mock('../src/ui/Icon', () => ({ Icon: () => null, AppIcon: () => null }));
jest.mock('../src/ui/kit', () => {
  const { View, Text, Pressable, Switch } = require('react-native');
  return {
    Screen: View,
    T: Text,
    Toggle: Switch,
    Details: View,
    LoadingState: View,
    Notice: View,
    Button: ({ label, onPress }: { label: string; onPress: () => void }) =>
      require('react').createElement(Pressable, { accessibilityLabel: label, onPress }),
  };
});
let tree: ReactTestRenderer;
const config = {
  ...DEFAULT_BLOCKING,
  schedules: [{ days: [6], startMinute: 600, endMinute: 660 }],
  maxBypassesPerDay: 1,
};
const control = (label: string) =>
  tree.root.findAll(
    (node) =>
      node.props.accessibilityLabel === label && (node.props.onPress || node.props.onValueChange),
  )[0]!;
beforeEach(async () => {
  jest.clearAllMocks();
  jest.mocked(loadBlocking).mockResolvedValue(config);
  jest.mocked(Tracking.health).mockReturnValue({
    feedLimitsImplemented: true,
    apps: [
      { package: 'youtube', label: 'YouTube Shorts', installed: true },
      { package: 'instagram', label: 'Instagram Reels', installed: false },
    ],
  } as ReturnType<typeof Tracking.health>);
  await act(async () => {
    tree = create(<Blocking />);
  });
});
afterEach(async () => {
  await act(async () => tree.unmount());
});

it('saves app choices and daily allowance while preserving existing focus and bypass settings', async () => {
  await act(async () => control('YouTube Shorts').props.onPress());
  expect(saveBlocking).toHaveBeenLastCalledWith({}, { ...config, apps: ['youtube'] });
  await act(async () => control('Daily limit: 45m').props.onPress());
  expect(saveBlocking).toHaveBeenLastCalledWith(
    {},
    { ...config, apps: ['youtube'], dailyMinutes: 45 },
  );
  await act(async () => control('Pause apps').props.onValueChange(true));
  expect(saveBlocking).toHaveBeenLastCalledWith(
    {},
    { ...config, apps: ['youtube'], dailyMinutes: 45, enabled: true },
  );
});
it('keeps feed breaks, scope and goal navigation connected to their saved settings', async () => {
  await act(async () => control('Whole app').props.onPress());
  await act(async () => control('Timed feed breaks').props.onValueChange(true));
  await act(async () => control('Break duration: 10m').props.onPress());
  expect(saveBlocking).toHaveBeenLastCalledWith(
    {},
    { ...config, feedOnly: false, breaksEnabled: true, breakMinutes: 10 },
  );
  await act(async () => control('Edit daily video goal').props.onPress());
  expect(router.push).toHaveBeenCalledWith('/goals');
});
