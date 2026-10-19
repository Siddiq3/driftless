import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Share, TurboModuleRegistry } from 'react-native';
import * as Sharing from 'expo-sharing';
import { WrapStories } from '@/wrapped/Stories';
import type { Recap } from '@/wrapped/model';
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useFocusEffect: jest.fn(),
}));
jest.mock('expo-font', () => ({ useFonts: () => [false] }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/ui/motion', () => ({ useReducedMotion: () => true, useDataMotion: () => ({}) }));
jest.mock('@/ui/BrainCharacter', () => ({ BrainCharacter: () => null }));
jest.mock('@/ui/Icon', () => ({ AppIcon: () => null, Icon: () => null }));
jest.mock('@/onboarding/Visuals', () => ({ SetupButton: () => null }));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('react-native-view-shot', () => ({
  captureRef: jest.fn().mockResolvedValue('file:///temporary.png'),
  releaseCapture: jest.fn(),
}));
jest.mock('tracking-android', () => ({ Tracking: {} }));
jest.mock('@/sync/run', () => ({ currentTimeZone: () => 'UTC' }));
const recap: Recap = {
  period: 'daily',
  source: 'phone',
  from: '2026-10-18',
  to: '2026-10-18',
  previousFrom: '2026-10-17',
  previousTo: '2026-10-17',
  expectedDays: 1,
  views: { value: null, trackedDays: 0 },
  minutes: { value: null, trackedDays: 0 },
  previousViews: { value: null, trackedDays: 0 },
  changePercent: null,
  apps: [],
  hours: null,
  sessions: [],
  returnCount: 0,
};
async function mount(data = recap) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<WrapStories recap={data} />);
  });
  return tree;
}
const button = (tree: ReactTestRenderer, label: string) =>
  tree.root.findAll(
    (n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function',
  )[0]!;
afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});
test.each(['daily', 'weekly'] as const)(
  '%s recaps keep six core slides with unavailable metrics',
  async (period) => {
    const tree = await mount({ ...recap, period, expectedDays: period === 'weekly' ? 7 : 1 });
    expect(button(tree, 'Previous story').props.disabled).toBe(true);
    for (let i = 1; i < 6; i++) {
      expect(button(tree, 'Next story')).toBeDefined();
      await act(async () => button(tree, 'Next story').props.onPress());
    }
    expect(button(tree, 'Next story')).toBeUndefined();
    expect(button(tree, 'Finish Wrapped')).toBeDefined();
    await act(async () => tree.unmount());
  },
);
test.each(['phone', 'synced'] as const)(
  '%s partial totals still include six core slides',
  async (source) => {
    const tree = await mount({
      ...recap,
      source,
      period: 'weekly',
      expectedDays: 7,
      views: { value: 20, trackedDays: 1 },
    });
    for (let i = 1; i < 6; i++) await act(async () => button(tree, 'Next story').props.onPress());
    expect(button(tree, 'Finish Wrapped')).toBeDefined();
    await act(async () => tree.unmount());
  },
);
test('complete measurements add personality and comparison for eight slides', async () => {
  const tree = await mount({
    ...recap,
    views: { value: 100, trackedDays: 1 },
    changePercent: -50,
    hours: Array.from({ length: 24 }, (_, i) => (i === 20 ? 100 : 0)),
    apps: [{ package: 'instagram', label: 'Instagram', views: 100 }],
    sessions: [
      {
        package: 'instagram',
        startMs: 0,
        endMs: 120000,
        startMinute: 1200,
        endMinute: 1202,
        views: 100,
      },
    ],
  });
  for (let i = 1; i < 8; i++) {
    expect(button(tree, 'Next story')).toBeDefined();
    await act(async () => button(tree, 'Next story').props.onPress());
  }
  expect(button(tree, 'Next story')).toBeUndefined();
  expect(button(tree, 'Finish Wrapped')).toBeDefined();
  await act(async () => tree.unmount());
});
test('older binaries share an honest text summary without requiring login', async () => {
  jest.spyOn(TurboModuleRegistry, 'get').mockReturnValue(null);
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.dismissedAction });
  const tree = await mount();
  await act(async () => button(tree, 'Share this Wrapped card').props.onPress());
  expect(share).toHaveBeenCalledWith({
    message: expect.stringContaining('No confirmed counts yet'),
  });
  expect(Sharing.shareAsync).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});
test('image sharing releases temporary captures even if the share sheet fails', async () => {
  jest.spyOn(TurboModuleRegistry, 'get').mockReturnValue({} as never);
  (Sharing.shareAsync as jest.Mock).mockRejectedValueOnce(new Error('cancel/failure'));
  const tree = await mount();
  await act(async () => button(tree, 'Share this Wrapped card').props.onPress());
  expect(Sharing.shareAsync).toHaveBeenCalledWith(
    'file:///temporary.png',
    expect.objectContaining({ mimeType: 'image/png' }),
  );
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  expect(require('react-native-view-shot').releaseCapture).toHaveBeenCalledWith(
    'file:///temporary.png',
  );
  expect(JSON.stringify(tree.toJSON())).toContain('Sharing failed');
  await act(async () => tree.unmount());
});
