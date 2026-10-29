import { BattleInvitePreviewSchema } from './battleLinks';
import { BattleCreate, BattleSummary, BattleList, BattleLeaderboard } from './challenges';
import { withDeadline } from './deadline';
import {
  AccountUsageHistory,
  AccountUsageResponse,
  AccountUsageReconcileResponse,
} from './accountUsage';
import { Problem, v1 } from '@siddiq3/driftless-contracts';
import { z } from 'zod';
import { PersonalHistoryResponse, type PersonalDailyAggregate } from './personalUsage';
import { entitlementGeneration } from '@/billing/cache';

export const AccountState = z
  .object({
    state: z.enum(['active', 'deleting', 'deleted', 'legacy_quarantined']),
    incarnation: z.uuid().nullable(),
  })
  .refine(
    (value) => !['active', 'deleting'].includes(value.state) || value.incarnation !== null,
    'An active or deleting account requires an incarnation',
  );
// Keep lifecycle additions explicit while the published base contract remains 0.4.0.
const AccountChallenge = BattleSummary;
const AccountChallenges = BattleList;
const AccountMe = v1.MeResponse.extend({ incarnation: z.uuid() });
const OkResponse = z.object({ ok: z.literal(true) });

export class ApiError extends Error {
  constructor(
    readonly status: number | null,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
  get offline(): boolean {
    return this.status === null;
  }
}

export type ApiClientOptions = {
  baseUrl: string;
  incarnation?: string;
  getAccessToken: (forceRefresh?: boolean) => Promise<string | null>;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  platform: 'android' | 'ios';
  appVersion: string;
};

/** A brief handoff window joins startup, screen and backup reads; never an offline cache. */
export const READ_REUSE_MS = 2000;
export const WAR_READ_REUSE_MS = 15_000;
type ReadEntry = { value: unknown; savedAt: number; once: boolean; maxAge?: number };
type ReadState = {
  pending: Map<string, Promise<unknown>>;
  recent: Map<string, ReadEntry>;
  revision: number;
  writes: number;
};
const sharedReads = new WeakMap<(forceRefresh?: boolean) => Promise<string | null>, ReadState>();
const copyResponse = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Thin typed client. Every response is validated against the shared contract. */
export function createApiClient(o: ApiClientOptions) {
  const credentialGeneration = entitlementGeneration();
  const f = o.fetchImpl ?? fetch;
  const base = o.baseUrl.replace(/\/+$/, '');
  if (!/^https:\/\//.test(base)) throw new Error('API base URL must be https');

  let shared = sharedReads.get(o.getAccessToken);
  if (!shared) {
    shared = { pending: new Map(), recent: new Map(), revision: 0, writes: 0 };
    sharedReads.set(o.getAccessToken, shared);
  }
  const reads = shared;
  const readKey = (path: string) =>
    `${base}:${credentialGeneration}:${o.incarnation ?? 'unbound'}:${path}`;
  const profilePath = `/v1/me?platform=${o.platform}&appVersion=${encodeURIComponent(o.appVersion)}`;
  const battlePath = (date: string) => `/v1/battles/daily?date=${encodeURIComponent(date)}`;
  const readLifetime = (path: string) =>
    path.startsWith('/v1/battles/daily?') ? WAR_READ_REUSE_MS : READ_REUSE_MS;
  const reusable = (path: string) =>
    path === profilePath || path === '/v1/goals' || path.startsWith('/v1/battles/daily?');
  const cachedRead = (path: string) => {
    if (credentialGeneration !== entitlementGeneration() || reads.writes > 0) return undefined;
    const key = readKey(path);
    const entry = reads.recent.get(key);
    if (!entry) return undefined;
    const age = Date.now() - entry.savedAt;
    if (age < 0 || age >= (entry.maxAge ?? READ_REUSE_MS)) {
      reads.recent.delete(key);
      return undefined;
    }
    return copyResponse(entry.value);
  };
  const invalidateReads = () => {
    reads.revision++;
    reads.recent.clear();
  };
  async function request<S extends z.ZodType>(
    method: string,
    path: string,
    schema: S,
    init: {
      body?: unknown;
      headers?: Record<string, string>;
      allowed?: () => boolean;
      fresh?: boolean;
    } = {},
  ): Promise<{ data: z.infer<S>; etag: string | null }> {
    // Share transport for the same credential getter/query; each caller checks its own cancellation.
    if (credentialGeneration !== entitlementGeneration() || (init.allowed && !init.allowed()))
      throw new ApiError(409, 'sync_cancelled', 'Request cancelled');
    if (method !== 'GET') {
      // Fence both ends: a GET started before/during a mutation must never seed a stale cache.
      reads.writes++;
      invalidateReads();
      try {
        return await send(method, path, schema, init);
      } finally {
        reads.writes--;
        invalidateReads();
      }
    }
    const key = readKey(path);
    const recent = reads.recent.get(key);
    if (recent) {
      const age = Date.now() - recent.savedAt;
      if (!init.fresh && reads.writes === 0 && age >= 0 && age < (recent.maxAge ?? READ_REUSE_MS)) {
        if (recent.once) reads.recent.delete(key);
        return copyResponse(recent.value) as { data: z.infer<S>; etag: string | null };
      }
      reads.recent.delete(key);
    }
    const revision = reads.revision;
    const pendingKey = `${revision}:${key}`;
    const previous = reads.pending.get(pendingKey);
    if (previous) {
      const result = (await previous) as { data: z.infer<S>; etag: string | null };
      if (credentialGeneration !== entitlementGeneration() || (init.allowed && !init.allowed()))
        throw new ApiError(409, 'sync_cancelled', 'Request cancelled');
      return copyResponse(result);
    }
    const task = send(method, path, schema, init)
      .then((result) => {
        if (reads.writes === 0 && revision === reads.revision && reusable(path)) {
          // Expired entries are discarded on every successful reusable read, keeping memory bounded.
          const now = Date.now();
          for (const [entryKey, entry] of reads.recent) {
            if (now < entry.savedAt || now - entry.savedAt >= (entry.maxAge ?? READ_REUSE_MS))
              reads.recent.delete(entryKey);
          }
          reads.recent.set(key, {
            value: copyResponse(result),
            savedAt: now,
            once: false,
            maxAge: readLifetime(path),
          });
        }
        return result;
      })
      .finally(() => {
        if (reads.pending.get(pendingKey) === task) reads.pending.delete(pendingKey);
      });
    reads.pending.set(pendingKey, task);
    return task;
  }

  async function send<S extends z.ZodType>(
    method: string,
    path: string,
    schema: S,
    init: { body?: unknown; headers?: Record<string, string>; allowed?: () => boolean } = {},
    refreshed = false,
  ): Promise<{ data: z.infer<S>; etag: string | null }> {
    const check = () => {
      if (credentialGeneration !== entitlementGeneration() || (init.allowed && !init.allowed()))
        throw new ApiError(409, 'sync_cancelled', 'Backup cancelled');
    };
    check();
    let token: string | null;
    try {
      token = await withDeadline(
        () => o.getAccessToken(refreshed),
        o.timeoutMs ?? 15_000,
        () => new ApiError(null, 'credential_timeout', 'Google session restoration timed out'),
      );
    } catch (error) {
      check();
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        null,
        'credential_unavailable',
        'Google session restoration could not complete',
      );
    }
    check();
    if (!token) throw new ApiError(401, 'unauthorized', 'not signed in');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), o.timeoutMs ?? 15_000);
    let res: Response;
    let text: string;
    try {
      res = await f(`${base}${path}`, {
        method,
        signal: ctrl.signal,
        headers: {
          authorization: `Bearer ${token}`,
          ...(o.incarnation ? { 'x-account-incarnation': o.incarnation } : {}),
          accept: 'application/json',
          ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}),
          ...init.headers,
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
      text = await res.text();
    } catch {
      throw new ApiError(null, 'network', 'network unavailable');
    } finally {
      clearTimeout(timer);
    }
    check();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* fall through */
    }
    // The session getter uses Google silent sign-in. Retry a rejected credential once;
    // keep the same incarnation/body/idempotency key and cancellation fence.
    if (res.status === 401 && !refreshed) return send(method, path, schema, init, true);
    if (!res.ok) {
      const p = Problem.safeParse(json);
      throw new ApiError(
        res.status,
        p.success ? p.data.code : 'http_error',
        p.success ? (p.data.detail ?? p.data.title) : `HTTP ${res.status}`,
      );
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success)
      throw new ApiError(res.status, 'contract_mismatch', 'unexpected response shape');
    return { data: parsed.data, etag: res.headers.get('etag') };
  }

  return {
    incarnation: o.incarnation,
    clearReadReuse: invalidateReads,
    /** Only AccountBoundary calls this after lifecycle, ownership and allowance installation. */
    primeStartupReads: (
      me: { data: z.infer<typeof AccountMe>; etag: string | null },
      usage: z.infer<typeof AccountUsageResponse>,
      readStartedAt: number,
    ) => {
      if (
        !o.incarnation ||
        me.data.incarnation !== o.incarnation ||
        usage.policy?.incarnation !== o.incarnation ||
        credentialGeneration !== entitlementGeneration() ||
        reads.writes > 0 ||
        Date.now() < readStartedAt ||
        Date.now() - readStartedAt >= READ_REUSE_MS
      )
        return;
      const savedAt = readStartedAt;
      reads.recent.set(readKey(profilePath), { value: copyResponse(me), savedAt, once: false });
      reads.recent.set(readKey('/v1/usage/account'), {
        value: { data: copyResponse(usage), etag: null },
        savedAt,
        once: true,
      });
    },
    accountUsageHistory: async (
      from: string,
      to: string,
      deviceId: string,
      allowed?: () => boolean,
    ) =>
      (
        await request(
          'GET',
          `/v1/usage/account/history?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&deviceId=${encodeURIComponent(deviceId)}`,
          AccountUsageHistory,
          { allowed },
        )
      ).data,
    getAccountUsage: async (allowed?: () => boolean) =>
      (await request('GET', '/v1/usage/account', AccountUsageResponse, { allowed })).data,
    configureAccountUsage: async (
      body: { tz: string; limits: Record<string, number>; expectedRev: number },
      allowed?: () => boolean,
    ) => (await request('PUT', '/v1/usage/account', AccountUsageResponse, { body, allowed })).data,
    reconcileAccountUsage: async (body: unknown, idempotencyKey: string, allowed?: () => boolean) =>
      (
        await request('POST', '/v1/usage/account/reconcile', AccountUsageReconcileResponse, {
          body,
          headers: { 'idempotency-key': idempotencyKey },
          allowed,
        })
      ).data,
    reserveAccountUsage: async (body: unknown, allowed?: () => boolean) =>
      (await request('POST', '/v1/usage/account/reserve', AccountUsageResponse, { body, allowed }))
        .data,
    accountState: async () => (await request('GET', '/v1/account', AccountState)).data,
    registerAccount: async (registrationId: string, expectedIncarnation: string | null) =>
      (
        await request('POST', '/v1/account/register', AccountState, {
          body: { registrationId, expectedIncarnation },
        })
      ).data,
    deletionStatus: async () =>
      (await request('GET', '/v1/account/delete', v1.DeletionStatus)).data,
    wrapped: async (period: 'daily' | 'weekly', end: string) =>
      (
        await request(
          'GET',
          `/v1/wrapped?period=${period}&end=${encodeURIComponent(end)}`,
          v1.WrapResponse,
        )
      ).data,
    getMe: (allowed?: () => boolean) =>
      request(
        'GET',
        `/v1/me?platform=${o.platform}&appVersion=${encodeURIComponent(o.appVersion)}`,
        AccountMe,
        { allowed },
      ),
    usageSync: async (
      days: PersonalDailyAggregate[],
      idempotencyKey: string,
      allowed?: () => boolean,
    ) => {
      return (
        await request('POST', '/v1/usage/sync', v1.UsageSyncResponse, {
          body: { days },
          headers: { 'idempotency-key': idempotencyKey },
          allowed,
        })
      ).data;
    },
    playVerify: async (productId: string, purchaseToken: string) =>
      (
        await request('POST', '/v1/billing/play/verify', v1.VerifyResponse, {
          body: { productId, purchaseToken },
        })
      ).data,
    createBattleInvite: async (allowed?: () => boolean) =>
      (
        await request('POST', '/v1/battles/invites', v1.InviteResponse, {
          body: { scoreConsent: true },
          allowed,
        })
      ).data,
    battleInvite: async (code: string, allowed?: () => boolean) =>
      (
        await request(
          'GET',
          `/v1/battles/invites/${encodeURIComponent(code)}`,
          BattleInvitePreviewSchema,
          { allowed },
        )
      ).data,
    acceptBattleInvite: async (code: string, allowed?: () => boolean) =>
      (
        await request(
          'POST',
          `/v1/battles/invites/${encodeURIComponent(code)}/accept`,
          OkResponse,
          { body: { scoreConsent: true }, allowed },
        )
      ).data,
    cachedBattleDaily: (date: string): v1.FriendsDailyResponse | null => {
      const cached = cachedRead(battlePath(date)) as { data: v1.FriendsDailyResponse } | undefined;
      return cached?.data ?? null;
    },
    battleDaily: async (date: string, allowed?: () => boolean, fresh = false) =>
      (await request('GET', battlePath(date), v1.FriendsDailyResponse, { allowed, fresh })).data,
    friends: async () => (await request('GET', '/v1/friends', v1.FriendsResponse)).data.friends,
    friendsDaily: async (date: string) => {
      v1.FriendsDailyQuery.parse({ date });
      return (
        await request(
          'GET',
          `/v1/friends/daily?date=${encodeURIComponent(date)}`,
          v1.FriendsDailyResponse,
        )
      ).data;
    },
    createInvite: async () =>
      (await request('POST', '/v1/friends/invites', v1.InviteResponse)).data,
    addFriend: async (by: { handle: string } | { inviteCode: string }) =>
      (await request('POST', '/v1/friends/requests', v1.FriendRequestResult, { body: by })).data
        .friend,
    respondFriend: async (userId: string, accept: boolean) =>
      void (await request('POST', '/v1/friends/respond', OkResponse, { body: { userId, accept } })),
    removeFriend: async (userId: string) =>
      void (await request('POST', '/v1/friends/remove', OkResponse, { body: { userId } })),
    challenges: async () =>
      (await request('GET', '/v1/challenges', AccountChallenges)).data.challenges,
    battleInbox: async (allowed?: () => boolean) =>
      (await request('GET', '/v1/challenges', BattleList, { allowed })).data,
    respondBattle: async (id: string, action: 'decline' | 'cancel', allowed?: () => boolean) =>
      (
        await request(
          'POST',
          `/v1/challenges/${encodeURIComponent(id)}/invitation`,
          BattleSummary,
          { body: { action }, allowed },
        )
      ).data,
    battleScoreConsent: async (id: string, share: boolean, allowed?: () => boolean) =>
      (
        await request(
          'PUT',
          `/v1/challenges/${encodeURIComponent(id)}/score-consent`,
          BattleSummary,
          { body: { share }, allowed },
        )
      ).data,
    createChallenge: async (c: z.input<typeof BattleCreate>, allowed?: () => boolean) =>
      (
        await request('POST', '/v1/challenges', AccountChallenge, {
          body: BattleCreate.parse(c),
          allowed,
        })
      ).data,
    joinChallenge: async (id: string, scoreConsent?: true, allowed?: () => boolean) =>
      (
        await request('POST', `/v1/challenges/${encodeURIComponent(id)}/join`, AccountChallenge, {
          body: scoreConsent ? { scoreConsent } : {},
          allowed,
        })
      ).data,
    leaveChallenge: async (id: string) =>
      void (await request('POST', `/v1/challenges/${encodeURIComponent(id)}/leave`, OkResponse)),
    leaderboard: async (id: string, allowed?: () => boolean) =>
      (
        await request(
          'GET',
          `/v1/challenges/${encodeURIComponent(id)}/leaderboard`,
          BattleLeaderboard,
          { allowed },
        )
      ).data,
    registerDevice: async (deviceId: string, pushToken?: string) =>
      void (await request('POST', '/v1/devices', OkResponse, {
        body: { deviceId, platform: 'android', pushToken },
      })),
    deleteAccount: async () =>
      (await request('POST', '/v1/account/delete', v1.DeletionStatus)).data,
    exportData: async () =>
      (await request('GET', '/v1/account/export', z.record(z.string(), z.unknown()))).data,
    getGoals: async (allowed?: () => boolean) => {
      const r = await request('GET', '/v1/goals', v1.GoalsResponse, { allowed });
      return { ...r.data, etag: r.etag };
    },
    putGoals: async (goals: v1.Goal[], etag: string, allowed?: () => boolean) => {
      v1.PutGoalsRequest.parse({ goals });
      return (
        await request('PUT', '/v1/goals', v1.GoalsResponse, {
          body: { goals },
          headers: { 'if-match': etag },
          allowed,
        })
      ).data;
    },
    usageHistory: async (from: string, to: string, allowed?: () => boolean) =>
      (
        await request(
          'GET',
          `/v1/usage/history?from=${from}&to=${to}&includePersonal=true`,
          PersonalHistoryResponse,
          {
            allowed,
          },
        )
      ).data,
    patchMe: (patch: v1.PatchMeRequest, rev: number, allowed?: () => boolean) =>
      request('PATCH', '/v1/me', AccountMe, {
        body: patch,
        allowed,
        headers: { 'if-match': `"${rev}"` },
      }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
