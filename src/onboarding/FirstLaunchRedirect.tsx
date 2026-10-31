import { router, usePathname, useRootNavigationState } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { Tracking } from 'tracking-android';
import { useOnboarding } from './context';

/** The navigator stays mounted; cold links cannot bypass first-launch setup. */
export function FirstLaunchRedirect() {
  const navigation = useRootNavigationState();
  const path = usePathname();
  const { load } = useOnboarding();
  const renewalShown = useRef(false);
  useEffect(() => {
    if (!navigation?.key || load.state !== 'ready') return;
    if (load.record?.completed) {
      // Index owns the initial Home/Welcome redirect. Do not race it with a push from '/'.
      // Count presentation only once the disclosure route is actually active, not when a
      // navigation request is queued. Declining then leaves the rest of the app usable.
      if (path === '/disclosure') {
        renewalShown.current = true;
        return;
      }
      if (path === '/') return;
      if (Platform.OS === 'android' && !renewalShown.current && path !== '/privacy') {
        try {
          if (Tracking.health().disclosureRenewalRequired) {
            router.push('/disclosure');
          }
        } catch {
          /* Native health may be unavailable in an older development client. */
        }
      }
      return;
    }
    if (!['/onboarding', '/privacy', '/disclosure', '/tracking'].includes(path))
      router.replace('/onboarding');
  }, [navigation?.key, path, load]);
  return null;
}
