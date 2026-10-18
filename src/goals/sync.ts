import type { ApiClient } from '../api/client';
import { getDb } from '../db';
import { loadGoals, mergeGoals } from './store';

/**
 * Two-way goal backup: pull server goals (higher rev wins locally), then push the merged set.
 * Local goals keep working if this fails.
 */
export async function syncGoals(api: Pick<ApiClient, 'getGoals' | 'putGoals'>): Promise<void> {
  const db = await getDb();
  const remote = await api.getGoals();
  await mergeGoals(db, remote.goals);
  const local = await loadGoals(db);
  await api.putGoals(local);
}
