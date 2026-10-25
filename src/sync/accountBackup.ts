import { syncAccountUsage } from './accountUsage';
import { ensureSocialProfile } from '@/social/profile';
import { ApiError, type ApiClient } from '@/api/client';
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
): Promise<BackupResult> {
  const task = queue.catch(() => undefined).then(() => synchronize(api, allowed, displayName));
  queue = task.catch(() => undefined);
  return task;
}

async function synchronize(
  api: ApiClient,
  allowed: () => boolean,
  displayName?: string | null,
): Promise<BackupResult> {
  const check = () => {
    if (!allowed()) throw new ApiError(409, 'sync_cancelled', 'Backup cancelled');
  };
  check();
  let { data: me } = await (displayName
    ? ensureSocialProfile(api, displayName, allowed)
    : api.getMe(allowed));
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
    throw new Error(
      `Backup could not finish (${outcome.code}). Your progress remains on this phone.`,
    );
  if (outcome.kind === 'deferred')
    return {
      state: 'pending',
      message: 'Progress is saved on this phone. Account backup will retry automatically.',
    };
  await hydratePersonalHistory(api, db, me.userId, allowed);
  check();
  await acknowledgeGuestImports(db, scopeOf(db), allowed);
  return {
    state: 'saved',
    message: `Your saved goals and supported daily history are backed up to your account. ${accountStatus}`,
  };
}
