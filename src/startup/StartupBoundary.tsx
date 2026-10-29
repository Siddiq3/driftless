import { useEffect, useState, type ReactNode } from 'react';
import { SessionProvider, useSession } from '@/auth/session';
import type { Env } from '@/config/env';
import { getStorageDb } from '@/db';
import { Button, Notice, Screen } from '@/ui/kit';
import { StartupScreen } from '@/ui/StartupScreen';
import { measureStartup } from './timing';

/** Storage and Google restoration start together. Neither exposes a dataset before it is ready. */
export function StartupBoundary({ env, children }: { env: Env | null; children: ReactNode }) {
  return (
    <SessionProvider env={env}>
      <StorageBoundary>
        <SessionBoundary>{children}</SessionBoundary>
      </StorageBoundary>
    </SessionProvider>
  );
}

function StorageBoundary({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    void measureStartup('local-storage', getStorageDb)
      .then(() => {
        if (alive) setReady(true);
      })
      .catch(() => {
        if (alive) setError(true);
      });
    return () => {
      alive = false;
    };
  }, [attempt]);
  if (error)
    return (
      <Screen>
        <Notice
          tone="warn"
          title="Local storage could not be opened"
          body="Saved phone data could not be opened. Retry to resume initialization."
        />
        <Button
          label="Retry"
          onPress={() => {
            setError(false);
            setAttempt((value) => value + 1);
          }}
        />
      </Screen>
    );
  return ready ? children : <StartupScreen message="Opening saved progress…" />;
}
function SessionBoundary({ children }: { children: ReactNode }) {
  const session = useSession();
  return session.status === 'loading' ? (
    <StartupScreen message="Restoring your sign-in…" />
  ) : (
    children
  );
}
