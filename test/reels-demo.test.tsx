import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AppState, type AppStateStatus } from 'react-native';
// Exercise the Android native video; Jest's default platform resolves .ios first.
const { ReelsDemo } = require('../src/onboarding/ReelsDemo.tsx');
import { useReducedMotion } from '@/ui/motion';

jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]),
}));
jest.mock('expo', () => ({ requireNativeView: () => 'ReelsVideo' }));
jest.mock('@/ui/motion', () => ({ useReducedMotion: jest.fn(() => false) }));
let tree: ReactTestRenderer;
let listener: (state: AppStateStatus) => void;
const playing = () => tree.root.findByType('ReelsVideo' as never).props.playing;
beforeEach(() => {
  (useReducedMotion as jest.Mock).mockReturnValue(false);
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, callback) => {
    listener = callback;
    return { remove: jest.fn() };
  });
});
afterEach(async () => {
  await act(async () => tree.unmount());
  jest.restoreAllMocks();
});
it('plays the reels MP4 when focused and pauses in background', async () => {
  await act(async () => {
    tree = create(<ReelsDemo height={400} />);
  });
  expect(tree.root.findByType('ReelsVideo' as never).props.source).toBe('reels');
  expect(playing()).toBe(true);
  await act(async () => listener('background'));
  expect(playing()).toBe(false);
  await act(async () => listener('active'));
  expect(playing()).toBe(true);
});
it('keeps the poster still when reduced motion is enabled', async () => {
  (useReducedMotion as jest.Mock).mockReturnValue(true);
  await act(async () => {
    tree = create(<ReelsDemo height={400} />);
  });
  expect(playing()).toBe(false);
});
