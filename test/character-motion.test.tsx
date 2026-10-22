/* eslint-disable @typescript-eslint/no-require-imports -- Jest module factories require lazy imports. */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Animated, AppState, type AppStateStatus } from 'react-native';
import { useCharacterExpression, EXPRESSION_TIMING } from '../src/ui/characterMotion';
import { CharacterFace } from '../src/ui/CharacterFace';

let mockReduced = false;
jest.mock('../src/ui/motion', () => ({ useReducedMotion: () => mockReduced }));
jest.mock('expo-router', () => ({
  useFocusEffect: (fn: () => void) => require('react').useEffect(fn, [fn]),
}));
function Probe({
  emotion = 'fresh',
  enabled = true,
}: {
  emotion?: Parameters<typeof useCharacterExpression>[0];
  enabled?: boolean;
}) {
  const frame = useCharacterExpression(emotion, enabled);
  return <CharacterFace emotion={emotion} {...frame} />;
}

afterEach(() => {
  jest.restoreAllMocks();
  mockReduced = false;
});
it('uses slower heavy blinks and gentler movement for drained than fresh', () => {
  expect(EXPRESSION_TIMING.drained.close).toBeGreaterThan(EXPRESSION_TIMING.fresh.close);
  expect(EXPRESSION_TIMING.drained.hold).toBeGreaterThan(EXPRESSION_TIMING.fresh.hold);
  expect(EXPRESSION_TIMING.drained.lift).toBeLessThan(EXPRESSION_TIMING.fresh.lift);
});
it('stops and restarts on background changes and cleans up on unmount', async () => {
  const start = jest.fn();
  const stop = jest.fn();
  const remove = jest.fn();
  jest.spyOn(Animated, 'loop').mockReturnValue({ start, stop, reset: jest.fn() });
  let onState: ((state: AppStateStatus) => void) | undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
    onState = callback;
    return { remove };
  });
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<Probe />);
  });
  await act(async () => {
    onState!('active');
  });
  expect(start).toHaveBeenCalled();
  await act(async () => {
    onState!('background');
  });
  expect(stop).toHaveBeenCalled();
  await act(async () => tree.unmount());
  expect(remove).toHaveBeenCalled();
});
it('does not animate still, focused or reduced-motion characters', async () => {
  const loop = jest.spyOn(Animated, 'loop');
  for (const props of [{ enabled: false }, { emotion: 'focused' as const }, {}]) {
    mockReduced = Object.keys(props).length === 0;
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(<Probe {...props} />);
    });
    await act(async () => tree.unmount());
  }
  expect(loop).not.toHaveBeenCalled();
});
