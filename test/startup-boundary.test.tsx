import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { getStorageDb } from '@/db';
import { StartupBoundary } from '@/startup/StartupBoundary';

let mockSession = 'loading';
let mockSessionStarted = false;
jest.mock('@/auth/session', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => {
    require('react').useEffect(() => {
      mockSessionStarted = true;
    }, []);
    return children;
  },
  useSession: () => ({ status: mockSession }),
}));
jest.mock('@/db', () => ({ getStorageDb: jest.fn() }));
jest.mock('@/ui/StartupScreen', () => ({
  StartupScreen: ({ message }: { message: string }) =>
    require('react').createElement(require('react-native').Text, null, message),
}));
jest.mock('@/ui/kit', () => ({
  Screen: require('react-native').View,
  Notice: ({ body }: { body: string }) =>
    require('react').createElement(require('react-native').Text, null, body),
  Button: ({ label, onPress }: { label: string; onPress: () => void }) =>
    require('react').createElement(require('react-native').Pressable, {
      accessibilityLabel: label,
      onPress,
    }),
}));
let root: ReactTestRenderer;
const content = () => (
  <StartupBoundary env={null}>
    <Text>Ready Home</Text>
  </StartupBoundary>
);
beforeEach(() => {
  jest.clearAllMocks();
  mockSession = 'loading';
  mockSessionStarted = false;
});
afterEach(async () => {
  if (root) await act(async () => root.unmount());
});
it('starts session preparation while storage opens, and waits for both before exposing Home', async () => {
  let finish!: () => void;
  jest.mocked(getStorageDb).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = () => resolve({} as never);
      }),
  );
  await act(async () => {
    root = create(content());
  });
  expect(mockSessionStarted).toBe(true);
  expect(getStorageDb).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(root.toJSON())).not.toContain('Ready Home');
  await act(async () => finish());
  expect(JSON.stringify(root.toJSON())).toContain('Restoring your sign-in');
  mockSession = 'signedIn';
  await act(async () => root.update(content()));
  expect(JSON.stringify(root.toJSON())).toContain('Ready Home');
});
it('retains retry for a local storage failure', async () => {
  jest
    .mocked(getStorageDb)
    .mockRejectedValueOnce(new Error('storage failure'))
    .mockResolvedValueOnce({} as never);
  mockSession = 'signedOut';
  await act(async () => {
    root = create(content());
  });
  expect(JSON.stringify(root.toJSON())).toContain('Saved phone data could not be opened');
  await act(async () => root.root.findByProps({ accessibilityLabel: 'Retry' }).props.onPress());
  expect(JSON.stringify(root.toJSON())).toContain('Ready Home');
});
