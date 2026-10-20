import { v1 } from '@siddiq3/driftless-contracts';
import { ApiError, type ApiClient } from '../api/client';
import { getDb } from '../db';
import { acknowledgeGoals, claimGoalBackup, loadGoals, mergeGoals } from './store';

type GoalApi = Pick<ApiClient, 'getGoals' | 'putGoals'>;
const running = new WeakMap<GoalApi, { userId: string; task: Promise<void>; cancelled: boolean }>();
const sameGoals = (a: v1.Goal[], b: v1.Goal[]) =>
  a.length === b.length &&
  a.every((g) =>
    b.some(
      (r) =>
        r.goalId === g.goalId &&
        r.metric === g.metric &&
        r.dailyLimit === g.dailyLimit &&
        r.enabled === g.enabled &&
        r.rev === g.rev,
    ),
  );

/** Local-first backup. Conditional writes preserve changes made by other devices during a pull. */
export function syncGoals(api: GoalApi, userId: string): Promise<void> {
  const active = running.get(api);
  if (active && !active.cancelled)
    return active.userId === userId
      ? active.task
      : Promise.reject(
          new Error('Another account has a goal backup in progress. Retry after it finishes.'),
        );
  const entry = { userId, cancelled: false, task: Promise.resolve() };
  const task = synchronize(api, userId, () => !entry.cancelled).finally(() => {
    if (running.get(api) === entry) running.delete(api);
  });
  entry.task = task;
  running.set(api, entry);
  return task;
}

/** Stop subsequent local merges/writes when consent or the signed-in session changes. */
export function cancelGoalSync(api: GoalApi): void {
  const entry = running.get(api);
  if (entry) entry.cancelled = true;
}

async function synchronize(api: GoalApi, userId: string, allowed: () => boolean): Promise<void> {
  const check = () => {
    if (!allowed()) throw new ApiError(409, 'sync_cancelled', 'Goal backup cancelled');
  };
  const db = await getDb();
  check();
  await claimGoalBackup(db, userId);
  for (let attempt = 0; attempt < 3; attempt++) {
    check();
    let remote: Awaited<ReturnType<GoalApi['getGoals']>>;
    try {
      remote = await api.getGoals(allowed);
    } catch (e) {
      if (
        e instanceof ApiError &&
        e.code !== 'sync_cancelled' &&
        [409, 412].includes(e.status ?? 0) &&
        attempt < 2
      )
        continue;
      throw e;
    }
    check();
    if (!remote.etag)
      throw new Error(
        'Goal backup needs a compatible server update. Your goals remain on this phone.',
      );
    await mergeGoals(db, remote.goals);
    const local = await loadGoals(db);
    v1.PutGoalsRequest.parse({ goals: local });
    if (sameGoals(local, remote.goals)) {
      await acknowledgeGoals(db, local);
      if (sameGoals(local, await loadGoals(db))) return;
      continue;
    }
    try {
      check();
      await api.putGoals(local, remote.etag, allowed);
      check();
      await acknowledgeGoals(db, local);
      if (sameGoals(local, await loadGoals(db))) return;
    } catch (e) {
      if (
        !(e instanceof ApiError) ||
        e.code === 'sync_cancelled' ||
        ![409, 412].includes(e.status ?? 0) ||
        attempt === 2
      )
        throw e;
    }
  }
  throw new Error('Goals changed during backup. Retry to back up the latest edits.');
}
