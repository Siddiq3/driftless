import type { SQLiteDatabase } from 'expo-sqlite';
import { scopeOf } from '@/db/scope';

const readyKey = (scope: string) => `account_bootstrap_ready:${scope}`;
/** Only a completed restore for this exact local dataset may use the shorter startup path. */
export async function accountReady(db: SQLiteDatabase, allowed: () => boolean): Promise<boolean> {
  const scope = scopeOf(db);
  if (!allowed()) throw new Error('Account initialization cancelled');
  const ready = await db.getFirstAsync('SELECT value FROM settings WHERE key=?', readyKey(scope));
  const data = await db.getFirstAsync<{ hydrated_at: number }>(
    'SELECT hydrated_at FROM data_scopes WHERE scope=?',
    scope,
  );
  const pending = await db.getFirstAsync(
    "SELECT source_scope FROM guest_imports WHERE target_scope=? AND state!='verified' AND source_scope LIKE 'guest:%'",
    scope,
  );
  if (!allowed()) throw new Error('Account initialization cancelled');
  return Boolean(ready && data?.hydrated_at && !pending);
}
export async function markAccountReady(db: SQLiteDatabase, allowed: () => boolean) {
  if (!allowed()) throw new Error('Account initialization cancelled');
  await db.runAsync('INSERT OR REPLACE INTO settings VALUES (?,?)', readyKey(scopeOf(db)), '1');
}
