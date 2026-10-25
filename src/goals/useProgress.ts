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
import { observeStorage, storageScope } from '@/db/scope';

export type ProgressState =
  | { state: 'loading' }
  | {
      state: 'ok';
      p: Progress;
      goals: v1.Goal[];
      health: TrackingHealth;
      today: string;
      daily: Daily;
    }
  | { state: 'error'; message: string };

/** Reads goals + native daily data and derives outcomes, streak and Wick. Re-reads on focus. */
export function useProgress(window = 60, live = false): [ProgressState, () => void] {
  const [s, setS] = useState<ProgressState>({ state: 'loading' });
  const generation = useRef(0);
  const history = useRef({ today: '', days: new Map<string, Daily>() });
  const read = useCallback(() => {
    const request = ++generation.current;
    (async () => {
      const scope = storageScope();
      const db = await getDb();
      const goals = await loadGoals(db);
      if (request !== generation.current) return null;
      // Keep the native mirror in sync so goal alerts work while the app is closed.
      Tracking.setLimits(
        goals.filter((g) => g.enabled).map((g) => ({ metric: g.metric, dailyLimit: g.dailyLimit })),
      );
      const today = localDateOf(currentAccountTime(), currentTimeZone());
      const fullRead = !live || history.current.today !== today || history.current.days.size === 0;
      refreshPersonalData(fullRead ? 7 : 1);
      Tracking.refreshCountWidget();
      const health = Tracking.health();
      const samples = fullRead ? new Map<string, Daily>() : new Map(history.current.days);
      // Re-read today each time; settled history refreshes on focus or a date change.
      samples.set(today, personalRawDay(today));
      const readDay = (date: string) => {
        const cached = samples.get(date);
        if (cached) return cached;
        const daily = personalRawDay(date);
        samples.set(date, daily);
        return daily;
      };
      const p = progress(readDay, health, goals, today, window, personalDay);
      history.current = { today, days: samples };
      if (scope !== storageScope()) return null;
      return {
        goals,
        health,
        today,
        daily: readDay(today),
        p,
      };
    })()
      .then((v) => {
        if (v && request === generation.current) setS({ state: 'ok', ...v });
      })
      .catch(
        (e: unknown) =>
          request === generation.current &&
          setS({ state: 'error', message: e instanceof Error ? e.message : 'unknown error' }),
      );
  }, [window, live]);
  useFocusEffect(
    useCallback(() => {
      history.current.days.clear();
      read();
      const unsubscribe = observeStorage(() => {
        history.current.days.clear();
        setS({ state: 'loading' });
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
  return [s, read];
}
