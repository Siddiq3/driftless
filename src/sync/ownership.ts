import type { SQLiteDatabase } from 'expo-sqlite';
import { scopeOf } from '@/db/scope';

export const BACKUP_OWNER_KEY = 'account_backup_owner';

/** Bind this local dataset before enabling uploads. Never transfer an old account's queue. */
export async function claimAccountBackup(
  db: SQLiteDatabase,
  userId: string,
  allowed: () => boolean = () => true,
): Promise<void> {
  const scope = scopeOf(db);
  if (scope.startsWith('account:')) {
    if (scope !== `account:${userId}`) throw new Error('Local scope belongs to another account');
    return;
  }
  await db.withExclusiveTransactionAsync(async (tx) => {
    const owners = await tx.getAllAsync<{ key: string; value: string }>(
      "SELECT key, value FROM settings WHERE key IN ('account_backup_owner', 'goal_backup_owner')",
    );
    if (owners.some((row) => row.value !== userId))
      throw new Error(
        'This phone’s saved progress belongs to another account. Sign in to that account to back it up. Your local data has been kept.',
      );
    if (owners.length === 0) {
      const queued = await tx.getFirstAsync<{ total: number }>(
        'SELECT (SELECT COUNT(*) FROM sync_days) + (SELECT COUNT(*) FROM sync_batch) AS total',
      );
      if (queued && queued.total > 0)
        throw new Error(
          'Older backup records have no account owner. They have been kept on this phone and will not be uploaded to a different account.',
        );
    }
    if (!allowed()) throw new Error('Backup cancelled');
    for (const key of [BACKUP_OWNER_KEY, 'goal_backup_owner'])
      await tx.runAsync('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', key, userId);
    // A session can change while an SQLite write is pending. Roll back the whole binding.
    if (!allowed()) throw new Error('Backup cancelled');
  });
}
