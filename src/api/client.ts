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
const AccountChallenge = v1.ChallengeSummary.extend({ ownerId: z.string().nullable() });
const AccountChallenges = z.object({ challenges: z.array(AccountChallenge) });
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

const sharedReads = new WeakMap<
  (forceRefresh?: boolean) => Promise<string | null>,
  Map<string, Promise<unknown>>
>();

/** Thin typed client. Every response is validated against the shared contract. */
export function createApiClient(o: ApiClientOptions) {
  const credentialGeneration = entitlementGeneration();
  const f = o.fetchImpl ?? fetch;
  const base = o.baseUrl.replace(/\/+$/, '');
  if (!/^https:\/\//.test(base)) throw new Error('API base URL must be https');

  let inFlight = sharedReads.get(o.getAccessToken);
  if (!inFlight) {
    inFlight = new Map();
    sharedReads.set(o.getAccessToken, inFlight);
  }
  const reads = inFlight;
  async function request<S extends z.ZodType>(
    method: string,
    path: string,
    schema: S,
    init: { body?: unknown; headers?: Record<string, string>; allowed?: () => boolean } = {},
  ): Promise<{ data: z.infer<S>; etag: string | null }> {
    // Share transport for the same credential getter/query; each caller checks its own cancellation.
    if (credentialGeneration !== entitlementGeneration() || (init.allowed && !init.allowed()))
      throw new ApiError(409, 'sync_cancelled', 'Request cancelled');
    if (method !== 'GET') return send(method, path, schema, init);
    const key = `${base}:${credentialGeneration}:${o.incarnation ?? 'unbound'}:${path}`;
    const previous = reads.get(key);
    if (previous) {
      const result = (await previous) as { data: z.infer<S>; etag: string | null };
      if (credentialGeneration !== entitlementGeneration() || (init.allowed && !init.allowed()))
        throw new ApiError(409, 'sync_cancelled', 'Request cancelled');
      return result;
    }
    const task = send(method, path, schema, init).finally(() => {
      if (reads.get(key) === task) reads.delete(key);
    });
    reads.set(key, task);
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
    createChallenge: async (c: z.input<typeof v1.ChallengeCreate>) =>
      (await request('POST', '/v1/challenges', AccountChallenge, { body: c })).data,
    joinChallenge: async (id: string) =>
      (await request('POST', `/v1/challenges/${encodeURIComponent(id)}/join`, AccountChallenge))
        .data,
    leaveChallenge: async (id: string) =>
      void (await request('POST', `/v1/challenges/${encodeURIComponent(id)}/leave`, OkResponse)),
    leaderboard: async (id: string) =>
      (
        await request(
          'GET',
          `/v1/challenges/${encodeURIComponent(id)}/leaderboard`,
          v1.LeaderboardResponse,
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
