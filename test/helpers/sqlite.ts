import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

/** Execute the production SQL against SQLite, with real rollback semantics. */
export function sqlite() {
  const raw = new DatabaseSync(':memory:');
  const adapter = {
    execAsync: async (sql: string) => {
      raw.exec(sql);
    },
    getFirstAsync: async (sql: string, ...params: (string | number)[]) =>
      raw.prepare(sql).get(...params) ?? null,
    getAllAsync: async (sql: string, ...params: (string | number)[]) =>
      raw.prepare(sql).all(...params),
    runAsync: async (sql: string, ...params: (string | number)[]) =>
      raw.prepare(sql).run(...params),
    withExclusiveTransactionAsync: async (fn: (tx: SQLiteDatabase) => Promise<void>) => {
      raw.exec('BEGIN IMMEDIATE');
      try {
        await fn(adapter as unknown as SQLiteDatabase);
        raw.exec('COMMIT');
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
  };
  return { db: adapter as unknown as SQLiteDatabase, close: () => raw.close() };
}
