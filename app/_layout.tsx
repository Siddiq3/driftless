import { AccountBoundary } from '@/auth/account';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type ReactNode } from 'react';
import { StartupScreen } from '@/ui/StartupScreen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider, useSession } from '@/auth/session';
import { AccountBackupProvider } from '@/sync/AccountBackupProvider';
import { readEnv } from '@/config/env';
import { getDb } from '@/db';
import { useReducedMotion } from '@/ui/motion';
import { OnboardingProvider } from '@/onboarding/context';
import { FirstLaunchRedirect } from '@/onboarding/FirstLaunchRedirect';
import { EntitlementRecovery } from '@/billing/EntitlementRecovery';
import { SUBSCRIPTIONS_REQUIRED } from '@/config/access';
import { Button, Notice, Screen, useTheme } from '@/ui/kit';

const env = readEnv();

export default function RootLayout() {
  const t = useTheme();
  const reduced = useReducedMotion();
  const [dbReady, setDbReady] = useState(false);
  const [dbAttempt, setDbAttempt] = useState(0);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void getDb()
      .then(() => {
        if (alive) setDbReady(true);
      })
      .catch(() => {
        if (alive)
          setDbError('Saved phone data could not be opened. Retry to resume initialization.');
      });
    return () => {
      alive = false;
    };
  }, [dbAttempt]);

  if (dbError) {
    return (
      <SafeAreaProvider>
        <Screen>
          <Notice tone="warn" title="Local storage could not be opened" body={dbError} />
          <Button
            label="Retry"
            onPress={() => {
              setDbError(null);
              setDbAttempt((n) => n + 1);
            }}
          />
        </Screen>
      </SafeAreaProvider>
    );
  }

  if (!dbReady) return <StartupScreen />;

  return (
    <SafeAreaProvider>
      <SessionProvider env={env}>
        <PersonalSessionBoundary>
          <AccountBoundary>
            <OnboardingProvider>
              <AccountBackupProvider>
                <StatusBar style="light" />
                <FirstLaunchRedirect />
                {SUBSCRIPTIONS_REQUIRED && <EntitlementRecovery />}
                <Stack
                  screenOptions={{
                    headerShown: false,
                    animation: reduced ? 'none' : 'fade_from_bottom',
                    contentStyle: { backgroundColor: t.bg },
                  }}
                />
              </AccountBackupProvider>
            </OnboardingProvider>
          </AccountBoundary>
        </PersonalSessionBoundary>
      </SessionProvider>
    </SafeAreaProvider>
  );
}

function PersonalSessionBoundary({ children }: { children: ReactNode }) {
  const session = useSession();
  if (session.status === 'loading') return <StartupScreen />;
  return children;
}
