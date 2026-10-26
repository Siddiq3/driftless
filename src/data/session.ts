import { randomUUID } from 'expo-crypto';
import { Tracking } from 'tracking-android';
import type { SQLiteDatabase } from 'expo-sqlite';
import { getStorageDb } from '@/db';
import { scopedDatabase, selectStorageScope, storageScope } from '@/db/scope';

let transitions: Promise<unknown> = Promise.resolve();
/** Capture only the current, unowned guest scope before authentication changes visibility. */
export function selectPersonalSession(identity: string | null): Promise<void> {
  const task = transitions
    .catch(() => undefined)
    .then(async () => {
      const db = await getStorageDb();
      const pendingReset = await db.getFirstAsync(
        "SELECT value FROM settings WHERE key='phone_reset_pending'",
      );
      if (pendingReset) await (await import('./reset')).resumePhoneReset(db);
      const native = Tracking.dataScope();
      const saved = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM settings WHERE key='available_guest_scope'",
      );
      const candidate = native.startsWith('guest:') ? native : saved?.value;
      const claimed =
        candidate &&
        (await db.getFirstAsync(
          'SELECT source_scope FROM guest_imports WHERE source_scope=?',
          candidate,
        ));
      const guest = candidate?.startsWith('guest:') && !claimed ? candidate : null;
      const scope = identity ? `pending:${randomUUID()}` : guest ? guest : `guest:${randomUUID()}`;
      await db.runAsync('INSERT OR IGNORE INTO data_scopes(scope) VALUES (?)', scope);
      if (identity && guest) {
        await db.runAsync(
          'UPDATE data_scopes SET source_scope=?,identity_key=? WHERE scope=?',
          guest,
          identity,
          scope,
        );
      }
      if (!identity)
        await db.runAsync(
          "INSERT OR REPLACE INTO settings VALUES ('available_guest_scope',?)",
          scope,
        );
      Tracking.setLimits([]);
      Tracking.selectDataScope(scope);
      selectStorageScope(scope);
      await db.runAsync("INSERT OR REPLACE INTO settings VALUES ('active_data_scope', ?)", scope);
    });
  transitions = task.catch(() => undefined);
  return task;
}

/** Only the verified incarnation selects account storage. Import is an explicit bootstrap step. */
export async function resolvePersonalAccount(
  userId: string,
  incarnation: string,
  allowed: () => boolean,
  importGuest = false,
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
      if (importGuest) {
        // Resume an already bound journal even after process death. Never scan old datasets.
        const pending = await raw.getFirstAsync<{
          source_scope: string | null;
          identity_key: string | null;
        }>('SELECT source_scope,identity_key FROM data_scopes WHERE scope=?', storageScope());
        const source = pending?.source_scope;
        if (source?.startsWith('guest:') && pending?.identity_key) {
          await raw.withExclusiveTransactionAsync(async (tx) => {
            check();
            const owner = await tx.getFirstAsync<{ backend_owner: string | null }>(
              'SELECT backend_owner FROM data_scopes WHERE scope=?',
              source,
            );
            const prior = await tx.getFirstAsync<{ target_scope: string }>(
              'SELECT target_scope FROM guest_imports WHERE source_scope=?',
              source,
            );
            if (owner?.backend_owner || (prior && prior.target_scope !== target))
              throw new Error('Guest history already belongs to another account');
            await tx.runAsync(
              'INSERT OR IGNORE INTO guest_imports(source_scope,target_scope) VALUES (?,?)',
              source,
              target,
            );
            check();
          });
        }
        const imports = await raw.getAllAsync<{ source_scope: string }>(
          "SELECT source_scope FROM guest_imports WHERE target_scope=? AND state!='verified'",
          target,
        );
        for (const entry of imports) {
          check();
          if (!entry.source_scope.startsWith('guest:')) continue; // legacy journals stay quarantined
          // Native transaction has its own one-owner, exactly-once journal. Source is retained.
          Tracking.importGuestScope(entry.source_scope, target, false);
          await raw.withExclusiveTransactionAsync(async (tx) => {
            check();
            await tx.runAsync(
              `INSERT OR IGNORE INTO goals(scope,goal_id,metric,daily_limit,enabled,rev)
              SELECT ?,goal_id,metric,daily_limit,enabled,rev FROM goals WHERE scope=?`,
              target,
              entry.source_scope,
            );
            await tx.runAsync(
              "UPDATE guest_imports SET state='copied' WHERE source_scope=?",
              entry.source_scope,
            );
            check();
          });
        }
      }
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

/** Mark completion only after server readback; retain source rows for recovery. */
export async function acknowledgeGuestImports(
  db: SQLiteDatabase,
  target: string,
  allowed: () => boolean,
) {
  if (!allowed()) throw new Error('Guest import cancelled');
  await db.runAsync(
    "UPDATE guest_imports SET state='verified' WHERE target_scope=? AND state='copied' AND source_scope LIKE 'guest:%'",
    target,
  );
}
