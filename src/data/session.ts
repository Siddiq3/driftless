import { randomUUID } from 'expo-crypto';
import { Tracking } from 'tracking-android';
import type { SQLiteDatabase } from 'expo-sqlite';
import { getStorageDb } from '@/db';
import { scopedDatabase, selectStorageScope, storageScope } from '@/db/scope';

let transitions: Promise<unknown> = Promise.resolve();
/** Sign-in opens an empty pending scope. Stable Google identity never selects historical data. */
export function selectPersonalSession(identity: string | null): Promise<void> {
  const task = transitions
    .catch(() => undefined)
    .then(async () => {
      const db = await getStorageDb();
      const pendingReset=await db.getFirstAsync("SELECT value FROM settings WHERE key='phone_reset_pending'");
      if(pendingReset) await (await import('./reset')).resumePhoneReset(db);
      const native = Tracking.dataScope();
      const scope = identity
        ? `pending:${randomUUID()}`
        : native.startsWith('guest:')
          ? native
          : `guest:${randomUUID()}`;
      await db.runAsync('INSERT OR IGNORE INTO data_scopes(scope) VALUES (?)', scope);
      Tracking.setLimits([]);
      Tracking.selectDataScope(scope);
      selectStorageScope(scope);
      await db.runAsync("INSERT OR REPLACE INTO settings VALUES ('active_data_scope', ?)", scope);
    });
  transitions = task.catch(() => undefined);
  return task;
}

/** No import or rebinding: legacy, guest, pending, and earlier-incarnation datasets stay intact.
 * The server-provided incarnation, not the stable identity, selects the local namespace. */
export async function resolvePersonalAccount(
  userId: string,
  incarnation: string,
  allowed: () => boolean,
): Promise<SQLiteDatabase> {
  if (!/^[0-9a-f-]{36}$/i.test(incarnation))
    throw new Error('A verified account incarnation is required');
  const task = transitions
    .catch(() => undefined)
    .then(async () => {
      const raw = await getStorageDb();
      const target = `account:${incarnation}`;
      const check = () => {
        if (!allowed()) throw new Error('Account synchronization cancelled');
      };
      check();
      await raw.withExclusiveTransactionAsync(async (tx) => {
        check();
        const existing = await tx.getFirstAsync<{ backend_owner: string | null }>(
          'SELECT backend_owner FROM data_scopes WHERE scope=?',
          target,
        );
        const binding = `${userId}:${incarnation}`;
        if (existing && existing.backend_owner !== binding)
          throw new Error('Local dataset is quarantined');
        await tx.runAsync(
          'INSERT OR IGNORE INTO data_scopes(scope,backend_owner) VALUES (?,?)',
          target,
          binding,
        );
        check();
      });
      check();
      if (storageScope() !== target) {
        Tracking.setLimits([]);
        Tracking.selectDataScope(target);
        selectStorageScope(target);
      }
      await raw.runAsync("INSERT OR REPLACE INTO settings VALUES ('active_data_scope', ?)", target);
      check();
      return scopedDatabase(raw, target);
    });
  transitions = task.catch(() => undefined);
  return task;
}

/** Legacy import journals are retained but never acknowledged by a fresh incarnation. */
export async function acknowledgeGuestImports(
  _db: SQLiteDatabase,
  _target: string,
  _allowed: () => boolean,
) {}
