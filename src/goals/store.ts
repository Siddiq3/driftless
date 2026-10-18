import type { v1 } from '@siddiq3/driftless-contracts';
import type { SQLiteDatabase } from 'expo-sqlite';

type Row = {
  goal_id: string;
  metric: 'views' | 'minutes';
  daily_limit: number;
  enabled: number;
  rev: number;
};

export async function loadGoals(db: SQLiteDatabase): Promise<v1.Goal[]> {
  const rows = await db.getAllAsync<Row>('SELECT * FROM goals ORDER BY metric');
  return rows.map((r) => ({
    goalId: r.goal_id,
    metric: r.metric,
    dailyLimit: r.daily_limit,
    enabled: r.enabled === 1,
    rev: r.rev,
  }));
}

/** Upserts one goal, bumping its rev so the server accepts it as newer. */
export async function saveGoal(db: SQLiteDatabase, g: Omit<v1.Goal, 'rev'>): Promise<v1.Goal> {
  const cur = await db.getFirstAsync<{ rev: number }>(
    'SELECT rev FROM goals WHERE goal_id = ?',
    g.goalId,
  );
  const rev = (cur?.rev ?? 0) + 1;
  await db.runAsync(
    'INSERT OR REPLACE INTO goals (goal_id, metric, daily_limit, enabled, rev) VALUES (?, ?, ?, ?, ?)',
    g.goalId,
    g.metric,
    g.dailyLimit,
    g.enabled ? 1 : 0,
    rev,
  );
  return { ...g, rev };
}

export async function deleteGoal(db: SQLiteDatabase, goalId: string): Promise<void> {
  await db.runAsync('DELETE FROM goals WHERE goal_id = ?', goalId);
}

/** Merge server goals into local storage: higher rev wins per goal. */
export async function mergeGoals(db: SQLiteDatabase, remote: v1.Goal[]): Promise<void> {
  for (const g of remote) {
    const cur = await db.getFirstAsync<{ rev: number }>(
      'SELECT rev FROM goals WHERE goal_id = ?',
      g.goalId,
    );
    if (cur && cur.rev >= g.rev) continue;
    await db.runAsync(
      'INSERT OR REPLACE INTO goals (goal_id, metric, daily_limit, enabled, rev) VALUES (?, ?, ?, ?, ?)',
      g.goalId,
      g.metric,
      g.dailyLimit,
      g.enabled ? 1 : 0,
      g.rev,
    );
  }
}
