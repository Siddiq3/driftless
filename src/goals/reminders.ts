import * as Notifications from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';

const ID = 'evening-check-in';
const KEY = 'evening_reminder';

/** Asks for notification permission (Android 13+). Returns whether notifications may be shown. */
export async function ensureNotificationPermission(): Promise<boolean> {
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  if (!cur.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

export async function eveningReminderEnabled(db: SQLiteDatabase): Promise<boolean> {
  const r = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    KEY,
  );
  return r?.value === '1';
}

/** Daily 9 pm local check-in. Turning it off cancels it. */
export async function setEveningReminder(db: SQLiteDatabase, on: boolean): Promise<boolean> {
  await Notifications.cancelScheduledNotificationAsync(ID).catch(() => undefined);
  if (on) {
    if (!(await ensureNotificationPermission())) return false;
    await Notifications.setNotificationChannelAsync('check_in', {
      name: 'Evening check-in',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    await Notifications.scheduleNotificationAsync({
      identifier: ID,
      content: {
        title: 'How did today go?',
        body: 'Take a look at your day and how Wick is doing.',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 21,
        minute: 0,
        channelId: 'check_in',
      },
    });
  }
  await db.runAsync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    KEY,
    on ? '1' : '0',
  );
  return on;
}
