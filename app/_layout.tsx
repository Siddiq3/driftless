import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider } from '@/auth/session';
import { readEnv } from '@/config/env';
import { getDb } from '@/db';
import { Notice, Screen, useTheme } from '@/ui/kit';

const env = readEnv();

export default function RootLayout() {
  const t = useTheme();
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
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }} />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
