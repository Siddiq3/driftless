import type { SQLiteDatabase } from 'expo-sqlite';
import type { Batch, DayState, SyncRepo } from './engine';

type DayRow = {
  local_date: string;
  values_key: string;
  rev: number;
  synced_rev: number;
  values_json: string;
};
type BatchRow = {
  id: string;
  idempotency_key: string;
  days_json: string;
  attempts: number;
  next_attempt_at: number;
};

const toDay = (r: DayRow): DayState => ({
  localDate: r.local_date,
  key: r.values_key,
  rev: r.rev,
  syncedRev: r.synced_rev,
  values: JSON.parse(r.values_json),
});

export function sqliteSyncRepo(db: SQLiteDatabase): SyncRepo {
  return {
    async getDay(localDate) {
      const r = await db.getFirstAsync<DayRow>(
        'SELECT * FROM sync_days WHERE local_date = ?',
        localDate,
      );
      return r ? toDay(r) : null;
    },
    async putDay(d) {
      await db.runAsync(
        `INSERT OR REPLACE INTO sync_days (local_date, values_key, rev, synced_rev, values_json) VALUES (?, ?, ?, ?, ?)`,
        d.localDate,
        d.key,
        d.rev,
        d.syncedRev,
        JSON.stringify(d.values),
      );
    },
    async pendingDays() {
      const rows = await db.getAllAsync<DayRow>(
        'SELECT * FROM sync_days WHERE rev > synced_rev ORDER BY local_date',
      );
      return rows.map(toDay);
    },
    async getBatch() {
      const r = await db.getFirstAsync<BatchRow>('SELECT * FROM sync_batch LIMIT 1');
      return r
        ? {
            id: r.id,
            idempotencyKey: r.idempotency_key,
            days: JSON.parse(r.days_json),
            attempts: r.attempts,
            nextAttemptAt: r.next_attempt_at,
          }
        : null;
    },
    async putBatch(b: Batch) {
      await db.withExclusiveTransactionAsync(async (txn) => {
        await txn.runAsync('DELETE FROM sync_batch WHERE id != ?', b.id);
        await txn.runAsync(
          `INSERT OR REPLACE INTO sync_batch (id, idempotency_key, days_json, attempts, next_attempt_at) VALUES (?, ?, ?, ?, ?)`,
          b.id,
          b.idempotencyKey,
          JSON.stringify(b.days),
          b.attempts,
          b.nextAttemptAt,
        );
      });
    },
    async deleteBatch(id) {
      await db.runAsync('DELETE FROM sync_batch WHERE id = ?', id);
    },
  };
}

/** Stable random id for this installation (never derived from hardware identifiers). */
export async function deviceId(db: SQLiteDatabase, uuid: () => string): Promise<string> {
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = 'device_id'",
  );
  if (row) return row.value;
  const id = uuid();
  await db.runAsync("INSERT OR IGNORE INTO settings (key, value) VALUES ('device_id', ?)", id);
  return (await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = 'device_id'",
  ))!.value;
}
