import * as Notifications from 'expo-notifications';
import { randomUUID } from 'expo-crypto';
import type { ApiClient } from '../api/client';
import { getDb } from '../db';
import { deviceId } from './sqliteRepo';

/**
 * Registers this phone's FCM token so friends' requests and challenge updates can be delivered.
 * Only after the user granted notifications; requires the app's Firebase configuration.
 */
export async function registerPush(api: Pick<ApiClient, 'registerDevice'>): Promise<boolean> {
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return false;
  const token = await Notifications.getDevicePushTokenAsync();
  if (typeof token.data !== 'string' || token.data.length < 16) return false;
  await api.registerDevice(await deviceId(await getDb(), randomUUID), token.data);
  return true;
}
