import { Alert } from 'react-native';
import { Tracking } from 'tracking-android';

export const USAGE_ACCESS_TITLE = 'Allow Usage Access?';
export const USAGE_ACCESS_BODY =
  'ScrollSnooze reads Android’s app-usage information to measure your time in Instagram and YouTube, and shows it as your minutes and statistics. It keeps this on your phone. If you sign in, daily and per-app minutes are backed up to your account. Friends don’t see your minutes. You can turn this off anytime in Android settings.';

/** Opening Settings is never consent. Already granted means the user is there to turn it off. */
export function openUsageAccess() {
  let granted = false;
  try {
    granted = Tracking.health().usageAccessGranted;
  } catch {
    /* Unknown state still explains first. */
  }
  if (granted) return Tracking.openUsageAccessSettings();
  Alert.alert(USAGE_ACCESS_TITLE, USAGE_ACCESS_BODY, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Continue', onPress: () => Tracking.openUsageAccessSettings() },
  ]);
}
