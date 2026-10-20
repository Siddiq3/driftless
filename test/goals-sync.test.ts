jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));
jest.mock('../src/db', () => ({ getDb: jest.fn() }));
import { randomUUID } from 'node:crypto';
import type { SQLiteDatabase } from 'expo-sqlite';
import { v1 } from '@siddiq3/driftless-contracts';
import { getDb } from '../src/db';
import { migrate, MIGRATIONS } from '../src/db/migrations';
import {
  acknowledgeGoals,
  deleteGoal,
  claimGoalBackup,
  loadGoals,
  mergeGoals,
  repairGoalIds,
  saveGoal,
} from '../src/goals/store';
import { cancelGoalSync, syncGoals } from '../src/goals/sync';
import { ApiError } from '../src/api/client';
import { finishSetup } from '../src/onboarding/store';
import { EMPTY_ANSWERS } from '../src/onboarding/model';
import { sqlite } from './helpers/sqlite';

const goal = (over: Partial<v1.Goal> = {}): v1.Goal => ({
  goalId: randomUUID(),
  metric: 'minutes',
  dailyLimit: 30,
  enabled: true,
  rev: 1,
  ...over,
});
let db: SQLiteDatabase;
let close: () => void;
beforeEach(async () => {
  ({ db, close } = sqlite());
  await migrate(db);
  jest.mocked(getDb).mockResolvedValue(db);
});
afterEach(() => close());
const api = (remote: v1.Goal[] = []) => ({
  getGoals: jest.fn().mockResolvedValue({ goals: remote, etag: '"goals-1"' }),
  putGoals: jest.fn().mockImplementation(async (goals: v1.Goal[]) => ({ goals })),
});

it('upgrades v3 seed IDs once, preserving all goal fields and unrelated data', async () => {
  const f = sqlite();
  await migrate(f.db, MIGRATIONS.slice(0, 3));
  const valid = goal();
  await f.db.runAsync(
    'INSERT INTO goals VALUES (?, ?, ?, ?, ?)',
    valid.goalId,
    valid.metric,
    valid.dailyLimit,
    1,
    4,
  );
  await f.db.runAsync("INSERT INTO goals VALUES ('setup-minutes', 'minutes', 80, 0, 7)");
  await migrate(f.db);
  await repairGoalIds(f.db);
  expect(await loadGoals(f.db)).toEqual(
    expect.arrayContaining([
      { ...valid, rev: 4 },
      expect.objectContaining({ dailyLimit: 80, enabled: false, rev: 7 }),
    ]),
  );
  f.close();
});

it('repairs seed IDs idempotently and accepts stale editor handles without duplicating goals', async () => {
  await db.runAsync("INSERT INTO goals VALUES ('setup-views', 'views', 75, 0, 9)");
  await db.runAsync("INSERT INTO goals VALUES ('setup-minutes', 'minutes', 45, 1, 3)");
  await db.runAsync("INSERT INTO settings VALUES ('unrelated', 'keep')");
  const valid = goal();
  await saveGoal(db, valid);
  await repairGoalIds(db);
  const first = await loadGoals(db);
  expect(first).toHaveLength(3);
  for (const g of first) expect(v1.Goal.safeParse(g).success).toBe(true);
  expect(first).toContainEqual(
    expect.objectContaining({ metric: 'views', dailyLimit: 75, enabled: false, rev: 9 }),
  );
  await repairGoalIds(db);
  expect(await loadGoals(db)).toEqual(first);
  const updated = await saveGoal(db, {
    goalId: 'setup-views',
    metric: 'views',
    dailyLimit: 100,
    enabled: true,
  });
  expect(updated.goalId).toBe(first.find((g) => g.metric === 'views')!.goalId);
  expect(updated.rev).toBe(10);
  expect(await loadGoals(db)).toHaveLength(3);
  expect(await db.getFirstAsync('SELECT value FROM settings WHERE key = ?', 'unrelated')).toEqual({
    value: 'keep',
  });
});

it('rolls back ID repair failures and can retry safely', async () => {
  await db.runAsync("INSERT INTO goals VALUES ('setup-views', 'views', 50, 1, 2)");
  await db.execAsync(
    "CREATE TRIGGER fail_repair BEFORE UPDATE ON goals BEGIN SELECT RAISE(ABORT, 'disk full'); END;",
  );
  await expect(repairGoalIds(db)).rejects.toThrow('disk full');
  expect((await loadGoals(db))[0]!.goalId).toBe('setup-views');
  expect(await db.getAllAsync('SELECT * FROM goal_id_aliases')).toEqual([]);
  await db.execAsync('DROP TRIGGER fail_repair');
  await repairGoalIds(db);
  expect(v1.Goal.safeParse((await loadGoals(db))[0]).success).toBe(true);
});

it('onboarding reuses an existing goal and preserves other goals', async () => {
  const g = goal();
  const other = goal({ metric: 'views', dailyLimit: 100 });
  await saveGoal(db, g);
  await saveGoal(db, other);
  await finishSetup(db, {
    version: 1,
    completed: false,
    step: 0,
    answers: EMPTY_ANSWERS,
    plan: { metric: 'minutes', dailyLimit: 45 },
  });
  expect(await loadGoals(db)).toEqual(
    expect.arrayContaining([{ ...g, dailyLimit: 45, rev: 2 }, other]),
  );
  expect(await loadGoals(db)).toHaveLength(2);
});

it('rejects invalid IDs and minutes locally without changing stored goals', async () => {
  await expect(saveGoal(db, goal({ goalId: 'setup-minutes' }))).rejects.toThrow();
  await expect(saveGoal(db, goal({ dailyLimit: 1441 }))).rejects.toThrow();
  expect(await loadGoals(db)).toEqual([]);
});

it('keeps unsynced edits over higher remote revisions and imports distinct cloud goals', async () => {
  const g = goal();
  await saveGoal(db, g);
  await acknowledgeGoals(db, [g]);
  await saveGoal(db, { ...g, dailyLimit: 60 });
  const other = goal({ metric: 'views' });
  await mergeGoals(db, [{ ...g, dailyLimit: 90, rev: 8 }, other]);
  expect(await loadGoals(db)).toEqual(
    expect.arrayContaining([{ ...g, dailyLimit: 60, rev: 9 }, other]),
  );
});

it('imports a newer remote change when the local revision was acknowledged', async () => {
  const g = goal();
  await saveGoal(db, g);
  await acknowledgeGoals(db, [g]);
  await mergeGoals(db, [{ ...g, dailyLimit: 90, rev: 2 }]);
  expect(await loadGoals(db)).toEqual([{ ...g, dailyLimit: 90, rev: 2 }]);
});

it('offline and lost-response retries preserve edits and do not duplicate goals', async () => {
  const g = goal();
  await saveGoal(db, g);
  const a = api();
  a.getGoals.mockRejectedValueOnce(new ApiError(null, 'network', 'offline'));
  await expect(syncGoals(a, 'user-a')).rejects.toThrow('offline');
  expect(await loadGoals(db)).toEqual([g]);
  a.putGoals.mockRejectedValueOnce(new ApiError(null, 'network', 'lost response'));
  await expect(syncGoals(a, 'user-a')).rejects.toThrow('lost response');
  a.getGoals.mockResolvedValue({ goals: [g], etag: '"goals-2"' });
  await syncGoals(a, 'user-a');
  expect(await loadGoals(db)).toEqual([g]);
});

it('re-pulls after a stale whole-set write and preserves both devices goals', async () => {
  const local = goal();
  const other = goal({ metric: 'views' });
  await saveGoal(db, local);
  const a = api();
  a.putGoals.mockRejectedValueOnce(new ApiError(412, 'precondition_failed', 'changed'));
  a.getGoals
    .mockResolvedValueOnce({ goals: [], etag: '"goals-0"' })
    .mockResolvedValue({ goals: [other], etag: '"goals-1"' });
  await syncGoals(a, 'user-a');
  expect(a.putGoals.mock.calls[1][0]).toEqual(expect.arrayContaining([local, other]));
  expect(a.putGoals.mock.calls[1][1]).toBe('"goals-1"');
});

it('reports repeated conflicts and incompatible servers without dropping local data', async () => {
  const g = goal();
  await saveGoal(db, g);
  const a = api();
  a.putGoals.mockRejectedValue(new ApiError(409, 'goal_conflict', 'changed'));
  await expect(syncGoals(a, 'user-a')).rejects.toThrow('changed');
  expect(a.putGoals).toHaveBeenCalledTimes(3);
  a.getGoals.mockResolvedValue({ goals: [], etag: null });
  await expect(syncGoals(a, 'user-a')).rejects.toThrow('compatible server');
  expect(a.putGoals).toHaveBeenCalledTimes(3);
  expect(await loadGoals(db)).toEqual([g]);
});

it('drains an edit made during upload, and overlapping backup calls share one task', async () => {
  const g = goal();
  await saveGoal(db, g);
  const a = api();
  a.putGoals.mockImplementationOnce(async () => {
    await saveGoal(db, { ...g, dailyLimit: 70 });
    return { goals: [g] };
  });
  const first = syncGoals(a, 'user-a');
  expect(syncGoals(a, 'user-a')).toBe(first);
  await expect(syncGoals(a, 'user-b')).rejects.toThrow('Another account');
  await first;
  expect(a.putGoals).toHaveBeenCalledTimes(2);
  await saveGoal(db, { ...g, dailyLimit: 70 });
  await mergeGoals(db, [{ ...g, dailyLimit: 90, rev: 5 }]);
  expect(await loadGoals(db)).toEqual([{ ...g, dailyLimit: 70, rev: 6 }]);
});

it('refuses to upload another accounts goals and leaves stored data unchanged', async () => {
  const g = goal();
  await saveGoal(db, g);
  await claimGoalBackup(db, 'user-a');
  const a = api();
  await expect(syncGoals(a, 'user-b')).rejects.toThrow('another account');
  expect(a.getGoals).not.toHaveBeenCalled();
  expect(await loadGoals(db)).toEqual([g]);
});

it('cancels a pending pull without importing or uploading data after consent/session changes', async () => {
  const g = goal();
  await saveGoal(db, g);
  const a = api();
  let finish!: (value: { goals: v1.Goal[]; etag: string }) => void;
  a.getGoals.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const task = syncGoals(a, 'user-a');
  while (!finish) await Promise.resolve();
  cancelGoalSync(a);
  finish({ goals: [goal()], etag: '"goals-1"' });
  await expect(task).rejects.toMatchObject({ code: 'sync_cancelled' });
  expect(a.putGoals).not.toHaveBeenCalled();
  expect(await loadGoals(db)).toEqual([g]);
});

it('retries a conflicted snapshot read before uploading', async () => {
  const g = goal();
  await saveGoal(db, g);
  const a = api();
  a.getGoals.mockRejectedValueOnce(new ApiError(409, 'goal_conflict', 'snapshot changed'));
  await syncGoals(a, 'user-a');
  expect(a.getGoals).toHaveBeenCalledTimes(2);
  expect(a.putGoals).toHaveBeenCalledTimes(1);
});

it('preserves all goals and reports a merged set beyond the cloud limit', async () => {
  const local = goal();
  await saveGoal(db, local);
  const remote = Array.from({ length: 10 }, () => goal());
  const a = api(remote);
  await expect(syncGoals(a, 'user-a')).rejects.toThrow();
  expect(a.putGoals).not.toHaveBeenCalled();
  expect(await loadGoals(db)).toHaveLength(11);
  expect(await loadGoals(db)).toContainEqual(local);
});

it('legacy handles can delete a repaired goal and a pull does not resurrect it', async () => {
  await db.runAsync("INSERT INTO goals VALUES ('setup-views', 'views', 50, 1, 2)");
  await repairGoalIds(db);
  const [g] = await loadGoals(db);
  await deleteGoal(db, 'setup-views');
  await mergeGoals(db, [g!]);
  expect(await loadGoals(db)).toEqual([]);
});

it('does not rewrite an unchanged cloud goal set', async () => {
  const g = goal();
  await saveGoal(db, g);
  const a = api([g]);
  await syncGoals(a, 'user-a');
  expect(a.putGoals).not.toHaveBeenCalled();
  expect(await loadGoals(db)).toEqual([g]);
});
