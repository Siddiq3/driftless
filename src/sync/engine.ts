import type { v1 } from '@siddiq3/driftless-contracts';
import type { PersonalDailyAggregate } from '@/api/personalUsage';
import { ApiError } from '../api/client';
import { isRetryable, nextDelayMs, STUCK_AFTER_ATTEMPTS } from '../db/outbox';
import { valuesKey, type DayValues } from './aggregate';

/** Per-day sync bookkeeping. `rev` increases whenever the day's values change. */
export type DayState = {
  localDate: string;
  key: string;
  rev: number;
  syncedRev: number;
  values: DayValues;
};

export type Batch = {
  id: string;
  idempotencyKey: string;
  days: PersonalDailyAggregate[];
  attempts: number;
  nextAttemptAt: number;
};

/** Storage the sync engine needs. Implemented with expo-sqlite in the app, in memory in tests. */
export interface SyncRepo {
  getDay(localDate: string): Promise<DayState | null>;
  putDay(d: DayState): Promise<void>;
  pendingDays(): Promise<DayState[]>;
  getBatch(): Promise<Batch | null>;
  putBatch(b: Batch): Promise<void>;
  deleteBatch(id: string): Promise<void>;
}

export type SyncClient = {
  usageSync(days: PersonalDailyAggregate[], idempotencyKey: string): Promise<v1.UsageSyncResponse>;
};

export type SyncOutcome =
  | { kind: 'idle' }
  | { kind: 'sent'; applied: number; unchanged: number; stale: number }
  | { kind: 'deferred'; until: number; attempts: number; stuck: boolean; reason: string }
  | { kind: 'rejected'; status: number; code: string };

/** Records today's/recent values. Bumps rev only if something changed. */
export async function stage(repo: SyncRepo, values: DayValues[]): Promise<number> {
  let changed = 0;
  for (const v of values) {
    const key = valuesKey(v);
    const cur = await repo.getDay(v.localDate);
    if (cur && cur.key === key) continue;
    await repo.putDay({
      localDate: v.localDate,
      key,
      rev: (cur?.rev ?? 0) + 1,
      syncedRev: cur?.syncedRev ?? 0,
      values: v,
    });
    changed++;
  }
  return changed;
}

/**
 * Sends at most one batch. A batch is frozen once built (same days, same Idempotency-Key) so a
 * retry after a lost response is replayed by the server instead of being applied twice.
 */
export async function flush(
  repo: SyncRepo,
  client: SyncClient,
  ids: { uuid(): string },
  now: number,
  random: () => number = Math.random,
): Promise<SyncOutcome> {
  let batch = await repo.getBatch();
  if (!batch) {
    const pending = (await repo.pendingDays()).slice(0, 31);
    if (pending.length === 0) return { kind: 'idle' };
    batch = {
      id: ids.uuid(),
      idempotencyKey: ids.uuid(),
      days: pending.map((d) => ({ ...d.values, rev: d.rev })),
      attempts: 0,
      nextAttemptAt: now,
    };
    await repo.putBatch(batch);
  }
  if (batch.nextAttemptAt > now) {
    return {
      kind: 'deferred',
      until: batch.nextAttemptAt,
      attempts: batch.attempts,
      stuck: batch.attempts >= STUCK_AFTER_ATTEMPTS,
      reason: 'backoff',
    };
  }

  let res: v1.UsageSyncResponse;
  try {
    res = await client.usageSync(batch.days, batch.idempotencyKey);
  } catch (e) {
    const status = e instanceof ApiError ? e.status : null;
    const code = e instanceof ApiError ? e.code : 'unknown';
    if (!isRetryable(status)) {
      // Permanent (e.g. consent off, validation). Drop the frozen batch; days stay pending.
      await repo.deleteBatch(batch.id);
      return { kind: 'rejected', status: status ?? 0, code };
    }
    const attempts = batch.attempts + 1;
    const until = now + nextDelayMs(attempts, random);
    await repo.putBatch({ ...batch, attempts, nextAttemptAt: until });
    return {
      kind: 'deferred',
      until,
      attempts,
      stuck: attempts >= STUCK_AFTER_ATTEMPTS,
      reason: code,
    };
  }

  let applied = 0;
  let unchanged = 0;
  let stale = 0;
  const received = new Map(res.results.map((r) => [`${r.localDate}:${r.deviceId}`, r]));
  for (const sent of batch.days) {
    const r = received.get(`${sent.localDate}:${sent.deviceId}`);
    if (!r) continue;

    const d = await repo.getDay(r.localDate);
    if (!d) continue;
    if (r.status === 'stale') {
      // The server holds a newer rev for this device-day (e.g. after reinstall). Jump past it.
      stale++;
      await repo.putDay({ ...d, rev: Math.max(d.rev, r.serverRev) + 1 });
    } else {
      if (r.status === 'applied') applied++;
      else unchanged++;
      const sentRev = batch.days.find((x) => x.localDate === r.localDate)?.rev ?? r.serverRev;
      await repo.putDay({ ...d, syncedRev: Math.max(d.syncedRev, sentRev) });
    }
  }
  const remaining = batch.days.filter((d) => !received.has(`${d.localDate}:${d.deviceId}`));
  if (remaining.length) {
    // Retain the original frozen body and key. Replaying already applied rows is idempotent.
    const attempts = batch.attempts + 1;
    const until = now + nextDelayMs(attempts, random);
    await repo.putBatch({ ...batch, attempts, nextAttemptAt: until });
    return {
      kind: 'deferred',
      until,
      attempts,
      stuck: attempts >= STUCK_AFTER_ATTEMPTS,
      reason: 'partial_response',
    };
  }
  await repo.deleteBatch(batch.id);
  return { kind: 'sent', applied, unchanged, stale };
}

/** In-memory repo for tests. */
export class MemorySyncRepo implements SyncRepo {
  days = new Map<string, DayState>();
  batch: Batch | null = null;
  async getDay(d: string) {
    return this.days.get(d) ?? null;
  }
  async putDay(d: DayState) {
    this.days.set(d.localDate, d);
  }
  async pendingDays() {
    return [...this.days.values()]
      .filter((d) => d.rev > d.syncedRev)
      .sort((a, b) => (a.localDate < b.localDate ? -1 : 1));
  }
  async getBatch() {
    return this.batch;
  }
  async putBatch(b: Batch) {
    this.batch = b;
  }
  async deleteBatch(id: string) {
    if (this.batch?.id === id) this.batch = null;
  }
}
