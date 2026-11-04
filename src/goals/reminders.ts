import * as Notifications from 'expo-notifications';

const ID = 'evening-check-in';

/** Asks for notification permission (Android 13+). Returns whether notifications may be shown. */
export async function ensureNotificationPermission(): Promise<boolean> {
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  if (!cur.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/** The 9 pm check-in was removed; cancel any copy still scheduled from an older version. */
export async function retireEveningReminder() {
  await Notifications.cancelScheduledNotificationAsync(ID).catch(() => undefined);
  await Notifications.deleteNotificationChannelAsync('check_in').catch(() => undefined);
}
