import * as Notifications from 'expo-notifications';
import { Tracking } from 'tracking-android';
import type { SQLiteDatabase } from 'expo-sqlite';
import { getDb } from '@/db';
import { publishLocalChange, storageScope } from '@/db/scope';
import { clearSetup } from '@/onboarding/store';

/** Local display reset. Frozen backup/accounting requests retain their original bodies and
 * keys; native cumulative backup totals remain separate from cleared visible history. */
export async function wipePhone(accountDeleted = false): Promise<void> {
  const scope = storageScope();
  const db = await getDb(scope);
  const check = () => {
    if (storageScope() !== scope) throw new Error('Account changed during local reset. Retry.');
  };
  await Notifications.cancelScheduledNotificationAsync('evening-check-in');
  check();
  await db.runAsync(
    "INSERT OR REPLACE INTO settings VALUES ('phone_reset_pending',?)",
    JSON.stringify({ scope, accountDeleted }),
  );
  await completePhoneReset(db, scope, accountDeleted, check);
}

/** Complete an explicitly requested reset before selecting any session on app restart. No
 * historical dataset is exposed or bound while the cross-database cleanup is recovered. */
export async function resumePhoneReset(db: SQLiteDatabase): Promise<void> {
  const pending = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key='phone_reset_pending'",
  );
  if (!pending) return;
  const { scope, accountDeleted } = JSON.parse(pending.value);
  const check = () => {
    if (Tracking.dataScope() !== scope)
      throw new Error('Local reset recovery needs its original native scope');
  };
  check();
  await Notifications.cancelScheduledNotificationAsync('evening-check-in');
  check();
  await completePhoneReset(db, scope, accountDeleted, check);
}

async function completePhoneReset(
  db: SQLiteDatabase,
  scope: string,
  accountDeleted: boolean,
  check: () => void,
) {
  check();
  Tracking.resetAccountHistory();
  check();
  if (accountDeleted) Tracking.forgetAccountUsage();
  await db.withExclusiveTransactionAsync(async (tx) => {
    check();
    // Keep a revision fence for cloud goals cleared from the phone. Whole-set backup must
    // preserve those cloud records without importing them back into the local goal list.
    const goals = await tx.getAllAsync<{ scope: string; goal_id: string; rev: number }>(
      'SELECT scope,goal_id,rev FROM goals',
    );
    for (const s of new Set(goals.map((g) => g.scope))) {
      const key = `local_reset_goals:${s}`;
      const prior = await tx.getFirstAsync<{ value: string }>(
        'SELECT value FROM settings WHERE key=?',
        key,
      );
      const hidden: Record<string, number> = prior ? JSON.parse(prior.value) : {};
      for (const g of goals.filter((g) => g.scope === s))
        hidden[g.goal_id] = Math.max(hidden[g.goal_id] ?? 0, g.rev);
      await tx.runAsync(
        'INSERT OR REPLACE INTO settings VALUES (?,?)',
        key,
        JSON.stringify(hidden),
      );
    }
    await clearSetup(tx);
    await tx.runAsync(
      "DELETE FROM settings WHERE key='evening_reminder' OR key LIKE 'wrapped_seen_%'",
    );
    for (const table of [
      'goals',
      'goal_id_aliases',
      'goal_sync_state',
      'daily_cache',
      'outbox',
      'guest_imports',
    ])
      await tx.runAsync(`DELETE FROM ${table}`);
    // Preserve ownership bindings, not old hydration/import progress.
    await tx.runAsync(
      "UPDATE data_scopes SET source_scope=NULL, migration_state='local', hydrated_at=0, synced_generation=-1",
    );
    if (accountDeleted) {
      await tx.runAsync(
        'DELETE FROM settings WHERE key LIKE ? OR key=?',
        `account_usage:${scope}:%`,
        `local_reset_goals:${scope}`,
      );
      await tx.runAsync('DELETE FROM settings WHERE key=?', `push_registration:${scope}`);
      await tx.runAsync('DELETE FROM sync_batch WHERE scope=?', scope);
      await tx.runAsync('DELETE FROM sync_days WHERE scope=?', scope);
    }
    await tx.runAsync("DELETE FROM settings WHERE key='phone_reset_pending'");
    check();
  });
  publishLocalChange();
}
