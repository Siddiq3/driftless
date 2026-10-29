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
import { EntitlementRecovery } from '@/billing/EntitlementRecovery';
import { SUBSCRIPTIONS_REQUIRED } from '@/config/access';
import { useTheme } from '@/ui/kit';

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
  return (
    <StartupBoundary env={env}>
      <AccountBoundary>
        <OnboardingProvider>
          <AccountBackupProvider>
            <StatusBar style="light" />
            <FirstLaunchRedirect />
            <BattleInviteCoordinator />
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
    </StartupBoundary>
  );
}
