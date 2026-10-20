/**
 * Forward-only SQLite migrations for the JS-side store (UI cache + sync outbox).
 * The native tracking store (Kotlin/Room, D-008) is separate and is the source of truth for counts.
 */

export type Migration = { version: number; name: string; sql: string };

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: 'init',
    sql: `
      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
      -- Pending server mutations; each row is sent with its own Idempotency-Key.
      CREATE TABLE IF NOT EXISTS outbox (
        id              TEXT PRIMARY KEY NOT NULL,
        kind            TEXT NOT NULL,
        payload         TEXT NOT NULL,
        idempotency_key TEXT NOT NULL UNIQUE,
        attempts        INTEGER NOT NULL DEFAULT 0,
        next_attempt_at INTEGER NOT NULL,
        last_error      TEXT,
        created_at      INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS outbox_due ON outbox (next_attempt_at);
      -- Read-only cache of server history for offline display. Never holds raw observations.
      CREATE TABLE IF NOT EXISTS daily_cache (
        local_date TEXT NOT NULL,
        device_id  TEXT NOT NULL,
        platform   TEXT NOT NULL,
        tz         TEXT NOT NULL,
        views      INTEGER,
        ad_views   INTEGER,
        minutes    INTEGER,
        coverage   REAL NOT NULL,
        rev        INTEGER NOT NULL,
        PRIMARY KEY (local_date, device_id)
      );
    `,
  },
  {
    version: 2,
    name: 'usage_sync',
    sql: `
      -- One row per local day: latest values that may be synced, and how far the server has them.
      CREATE TABLE IF NOT EXISTS sync_days (
        local_date  TEXT PRIMARY KEY NOT NULL,
        values_key  TEXT NOT NULL,
        rev         INTEGER NOT NULL,
        synced_rev  INTEGER NOT NULL DEFAULT 0,
        values_json TEXT NOT NULL
      );
      -- At most one frozen in-flight batch (same days + Idempotency-Key across retries).
      CREATE TABLE IF NOT EXISTS sync_batch (
        id              TEXT PRIMARY KEY NOT NULL,
        idempotency_key TEXT NOT NULL,
        days_json       TEXT NOT NULL,
        attempts        INTEGER NOT NULL DEFAULT 0,
        next_attempt_at INTEGER NOT NULL
      );
    `,
  },
  {
    version: 3,
    name: 'goals',
    sql: `
      -- Local-first goals; backed up to the server when signed in (PUT /v1/goals).
      CREATE TABLE IF NOT EXISTS goals (
        goal_id     TEXT PRIMARY KEY NOT NULL,
        metric      TEXT NOT NULL CHECK (metric IN ('views', 'minutes')),
        daily_limit INTEGER NOT NULL CHECK (daily_limit BETWEEN 1 AND 2000),
        enabled     INTEGER NOT NULL DEFAULT 1,
        rev         INTEGER NOT NULL DEFAULT 1
      );
    `,
  },
  {
    version: 4,
    name: 'goal_compatibility',
    sql: `
      CREATE TABLE IF NOT EXISTS goal_id_aliases (
        legacy_id TEXT PRIMARY KEY NOT NULL,
        goal_id TEXT NOT NULL UNIQUE
      );
      CREATE TABLE IF NOT EXISTS goal_sync_state (
        goal_id TEXT PRIMARY KEY NOT NULL,
        synced_rev INTEGER NOT NULL DEFAULT 0
      );
    `,
  },
];

/** Subset of expo-sqlite's SQLiteDatabase used here (keeps the runner unit-testable). */
export type SqlDb = {
  execAsync(sql: string): Promise<void>;
  getFirstAsync<T>(sql: string): Promise<T | null>;
  withExclusiveTransactionAsync(fn: (txn: SqlDb) => Promise<void>): Promise<void>;
};

export async function currentVersion(db: SqlDb): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

/**
 * Applies pending migrations in order, each in its own exclusive transaction together with the
 * user_version bump, so a crash leaves the DB at a consistent version. Returns versions applied.
 * Refuses to run if the DB is newer than this app (downgrade protection).
 */
export async function migrate(
  db: SqlDb,
  migrations: readonly Migration[] = MIGRATIONS,
): Promise<number[]> {
  const sorted = [...migrations].sort((a, b) => a.version - b.version);
  sorted.forEach((m, i) => {
    if (m.version !== i + 1)
      throw new Error(`migration versions must be contiguous from 1 (got ${m.version})`);
  });
  const from = await currentVersion(db);
  const latest = sorted.at(-1)?.version ?? 0;
  if (from > latest) throw new Error(`database version ${from} is newer than app schema ${latest}`);
  const applied: number[] = [];
  for (const m of sorted.filter((x) => x.version > from)) {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.execAsync(m.sql);
      await txn.execAsync(`PRAGMA user_version = ${m.version}`);
    });
    applied.push(m.version);
  }
  return applied;
}
