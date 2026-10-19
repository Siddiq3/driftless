import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { getDb } from '@/db';
import { Tracking } from 'tracking-android';
import { loadGoals } from '@/goals/store';
import { clearSetup, finishSetup, readSetup, saveSetup } from './store';
import type { SetupRecord } from './model';

type Load =
  | { state: 'loading' }
  | { state: 'ready'; record: SetupRecord | null }
  | { state: 'error'; message: string };
type SetupContext = {
  load: Load;
  reload: () => void;
  restart: () => Promise<void>;
  save: (record: SetupRecord) => Promise<void>;
  finish: (record: SetupRecord) => Promise<void>;
};
const Context = createContext<SetupContext | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const reload = useCallback(() => {
    getDb()
      .then(readSetup)
      .then((record) => setLoad({ state: 'ready', record }))
      .catch((e: unknown) =>
        setLoad({
          state: 'error',
          message: e instanceof Error ? e.message : 'Setup could not be loaded.',
        }),
      );
  }, []);
  useEffect(reload, [reload]);
  const save = async (record: SetupRecord) => {
    await saveSetup(await getDb(), record);
    setLoad({ state: 'ready', record });
  };
  const finish = async (record: SetupRecord) => {
    const db = await getDb();
    const result = await finishSetup(db, record);
    // Completion is durable even if mirroring to Android needs a retry on home focus.
    try {
      const goals = await loadGoals(db);
      Tracking.setLimits(
        goals.filter((g) => g.enabled).map((g) => ({ metric: g.metric, dailyLimit: g.dailyLimit })),
      );
    } catch {
      /* useProgress re-mirrors persisted goals on focus */
    }
    setLoad({ state: 'ready', record: result });
  };
  return (
    <Context.Provider
      value={{
        load,
        reload,
        save,
        finish,
        restart: async () => {
          await clearSetup(await getDb());
          reload();
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useOnboarding() {
  const value = useContext(Context);
  if (!value) throw new Error('OnboardingProvider is missing');
  return value;
}
