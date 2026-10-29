import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ScreenTime } from '../modules/screen-time/src';
import { ScreenTimeScreen } from '../src/ios/ScreenTimeScreen';

jest.mock('../modules/screen-time/src', () => ({
  ScreenTime: {
    supported: () => true,
    isSimulator: jest.fn(() => false),
    status: jest.fn(),
    authorize: jest.fn(),
    chooseApps: jest.fn(),
    setPaused: jest.fn(),
  },
}));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: () => true },
  useFocusEffect: (fn: () => void) => require('react').useEffect(fn, [fn]),
}));
jest.mock('@/ui/BrandMark', () => ({ BrandMark: () => null }));
jest.mock('@/ui/kit', () => {
  const { View, Text, Pressable } = require('react-native');
  return {
    Screen: View,
    Section: View,
    T: Text,
    Notice: ({ body }: { body: string }) => <Text>{body}</Text>,
    Button: ({ label, onPress }: { label: string; onPress: () => void }) => (
      <Pressable accessibilityLabel={label} onPress={onPress} />
    ),
  };
});
let tree: ReactTestRenderer;
let status: ReturnType<typeof ScreenTime.status>;
const button = (label: string) =>
  tree.root.findAll(
    (n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function',
  )[0];
async function tap(label: string) {
  await act(async () => {
    await button(label)!.props.onPress();
  });
}
beforeEach(async () => {
  jest.clearAllMocks();
  jest.mocked(ScreenTime.isSimulator).mockReturnValue(false);
  status = { authorization: 'notDetermined', selectedCount: 0, paused: false };
  jest.mocked(ScreenTime.status).mockImplementation(() => ({ ...status }));
  jest.mocked(ScreenTime.authorize).mockImplementation(async () => {
    status.authorization = 'approved';
  });
  jest.mocked(ScreenTime.chooseApps).mockImplementation(async () => {
    status.selectedCount = 2;
  });
  jest.mocked(ScreenTime.setPaused).mockImplementation(async (paused) => {
    status.paused = paused;
  });
  await act(async () => {
    tree = create(<ScreenTimeScreen />);
  });
});
afterEach(async () => {
  await act(async () => tree.unmount());
});

test('authorization and private app selection precede pause/resume', async () => {
  expect(button('Pause selected apps')).toBeUndefined();
  expect(button('Choose apps')).toBeUndefined();
  await tap('Allow Screen Time access');
  expect(button('Pause selected apps')).toBeUndefined();
  await tap('Choose apps');
  await tap('Pause selected apps');
  expect(ScreenTime.setPaused).toHaveBeenLastCalledWith(true);
  await tap('Resume apps');
  expect(ScreenTime.setPaused).toHaveBeenLastCalledWith(false);
});

test('authorization failure is visible and does not reveal pause controls', async () => {
  jest.mocked(ScreenTime.authorize).mockRejectedValueOnce(new Error('Access denied'));
  await tap('Allow Screen Time access');
  expect(JSON.stringify(tree.toJSON())).toContain('Access denied');
  expect(button('Pause selected apps')).toBeUndefined();
  expect(ScreenTime.chooseApps).not.toHaveBeenCalled();
});

test('simulator explains physical-device testing without offering a failing permission prompt', async () => {
  jest.mocked(ScreenTime.isSimulator).mockReturnValue(true);
  await act(async () => tree.update(<ScreenTimeScreen embedded />));
  expect(button('Allow Screen Time access')).toBeUndefined();
  expect(button('Back')).toBeUndefined();
  expect(JSON.stringify(tree.toJSON())).toContain('physical iPhone');
  expect(ScreenTime.authorize).not.toHaveBeenCalled();
});
