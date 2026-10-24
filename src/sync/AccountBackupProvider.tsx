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

export type BackupStatus = {
  state: 'local' | 'saving' | 'saved' | 'pending' | 'paused';
  message: string;
};
const LOCAL: BackupStatus = { state: 'local', message: 'Your progress is saved on this phone.' };
const Context = createContext<{
  status: BackupStatus;
  retry: () => Promise<boolean>;
  pause: () => void;
}>({ status: LOCAL, retry: async () => false, pause: () => undefined });
export const useAccountBackup = () => useContext(Context);

type Worker = { api: ApiClient; run: () => Promise<boolean>; pause: () => void };

export function AccountBackupProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const session = useSession();
  const displayName = session.status === 'signedIn' ? session.displayName : null;
  const worker = useRef<Worker | null>(null);
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
    const accountGeneration = entitlementGeneration();
    const allowed = () =>
      alive &&
      !paused &&
      AppState.currentState === 'active' &&
      accountGeneration === entitlementGeneration();
    const run = (force = false): Promise<boolean> => {
      if (!allowed()) return Promise.resolve(false);
      if (task) return task;
      const now = Date.now();
      const nativeAtStart = Tracking.dataRevision?.() ?? 0;
      const jsAtStart = storageGeneration();
      if (!force && now < nextAttempt) return Promise.resolve(false);
      if (!force && !failed && nativeAtStart === lastNative && storageGeneration() === lastJs)
        return Promise.resolve(true);
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
      run: () => run(true),
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
    const timer = setInterval(() => void run(), 60_000);
    return () => {
      alive = false;
      subscription.remove();
      clearInterval(timer);
      unsubscribe();
      if (worker.current === current) worker.current = null;
    };
  }, [api, displayName]);
  const retry = useCallback(async () => {
    if (worker.current?.api === api) return worker.current.run();
    return false;
  }, [api]);
  const pause = useCallback(() => {
    if (worker.current?.api === api) worker.current.pause();
  }, [api]);
  const status = api && result?.api === api ? result.status : LOCAL;
  return <Context.Provider value={{ status, retry, pause }}>{children}</Context.Provider>;
}
