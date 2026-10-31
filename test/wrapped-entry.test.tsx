import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AppState, Modal } from 'react-native';
import { router } from 'expo-router';
import { WrapEntry } from '@/wrapped/Entry';
import { defaultEnd, readPhoneWrap } from '@/wrapped/model';
import { observeStorage, storageScope } from '@/db/scope';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]),
}));
jest.mock('@/db/scope', () => ({
  observeStorage: jest.fn(() => jest.fn()),
  storageScope: jest.fn(() => 'guest:current'),
}));
jest.mock('tracking-android', () => ({ Tracking: {} }));
jest.mock('@/sync/run', () => ({ currentTimeZone: () => 'UTC' }));
jest.mock('@/wrapped/model', () => ({
  ...jest.requireActual('@/wrapped/model'),
  defaultEnd: jest.fn(),
  readPhoneWrap: jest.fn(),
}));
jest.mock('@/ui/responsive', () => ({ useResponsiveLayout: () => ({ stack: false }) }));
jest.mock('@/ui/Icon', () => ({ Icon: () => null }));
jest.mock('@/ui/kit', () => ({
  T: ({ children }: { children: React.ReactNode }) =>
    require('react').createElement(require('react-native').Text, null, children),
  useTheme: () => ({ surfaceRaised: '#201B16' }),
}));
let root: ReactTestRenderer;
let data: Record<
  string,
  {
    views: { value: number | null; trackedDays: number };
    minutes: { value: number | null; trackedDays: number };
  }
>;
const unknown = {
  views: { value: null, trackedDays: 0 },
  minutes: { value: null, trackedDays: 0 },
};
const measured = { ...unknown, views: { value: 0, trackedDays: 1 } };
const buttons = () =>
  root.root.findAll(
    (node) => typeof node.props.onPress === 'function' && node.props.accessibilityRole === 'button',
  );
beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  data = { daily: unknown, weekly: unknown };
  jest.mocked(storageScope).mockReturnValue('guest:current');
  jest
    .mocked(defaultEnd)
    .mockImplementation((period) => (period === 'daily' ? '2026-10-26' : '2026-10-25'));
  jest
    .mocked(readPhoneWrap)
    .mockImplementation((period) => data[period] as ReturnType<typeof readPhoneWrap>);
});
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  jest.useRealTimers();
  jest.restoreAllMocks();
});
async function mount() {
  await act(async () => {
    root = create(<WrapEntry />);
  });
}

test('hides the wrap button when yesterday has no measurements', async () => {
  await mount();
  expect(root.toJSON()).toBeNull();
});
test('shows only ready periods and never mounts an in-app wrap popup', async () => {
  data.daily = measured;
  await mount();
  expect(buttons().map((node) => node.props.accessibilityLabel)).toEqual(['Open your daily wrap']);
  expect(root.root.findAllByType(Modal)).toHaveLength(0);
  await act(async () => buttons()[0]!.props.onPress());
  expect(router.push).toHaveBeenCalledWith({
    pathname: '/wrapped',
    params: { end: '2026-10-26' },
  });
});
test('weekly data never adds a weekly wrap', async () => {
  data.weekly = measured;
  await mount();
  expect(root.toJSON()).toBeNull();
});
test('returning from a feed refreshes availability and a failed period read stays hidden', async () => {
  const listen = jest.spyOn(AppState, 'addEventListener');
  await mount();
  data.daily = measured;
  await act(async () => listen.mock.calls[0]![1]('active'));
  expect(buttons()).toHaveLength(1);
  jest.mocked(readPhoneWrap).mockImplementation(() => {
    throw new Error('unavailable');
  });
  await act(async () => jest.advanceTimersByTime(60_000));
  expect(root.toJSON()).toBeNull();
});
test('switching accounts removes ready buttons from the previous dataset', async () => {
  data.daily = measured;
  await mount();
  jest.mocked(storageScope).mockReturnValue('account:new');
  data = { daily: unknown, weekly: unknown };
  await act(async () => jest.mocked(observeStorage).mock.calls[0]![0]());
  expect(root.toJSON()).toBeNull();
});
