import { Problem, v1 } from '@siddiq3/driftless-contracts';
import { z } from 'zod';

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
  getAccessToken: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  platform: 'android' | 'ios';
  appVersion: string;
};

/** Thin typed client. Every response is validated against the shared contract. */
export function createApiClient(o: ApiClientOptions) {
  const f = o.fetchImpl ?? fetch;
  const base = o.baseUrl.replace(/\/+$/, '');
  if (!/^https:\/\//.test(base)) throw new Error('API base URL must be https');

  async function request<S extends z.ZodType>(
    method: string,
    path: string,
    schema: S,
    init: { body?: unknown; headers?: Record<string, string>; allowed?: () => boolean } = {},
  ): Promise<{ data: z.infer<S>; etag: string | null }> {
    const check = () => {
      if (init.allowed && !init.allowed())
        throw new ApiError(409, 'sync_cancelled', 'Goal backup cancelled');
    };
    check();
    const token = await o.getAccessToken();
    check();
    if (!token) throw new ApiError(401, 'unauthorized', 'not signed in');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), o.timeoutMs ?? 15_000);
    let res: Response;
    try {
      res = await f(`${base}${path}`, {
        method,
        signal: ctrl.signal,
        headers: {
          authorization: `Bearer ${token}`,
          accept: 'application/json',
          ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}),
          ...init.headers,
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
    } catch {
      throw new ApiError(null, 'network', 'network unavailable');
    } finally {
      clearTimeout(timer);
    }
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* fall through */
    }
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
    wrapped: async (period: 'daily' | 'weekly', end: string) =>
      (
        await request(
          'GET',
          `/v1/wrapped?period=${period}&end=${encodeURIComponent(end)}`,
          v1.WrapResponse,
        )
      ).data,
    getMe: () =>
      request(
        'GET',
        `/v1/me?platform=${o.platform}&appVersion=${encodeURIComponent(o.appVersion)}`,
        v1.MeResponse,
      ),
    usageSync: async (days: v1.DailyAggregate[], idempotencyKey: string) =>
      (
        await request('POST', '/v1/usage/sync', v1.UsageSyncResponse, {
          body: { days },
          headers: { 'idempotency-key': idempotencyKey },
        })
      ).data,
    playVerify: async (productId: string, purchaseToken: string) =>
      (
        await request('POST', '/v1/billing/play/verify', v1.VerifyResponse, {
          body: { productId, purchaseToken },
        })
      ).data,
    friends: async () => (await request('GET', '/v1/friends', v1.FriendsResponse)).data.friends,
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
      (await request('GET', '/v1/challenges', v1.ChallengesResponse)).data.challenges,
    createChallenge: async (c: z.input<typeof v1.ChallengeCreate>) =>
      (await request('POST', '/v1/challenges', v1.ChallengeSummary, { body: c })).data,
    joinChallenge: async (id: string) =>
      (await request('POST', `/v1/challenges/${encodeURIComponent(id)}/join`, v1.ChallengeSummary))
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
    registerDevice: async (deviceId: string, pushToken: string) =>
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
    usageHistory: async (from: string, to: string) =>
      (await request('GET', `/v1/usage/history?from=${from}&to=${to}`, v1.HistoryResponse)).data,
    patchMe: (patch: v1.PatchMeRequest, rev: number) =>
      request('PATCH', '/v1/me', v1.MeResponse, {
        body: patch,
        headers: { 'if-match': `"${rev}"` },
      }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
