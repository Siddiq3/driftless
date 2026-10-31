import { randomUUID } from 'expo-crypto';
import { ApiError, type ApiClient } from '@/api/client';

const pending = new WeakMap<
  ApiClient,
  Map<string, Promise<Awaited<ReturnType<ApiClient['getMe']>>>>
>();

/** Friends see the Google sign-up name. A separate unique handle is allocated without a setup form. */
export function ensureSocialProfile(api: ApiClient, name: string | null, allowed: () => boolean) {
  let requests = pending.get(api);
  if (!requests) pending.set(api, (requests = new Map()));
  const key = name ?? '';
  const existing = requests.get(key);
  if (existing)
    return existing.then((result) => {
      if (!allowed()) throw new Error('Account changed. Please try again.');
      return result;
    });
  const task = (async () => {
    for (let attempt = 0; attempt < 4; attempt++) {
      if (!allowed()) throw new Error('Account changed. Please try again.');
      const result = await api.getMe(allowed);
      const p = result.data.profile;
      const patch: { displayName?: string; handle?: string } = {};
      if (name && p.displayName !== name) patch.displayName = name;
      if (!p.handle) patch.handle = `player_${randomUUID().replace(/-/g, '').slice(0, 8)}`;
      if (!Object.keys(patch).length) return result;
      if (!allowed()) throw new Error('Account changed. Please try again.');
      try {
        return await api.patchMe(patch, p.rev, allowed);
      } catch (e) {
        if (
          !(e instanceof ApiError) ||
          !(e.status === 412 || e.code === 'handle_taken') ||
          attempt === 3
        )
          throw e;
      }
    }
    throw new Error('Your profile could not be saved. Please try again.');
  })();
  requests.set(key, task);
  void task
    .finally(() => {
      if (requests?.get(key) === task) requests.delete(key);
    })
    .catch(() => undefined);
  return task;
}
