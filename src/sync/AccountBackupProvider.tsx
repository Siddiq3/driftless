import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import { useSession } from '@/auth/session';
import { useApi } from '@/api/useApi';
import type { ApiClient } from '@/api/client';
import { entitlementGeneration } from '@/billing/cache';
import { backupAccount } from './accountBackup';
import { Tracking } from 'tracking-android';
import { storageGeneration, observeStorage } from '@/db/scope';
import { nextDelayMs } from '@/db/outbox';
import { READ_REUSE_MS } from '@/api/client';

export type BackupStatus = {
  state: 'local' | 'saving' | 'saved' | 'pending' | 'paused';
  message: string;
};
const LOCAL: BackupStatus = { state: 'local', message: 'Your progress is saved on this phone.' };
const Context = createContext<{
  status: BackupStatus;
  retry: () => Promise<boolean>;
  pause: () => void;
  resume: () => void;
}>({ status: LOCAL, retry: async () => false, pause: () => undefined, resume: () => undefined });
export const useAccountBackup = () => useContext(Context);

type Worker = { api: ApiClient; run: () => Promise<boolean>; pause: () => void };

export function AccountBackupProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const session = useSession();
  const displayName = session.status === 'signedIn' ? session.displayName : null;
  const worker = useRef<Worker | null>(null);
  const [workerRevision, setWorkerRevision] = useState(0);
  const [result, setResult] = useState<{ api: ApiClient; status: BackupStatus } | null>(null);
  useEffect(() => {
    if (!api) return;
    let alive = true;
    let paused = false;
    let task: Promise<boolean> | null = null;
    let lastNative = -1,
      lastJs = -1,
      nextAttempt = 0,
      failures = 0;
    let failed = false;
    let lastCompleted: number | null = null;
    const accountGeneration = entitlementGeneration();
    const allowed = () =>
      alive &&
      !paused &&
      AppState.currentState === 'active' &&
      accountGeneration === entitlementGeneration();
    const run = (force = false, manual = false): Promise<boolean> => {
      if (!allowed()) return Promise.resolve(false);
      if (task) return task;
      const now = Date.now();
      const nativeAtStart = Tracking.dataRevision?.() ?? 0;
      const jsAtStart = storageGeneration();
      // Foreground/interval callbacks can arrive just after a successful startup backup.
      // Coalesce that burst, but never suppress explicit Retry, changed data or failed work.
      const age = lastCompleted === null ? Infinity : now - lastCompleted;
      if (
        !manual &&
        !failed &&
        age >= 0 &&
        age < READ_REUSE_MS &&
        nativeAtStart === lastNative &&
        jsAtStart === lastJs
      )
        return Promise.resolve(true);
      if (!force && now < nextAttempt) return Promise.resolve(false);
      if (!force && !failed && nativeAtStart === lastNative && storageGeneration() === lastJs)
        return Promise.resolve(true);
      if (manual) api.clearReadReuse?.();
      task = Promise.resolve()
        .then(async () => {
          if (!allowed()) return false;
          setResult({
            api,
            status: { state: 'saving', message: 'Saving progress to your account…' },
          });
          try {
            const status = await backupAccount(api, allowed, displayName);
            if (allowed()) setResult({ api, status });
            failed = status.state !== 'saved';
            if (failed) nextAttempt = Date.now() + nextDelayMs(++failures);
            else {
              failures = 0;
              nextAttempt = 0;
              lastCompleted = Date.now();
              lastNative = nativeAtStart;
              lastJs = jsAtStart;
            }
            return allowed() && status.state === 'saved';
          } catch (error) {
            failed = true;
            nextAttempt = Date.now() + nextDelayMs(++failures);
            if (allowed())
              setResult({
                api,
                status: {
                  state: 'pending',
                  message:
                    error instanceof Error
                      ? error.message
                      : 'Backup will retry. Your progress is saved on this phone.',
                },
              });
            return false;
          }
        })
        .finally(() => {
          task = null;
        });
      return task;
    };
    const current = {
      api,
      run: () => run(true, true),
      pause: () => {
        paused = true;
        setResult({
          api,
          status: { state: 'paused', message: 'Account backup is paused until you sign in again.' },
        });
      },
    };
    worker.current = current;
    void run();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void run(true);
    });
    const unsubscribe = observeStorage(() => {
      void run();
    });
    // Credit and account-day freshness also change when no tracking event is recorded.
    const timer = setInterval(() => void run(true), 60_000);
    return () => {
      alive = false;
      subscription.remove();
      clearInterval(timer);
      unsubscribe();
      if (worker.current === current) worker.current = null;
    };
  }, [api, displayName, workerRevision]);
  const retry = useCallback(async () => {
    if (worker.current?.api === api) return worker.current.run();
    return false;
  }, [api]);
  const pause = useCallback(() => {
    if (worker.current?.api === api) worker.current.pause();
  }, [api]);
  // Start a new worker rather than reviving the captured cancellation predicate of an
  // in-flight pre-reset request. The old worker remains permanently paused/dead.
  const resume = useCallback(() => setWorkerRevision((r) => r + 1), []);
  const status = api && result?.api === api ? result.status : LOCAL;
  return <Context.Provider value={{ status, retry, pause, resume }}>{children}</Context.Provider>;
}
