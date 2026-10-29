import { Platform } from 'react-native';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { router } from 'expo-router';
import { Tracking } from 'tracking-android';
import Blocking from '../app/app-pauses';
import Focus from '../app/blocking';
import { DEFAULT_BLOCKING, loadBlocking, saveBlocking } from '../src/billing/blocking';

// Exercise controls and persistence with native animation timing removed.
jest.mock('react-native-reanimated', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const native = jest.requireActual<typeof import('react-native')>('react-native');
  const transition = { duration: () => undefined };
  return {
    __esModule: true,
    default: { View: native.View },
    FadeIn: transition,
    FadeOut: transition,
    LinearTransition: transition,
    useSharedValue: (initial: number) =>
      React.useState(() => ({
        value: initial,
        set(value: number) {
          this.value = value;
        },
      }))[0],
    useAnimatedStyle: (fn: () => object) => fn(),
    withTiming: (value: number) => value,
    interpolateColor: (_value: number, _range: number[], colors: string[]) => colors[0],
  };
});
jest.mock('../src/ui/motion', () => ({ useReducedMotion: () => true }));

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useFocusEffect: (fn: () => void) => require('react').useEffect(fn, [fn]),
}));
jest.mock('expo-font', () => ({ useFonts: () => [true] }));
jest.mock('../src/goals/store', () => ({ loadGoals: jest.fn().mockResolvedValue([]) }));
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
    useTheme: () => require('../src/design-tokens').dark,
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
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  jest.clearAllMocks();
  jest.mocked(loadBlocking).mockResolvedValue(config);
  jest.mocked(Tracking.health).mockReturnValue({
    feedLimitsImplemented: true,
    implemented: true,
    subscriptionRequired: false,
    disclosureAccepted: true,
    serviceEnabled: true,
    serviceRunning: true,
    usageAccessGranted: true,
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

it('applies rapid edits against the latest configuration and persists them in order', async () => {
  await act(async () => {
    control('YouTube Shorts').props.onPress();
    control('Daily limit: 60m').props.onPress();
    control('Pause apps').props.onValueChange(true);
  });
  expect(saveBlocking).toHaveBeenLastCalledWith(
    {},
    { ...config, apps: ['youtube'], dailyMinutes: 60, enabled: true },
  );
});
it('restores the last saved configuration after a failed write', async () => {
  jest.mocked(saveBlocking).mockRejectedValueOnce(new Error('disk full'));
  await act(async () => control('Daily limit: 60m').props.onPress());
  expect(control('Daily limit: 30m').props.accessibilityState.selected).toBe(true);
  expect(JSON.stringify(tree.toJSON())).toContain('last saved settings have been restored');
  await act(async () => control('Daily limit: 45m').props.onPress());
  expect(saveBlocking).toHaveBeenLastCalledWith({}, { ...config, dailyMinutes: 45 });
});
it('keeps selections after returning to the screen', async () => {
  await act(async () => control('YouTube Shorts').props.onPress());
  const saved = jest.mocked(saveBlocking).mock.calls.at(-1)![1];
  await act(async () => tree.unmount());
  jest.mocked(loadBlocking).mockResolvedValue(saved);
  await act(async () => {
    tree = create(<Blocking />);
  });
  expect(control('YouTube Shorts').props.accessibilityState.checked).toBe(true);
});
it('preserves custom schedules when toggling a preset and opens app pause configuration', async () => {
  await act(async () => {
    tree.unmount();
    tree = create(<Focus />);
  });
  await act(async () => control('Work hours').props.onValueChange(true));
  expect(jest.mocked(saveBlocking).mock.calls.at(-1)![1].schedules).toEqual([
    ...config.schedules,
    { days: [1, 2, 3, 4, 5], startMinute: 540, endMinute: 1020 },
  ]);
  await act(async () => control('Work hours').props.onValueChange(false));
  expect(jest.mocked(saveBlocking).mock.calls.at(-1)![1].schedules).toEqual(config.schedules);
  await act(async () => control('Configure app pauses').props.onPress());
  expect(router.push).toHaveBeenCalledWith('/app-pauses');
});
it('does not claim active protection when permissions are missing', async () => {
  jest.mocked(loadBlocking).mockResolvedValue({ ...config, enabled: true, apps: ['youtube'] });
  jest.mocked(Tracking.health).mockReturnValue({ ...Tracking.health(), serviceEnabled: false });
  await act(async () => {
    tree.unmount();
    tree = create(<Blocking />);
  });
  expect(JSON.stringify(tree.toJSON())).toContain('Permission required');
  expect(JSON.stringify(tree.toJSON())).not.toContain('Protection active');
});
it('handles unavailable native services without discarding saved settings', async () => {
  jest.mocked(Tracking.health).mockImplementationOnce(() => {
    throw new Error('not supported');
  });
  await act(async () => {
    tree.unmount();
    tree = create(<Blocking />);
  });
  expect(JSON.stringify(tree.toJSON())).toContain(
    'App pauses need the Android accessibility service',
  );
  expect(control('Daily limit: 30m').props.accessibilityState.selected).toBe(true);
});
it('shows ready protection only for a supported, running and approved configuration', async () => {
  jest.mocked(loadBlocking).mockResolvedValue({ ...config, enabled: true, apps: ['youtube'] });
  jest.mocked(Tracking.health).mockReturnValue({
    ...Tracking.health(),
    apps: [
      {
        package: 'youtube',
        label: 'YouTube Shorts',
        installed: true,
        validated: true,
        version: '1',
      },
    ],
  });
  await act(async () => {
    tree.unmount();
    tree = create(<Blocking />);
  });
  expect(JSON.stringify(tree.toJSON())).toContain('Protection active');
});
it('does not claim restoration if persistence and restoration both fail', async () => {
  jest
    .mocked(saveBlocking)
    .mockRejectedValueOnce(new Error('native failure'))
    .mockRejectedValueOnce(new Error('still unavailable'));
  await act(async () => control('Daily limit: 60m').props.onPress());
  expect(JSON.stringify(tree.toJSON())).toContain('Changes could not be confirmed');
  expect(JSON.stringify(tree.toJSON())).not.toContain('have been restored');
  await act(async () => control('Try saving again').props.onPress());
  expect(saveBlocking).toHaveBeenLastCalledWith({}, { ...config, dailyMinutes: 60 });
});
it('can retry after failing to load settings', async () => {
  jest.mocked(loadBlocking).mockRejectedValueOnce(new Error('storage unavailable'));
  await act(async () => {
    tree.unmount();
    tree = create(<Blocking />);
  });
  expect(JSON.stringify(tree.toJSON())).toContain('Your settings could not be loaded');
  await act(async () => control('Try again').props.onPress());
  expect(control('Daily limit: 30m').props.accessibilityState.selected).toBe(true);
});

it('makes Focus protection primary, keeps setup editable while off, and preserves choices on enable', async () => {
  await act(async () => {
    tree.unmount();
    tree = create(<Focus />);
  });
  expect(JSON.stringify(tree.toJSON())).toContain('Protection is off');
  expect(JSON.stringify(tree.toJSON())).not.toContain('INCLUDED');
  expect(control('More options').props.accessibilityState.expanded).toBe(false);
  expect(
    tree.root.findAll((node) => node.props.accessibilityLabel === 'Timed feed breaks'),
  ).toHaveLength(0);
  await act(async () => control('YouTube Shorts').props.onPress());
  await act(async () => control('Increase daily limit').props.onPress());
  await act(async () => control('Turn on app pauses').props.onPress());
  expect(saveBlocking).toHaveBeenLastCalledWith(
    {},
    { ...config, apps: ['youtube'], dailyMinutes: 45, enabled: true },
  );
  await act(async () => control('Pause apps').props.onPress());
  expect(saveBlocking).toHaveBeenLastCalledWith(
    {},
    { ...config, apps: ['youtube'], dailyMinutes: 45, enabled: false },
  );
});

it('retains advanced goal, break, bypass and experimental controls inside More options', async () => {
  await act(async () => {
    tree.unmount();
    tree = create(<Focus />);
  });
  await act(async () => control('More options').props.onPress());
  await act(async () => control('Timed feed breaks').props.onValueChange(true));
  await act(async () => control('Break duration: 10m').props.onPress());
  await act(async () => control('Bypass options').props.onPress());
  await act(async () => control('Bypasses per day: 5').props.onPress());
  await act(async () => control('Experimental feed detection').props.onValueChange(true));
  expect(saveBlocking).toHaveBeenLastCalledWith(
    {},
    {
      ...config,
      breaksEnabled: true,
      breakMinutes: 10,
      maxBypassesPerDay: 5,
      allowUnvalidatedCounts: true,
    },
  );
  await act(async () => control('Edit daily video goal').props.onPress());
  expect(router.push).toHaveBeenCalledWith('/goals');
});

it('keeps unavailable app selections and custom daily limits without normalizing them', async () => {
  const saved = { ...config, apps: ['instagram'], dailyMinutes: 35 };
  jest.mocked(loadBlocking).mockResolvedValue(saved);
  await act(async () => {
    tree.unmount();
    tree = create(<Focus />);
  });
  expect(JSON.stringify(tree.toJSON())).toContain('35');
  await act(async () => control('Add app').props.onPress());
  expect(JSON.stringify(tree.toJSON())).toContain('selection saved');
  await act(async () => control('Turn on app pauses').props.onPress());
  expect(saveBlocking).toHaveBeenLastCalledWith({}, { ...saved, enabled: true });
});

it('keeps the Focus hero honest when protection is enabled without permissions', async () => {
  jest.mocked(loadBlocking).mockResolvedValue({ ...config, enabled: true, apps: ['youtube'] });
  jest.mocked(Tracking.health).mockReturnValue({ ...Tracking.health(), serviceEnabled: false });
  await act(async () => {
    tree.unmount();
    tree = create(<Focus />);
  });
  expect(JSON.stringify(tree.toJSON())).toContain('Permission required');
  expect(JSON.stringify(tree.toJSON())).not.toContain('Protection is on');
});

it('shows the on state in Focus only when the existing readiness checks pass', async () => {
  jest.mocked(loadBlocking).mockResolvedValue({ ...config, enabled: true, apps: ['youtube'] });
  jest.mocked(Tracking.health).mockReturnValue({
    ...Tracking.health(),
    apps: [
      {
        package: 'youtube',
        label: 'YouTube Shorts',
        installed: true,
        validated: true,
        version: '1',
      },
    ],
  });
  await act(async () => {
    tree.unmount();
    tree = create(<Focus />);
  });
  expect(JSON.stringify(tree.toJSON())).toContain('Protection is on');
  expect(control('Pause apps').props.accessibilityState.checked).toBe(true);
});

it('retains Focus rollback and retry behavior after a failed write', async () => {
  await act(async () => {
    tree.unmount();
    tree = create(<Focus />);
  });
  jest.mocked(saveBlocking).mockRejectedValueOnce(new Error('disk full'));
  await act(async () => control('Increase daily limit').props.onPress());
  expect(JSON.stringify(tree.toJSON())).toContain('last saved settings have been restored');
  await act(async () => control('Retry save').props.onPress());
  expect(saveBlocking).toHaveBeenLastCalledWith({}, config);
});
