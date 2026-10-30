import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AppState } from 'react-native';
import { useProgress, type ProgressState } from '@/goals/useProgress';
import { Tracking, type TrackingHealth } from 'tracking-android';
import { getDb } from '@/db';
import { loadGoals } from '@/goals/store';
import { selectStorageScope, publishLocalChange } from '@/db/scope';
let mockFocused = true;
jest.mock('expo-router', () => ({
  useFocusEffect: (fn: () => () => void) =>
    require('react').useEffect(() => (mockFocused ? fn() : undefined), [fn, mockFocused]),
}));
jest.mock('@/db', () => ({ getDb: jest.fn() }));
jest.mock('@/goals/store', () => ({ loadGoals: jest.fn() }));
jest.mock('@/sync/run', () => ({
  currentTimeZone: () => 'UTC',
  currentAccountTime: () => Date.now(),
}));
jest.mock('tracking-android', () => ({
  Tracking: {
    accountUsageInfo: jest.fn(),
    daily: jest.fn(),
    health: jest.fn(),
    refreshUsage: jest.fn(),
    refreshCountWidget: jest.fn(),
    setLimits: jest.fn(),
  },
}));
let tree: ReactTestRenderer;
let state: ProgressState;
let status: { initialLoading: boolean; refreshing: boolean; error: string | null };
let refresh: () => void;
const states: ProgressState[] = [];
function Probe({ tick: _tick = 0 }) {
  [state, refresh, status] = useProgress(2, true);
  states.push(state);
  return null;
}
let scope = 0,
  count = 12;
const today = () => new Date(Date.now()).toISOString().slice(0, 10);
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-30T12:00:00Z'));
  jest.clearAllMocks();
  mockFocused = true;
  count = 12;
  states.length = 0;
  selectStorageScope(`guest:swr-${++scope}`);
  jest.mocked(getDb).mockResolvedValue({} as never);
  jest.mocked(loadGoals).mockReset().mockResolvedValue([]);
  jest.mocked(Tracking.accountUsageInfo).mockReturnValue({ resetGeneration: 0 } as never);
  jest.mocked(Tracking.health).mockReturnValue({
    usageAccessGranted: true,
    apps: [{ package: 'com.instagram.android', installed: true, validated: false }],
  } as TrackingHealth);
  jest.mocked(Tracking.daily).mockImplementation((date) => ({
    localDate: date!,
    heartbeatMinutes: 1,
    coverage: 1,
    apps: [
      {
        package: 'com.instagram.android',
        views: date === today() ? count : 0,
        adViews: 0,
        usageMs: 60000,
        surfaceMs: 1000,
        unknownMs: 0,
      },
    ],
  }));
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  jest.useRealTimers();
  jest.restoreAllMocks();
});
async function mount() {
  await act(async () => {
    tree = create(<Probe />);
  });
}
async function focus(value: boolean) {
  mockFocused = value;
  await act(async () => {
    tree.update(<Probe tick={Date.now()} />);
  });
}
function expectCount(value: number) {
  expect(state.state).toBe('ok');
  if (state.state === 'ok') expect(state.p.today.views).toBe(value);
}
it('shows initial loading only before the first SQLite read and supports a measured zero', async () => {
  count = 0;
  let resolve!: (value: never[]) => void;
  jest.mocked(loadGoals).mockReturnValueOnce(
    new Promise((r) => {
      resolve = r;
    }),
  );
  await mount();
  expect(status.initialLoading).toBe(true);
  expect(state.state).toBe('loading');
  await act(async () => {
    resolve([]);
  });
  expectCount(0);
  expect(status.initialLoading).toBe(false);
});
it('keeps counts during storage notifications and errors, reloads goals, and retries successfully', async () => {
  await mount();
  expectCount(12);
  states.length = 0;
  let reject!: (error: Error) => void;
  jest.mocked(loadGoals).mockReturnValueOnce(
    new Promise((_r, fail) => {
      reject = fail;
    }),
  );
  await act(async () => {
    publishLocalChange();
  });
  expectCount(12);
  expect(status.refreshing).toBe(true);
  await act(async () => {
    reject(new Error('SQLite temporarily unavailable'));
  });
  expectCount(12);
  expect(status.error).toContain('SQLite');
  expect(states.every((s) => s.state === 'ok')).toBe(true);
  count = 20;
  await act(async () => {
    refresh();
  });
  expectCount(20);
  expect(status.error).toBeNull();
});
it('reuses the ten-second activity cache across tab remounts while reloading goals', async () => {
  await mount();
  const reads = jest.mocked(Tracking.daily).mock.calls.length;
  count = 99;
  for (let i = 0; i < 3; i++) {
    await act(async () => tree.unmount());
    await mount();
    expectCount(12);
  }
  expect(Tracking.daily).toHaveBeenCalledTimes(reads);
  expect(loadGoals).toHaveBeenCalledTimes(4);
  jest.setSystemTime(new Date('2026-10-30T12:00:10Z'));
  await act(async () => tree.unmount());
  states.length = 0;
  await mount();
  expectCount(99);
  expect(states[0]?.state).toBe('ok');
  if (states[0]?.state === 'ok') expect(states[0].p.today.views).toBe(12);
  expect(states.every((s) => s.state === 'ok')).toBe(true);
});
it('joins an unfinished read across blur/remount and ignores completion for an old scope', async () => {
  await mount();
  let resolve!: (value: never[]) => void;
  jest.mocked(loadGoals).mockReturnValueOnce(
    new Promise((r) => {
      resolve = r;
    }),
  );
  await act(async () => {
    refresh();
    refresh();
  });
  expect(loadGoals).toHaveBeenCalledTimes(2);
  await focus(false);
  await focus(true);
  expect(loadGoals).toHaveBeenCalledTimes(2);
  await act(async () => {
    selectStorageScope(`guest:other-${scope}`);
    count = 3;
    tree.update(<Probe tick={1} />);
    refresh();
  });
  await act(async () => {
    resolve([]);
  });
  expectCount(3);
});
it('refreshes silently on expiry and removes polling/subscriptions while blurred', async () => {
  await mount();
  states.length = 0;
  count = 25;
  await act(async () => {
    await jest.advanceTimersByTimeAsync(10000);
  });
  expectCount(25);
  expect(states.every((s) => s.state === 'ok')).toBe(true);
  await focus(false);
  const reads = jest.mocked(loadGoals).mock.calls.length;
  await act(async () => {
    publishLocalChange();
    await jest.advanceTimersByTimeAsync(30000);
  });
  expect(loadGoals).toHaveBeenCalledTimes(reads);
});
it('reads persisted SQLite activity when no display snapshot exists after a scope reset', async () => {
  await mount();
  jest.mocked(Tracking.accountUsageInfo).mockReturnValue({ resetGeneration: 1 } as never);
  count = 7;
  await act(async () => {
    publishLocalChange();
  });
  expectCount(7);
  expect(states.some((s) => s.state === 'loading')).toBe(true);
});

it('keeps initial errors separate from loading and never invents zero for unrecorded activity', async () => {
  jest.mocked(loadGoals).mockRejectedValueOnce(new Error('Storage unavailable'));
  await mount();
  expect(state.state).toBe('error');
  expect(status.initialLoading).toBe(false);
  expect(status.error).toBe('Storage unavailable');
  jest.mocked(Tracking.daily).mockImplementation((localDate) => ({
    localDate: localDate!,
    apps: [],
    heartbeatMinutes: 0,
    coverage: 0,
  }));
  await act(async () => {
    refresh();
  });
  expect(state.state).toBe('ok');
  if (state.state === 'ok') expect(state.p.today.views).toBeNull();
});
