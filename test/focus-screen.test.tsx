import { Platform } from 'react-native';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { router } from 'expo-router';
import { Tracking } from 'tracking-android';
import Focus, { focusSummary } from '../app/blocking';
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
    withRepeat: (value: number) => value,
    withSequence: (value: number) => value,
    cancelAnimation: () => undefined,
    Easing: { out: () => undefined, in: () => undefined, quad: undefined },
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
jest.mock('../src/ui/BrainCharacter', () => ({ BrainCharacter: () => null }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('../src/ui/kit', () => {
  const { View, Text, Pressable, Switch } = require('react-native');
  return {
    Screen: View,
    useTheme: () => require('../src/design-tokens').dark,
    T: Text,
    Toggle: Switch,
    Details: View,
    LoadingState: View,
    Notice: ({ body }: { body: string }) => require('react').createElement(Text, null, body),
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
const text = () => JSON.stringify(tree.toJSON());
// Settings live in collapsed summary rows; open one before using its controls.
const open = (title: string) =>
  act(async () =>
    tree.root
      .findAll(
        (n) =>
          typeof n.props.accessibilityLabel === 'string' &&
          n.props.accessibilityLabel.startsWith(`${title}: `) &&
          n.props.accessibilityState &&
          'expanded' in n.props.accessibilityState &&
          n.props.onPress,
      )[0]!
      .props.onPress(),
  );
const health = {
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
} as ReturnType<typeof Tracking.health>;
async function mount() {
  await act(async () => {
    tree?.unmount();
    tree = create(<Focus />);
  });
}
beforeEach(async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  jest.clearAllMocks();
  jest.mocked(loadBlocking).mockResolvedValue(config);
  jest.mocked(Tracking.health).mockReturnValue(health);
  await mount();
});
afterEach(async () => {
  await act(async () => tree.unmount());
});

it('saves app choices, the daily limit and the master switch', async () => {
  await act(async () => control('YouTube Shorts').props.onPress());
  // Picking the first app keeps the Apps row open.
  expect(control('YouTube Shorts').props.accessibilityState.checked).toBe(true);
  expect(saveBlocking).toHaveBeenLastCalledWith({}, { ...config, apps: ['youtube'] });
  await open('Daily limit');
  await act(async () => control('Daily limit: 45m').props.onPress());
  await act(async () => control('App pauses').props.onValueChange(true));
  expect(saveBlocking).toHaveBeenLastCalledWith(
    {},
    { ...config, apps: ['youtube'], dailyMinutes: 45, enabled: true },
  );
});

it('turns the daily limit off and on', async () => {
  await open('Daily limit');
  await act(async () => control('Pause after a daily limit').props.onValueChange(false));
  expect(saveBlocking).toHaveBeenLastCalledWith({}, { ...config, dailyMinutes: null });
  expect(tree.root.findAll((n) => n.props.accessibilityLabel === 'Daily limit: 30m')).toHaveLength(
    0,
  );
});

it('applies rapid edits against the latest configuration and persists them in order', async () => {
  await open('Daily limit');
  await act(async () => {
    control('YouTube Shorts').props.onPress();
    control('Daily limit: 60m').props.onPress();
    control('App pauses').props.onValueChange(true);
  });
  expect(saveBlocking).toHaveBeenLastCalledWith(
    {},
    { ...config, apps: ['youtube'], dailyMinutes: 60, enabled: true },
  );
});

it('restores the last saved configuration after a failed write, then retries', async () => {
  jest.mocked(saveBlocking).mockRejectedValueOnce(new Error('disk full'));
  await open('Daily limit');
  await act(async () => control('Daily limit: 60m').props.onPress());
  expect(control('Daily limit: 30m').props.accessibilityState.checked).toBe(true);
  expect(text()).toContain('last saved settings have been restored');
  await act(async () => control('Retry save').props.onPress());
  expect(saveBlocking).toHaveBeenLastCalledWith({}, config);
});

it('does not claim restoration if persistence and restoration both fail', async () => {
  jest
    .mocked(saveBlocking)
    .mockRejectedValueOnce(new Error('native failure'))
    .mockRejectedValueOnce(new Error('still unavailable'));
  await open('Daily limit');
  await act(async () => control('Daily limit: 60m').props.onPress());
  expect(text()).toContain('Changes could not be confirmed');
  expect(text()).not.toContain('have been restored');
});

it('keeps selections after returning to the screen', async () => {
  await act(async () => control('YouTube Shorts').props.onPress());
  jest.mocked(loadBlocking).mockResolvedValue(jest.mocked(saveBlocking).mock.calls.at(-1)![1]);
  await mount();
  await open('Apps');
  expect(control('YouTube Shorts').props.accessibilityState.checked).toBe(true);
});

it('toggles focus-time presets while preserving custom schedules', async () => {
  await open('Focus times');
  await act(async () => control('Work hours').props.onValueChange(true));
  expect(jest.mocked(saveBlocking).mock.calls.at(-1)![1].schedules).toEqual([
    ...config.schedules,
    { days: [1, 2, 3, 4, 5], startMinute: 540, endMinute: 1020 },
  ]);
  await act(async () => control('Work hours').props.onValueChange(false));
  expect(jest.mocked(saveBlocking).mock.calls.at(-1)![1].schedules).toEqual(config.schedules);
});

it('adds a custom overnight focus time once, only with at least one day', async () => {
  const press = async (label: string, times = 1) => {
    for (let i = 0; i < times; i++) await act(async () => control(label).props.onPress());
  };
  const time = (label: string) =>
    tree.root.findAll(
      (n) =>
        typeof n.props.accessibilityLabel === 'string' &&
        n.props.accessibilityLabel.startsWith(label),
    )[0]!.props.accessibilityLabel as string;
  await open('Focus times');
  await press('Add your own time');
  // 6:00 PM → 11:00 PM, and 9:00 PM → 6:00 AM, wrapping past midnight.
  for (let i = 0; i < 10; i++) await act(async () => control(time('Starts later')).props.onPress());
  for (let i = 0; i < 18; i++) await act(async () => control(time('Ends later')).props.onPress());
  await press('Sat');
  await press('Sun');
  await press('Save focus time');
  const added = { days: [1, 2, 3, 4, 5], startMinute: 23 * 60, endMinute: 6 * 60 };
  expect(jest.mocked(saveBlocking).mock.calls.at(-1)![1].schedules).toEqual([
    ...config.schedules,
    added,
  ]);
  expect(text()).toContain('Mon–Fri · 11:00 PM – 6:00 AM (next day)');

  const saves = jest.mocked(saveBlocking).mock.calls.length;
  await press('Add your own time');
  // The form keeps the last choice (Mon–Fri); clearing those leaves no day.
  for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']) await press(day);
  expect(text()).toContain('Pick at least one day.');
  await press('Save focus time');
  expect(jest.mocked(saveBlocking).mock.calls.length).toBe(saves);
});

it('keeps feed scope, breaks, skips and the goal link connected', async () => {
  await open('What to pause');
  await open('Feed breaks');
  await act(async () => control('Whole app').props.onPress());
  await act(async () => control('Short break after a run of videos').props.onValueChange(true));
  await act(async () => control('Break length: 10m').props.onPress());
  await act(async () => control('Skips allowed per day: 5').props.onPress());
  expect(saveBlocking).toHaveBeenLastCalledWith(
    {},
    {
      ...config,
      feedOnly: false,
      breaksEnabled: true,
      breakMinutes: 10,
      maxBypassesPerDay: 5,
    },
  );
  await act(async () => control('Pause at my video goal').props.onValueChange(true));
  await act(async () => control('Edit video goal').props.onPress());
  expect(router.push).toHaveBeenCalledWith('/goals');
});

it('keeps a custom daily limit without normalizing it', async () => {
  jest.mocked(loadBlocking).mockResolvedValue({ ...config, dailyMinutes: 35 });
  await mount();
  await open('Daily limit');
  expect(control('Daily limit: 35m').props.accessibilityState.checked).toBe(true);
});

it('says pauses need attention, not on, when counting is off', async () => {
  jest.mocked(loadBlocking).mockResolvedValue({ ...config, enabled: true, apps: ['youtube'] });
  jest.mocked(Tracking.health).mockReturnValue({ ...health, serviceEnabled: false });
  await mount();
  expect(text()).toContain('Pauses need attention');
  expect(text()).not.toContain('Pauses are on');
  await act(async () => control('Turn on counting').props.onPress());
  expect(router.push).toHaveBeenCalledWith('/disclosure');
});

it('says pauses are on only when the readiness checks pass', async () => {
  jest.mocked(loadBlocking).mockResolvedValue({ ...config, enabled: true, apps: ['youtube'] });
  jest.mocked(Tracking.health).mockReturnValue({
    ...health,
    apps: [
      {
        package: 'youtube',
        label: 'YouTube Shorts',
        installed: true,
        validated: true,
        version: '1',
      },
    ],
  } as ReturnType<typeof Tracking.health>);
  await mount();
  expect(text()).toContain('Pauses are on');
});

it('handles unavailable native services without discarding saved settings', async () => {
  jest.mocked(loadBlocking).mockResolvedValue({ ...config, enabled: true });
  jest.mocked(Tracking.health).mockImplementation(() => {
    throw new Error('not supported');
  });
  await mount();
  expect(text()).toContain('App pauses need the Android accessibility service');
  await open('Daily limit');
  expect(control('Daily limit: 30m').props.accessibilityState.checked).toBe(true);
});

it('can retry after failing to load settings', async () => {
  jest.mocked(loadBlocking).mockRejectedValueOnce(new Error('storage unavailable'));
  await mount();
  await act(async () => control('Try again').props.onPress());
  await open('Daily limit');
  expect(control('Daily limit: 30m').props.accessibilityState.checked).toBe(true);
});

it('writes the status sentence from the picked apps and live settings', () => {
  const on = { ...config, enabled: true, feedOnly: true, dailyMinutes: 30 };
  expect(focusSummary(on, ['Instagram Reels'])).toBe(
    'Instagram Reels pauses after 30 min a day and during 10:00 AM – 11:00 AM.',
  );
  expect(
    focusSummary({ ...on, feedOnly: false, schedules: [] }, ['Instagram Reels', 'YouTube Shorts']),
  ).toBe('Instagram and YouTube pause after 30 min a day.');
  expect(focusSummary({ ...on, dailyMinutes: null, schedules: [] }, ['YouTube Shorts'])).toBe(
    'Pick a daily limit or a focus time below.',
  );
  expect(focusSummary(on, [])).toBe('Pick an app below to get started.');
  expect(focusSummary({ ...on, enabled: false }, ['YouTube Shorts'])).toBe(
    'Your choices are saved for when you turn pauses on.',
  );
});

it('keeps pauses on with a quiet note and a fix when only Usage Access is off', async () => {
  jest
    .mocked(loadBlocking)
    .mockResolvedValue({ ...config, enabled: true, apps: ['youtube'], dailyMinutes: 30 });
  jest.mocked(Tracking.health).mockReturnValue({
    ...health,
    usageAccessGranted: false,
    apps: [
      {
        package: 'youtube',
        label: 'YouTube Shorts',
        installed: true,
        validated: true,
        version: '1',
      },
    ],
  } as ReturnType<typeof Tracking.health>);
  await mount();
  expect(text()).toContain('Pauses are on');
  expect(text()).toContain('Turn on Usage Access so your daily limit counts your full app time.');
  expect(control('Turn on Usage Access')).toBeDefined();
  jest
    .mocked(loadBlocking)
    .mockResolvedValue({ ...config, enabled: true, apps: [], dailyMinutes: 30 });
  await mount();
  expect(text()).toContain('Pick an app below to get started.');
  expect(text()).not.toContain('Turn on Usage Access');
});
