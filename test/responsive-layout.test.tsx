import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Dashboard } from '@/ui/Focus';
import { ActivityChart } from '@/activity/ActivityChart';
import type { ActivityData } from '@/activity/model';
import { ModalContent, Screen, T } from '@/ui/kit';
import { ContentViewportContext, responsiveLayout, useResponsiveLayout } from '@/ui/responsive';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn() },
  usePathname: () => '/home',
}));
jest.mock('@/ui/Icon', () => ({ Icon: () => null, iconForMark: () => 'chart' }));
jest.mock('@/goals/useProgress', () => ({ useProgress: () => [{ state: 'loading' }, jest.fn()] }));
jest.mock('@/ui/motion', () => ({ useDataMotion: () => ({}) }));
jest.mock('@/ui/BrandMark', () => ({ BrandMark: () => null }));
jest.mock('@/ui/BrainCompanion', () => ({
  BrainCompanion: ({ size }: { size: number }) =>
    require('react').createElement(require('react-native').View, {
      testID: 'today-mascot',
      accessibilityValue: { now: size },
    }),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
  useSafeAreaInsets: () => ({ top: 32, bottom: 24, left: 12, right: 12 }),
}));

let tree: ReactTestRenderer;
async function mount(content: React.ReactNode) {
  await act(async () => {
    tree = create(<>{content}</>);
  });
  return tree;
}
beforeEach(() => {
  jest
    .spyOn(require('react-native'), 'useWindowDimensions')
    .mockReturnValue({ width: 393, height: 850, scale: 3, fontScale: 1 });
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  jest.restoreAllMocks();
});

function Probe() {
  const layout = useResponsiveLayout();
  return <View testID="viewport" accessibilityValue={{ text: JSON.stringify(layout) }} />;
}

it.each([
  [320, 640, 1],
  [360, 720, 1],
  [393, 850, 1],
  [440, 950, 1],
  [360, 800, 2],
  [800, 1280, 1],
  [720, 360, 1],
])('bounds decorative art at %i × %i, font scale %f', (width, height, scale) => {
  const layout = responsiveLayout(width, height, scale);
  expect(layout.mascotSize).toBeLessThanOrEqual(width - 32);
  expect(layout.mascotSize).toBeLessThanOrEqual(180);
  expect(layout.mascotSize).toBeGreaterThanOrEqual(64);
  expect(layout.stack).toBe(width < 360 || scale > 1.3);
});

it('responds to window resizing and uses logical dp independent of pixel density', async () => {
  const window = jest.spyOn(require('react-native'), 'useWindowDimensions');
  window.mockReturnValue({ width: 393, height: 850, scale: 1, fontScale: 1 });
  await mount(<Probe />);
  const read = () =>
    JSON.parse(tree.root.findByProps({ testID: 'viewport' }).props.accessibilityValue.text);
  expect(read()).toMatchObject({ width: 369, height: 794 });
  window.mockReturnValue({ width: 393, height: 850, scale: 3, fontScale: 1 });
  await act(async () => tree.update(<Probe />));
  expect(read()).toMatchObject({ width: 369, height: 794, mascotSize: 180 });
  window.mockReturnValue({ width: 720, height: 360, scale: 3, fontScale: 2 });
  await act(async () => tree.update(<Probe />));
  expect(read()).toMatchObject({ compact: true, stack: true, mascotSize: 120 });
});

it('sizes children from the measured scroll viewport without subtracting safe areas twice', async () => {
  await mount(
    <Screen topBanner={<Text>Permission reminder</Text>}>
      <Probe />
    </Screen>,
  );
  const scroll = tree.root.findByType(ScrollView);
  expect(scroll.findAllByType(Text).some((n) => n.props.children === 'Permission reminder')).toBe(
    true,
  );
  await act(async () =>
    scroll.props.onLayout({ nativeEvent: { layout: { width: 320, height: 510 } } }),
  );
  const probe = tree.root.findByProps({ testID: 'viewport' });
  expect(JSON.parse(probe.props.accessibilityValue.text)).toMatchObject({
    width: 320,
    height: 510,
    mascotSize: 120,
  });
  const tabs = tree.root.findAll((n) => n.props.accessibilityRole === 'tab' && n.props.onPress);
  expect(tabs.map((n) => n.props.accessibilityLabel)).toEqual(['Today', 'War', 'Progress']);
  expect(scroll.findAll((n) => n.props.accessibilityRole === 'tab')).toHaveLength(0);
  await act(async () => tabs[1]!.props.onPress());
  expect(router.replace).toHaveBeenCalledWith('/friends');
});

it('updates art when measured space changes after system UI or rotation', async () => {
  await mount(
    <ContentViewportContext.Provider value={{ width: 393, height: 800 }}>
      <Probe />
    </ContentViewportContext.Provider>,
  );
  expect(
    JSON.parse(tree.root.findByProps({ testID: 'viewport' }).props.accessibilityValue.text)
      .mascotSize,
  ).toBe(180);
  await act(async () =>
    tree.update(
      <ContentViewportContext.Provider value={{ width: 393, height: 450 }}>
        <Probe />
      </ContentViewportContext.Provider>,
    ),
  );
  expect(
    JSON.parse(tree.root.findByProps({ testID: 'viewport' }).props.accessibilityValue.text)
      .mascotSize,
  ).toBe(120);
});

it('keeps overflowing dialog content scrollable and close controls reachable', async () => {
  const close = jest.fn();
  await mount(
    <ModalContent onClose={close}>
      <T>{'Long invitation text '.repeat(100)}</T>
    </ModalContent>,
  );
  const scroll = tree.root.findByType(ScrollView);
  expect(StyleSheet.flatten(scroll.props.style)).toMatchObject({
    maxHeight: '90%',
    flexGrow: 0,
    maxWidth: 560,
  });
  expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
  await act(async () =>
    tree.root
      .findAll((n) => n.props.accessibilityLabel === 'Dismiss dialog' && n.props.onPress)[0]!
      .props.onPress(),
  );
  expect(close).toHaveBeenCalledTimes(1);
  expect(tree.root.findByType(KeyboardAvoidingView).props.behavior).toBe('padding');
});

it('preserves accessible typography with wrapping instead of fitting text to device pixels', async () => {
  await mount(<T v="title">A heading that needs several lines</T>);
  const text = tree.root.findByType(Text);
  expect(text.props.allowFontScaling).not.toBe(false);
  expect(text.props.numberOfLines).toBeUndefined();
  expect(StyleSheet.flatten(text.props.style)).toMatchObject({
    fontSize: 24,
    lineHeight: 30,
    flexShrink: 1,
    minWidth: 0,
  });
});

it('keeps a matching line height when a branded component overrides its text size', async () => {
  await mount(<T style={{ fontSize: 28 }}>123,456</T>);
  expect(StyleSheet.flatten(tree.root.findByType(Text).props.style).lineHeight).toBeGreaterThan(28);
});

it('keeps Today artwork compact after the content viewport shrinks and preserves Focus navigation', async () => {
  await mount(<Dashboard />);
  const scroll = tree.root.findByType(ScrollView);
  await act(async () =>
    scroll.props.onLayout({ nativeEvent: { layout: { width: 320, height: 510 } } }),
  );
  expect(tree.root.findByProps({ testID: 'today-mascot' }).props.accessibilityValue.now).toBe(120);
  await act(async () =>
    tree.root
      .findAll((n) => n.props.accessibilityLabel === 'Focus and app pauses' && n.props.onPress)[0]!
      .props.onPress(),
  );
  expect(router.push).toHaveBeenCalledWith('/blocking');
});

it('gives large-font charts scrollable space while retaining exact accessible values and gaps', async () => {
  jest
    .spyOn(require('react-native'), 'useWindowDimensions')
    .mockReturnValue({ width: 320, height: 640, scale: 3, fontScale: 2 });
  const data: ActivityData = {
    from: '2026-10-26',
    to: '2026-11-01',
    dates: ['2026-10-26'],
    views: { value: 123456, days: 1 },
    minutes: { value: null, days: 0 },
    apps: [],
    hourlyAvailable: false,
    hourlyUnavailableReason: null,
    expectedDays: 1,
    bars: [
      { key: '1', label: 'Mon', value: 123456 },
      { key: '2', label: 'Tue', value: null },
    ],
  };
  await mount(<ActivityChart data={data} period="weekly" />);
  const scroll = tree.root.findByType(ScrollView);
  expect(scroll.props.horizontal).toBe(true);
  expect(
    tree.root.findAll((n) => n.props.accessibilityLabel === 'Mon: 123456 short videos').length,
  ).toBeGreaterThan(0);
  expect(
    tree.root.findAll((n) => n.props.accessibilityLabel === 'Tue: not recorded').length,
  ).toBeGreaterThan(0);
});

it.each([
  ['daily', 24, 1],
  ['weekly', 7, 1],
  ['daily', 24, 2],
  ['weekly', 7, 2],
] as const)(
  'keeps the full %s chart with %i buckets reachable at font scale %f',
  async (period, count, fontScale) => {
    jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
      width: 320,
      height: 640,
      scale: 3,
      fontScale,
    });
    const data: ActivityData = {
      from: '2026-10-28',
      to: '2026-10-28',
      dates: ['2026-10-28'],
      views: { value: 25, days: 1 },
      minutes: { value: 13, days: 1 },
      apps: [],
      hourlyAvailable: period === 'daily',
      hourlyUnavailableReason: null,
      expectedDays: 1,
      bars: Array.from({ length: count }, (_, index) => ({
        key: String(index),
        label: String(index),
        value: index === count - 2 ? 4 : index === count - 1 ? 21 : 0,
      })),
    };
    await mount(<ActivityChart data={data} period={period} />);
    const chart = tree.root.findByProps({ testID: 'activity-chart-content' });
    // Available width on a 320dp phone after page (20dp) and chart (18dp) gutters.
    const viewportWidth = 320 - 2 * 20 - 2 * 18;
    if (fontScale === 1) expect(chart.props.style.minWidth).toBeLessThanOrEqual(viewportWidth);
    else expect(chart.props.style.minWidth).toBeGreaterThan(viewportWidth);
    expect(
      chart.findAllByProps({ accessibilityLabel: `${count - 1}: 21 short videos` }).length,
    ).toBeGreaterThan(0);
    expect(
      chart.findAllByProps({ accessibilityLabel: `${count - 2}: 4 short videos` }).length,
    ).toBeGreaterThan(0);
  },
);
