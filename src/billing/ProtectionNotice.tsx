import { useCallback, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Tracking, type BlockingConfig } from 'tracking-android';
import { getDb } from '@/db';
import { loadGoals } from '@/goals/store';
import { Notice } from '@/ui/kit';
import { loadBlocking } from './blocking';
import { protectionStatus, type ProtectionStatus } from './protectionStatus';

export function ProtectionNotice({ config }: { config?: BlockingConfig }) {
  const [status, setStatus] = useState<ProtectionStatus | null>(null);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      let generation = 0;
      const read = async () => {
        const request = ++generation;
        try {
          const db = await getDb();
          const saved = config ?? (await loadBlocking(db));
          const goals = await loadGoals(db);
          const limits = goals.filter(
            (goal) => goal.enabled && goal.metric === 'views' && goal.dailyLimit > 0,
          );
          const next = protectionStatus(
            saved,
            Tracking.health(),
            limits.length ? Math.min(...limits.map((goal) => goal.dailyLimit)) : null,
          );
          if (active && request === generation) setStatus(next);
        } catch {
          if (active && request === generation)
            setStatus({
              title: 'Protection status unavailable',
              body: 'Your settings could not be checked. Reopen Focus to try again.',
              tone: 'warn',
            });
        }
      };
      void read();
      const timer = setInterval(() => {
        if (AppState.currentState === 'active') void read();
      }, 5000);
      const listener = AppState.addEventListener('change', (state) => {
        if (state === 'active') void read();
      });
      return () => {
        active = false;
        generation++;
        clearInterval(timer);
        listener.remove();
      };
    }, [config]),
  );
  return status ? <Notice {...status} /> : null;
}
