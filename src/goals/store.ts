import { v1 } from '@siddiq3/driftless-contracts';
import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';
import { ApiError } from '../api/client';
import { scopeOf, publishLocalChange } from '../db/scope';

const checkAllowed = (allowed: () => boolean) => {
  if (!allowed()) throw new ApiError(409, 'sync_cancelled', 'Goal backup cancelled');
};

type Row = {
  goal_id: string;
  metric: 'views' | 'minutes';
  daily_limit: number;
  enabled: number;
  rev: number;
};
const fromRow = (r: Row): v1.Goal => ({
  goalId: r.goal_id,
  metric: r.metric,
  dailyLimit: r.daily_limit,
  enabled: r.enabled === 1,
  rev: r.rev,
});
const sameValues = (a: v1.Goal, b: v1.Goal) =>
  a.goalId === b.goalId &&
  a.metric === b.metric &&
  a.dailyLimit === b.dailyLimit &&
  a.enabled === b.enabled;

/** Repair only identity, atomically; limits, enabled state and revisions remain untouched. */
export async function repairGoalIds(db: SQLiteDatabase): Promise<void> {
  const scope = scopeOf(db);
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const row of await tx.getAllAsync<Row>('SELECT * FROM goals WHERE scope = ?', scope)) {
      if (v1.Goal.shape.goalId.safeParse(row.goal_id).success) continue;
      const alias = await tx.getFirstAsync<{ goal_id: string }>(
        'SELECT goal_id FROM goal_id_aliases WHERE legacy_id = ? AND scope = ?',
        row.goal_id,
        scope,
      );
      const id = alias?.goal_id ?? randomUUID();
      await tx.runAsync(
        'INSERT OR IGNORE INTO goal_id_aliases (legacy_id, goal_id, scope) VALUES (?, ?, ?)',
        row.goal_id,
        id,
        scope,
      );
      await tx.runAsync(
        'UPDATE goals SET goal_id = ? WHERE goal_id = ? AND scope = ?',
        id,
        row.goal_id,
        scope,
      );
      await tx.runAsync(
        'UPDATE goal_sync_state SET goal_id = ? WHERE goal_id = ? AND scope = ?',
        id,
        row.goal_id,
        scope,
      );
    }
  });
}

export async function loadGoals(db: SQLiteDatabase): Promise<v1.Goal[]> {
  const scope = scopeOf(db);
  return (
    await db.getAllAsync<Row>('SELECT * FROM goals WHERE scope = ? ORDER BY metric', scope)
  ).map(fromRow);
}

/** Atomic revision increment also protects overlapping UI saves. Accepts stale legacy handles. */
export async function saveGoal(db: SQLiteDatabase, input: Omit<v1.Goal, 'rev'>): Promise<v1.Goal> {
  const scope = scopeOf(db);
  const alias = await db.getFirstAsync<{ goal_id: string }>(
    'SELECT goal_id FROM goal_id_aliases WHERE legacy_id = ? AND scope = ?',
    input.goalId,
    scope,
  );
  const g = v1.Goal.parse({ ...input, goalId: alias?.goal_id ?? input.goalId, rev: 1 });
  // Apply the same cross-field validation as the cloud before changing local data.
  v1.PutGoalsRequest.parse({ goals: [g] });
  const row = await db.getFirstAsync<Row>(
    `INSERT INTO goals (goal_id, metric, daily_limit, enabled, rev, scope) VALUES (?, ?, ?, ?, 1, ?)
     ON CONFLICT(scope, goal_id) DO UPDATE SET metric = excluded.metric,
       daily_limit = excluded.daily_limit, enabled = excluded.enabled, rev = goals.rev + 1
     RETURNING *`,
    g.goalId,
    g.metric,
    g.dailyLimit,
    g.enabled ? 1 : 0,
    scope,
  );
  if (!row) throw new Error('Could not save your goal');
  publishLocalChange();
  return fromRow(row);
}

/** Local goal deletion is currently unused by the UI; never silently resurrect it from backup. */
export async function deleteGoal(db: SQLiteDatabase, goalId: string): Promise<void> {
  const scope = scopeOf(db);
  await db.withExclusiveTransactionAsync(async (tx) => {
    const alias = await tx.getFirstAsync<{ goal_id: string }>(
      'SELECT goal_id FROM goal_id_aliases WHERE legacy_id = ? AND scope = ?',
      goalId,
      scope,
    );
    goalId = alias?.goal_id ?? goalId;
    await tx.runAsync('DELETE FROM goals WHERE goal_id = ? AND scope = ?', goalId, scope);
    await tx.runAsync(
      'INSERT OR REPLACE INTO goal_sync_state (goal_id, synced_rev, scope) VALUES (?, -1, ?)',
      goalId,
      scope,
    );
  });
}

/** Unsynced local edits win a conflict, rebased above the remote revision. */
export async function mergeGoals(
  db: SQLiteDatabase,
  remote: v1.Goal[],
  allowed: () => boolean = () => true,
): Promise<void> {
  const scope = scopeOf(db);
  await db.withExclusiveTransactionAsync(async (tx) => {
    checkAllowed(allowed);
    for (const g of remote) {
      checkAllowed(allowed);
      const state = await tx.getFirstAsync<{ synced_rev: number }>(
        'SELECT synced_rev FROM goal_sync_state WHERE goal_id = ? AND scope = ?',
        g.goalId,
        scope,
      );
      if (state?.synced_rev === -1) continue;
      const row = await tx.getFirstAsync<Row>(
        'SELECT * FROM goals WHERE goal_id = ? AND scope = ?',
        g.goalId,
        scope,
      );
      const local = row && fromRow(row);
      const dirty = local && local.rev > (state?.synced_rev ?? 0);
      if (local && sameValues(local, g)) {
        const rev = Math.max(local.rev, g.rev);
        await tx.runAsync(
          'UPDATE goals SET rev = ? WHERE goal_id = ? AND scope = ?',
          rev,
          g.goalId,
          scope,
        );
        await tx.runAsync(
          'INSERT OR REPLACE INTO goal_sync_state (goal_id, synced_rev, scope) VALUES (?, ?, ?)',
          g.goalId,
          g.rev,
          scope,
        );
      } else if (local && dirty) {
        await tx.runAsync(
          'UPDATE goals SET rev = ? WHERE goal_id = ? AND scope = ?',
          Math.max(local.rev, g.rev + 1),
          g.goalId,
          scope,
        );
      } else if (!local || g.rev >= local.rev) {
        await tx.runAsync(
          'INSERT OR REPLACE INTO goals (goal_id, metric, daily_limit, enabled, rev, scope) VALUES (?, ?, ?, ?, ?, ?)',
          g.goalId,
          g.metric,
          g.dailyLimit,
          g.enabled ? 1 : 0,
          g.rev,
          scope,
        );
        await tx.runAsync(
          'INSERT OR REPLACE INTO goal_sync_state (goal_id, synced_rev, scope) VALUES (?, ?, ?)',
          g.goalId,
          g.rev,
          scope,
        );
      }
    }
    checkAllowed(allowed);
  });
}

/** Never acknowledge edits made while the network request was in flight. */
export async function acknowledgeGoals(
  db: SQLiteDatabase,
  sent: v1.Goal[],
  allowed: () => boolean = () => true,
): Promise<void> {
  const scope = scopeOf(db);
  await db.withExclusiveTransactionAsync(async (tx) => {
    checkAllowed(allowed);
    for (const g of sent) {
      const row = await tx.getFirstAsync<Row>(
        'SELECT * FROM goals WHERE goal_id = ? AND scope = ?',
        g.goalId,
        scope,
      );
      if (row && row.rev === g.rev && sameValues(fromRow(row), g)) {
        await tx.runAsync(
          'INSERT OR REPLACE INTO goal_sync_state (goal_id, synced_rev, scope) VALUES (?, ?, ?)',
          g.goalId,
          g.rev,
          scope,
        );
      }
    }
    checkAllowed(allowed);
  });
}

/** A second account must not receive the first account's downloaded goals. Keep local data intact. */
export async function claimGoalBackup(
  db: SQLiteDatabase,
  userId: string,
  allowed: () => boolean = () => true,
): Promise<void> {
  const scope = scopeOf(db);
  await db.withExclusiveTransactionAsync(async (tx) => {
    checkAllowed(allowed);
    const row = await tx.getFirstAsync<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      `goal_backup_owner:${scope}`,
    );
    if (row && row.value !== userId)
      throw new Error(
        'Goal backup belongs to another account on this phone. Sign in to that account to retry. Your local goals are unchanged.',
      );
    await tx.runAsync(
      'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
      `goal_backup_owner:${scope}`,
      userId,
    );
    checkAllowed(allowed);
  });
}
