import type { ApiClient } from '@/api/client';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Tracking } from 'tracking-android';
import { addDays, localDateOf } from '@siddiq3/driftless-contracts/domain';
import { scopeOf, publishLocalChange } from '@/db/scope';
import { deviceId } from '@/sync/sqliteRepo';
import { randomUUID } from 'expo-crypto';
import { currentAccountTime, currentTimeZone } from '@/sync/run';

const pending = new Map<string, Promise<void>>();
/** Initial account hydration or explicit freshness invalidation; never owned by a screen. */
export function hydratePersonalHistory(
  api: ApiClient,
  db: SQLiteDatabase,
  userId: string,
  allowed: () => boolean,
  force = false,
): Promise<void> {
  const scope = scopeOf(db);
  const reset = () => {
    try { return Tracking.accountUsageInfo(); } catch { return {cutoffMs:0,resetGeneration:0}; }
  };
  const generation=reset().resetGeneration;
  const originallyAllowed=allowed;
  allowed=()=>originallyAllowed() && generation===reset().resetGeneration;
  const key = `${userId}:${scope}`;
  const existing = pending.get(key);
  if (existing) return existing;
  const task = (async () => {
    const meta = await db.getFirstAsync<{ hydrated_at: number }>(
      'SELECT hydrated_at FROM data_scopes WHERE scope=?',
      scope,
    );
    if (!force && meta && Date.now() - meta.hydrated_at < 15 * 60000) return;
    if (!allowed()) throw new Error('History restore cancelled');
    const to = localDateOf(currentAccountTime(), currentTimeZone());
    const retentionFrom = addDays(to, -399);
    const incrementalFrom = meta?.hydrated_at
      ? addDays(localDateOf(meta.hydrated_at, currentTimeZone()), -1)
      : retentionFrom;
    const from = force
      ? retentionFrom
      : incrementalFrom > retentionFrom
        ? incrementalFrom
        : retentionFrom;
    const result = await api.usageHistory(from, to, allowed);
    if (!allowed()) throw new Error('History restore cancelled');
    const cutoff=reset().cutoffMs;
    const cutoffDate=cutoff ? localDateOf(cutoff,currentTimeZone()) : null;
    // Daily cloud snapshots cannot distinguish before/after reset within a day. Suppress the
    // cutoff day and earlier; never fabricate an after-reset portion of a remote day total.
    const retained = result.days.filter((d) => d.localDate >= from && d.localDate <= to && (!cutoffDate || d.localDate>cutoffDate));
    // Both caches serve personal screens only. Never write these totals to the recorder or
    // to the competitive `views` upload field. Legacy server rows fall back to approved views.
    const personalDays = retained.map((day) => ({ ...day, views: day.personalViews ?? day.views }));
    const source = await deviceId(db, randomUUID);
    if(api.accountUsageHistory && scope.startsWith('account:')) {
      const accounting=await api.accountUsageHistory(from,to,source,allowed);
      if(!allowed()) throw new Error('History restore cancelled');
      Tracking.installAccountHistory(JSON.stringify(accounting.days),scope);
    }
    Tracking.setSourceDevice(source);
    await db.withExclusiveTransactionAsync(async (tx) => {
      for (const d of personalDays) {
        if (d.localDate < from || d.localDate > to) continue;
        await tx.runAsync(
          `INSERT INTO daily_cache(scope,local_date,device_id,platform,tz,views,ad_views,minutes,coverage,rev) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(scope,local_date,device_id) DO UPDATE SET platform=excluded.platform,tz=excluded.tz,views=excluded.views,ad_views=excluded.ad_views,minutes=excluded.minutes,coverage=excluded.coverage,rev=excluded.rev WHERE excluded.rev>=daily_cache.rev`,
          scope,
          d.localDate,
          d.deviceId,
          d.platform,
          d.tz,
          d.views,
          d.adViews,
          d.minutes,
          d.coverage,
          d.rev,
        );
      }
      if (!allowed()) throw new Error('History restore cancelled');
    });
    if (!allowed()) throw new Error('History restore cancelled');
    // Cache becomes visible only in this scope; never modifies native recorded counters.
    for (let offset = 0; offset < personalDays.length; offset += 1000) {
      if (!allowed()) throw new Error('History restore cancelled');
      Tracking.mergeSyncedDays(personalDays.slice(offset, offset + 1000), scope);
    }
    await db.runAsync('UPDATE data_scopes SET hydrated_at=? WHERE scope=?', Date.now(), scope);
    publishLocalChange();
  })().finally(() => {
    if (pending.get(key) === task) pending.delete(key);
  });
  pending.set(key, task);
  return task;
}
