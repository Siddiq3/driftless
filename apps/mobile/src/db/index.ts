import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { migrate } from './migrations';

let dbPromise: Promise<SQLiteDatabase> | null = null;

/** Opens the app database once, enables WAL and applies migrations before first use. */
export function getDb(): Promise<SQLiteDatabase> {
  dbPromise ??= (async () => {
    const db = await openDatabaseAsync('driftless.db');
    await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    await migrate(db);
    return db;
  })();
  return dbPromise;
}
