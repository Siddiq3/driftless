import { randomUUID } from 'expo-crypto';
import { Tracking } from 'tracking-android';
import type { SQLiteDatabase } from 'expo-sqlite';
import { getStorageDb } from '@/db';
import { scopedDatabase, selectStorageScope, storageScope, publishLocalChange } from '@/db/scope';

const tables = [
  'goals',
  'goal_id_aliases',
  'goal_sync_state',
  'sync_days',
  'sync_batch',
  'daily_cache',
  'outbox',
] as const;
let transitions: Promise<unknown> = Promise.resolve();
export function selectPersonalSession(identity: string | null): Promise<void> {
  const task = transitions
    .catch(() => undefined)
    .then(async () => {
      const db = await getStorageDb();
      const native = Tracking.dataScope();
      let scope: string;
      if (identity) {
        const known = await db.getFirstAsync<{ scope: string }>(
          'SELECT scope FROM data_scopes WHERE identity_key = ?',
          identity,
        );
        scope = known?.scope ?? `pending:${randomUUID()}`;
        if (native.startsWith('guest:') && scope.startsWith('account:')) {
          const previous = await db.getFirstAsync<{ target_scope: string }>(
            'SELECT target_scope FROM guest_imports WHERE source_scope=?',
            native,
          );
          if (previous && previous.target_scope !== scope)
            throw new Error('Guest data already belongs to another account.');
          await db.runAsync(
            'INSERT OR IGNORE INTO guest_imports(source_scope,target_scope) VALUES (?,?)',
            native,
            scope,
          );
        }
        await db.runAsync(
          'INSERT OR IGNORE INTO data_scopes(scope, identity_key, source_scope) VALUES (?, ?, ?)',
          scope,
          identity,
          native.startsWith('guest:') ? native : null,
        );
      } else {
        scope = native.startsWith('guest:') ? native : `guest:${randomUUID()}`;
        await db.runAsync('INSERT OR IGNORE INTO data_scopes(scope) VALUES (?)', scope);
      }
      Tracking.setLimits([]);
      Tracking.selectDataScope(scope);
      selectStorageScope(scope);
      await db.runAsync("INSERT OR REPLACE INTO settings VALUES ('active_data_scope', ?)", scope);
    });
  transitions = task.catch(() => undefined);
  return task;
}

/** Bind only after /me resolves a verified backend owner. Journal both database transitions. */
export async function resolvePersonalAccount(
  userId: string,
  allowed: () => boolean,
): Promise<SQLiteDatabase> {
  const raw = await getStorageDb();
  const from = storageScope();
  const target = `account:${userId}`;
  const check = () => {
    if (!allowed()) throw new Error('Account synchronization cancelled');
  };
  check();
  const pending = await raw.getFirstAsync<{
    identity_key: string | null;
    source_scope: string | null;
  }>('SELECT identity_key, source_scope FROM data_scopes WHERE scope = ?', from);
  await raw.withExclusiveTransactionAsync(async (tx) => {
    check();
    await tx.runAsync(
      'INSERT OR IGNORE INTO data_scopes(scope, backend_owner) VALUES (?, ?)',
      target,
      userId,
    );
    if (pending?.identity_key)
      await tx.runAsync('UPDATE data_scopes SET identity_key = NULL WHERE scope = ?', from);
    if (pending?.identity_key)
      await tx.runAsync(
        'UPDATE data_scopes SET identity_key = ? WHERE scope = ?',
        pending.identity_key,
        target,
      );
    for (const source of [pending?.source_scope, from.startsWith('pending:') ? from : null].filter(
      (x): x is string => !!x,
    )) {
      const bound = await tx.getFirstAsync<{ target_scope: string }>(
        'SELECT target_scope FROM guest_imports WHERE source_scope = ?',
        source,
      );
      if (bound && bound.target_scope !== target)
        throw new Error('This guest history is assigned to another account.');
      await tx.runAsync(
        'INSERT OR IGNORE INTO guest_imports(source_scope,target_scope) VALUES (?,?)',
        source,
        target,
      );
    }
    check();
  });
  // Upgrade only legacy records carrying an exact persisted backend owner.
  const legacy = await raw.getFirstAsync<{ backend_owner: string }>(
    'SELECT backend_owner FROM data_scopes WHERE scope=?',
    'legacy',
  );
  if (legacy?.backend_owner === userId)
    await raw.runAsync(
      'INSERT OR IGNORE INTO guest_imports(source_scope,target_scope) VALUES (?,?)',
      'legacy',
      target,
    );
  const imports = await raw.getAllAsync<{ source_scope: string; state: string }>(
    'SELECT source_scope,state FROM guest_imports WHERE target_scope=? AND state != ?',
    target,
    'complete',
  );
  // Freeze native background writes before importing the old guest scope.
  check();
  Tracking.selectDataScope(target);
  selectStorageScope(target);
  for (const journal of imports) {
    check();
    if (journal.source_scope === 'legacy') Tracking.importGuestScope('legacy', target, true);
    else if (journal.source_scope.startsWith('guest:'))
      Tracking.importGuestScope(journal.source_scope, target);
    else if (journal.source_scope.startsWith('pending:')) {
      // Pending writes are account-owned but can still use the same native merge transaction.
      Tracking.importGuestScope(journal.source_scope, target);
    }
    await raw.withExclusiveTransactionAsync(async (tx) => {
      check();
      const state = await tx.getFirstAsync<{ state: string }>(
        'SELECT state FROM guest_imports WHERE source_scope=?',
        journal.source_scope,
      );
      if (state?.state === 'bound') {
        for (const table of tables) {
          const columns = await tx.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
          const names = columns.map((c) => c.name).filter((name) => name !== 'scope');
          if (table === 'goals') {
            // A guest's unsynced edit wins only the same stable goal identity, rebased above both revisions.
            await tx.runAsync(
              `INSERT INTO goals(scope,goal_id,metric,daily_limit,enabled,rev) SELECT ?,goal_id,metric,daily_limit,enabled,rev FROM goals WHERE scope=? AND 1 ON CONFLICT(scope,goal_id) DO UPDATE SET metric=excluded.metric,daily_limit=excluded.daily_limit,enabled=excluded.enabled,rev=MAX(goals.rev,excluded.rev)+1`,
              target,
              journal.source_scope,
            );
          } else {
            // Keep target acknowledgements/tombstones; native merged totals are restaged by the existing engine.
            await tx.runAsync(
              `INSERT OR IGNORE INTO ${table} (scope,${names.join(',')}) SELECT ?,${names.join(',')} FROM ${table} WHERE scope=?`,
              target,
              journal.source_scope,
            );
          }
        }
        await tx.runAsync(
          "UPDATE guest_imports SET state='imported' WHERE source_scope=?",
          journal.source_scope,
        );
      }
      check();
    });
  }
  check();
  await raw.runAsync("INSERT OR REPLACE INTO settings VALUES ('active_data_scope', ?)", target);
  if (imports.some((journal) => journal.state === 'bound')) publishLocalChange();
  return scopedDatabase(raw, target);
}

export async function acknowledgeGuestImports(
  db: SQLiteDatabase,
  target: string,
  allowed: () => boolean,
) {
  await db.withExclusiveTransactionAsync(async (tx) => {
    if (!allowed()) throw new Error('Account synchronization cancelled');
    const pending = await tx.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM sync_days WHERE scope=? AND rev>synced_rev',
      target,
    );
    if (!pending?.n)
      await tx.runAsync(
        "UPDATE guest_imports SET state='complete' WHERE target_scope=? AND state='imported'",
        target,
      );
    if (!allowed()) throw new Error('Account synchronization cancelled');
  });
}
