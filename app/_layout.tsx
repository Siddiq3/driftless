import { BattleInviteCoordinator } from '@/social/BattleInviteCoordinator';
import { AppUpdateBoundary } from '@/updates/AppUpdateBoundary';
import { AccountBoundary } from '@/auth/account';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StartupBoundary } from '@/startup/StartupBoundary';
import { AccountBackupProvider } from '@/sync/AccountBackupProvider';
import { readEnv } from '@/config/env';
import { useReducedMotion } from '@/ui/motion';
import { OnboardingProvider } from '@/onboarding/context';
import { FirstLaunchRedirect } from '@/onboarding/FirstLaunchRedirect';
import { useTheme } from '@/ui/kit';
import { retireEveningReminder } from '@/goals/reminders';
import { useEffect } from 'react';

const env = readEnv();

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppUpdateBoundary>
        <AppRoot />
      </AppUpdateBoundary>
    </SafeAreaProvider>
  );
}

function AppRoot() {
  const t = useTheme();
  const reduced = useReducedMotion();
  useEffect(() => {
    void retireEveningReminder();
  }, []);
  return (
    <StartupBoundary env={env}>
      <AccountBoundary>
        <OnboardingProvider>
          <AccountBackupProvider>
            <StatusBar style="light" />
            <FirstLaunchRedirect />
            <BattleInviteCoordinator />
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
    </StartupBoundary>
  );
}
