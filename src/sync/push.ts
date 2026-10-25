import * as Notifications from 'expo-notifications';
import { randomUUID } from 'expo-crypto';
import type { ApiClient } from '../api/client';
import { getDb } from '../db';
import { deviceId } from './sqliteRepo';
import { scopeOf } from '@/db/scope';

/**
 * Registers this phone's FCM token so friends' requests and challenge updates can be delivered.
 * Only after the user granted notifications; requires the app's Firebase configuration.
 */
export async function registerPush(api: Pick<ApiClient, 'registerDevice'>): Promise<boolean> {
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return false;
  const token = await Notifications.getDevicePushTokenAsync();
  if (typeof token.data !== 'string' || token.data.length < 16) return false;
  const db=await getDb(),key=`push_registration:${scopeOf(db)}`;
  const previous=await db.getFirstAsync<{value:string}>('SELECT value FROM settings WHERE key=?',key);
  const prior=previous ? JSON.parse(previous.value) : null;
  const now=Date.now();
  if(prior?.token===token.data && now>=prior.at && now-prior.at<86400000) return true;
  await api.registerDevice(await deviceId(db, randomUUID), token.data);
  await db.runAsync('INSERT OR REPLACE INTO settings VALUES (?,?)',key,JSON.stringify({token:token.data,at:now}));
  return true;
}
