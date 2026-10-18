import type { v1 } from '@siddiq3/driftless-contracts';
import { localDateOf } from '@siddiq3/driftless-contracts/domain';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Tracking, type TrackingHealth } from 'tracking-android';
import { getDb } from '../db';
import { currentTimeZone } from '../sync/run';
import { progress, type Progress } from './progress';
import { loadGoals } from './store';

export type ProgressState =
  | { state: 'loading' }
  | { state: 'ok'; p: Progress; goals: v1.Goal[]; health: TrackingHealth; today: string }
  | { state: 'error'; message: string };

/** Reads goals + native daily data and derives outcomes, streak and Wick. Re-reads on focus. */
export function useProgress(window = 60): [ProgressState, () => void] {
  const [s, setS] = useState<ProgressState>({ state: 'loading' });
  const read = useCallback(() => {
    (async () => {
      const db = await getDb();
      const goals = await loadGoals(db);
      // Keep the native mirror in sync so goal alerts work while the app is closed.
      Tracking.setLimits(
        goals.filter((g) => g.enabled).map((g) => ({ metric: g.metric, dailyLimit: g.dailyLimit })),
      );
      Tracking.refreshUsage(7);
      const health = Tracking.health();
      const today = localDateOf(Date.now(), currentTimeZone());
      return {
        goals,
        health,
        today,
        p: progress((d) => Tracking.daily(d), health, goals, today, window),
      };
    })()
      .then((v) => setS({ state: 'ok', ...v }))
      .catch((e: unknown) =>
        setS({ state: 'error', message: e instanceof Error ? e.message : 'unknown error' }),
      );
  }, [window]);
  useFocusEffect(read);
  return [s, read];
}
