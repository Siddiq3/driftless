import { router, usePathname, useRootNavigationState } from 'expo-router';
import { useEffect } from 'react';
import { useOnboarding } from './context';

/** The navigator stays mounted; cold links cannot bypass first-launch setup. */
export function FirstLaunchRedirect() {
  const navigation = useRootNavigationState();
  const path = usePathname();
  const { load } = useOnboarding();
  useEffect(() => {
    if (!navigation?.key || load.state !== 'ready' || load.record?.completed) return;
    if (!['/onboarding', '/privacy', '/disclosure', '/tracking'].includes(path))
      router.replace('/onboarding');
  }, [navigation?.key, path, load]);
  return null;
}
