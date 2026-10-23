import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Tracking, type BlockingConfig, type TrackingHealth } from 'tracking-android';
import { getDb } from '@/db';
import { loadBlocking, saveBlocking } from '@/billing/blocking';
import { loadGoals } from '@/goals/store';

// Both routes share the queue so navigation cannot load a configuration ahead of an in-flight save.
let writes: Promise<void> = Promise.resolve();
export function useFocusSettings() {
  const [cfg, setCfg] = useState<BlockingConfig | null>(null);
  const current = useRef<BlockingConfig | null>(null);
  const confirmed = useRef<BlockingConfig | null>(null);
  const revision = useRef(0);
  const focused = useRef(false);
  const [health, setHealth] = useState<TrackingHealth | null>(null);
  const [goal, setGoal] = useState<number | null>(null);
  const [goalLoaded, setGoalLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(new Date());
  const [reload, setReload] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      focused.current = true;
      current.current = null;
      setCfg(null);
      setGoalLoaded(false);
      if (reload > 0) setError(null);
      const refresh = () => {
        setNow(new Date());
        try {
          setHealth(Tracking.health());
        } catch {
          setHealth(null);
        }
      };
      refresh();
      void (async () => {
        try {
          await writes;
          const db = await getDb();
          const config = await loadBlocking(db);
          if (!active) return;
          current.current = confirmed.current = config;
          setCfg(config);
          setError(null);
          setSaving(false);
          try {
            const goals = await loadGoals(db);
            const limits = goals.filter(
              (g) => g.enabled && g.metric === 'views' && g.dailyLimit > 0,
            );
            if (active) {
              setGoal(limits.length ? Math.min(...limits.map((g) => g.dailyLimit)) : null);
              setGoalLoaded(true);
            }
          } catch {
            if (active) setGoalLoaded(false);
          }
        } catch {
          if (active) setError('Your settings could not be loaded. Please try again.');
        }
      })();
      const timer = setInterval(() => {
        if (AppState.currentState === 'active') refresh();
      }, 15000);
      const listener = AppState.addEventListener('change', (state) => {
        if (state === 'active') refresh();
      });
      return () => {
        active = false;
        focused.current = false;
        clearInterval(timer);
        listener.remove();
      };
    }, [reload]),
  );

  const update = (
    change: Partial<BlockingConfig> | ((saved: BlockingConfig) => BlockingConfig),
  ) => {
    if (!current.current) return;
    const next =
      typeof change === 'function' ? change(current.current) : { ...current.current, ...change };
    current.current = next;
    const request = ++revision.current;
    setCfg(next);
    setSaving(true);
    setError(null);
    writes = writes.then(async () => {
      try {
        await saveBlocking(await getDb(), next);
        confirmed.current = next;
        if (focused.current && request === revision.current) {
          setSaving(false);
          setError(null);
        }
      } catch {
        // A native mirror failure may occur after SQLite committed. Restore both layers
        // before telling the user their previous configuration is back.
        let restored = false;
        if (confirmed.current) {
          try {
            await saveBlocking(await getDb(), confirmed.current);
            restored = true;
          } catch {
            /* Keep the uncertainty visible; never claim a successful restore. */
          }
        }
        if (request === revision.current) {
          current.current = restored ? confirmed.current : next;
          if (focused.current) {
            setCfg(current.current);
            setSaving(false);
            setError(
              restored
                ? 'Changes could not be saved. Your last saved settings have been restored. Please try again.'
                : 'Changes could not be confirmed. Try saving again or reopen this screen to review the saved settings.',
            );
          }
        }
      }
    });
  };
  return {
    cfg,
    health,
    goal,
    goalLoaded,
    now,
    error,
    saving,
    update,
    retrySave: () => update({}),
    retry: () => setReload((r) => r + 1),
  };
}
export type FocusSettings = ReturnType<typeof useFocusSettings>;
