import { addDays, localDateOf } from '@siddiq3/driftless-contracts/domain';
import { randomUUID } from 'expo-crypto';
import { getCalendars } from 'expo-localization';
import { Tracking } from 'tracking-android';
import type { ApiClient } from '../api/client';
import { getDb } from '../db';
import { aggregateDay } from './aggregate';
import { flush, stage, type SyncOutcome } from './engine';
import { deviceId, sqliteSyncRepo } from './sqliteRepo';

export const SYNC_DAYS = 7;

export function currentTimeZone(): string {
  return getCalendars()[0]?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
}

/** Local dates from `days - 1` days ago up to today, oldest first. */
export function recentDates(now: number, tz: string, days = SYNC_DAYS): string[] {
  const today = localDateOf(now, tz);
  return Array.from({ length: days }, (_, i) => addDays(today, i - (days - 1)));
}

/**
 * Collects the last week's local data, stages changed days and sends them.
 * Only call when the user has turned on cloud sync. Counting never depends on this succeeding.
 */
export async function syncNow(
  api: Pick<ApiClient, 'usageSync'>,
  now = Date.now(),
): Promise<SyncOutcome> {
  const db = await getDb();
  const repo = sqliteSyncRepo(db);
  const tz = currentTimeZone();
  const id = await deviceId(db, randomUUID);
  Tracking.refreshUsage(SYNC_DAYS);
  const health = Tracking.health();
  await stage(
    repo,
    recentDates(now, tz).map((d) => aggregateDay(Tracking.daily(d), health, id, tz)),
  );
  let last: SyncOutcome = { kind: 'idle' };
  for (let i = 0; i < 3; i++) {
    last = await flush(repo, api, { uuid: randomUUID }, now);
    if (last.kind !== 'sent') break;
  }
  return last;
}
