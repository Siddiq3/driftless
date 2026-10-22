import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider } from '@/auth/session';
import { readEnv } from '@/config/env';
import { getDb } from '@/db';
import { useReducedMotion } from '@/ui/motion';
import { OnboardingProvider } from '@/onboarding/context';
import { FirstLaunchRedirect } from '@/onboarding/FirstLaunchRedirect';
import { EntitlementRecovery } from '@/billing/EntitlementRecovery';
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
      <OnboardingProvider>
        <SessionProvider env={env}>
          <StatusBar style="light" />
          <FirstLaunchRedirect />
          <EntitlementRecovery />
          <Stack
            screenOptions={{
              headerShown: false,
              animation: reduced ? 'none' : 'fade_from_bottom',
              contentStyle: { backgroundColor: t.bg },
            }}
          />
        </SessionProvider>
      </OnboardingProvider>
    </SafeAreaProvider>
  );
}
