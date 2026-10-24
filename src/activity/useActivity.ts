import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { localDateOf } from '@siddiq3/driftless-contracts/domain';
import { Tracking, type WrapDetails } from 'tracking-android';
import { currentTimeZone } from '@/sync/run';
import { personalDay, personalRawDay, refreshPersonalData } from '@/data/personal';
import { observeStorage } from '@/db/scope';
import { activityBounds, activityData, type ActivityData, type ActivityPeriod } from './model';
type State =
  | { state: 'loading' }
  | { state: 'ok'; data: ActivityData; today: string }
  | { state: 'error' };
export function useActivity(period: ActivityPeriod, offset: number) {
  const [state, setState] = useState<State>({ state: 'loading' });
  const generation = useRef(0);
  const read = useCallback(() => {
    const id = ++generation.current;
    try {
      const today = localDateOf(Date.now(), currentTimeZone());
      const bounds = activityBounds(period, offset, today);
      refreshPersonalData(
        offset === 0 ? 7 : Math.min(60, offset * (period === 'daily' ? 1 : 7) + 7),
      );
      const health = Tracking.health();
      let details: WrapDetails = { available: false, days: [] };
      if (period === 'daily')
        try {
          details = Tracking.localActivityDetails(bounds.from, bounds.from) ?? details;
        } catch {
          /* An older binary still has daily totals. */
        }
      const data = activityData(
        period,
        offset,
        today,
        health,
        personalRawDay,
        details,
        personalDay,
      );
      if (id === generation.current) setState({ state: 'ok', data, today });
    } catch {
      if (id === generation.current) setState({ state: 'error' });
    }
  }, [period, offset]);
  useFocusEffect(
    useCallback(() => {
      setState({ state: 'loading' });
      read();
      const unsubscribe = observeStorage(read);
      const timer =
        offset === 0
          ? setInterval(() => {
              if (AppState.currentState === 'active') read();
            }, 10000)
          : undefined;
      const sub = AppState.addEventListener('change', (s) => {
        if (s === 'active') read();
      });
      return () => {
        unsubscribe();
        generation.current++;
        clearInterval(timer);
        sub.remove();
      };
    }, [offset, read]),
  );
  return [state, read] as const;
}
