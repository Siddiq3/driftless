import { addDays, localDateOf } from '@siddiq3/driftless-contracts/domain';
import { randomUUID } from 'expo-crypto';
import { getCalendars } from 'expo-localization';
import { Tracking } from 'tracking-android';
import { ApiError, type ApiClient } from '../api/client';
import { claimAccountBackup } from './ownership';
import { getDb } from '../db';
import { aggregateDay } from './aggregate';
import { flush, stage, type SyncOutcome, type SyncRepo } from './engine';
import { deviceId, sqliteSyncRepo } from './sqliteRepo';

export const SYNC_DAYS = 7;
export const BACKUP_HISTORY_DAYS = 400;

export function currentTimeZone(): string {
  return getCalendars()[0]?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
}

/** Local dates from `days - 1` days ago up to today, oldest first. */
export function recentDates(now: number, tz: string, days = SYNC_DAYS): string[] {
  const today = localDateOf(now, tz);
  return Array.from({ length: days }, (_, i) => addDays(today, i - (days - 1)));
}

/**
 * Collect stored history, then stage and send owner-bound batches. Called by the account
 * backup coordinator only. Counting never depends on the network or sign-in.
 */
export async function syncNow(
  api: Pick<ApiClient, 'usageSync'>,
  userId: string,
  allowed: () => boolean,
  now = Date.now(),
): Promise<SyncOutcome> {
  const db = await getDb();
  const check = () => {
    if (!allowed()) throw new ApiError(409, 'sync_cancelled', 'Backup cancelled');
  };
  check();
  await claimAccountBackup(db, userId, allowed);
  check();
  const storage = sqliteSyncRepo(db, allowed);
  // Cancellation also fences acknowledgements and batch replacement after a late reply.
  const repo = Object.fromEntries(
    Object.entries(storage).map(([name, method]) => [
      name,
      async (...args: unknown[]) => {
        check();
        const result = await (method as (...args: unknown[]) => Promise<unknown>)(...args);
        check();
        return result;
      },
    ]),
  ) as unknown as SyncRepo;
  const tz = currentTimeZone();
  const id = await deviceId(db, randomUUID);
  Tracking.refreshUsage(SYNC_DAYS);
  const health = Tracking.health();
  const today = localDateOf(now, tz);
  const from = addDays(today, -(BACKUP_HISTORY_DAYS - 1));
  const stored = Tracking.storedDates(from, today);
  const dates = [...new Set([...stored, ...recentDates(now, tz)])].sort();
  check();
  const values = [];
  for (const d of dates) {
    check();
    const daily = Tracking.daily(d);
    if (daily.apps.length === 0) continue; // Restored devices are never restaged as this phone's observations.
    const previous = d === today ? null : await repo.getDay(d);
    const historicalHealth =
      d === today
        ? health
        : { ...health, usageAccessGranted: daily.apps.some((app) => app.usageMs > 0) };
    const value = aggregateDay(daily, historicalHealth, id, tz, d === today);
    // Keep already established historical count eligibility; today's app version proves nothing about older observations.
    if (previous) {
      value.views = previous.values.views;
      value.adViews = previous.values.adViews;
    }
    values.push(value);
  }
  await stage(repo, values);
  let last: SyncOutcome = { kind: 'idle' };
  for (let i = 0; i < 3; i++) {
    check();
    last = await flush(
      repo,
      { usageSync: (days, key) => api.usageSync(days, key, allowed) },
      { uuid: randomUUID },
      now,
    );
    if (last.kind !== 'sent') break;
  }
  if (last.kind === 'sent' && (await repo.pendingDays()).length > 0)
    return { kind: 'deferred', until: now, attempts: 0, stuck: false, reason: 'more_history' };
  return last;
}
