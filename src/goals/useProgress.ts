import type { v1 } from '@siddiq3/driftless-contracts';
import { localDateOf } from '@siddiq3/driftless-contracts/domain';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { Tracking, type Daily, type TrackingHealth } from 'tracking-android';
import { getDb } from '../db';
import { currentAccountTime, currentTimeZone } from '../sync/run';
import { progress, type Progress } from './progress';
import { loadGoals } from './store';
import { personalDay, personalRawDay, refreshPersonalData } from '@/data/personal';
import { entitlementGeneration } from '@/billing/cache';
import { observeStorage, storageScope, storageGeneration } from '@/db/scope';

export type ProgressState =
  | { state: 'loading' }
  | {
      state: 'ok';
      p: Progress;
      goals: v1.Goal[];
      health: TrackingHealth;
      today: string;
      daily: Daily;
      refreshing?: boolean;
      error?: string | null;
    }
  | { state: 'error'; message: string };

type Loaded = Extract<ProgressState, { state: 'ok' }>;
const snapshots = new Map<string, Loaded>();
const pending = new Map<string, Promise<Loaded | null>>();
let owner = '';
function snapshotKey(window: number, live: boolean) {
  let reset = 0;
  try {
    reset = Tracking.accountUsageInfo().resetGeneration;
  } catch {
    /* Older binaries. */
  }
  const identity = `${storageScope()}:${entitlementGeneration()}:${reset}`;
  if (identity !== owner) {
    snapshots.clear();
    owner = identity;
  }
  return `${identity}:${window}:${live}:${localDateOf(currentAccountTime(), currentTimeZone())}`;
}

/** Retain display snapshots across tab remounts; SQLite remains the source of truth. */
export function useProgress(
  window = 60,
  live = false,
): [
  ProgressState,
  () => void,
  {
    initialLoading: boolean;
    refreshing: boolean;
    error: string | null;
  },
] {
  const key = snapshotKey(window, live);
  const [stored, setStored] = useState<{ key: string; value: ProgressState }>(() => ({
    key,
    value: snapshots.get(key) ?? { state: 'loading' },
  }));
  const generation = useRef(0);
  const history = useRef({ key: '', days: new Map<string, Daily>() });
  const read = useCallback(
    function readSnapshot() {
      const request = ++generation.current;
      const currentKey = snapshotKey(window, live);
      setStored((previous) => {
        const value = previous.key === currentKey ? previous.value : snapshots.get(currentKey);
        return {
          key: currentKey,
          value:
            value?.state === 'ok'
              ? { ...value, refreshing: true, error: null }
              : { state: 'loading' },
        };
      });
      let task = pending.get(currentKey);
      if (!task) {
        const scope = storageScope();
        const revision = storageGeneration();
        task = (async (): Promise<Loaded | null> => {
          const db = await getDb();
          const goals = await loadGoals(db);
          if (scope !== storageScope() || revision !== storageGeneration()) return null;
          Tracking.setLimits(
            goals
              .filter((g) => g.enabled)
              .map((g) => ({ metric: g.metric, dailyLimit: g.dailyLimit })),
          );
          const today = localDateOf(currentAccountTime(), currentTimeZone());
          const fullRead =
            !live || history.current.key !== currentKey || history.current.days.size === 0;
          refreshPersonalData(fullRead ? 7 : 1);
          Tracking.refreshCountWidget();
          const health = Tracking.health();
          const samples = fullRead ? new Map<string, Daily>() : new Map(history.current.days);
          samples.set(today, personalRawDay(today));
          const readDay = (date: string) => {
            if (!samples.has(date)) samples.set(date, personalRawDay(date));
            return samples.get(date)!;
          };
          const p = progress(readDay, health, goals, today, window, personalDay);
          history.current = { key: currentKey, days: samples };
          if (currentKey !== snapshotKey(window, live) || revision !== storageGeneration())
            return null;
          const value: Loaded = {
            state: 'ok',
            goals,
            health,
            today,
            daily: personalRawDay(today),
            p,
            refreshing: false,
            error: null,
          };
          snapshots.set(currentKey, value);
          if (snapshots.size > 8) snapshots.delete(snapshots.keys().next().value!);
          return value;
        })().finally(() => {
          pending.delete(currentKey);
        });
        pending.set(currentKey, task);
      }
      void task
        .then((value) => {
          if (request !== generation.current || currentKey !== snapshotKey(window, live)) return;
          if (value) setStored({ key: currentKey, value });
          else readSnapshot(); // A storage change during the read needs one fresh pass.
        })
        .catch((error: unknown) => {
          if (request !== generation.current || currentKey !== snapshotKey(window, live)) return;
          const message =
            error instanceof Error ? error.message : 'Activity could not be refreshed';
          setStored((previous) => ({
            key: currentKey,
            value:
              previous.key === currentKey && previous.value.state === 'ok'
                ? { ...previous.value, refreshing: false, error: message }
                : { state: 'error', message },
          }));
        });
    },
    [window, live],
  );
  useFocusEffect(
    useCallback(() => {
      history.current.days.clear();
      read();
      const unsubscribe = observeStorage(() => {
        history.current.days.clear();
        read();
      });
      const timer = live
        ? setInterval(() => {
            if (AppState.currentState === 'active') read();
          }, 10_000)
        : undefined;
      const sub = AppState.addEventListener('change', (state) => {
        if (state === 'active') read();
      });
      return () => {
        unsubscribe();
        generation.current++;
        clearInterval(timer);
        sub.remove();
      };
    }, [read, live]),
  );
  const state =
    stored.key === key ? stored.value : (snapshots.get(key) ?? { state: 'loading' as const });
  return [
    state,
    read,
    {
      initialLoading: state.state === 'loading',
      refreshing: state.state === 'ok' && Boolean(state.refreshing),
      error:
        state.state === 'error'
          ? state.message
          : state.state === 'ok'
            ? (state.error ?? null)
            : null,
    },
  ];
}
