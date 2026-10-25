import { AccountBoundary } from '@/auth/account';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator } from 'react-native';
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
import { Notice, Screen, useTheme } from '@/ui/kit';

const env = readEnv();

export default function RootLayout() {
  const t = useTheme();
  const reduced = useReducedMotion();
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    getDb().catch((e: unknown) => setDbError(e instanceof Error ? e.message : 'unknown error'));
  }, []);

  if (dbError) {
    return (
      <SafeAreaProvider>
        <Screen>
          <Notice tone="warn" title="Local storage could not be opened" body={dbError} />
        </Screen>
      </SafeAreaProvider>
    );
  }

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
  if (session.status === 'loading')
    return <ActivityIndicator accessibilityLabel="Opening your saved progress" />;
  return children;
}
