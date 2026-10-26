import { randomUUID } from 'expo-crypto';
import type { z } from 'zod';
import { BattleCreate } from '@/api/challenges';
import { ApiError, type ApiClient } from '@/api/client';
import { getDb } from '@/db';
import { scopeOf } from '@/db/scope';

const queued = new Map<string, Promise<Awaited<ReturnType<ApiClient['createChallenge']>>>>();
/** Freeze create intent before the request. Lost replies/restarts reuse its original operation ID. */
export async function createBattle(
  api: ApiClient,
  input: z.input<typeof BattleCreate>,
  allowed: () => boolean,
) {
  const db = await getDb();
  const scope = scopeOf(db);
  if (scope !== `account:${api.incarnation}` || !allowed())
    throw new Error('Account changed. Please retry.');
  const key = `battle_create:${scope}:${input.targetUserId ?? input.metric}`;
  const pending = queued.get(key);
  if (pending) return pending;
  const check = () => {
    if (!allowed()) throw new Error('Battle request cancelled');
  };
  const task = (async () => {
    check();
    const previous = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM settings WHERE key=?',
      key,
    );
    const body = previous
      ? BattleCreate.parse(JSON.parse(previous.value))
      : BattleCreate.parse({ ...input, operationId: randomUUID() });
    if (!previous)
      await db.runAsync('INSERT OR IGNORE INTO settings VALUES (?,?)', key, JSON.stringify(body));
    check();
    // A second device/account cannot reuse this phone's scope-bound operation.
    try {
      const result = await api.createChallenge(body, allowed);
      check();
      await db.runAsync('DELETE FROM settings WHERE key=?', key);
      return result;
    } catch (error) {
      // These are definitive refusals before creation, not uncertain transport outcomes.
      if (
        allowed() &&
        error instanceof ApiError &&
        ['bad_request', 'friend_unavailable', 'battle_exists', 'operation_reuse'].includes(
          error.code,
        )
      )
        await db.runAsync(
          'DELETE FROM settings WHERE key=? AND value=?',
          key,
          JSON.stringify(body),
        );
      throw error;
    }
  })().finally(() => {
    if (queued.get(key) === task) queued.delete(key);
  });
  queued.set(key, task);
  return task;
}
