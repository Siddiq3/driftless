import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { ApiClient } from '@/api/client';
import type { Battle } from '@/api/challenges';
import { useAccountBackup } from '@/sync/AccountBackupProvider';

export const BATTLE_REFRESH_MS = 60_000;
/** One in-flight read per focused feed; API client also shares identical transports. */
export function useBattleFeed(api: ApiClient | null) {
  const [state, setState] = useState<{
    api: ApiClient;
    challenges: Battle[];
    invitations: Battle[];
    updatedAt: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const refresh = useRef<() => void>(() => {});
  const backup = useAccountBackup();
  useFocusEffect(
    useCallback(() => {
      if (!api) return;
      let alive = true,
        loading = false;
      const read = async () => {
        if (!alive || loading) return;
        loading = true;
        try {
          const result = await api.battleInbox(() => alive);
          if (alive) {
            setState({
              api,
              ...result,
              invitations: result.invitations ?? [],
              updatedAt: Date.now(),
            });
            setError(null);
          }
        } catch {
          if (alive) setError('Battles could not be updated. We’ll check again automatically.');
        } finally {
          loading = false;
        }
      };
      refresh.current = () => {
        void read();
      };
      void read();
      const timer = setInterval(() => {
        if (AppState.currentState === 'active') void read();
      }, BATTLE_REFRESH_MS);
      const listener = AppState.addEventListener('change', (value) => {
        if (value === 'active') void read();
      });
      return () => {
        alive = false;
        clearInterval(timer);
        listener.remove();
        refresh.current = () => {};
      };
      // An explicit reload restarts this focus-bound worker.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [api, revision]),
  );
  useEffect(() => {
    if (backup.status?.state === 'saved') refresh.current();
  }, [backup.status]);
  const current = state?.api === api ? state : null;
  return { data: current, error, revision, reload: () => setRevision((v) => v + 1) };
}
