import { sameAppViews } from '@/api/personalUsage';
import { syncAccountUsage } from './accountUsage';
import { ensureSocialProfile } from '@/social/profile';
import { ApiError, type ApiClient } from '@/api/client';
import { loadGoals } from '@/goals/store';
import { cancelGoalSync, syncGoals } from '@/goals/sync';
import { claimAccountBackup } from './ownership';
import { syncNow } from './run';
import { registerPush } from './push';
import { resolvePersonalAccount, acknowledgeGuestImports } from '@/data/session';
import { hydratePersonalHistory } from '@/data/hydration';
import { scopeOf } from '@/db/scope';

export type BackupResult = { state: 'saved' | 'pending'; message: string };
let queue: Promise<unknown> = Promise.resolve();

/** One writer across root refresh, manual retry and every API-client generation. */
export function backupAccount(
  api: ApiClient,
  allowed: () => boolean,
  displayName?: string | null,
  initialMe?: Awaited<ReturnType<ApiClient['getMe']>>['data'],
): Promise<BackupResult> {
  const task = queue
    .catch(() => undefined)
    .then(() => synchronize(api, allowed, displayName, initialMe));
  queue = task.catch(() => undefined);
  return task;
}

async function synchronize(
  api: ApiClient,
  allowed: () => boolean,
  displayName?: string | null,
  initialMe?: Awaited<ReturnType<ApiClient['getMe']>>['data'],
): Promise<BackupResult> {
  const check = () => {
    if (!allowed()) throw new ApiError(409, 'sync_cancelled', 'Backup cancelled');
  };
  check();
  let { data: me } = initialMe
    ? { data: initialMe }
    : await (displayName ? ensureSocialProfile(api, displayName, allowed) : api.getMe(allowed));
  check();
  const db = await resolvePersonalAccount(me.userId, me.incarnation, allowed);
  await claimAccountBackup(db, me.incarnation, allowed);
  check();
  // Account backup is included in sign-in. Friend sharing is a separate choice.
  for (let attempt = 0; !me.profile.consent.cloudSync && attempt < 3; attempt++) {
    check();
    try {
      ({ data: me } = await api.patchMe({ consent: { cloudSync: true } }, me.profile.rev, allowed));
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 412 || attempt >= 2) throw error;
      ({ data: me } = await api.getMe(allowed));
    }
  }
  check();
  if (!me.profile.consent.cloudSync)
    throw new Error('Account backup could not be enabled. Your progress remains on this phone.');
  // Preserve device registration for users who already granted notification permission.
  void registerPush({
    registerDevice: async (deviceId, token) => {
      check();
      return api.registerDevice(deviceId, token);
    },
  }).catch(() => undefined);
  const goalApi = {
    getGoals: (localAllowed?: () => boolean) =>
      api.getGoals(() => allowed() && (localAllowed?.() ?? true)),
    putGoals: (
      goals: Parameters<ApiClient['putGoals']>[0],
      etag: string,
      localAllowed?: () => boolean,
    ) => api.putGoals(goals, etag, () => allowed() && (localAllowed?.() ?? true)),
  };
  let goalError: unknown;
  try {
    await syncGoals(goalApi, me.incarnation, allowed);
  } catch (error) {
    goalError = error;
  } finally {
    cancelGoalSync(goalApi);
  }
  check();
  const accountStatus = await syncAccountUsage(api, allowed);
  const outcome = await syncNow(api, me.incarnation, allowed);
  check();
  if (goalError) throw goalError;
  if (outcome.kind === 'rejected')
    throw new ApiError(
      outcome.status,
      outcome.code,
      `Backup could not finish (${outcome.code}). Your progress remains on this phone.`,
    );
  if (outcome.kind === 'deferred')
    return {
      state: 'pending',
      message: 'Progress is saved on this phone. Account backup will retry automatically.',
    };
  const imports = await db.getFirstAsync(
    "SELECT source_scope FROM guest_imports WHERE target_scope=? AND state='copied' AND source_scope LIKE 'guest:%'",
    scopeOf(db),
  );
  await hydratePersonalHistory(api, db, me.userId, allowed, Boolean(imports));
  if (imports) {
    const { goals } = await api.getGoals(allowed);
    const localGoals = await loadGoals(db);
    if (
      localGoals.some(
        (g) =>
          !goals.some(
            (r) =>
              r.goalId === g.goalId &&
              r.rev >= g.rev &&
              r.metric === g.metric &&
              r.dailyLimit === g.dailyLimit &&
              r.enabled === g.enabled,
          ),
      )
    )
      throw new Error('Guest goals are awaiting server verification');
    const days = await db.getAllAsync<{ local_date: string; rev: number; values_json: string }>(
      'SELECT local_date,rev,values_json FROM sync_days WHERE scope=?',
      scopeOf(db),
    );
    for (const day of days) {
      check();
      const sent = JSON.parse(day.values_json);
      const remote = await db.getFirstAsync<{
        rev: number;
        views: number | null;
        minutes: number | null;
        app_views_json: string | null;
      }>(
        'SELECT rev,views,minutes,app_views_json FROM daily_cache WHERE scope=? AND local_date=? AND device_id=?',
        scopeOf(db),
        day.local_date,
        sent.deviceId,
      );
      if (
        !remote ||
        remote.rev < day.rev ||
        remote.views !== (sent.personalViews ?? sent.views) ||
        remote.minutes !== sent.minutes ||
        !sameAppViews(
          remote.app_views_json ? JSON.parse(remote.app_views_json) : null,
          sent.personalAppViews,
        )
      )
        throw new Error('Guest history is awaiting server verification');
    }
  }
  check();
  await acknowledgeGuestImports(db, scopeOf(db), allowed);
  return {
    state: 'saved',
    message: `Your saved goals and supported daily history are backed up to your account. ${accountStatus}`,
  };
}
