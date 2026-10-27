import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AppState, Image } from 'react-native';
import { UpdatingMascot } from '@/updates/UpdatingMascot';
let mockReduced = false;
jest.mock('@/ui/motion', () => ({ useReducedMotion: () => mockReduced }));
let root: ReactTestRenderer;
const originalAppState = AppState.currentState;
const frame = () => root.root.findByType(Image).props.style;
beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockReduced = false;
  AppState.currentState = 'active';
});
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  AppState.currentState = originalAppState;
  jest.useRealTimers();
  jest.restoreAllMocks();
});
async function mount() {
  await act(async () => {
    root = create(<UpdatingMascot size={224} />);
  });
}
test('plays all four poses and returns to the first pose without remounting the image', async () => {
  await mount();
  const first = frame();
  const positions = new Set<string>();
  for (let index = 0; index < 4; index++) {
    positions.add(`${frame().left},${frame().top}`);
    await act(async () => jest.advanceTimersByTime(450));
  }
  expect(positions.size).toBe(4);
  expect(frame()).toEqual(first);
});
test('reduced motion keeps the updating mascot still', async () => {
  mockReduced = true;
  await mount();
  const first = frame();
  await act(async () => jest.advanceTimersByTime(5000));
  expect(frame()).toEqual(first);
});
test('backgrounding pauses the mascot and foregrounding resumes it', async () => {
  const listen = jest.spyOn(AppState, 'addEventListener');
  await mount();
  await act(async () => listen.mock.calls[0]![1]('background'));
  const paused = frame();
  await act(async () => jest.advanceTimersByTime(5000));
  expect(frame()).toEqual(paused);
  await act(async () => listen.mock.calls[0]![1]('active'));
  await act(async () => jest.advanceTimersByTime(450));
  expect(frame()).not.toEqual(paused);
});
