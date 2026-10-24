import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { repairGoalIds } from '../goals/store';
import { migrate } from './migrations';
import { scopedDatabase, storageScope } from './scope';

let dbPromise: Promise<SQLiteDatabase> | null = null;

/** Opens the app database once, enables WAL and applies migrations before first use. */
export function getStorageDb(): Promise<SQLiteDatabase> {
  dbPromise ??= (async () => {
    const db = await openDatabaseAsync('driftless.db');
    try {
      await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
      await migrate(db);
      await repairGoalIds(db);
      return db;
    } catch (error) {
      await db.closeAsync().catch(() => undefined);
      throw error;
    }
  })().catch((error: unknown) => {
    dbPromise = null; // Storage failures can be retried without restarting the app.
    throw error;
  });
  return dbPromise;
}

export async function getDb(scope = storageScope()): Promise<SQLiteDatabase> {
  return scopedDatabase(await getStorageDb(), scope);
}
