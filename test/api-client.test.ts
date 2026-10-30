jest.mock('tracking-android', () => ({ Tracking: { setEntitlement: jest.fn() } }));
import { ApiError, createApiClient, type ApiClient } from '../src/api/client';
import { invalidateEntitlement } from '../src/billing/cache';

const me: Awaited<ReturnType<ApiClient['getMe']>>['data'] = {
  userId: 'u1',
  incarnation: '00000000-0000-4000-8000-000000000099',
  profile: {
    handle: null,
    displayName: null,
    tz: 'UTC',
    locale: 'en',
    consent: { cloudSync: false, shareWithFriends: false },
    rev: 1,
  },
  entitlement: { tier: 'free', source: 'none', state: 'none', expiresAt: null, verifiedAt: null },
  capabilities: {
    videoCounting: false,
    minutesTracking: false,
    blocking: false,
    schedules: false,
    advancedAnalytics: false,
    socialSharingOfUsage: true,
  },
};

const resp = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  ({
    ok: status < 400,
    status,
    text: async () => JSON.stringify(body),
    headers: { get: (k: string) => headers[k] ?? null },
  }) as unknown as Response;

const client = (fetchImpl: jest.Mock, token: string | null = 't0k') =>
  createApiClient({
    baseUrl: 'https://api.example.test/',
    getAccessToken: async () => token,
    fetchImpl,
    platform: 'android',
    appVersion: '0.1.0',
  });

describe('api client', () => {
  it('requests a daily comparison with a validated date and response', async () => {
    const data = {
      localDate: '2026-10-21',
      self: { status: 'unavailable', views: null, updatedAt: null },
      friends: [],
    };
    const f = jest.fn().mockResolvedValue(resp(200, data));
    expect(await client(f).friendsDaily('2026-10-21')).toEqual(data);
    expect(f.mock.calls[0][0]).toBe('https://api.example.test/v1/friends/daily?date=2026-10-21');
    await expect(client(f).friendsDaily('2026-02-30')).rejects.toThrow();
    expect(f).toHaveBeenCalledTimes(1);
  });
  it('sends the bearer token and capability query, validates the response', async () => {
    const f = jest.fn().mockResolvedValue(resp(200, me, { etag: '"1"' }));
    const r = await client(f).getMe();
    expect(r.data.userId).toBe('u1');
    expect(r.etag).toBe('"1"');
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://api.example.test/v1/me?platform=android&appVersion=0.1.0');
    expect(init.headers.authorization).toBe('Bearer t0k');
  });

  it('refuses plain http base URLs', () => {
    expect(() =>
      createApiClient({
        baseUrl: 'http://x',
        getAccessToken: async () => 't',
        platform: 'android',
        appVersion: '1.0.0',
      }),
    ).toThrow();
  });

  it('does not call the network when signed out', async () => {
    const f = jest.fn();
    await expect(client(f, null).getMe()).rejects.toMatchObject({ status: 401 });
    expect(f).not.toHaveBeenCalled();
  });

  it('maps problem+json errors', async () => {
    const f = jest.fn().mockResolvedValue(
      resp(409, {
        type: 'x',
        title: 'Conflict',
        status: 409,
        code: 'handle_taken',
        detail: 'taken',
      }),
    );
    await expect(client(f).patchMe({ handle: 'sam' }, 1)).rejects.toMatchObject({
      status: 409,
      code: 'handle_taken',
    });
    expect(f.mock.calls[0][1].headers['if-match']).toBe('"1"');
  });

  it('reports offline distinctly', async () => {
    const f = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    const err = await client(f)
      .getMe()
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).offline).toBe(true);
  });

  it('rejects responses that break the contract', async () => {
    const f = jest.fn().mockResolvedValue(resp(200, { ...me, entitlement: { tier: 'platinum' } }));
    await expect(client(f).getMe()).rejects.toMatchObject({ code: 'contract_mismatch' });
  });
  it('preserves the goal snapshot ETag and sends it on conditional writes', async () => {
    const f = jest.fn().mockResolvedValue(resp(200, { goals: [] }, { etag: '"goals-4"' }));
    const api = client(f);
    expect(await api.getGoals()).toEqual({ goals: [], etag: '"goals-4"' });
    await api.putGoals([], '"goals-4"');
    expect(f.mock.calls[1][1].headers['if-match']).toBe('"goals-4"');
  });
  it('rejects the legacy onboarding seed ID before uploading', async () => {
    const f = jest.fn();
    await expect(
      client(f).putGoals(
        [{ goalId: 'setup-views', metric: 'views', dailyLimit: 50, enabled: true, rev: 1 }],
        '"goals-0"',
      ),
    ).rejects.toThrow();
    expect(f).not.toHaveBeenCalled();
  });
  it('checks session/consent cancellation again after awaiting credentials', async () => {
    const f = jest.fn();
    let allowed = true;
    const api = createApiClient({
      baseUrl: 'https://api.example.test',
      platform: 'android',
      appVersion: '1',
      fetchImpl: f,
      getAccessToken: async () => {
        allowed = false;
        return 'new-account-token';
      },
    });
    await expect(api.putGoals([], '"goals-0"', () => allowed)).rejects.toMatchObject({
      code: 'sync_cancelled',
    });
    expect(f).not.toHaveBeenCalled();
  });
  it('cancels a usage upload if the account changes while retrieving credentials', async () => {
    const f = jest.fn();
    let allowed = true;
    const api = createApiClient({
      baseUrl: 'https://api.example.test',
      platform: 'android',
      appVersion: '1',
      fetchImpl: f,
      getAccessToken: async () => {
        allowed = false;
        return 'new-account-token';
      },
    });
    await expect(api.usageSync([], 'key', () => allowed)).rejects.toMatchObject({
      code: 'sync_cancelled',
    });
    expect(f).not.toHaveBeenCalled();
  });
  it('discards a completed response when backup was cancelled while reading its body', async () => {
    let allowed = true;
    const f = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => {
        allowed = false;
        return JSON.stringify({ goals: [] });
      },
      headers: new Headers(),
    });
    await expect(client(f).getGoals(() => allowed)).rejects.toMatchObject({
      code: 'sync_cancelled',
    });
  });
});

it('deduplicates simultaneous identical GETs across clients for one authenticated getter', async () => {
  const getAccessToken = jest.fn().mockResolvedValue('token');
  let finish!: (r: Response) => void;
  let markStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  const fetchImpl = jest.fn(
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
        markStarted();
      }),
  );
  const options = {
    baseUrl: 'https://api.example.test',
    getAccessToken,
    fetchImpl,
    platform: 'android' as const,
    appVersion: '1',
  };
  const a = createApiClient(options);
  const b = createApiClient(options);
  const first = a.getMe();
  const second = b.getMe();
  await started;
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  finish(resp(200, me));
  expect(await first).toEqual(await second);
});
it('never shares a request across different authenticated account getters', async () => {
  const f = jest.fn().mockResolvedValue(resp(200, me));
  const a = client(f);
  const b = client(f);
  await Promise.all([a.getMe(), b.getMe()]);
  expect(f).toHaveBeenCalledTimes(2);
});

it('keeps the incarnation on queued transports and never shares reads between incarnations', async () => {
  const fetchImpl = jest.fn().mockResolvedValue(resp(200, { goals: [] }));
  const getAccessToken = jest.fn().mockResolvedValue('same-google-token');
  const options = {
    baseUrl: 'https://api.example.test',
    platform: 'android' as const,
    appVersion: '0.1.0',
    getAccessToken,
    fetchImpl,
  };
  const a = createApiClient({ ...options, incarnation: 'incarnation-a' });
  const b = createApiClient({ ...options, incarnation: 'incarnation-b' });
  await Promise.all([a.getGoals(), b.getGoals()]);
  expect(fetchImpl).toHaveBeenCalledTimes(2);
  expect(fetchImpl.mock.calls.map((call) => call[1].headers['x-account-incarnation'])).toEqual([
    'incarnation-a',
    'incarnation-b',
  ]);
  fetchImpl.mockResolvedValue(
    resp(409, {
      status: 409,
      code: 'account_inactive',
      title: 'Conflict',
      type: 'https://fixture.invalid/account_inactive',
    }),
  );
  await expect(a.usageSync([], 'frozen-request-key')).rejects.toMatchObject({
    code: 'account_inactive',
  });
  const last = fetchImpl.mock.calls[2][1];
  expect(last.headers['x-account-incarnation']).toBe('incarnation-a');
  expect(last.headers['idempotency-key']).toBe('frozen-request-key');
  expect(last.body).toBe('{"days":[]}');
});

it('session invalidation rejects offline queued operations before requesting a new credential', async () => {
  const getAccessToken = jest.fn().mockResolvedValue('new-account-token');
  const fetchImpl = jest.fn();
  const old = createApiClient({
    baseUrl: 'https://api.example.test',
    platform: 'android',
    appVersion: '0.1.0',
    incarnation: 'old-incarnation',
    getAccessToken,
    fetchImpl,
  });
  invalidateEntitlement();
  await expect(old.usageSync([], 'original-key')).rejects.toMatchObject({ code: 'sync_cancelled' });
  expect(getAccessToken).not.toHaveBeenCalled();
  expect(fetchImpl).not.toHaveBeenCalled();
});

it('keeps personal recorded counts when decoding restored history', async () => {
  const row = {
    localDate: '2026-10-24',
    tz: 'UTC',
    platform: 'android',
    deviceId: '00000000-0000-4000-8000-000000000001',
    views: null,
    adViews: null,
    personalViews: 73,
    minutes: 12,
    coverage: 1,
    rev: 2,
  };
  const api = client(jest.fn().mockResolvedValue(resp(200, { days: [row] })));
  expect((await api.usageHistory('2026-10-24', '2026-10-24')).days).toEqual([row]);
});

it('refreshes a rejected credential once through the existing session getter', async () => {
  const getAccessToken = jest
    .fn()
    .mockResolvedValueOnce('expired')
    .mockResolvedValueOnce('renewed');
  const f = jest.fn().mockResolvedValueOnce(resp(401, {})).mockResolvedValueOnce(resp(200, me));
  const api = createApiClient({
    baseUrl: 'https://fixture.invalid',
    getAccessToken,
    fetchImpl: f,
    platform: 'android',
    appVersion: 'test',
  });
  expect((await api.getMe()).data.userId).toBe(me.userId);
  expect(getAccessToken).toHaveBeenCalledTimes(2);
  expect(getAccessToken.mock.calls).toEqual([[false], [true]]);
  expect(f.mock.calls.map(([, init]) => init.headers.authorization)).toEqual([
    'Bearer expired',
    'Bearer renewed',
  ]);
});
it('does not loop on a permanently rejected credential', async () => {
  const f = jest.fn().mockResolvedValue(resp(401, {}));
  await expect(client(f).getMe()).rejects.toMatchObject({ status: 401 });
  expect(f).toHaveBeenCalledTimes(2);
});
it('classifies interrupted response downloads as recoverable network errors', async () => {
  const f = jest.fn().mockResolvedValue({
    ...resp(200, me),
    text: async () => {
      throw new Error('body interrupted');
    },
  });
  await expect(client(f).getMe()).rejects.toMatchObject({ code: 'network', status: null });
});
it('rejects an active lifecycle with no incarnation', async () => {
  const f = jest.fn().mockResolvedValue(resp(200, { state: 'active', incarnation: null }));
  await expect(client(f).accountState()).rejects.toMatchObject({ code: 'contract_mismatch' });
});

it('bounds credential acquisition before fetch and ignores a late credential', async () => {
  jest.useFakeTimers();
  try {
    let finish!: (value: string) => void;
    const getAccessToken = jest
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            finish = resolve;
          }),
      )
      .mockResolvedValue('renewed');
    const f = jest
      .fn()
      .mockResolvedValue(resp(200, { state: 'active', incarnation: me.incarnation }));
    const api = createApiClient({
      baseUrl: 'https://fixture.invalid',
      getAccessToken,
      fetchImpl: f,
      timeoutMs: 100,
      platform: 'android',
      appVersion: 'test',
    });
    const rejected = expect(api.accountState()).rejects.toMatchObject({
      code: 'credential_timeout',
    });
    await jest.advanceTimersByTimeAsync(100);
    await rejected;
    finish('late-token');
    await Promise.resolve();
    expect(f).not.toHaveBeenCalled();
    expect((await api.accountState()).state).toBe('active');
    expect(f).toHaveBeenCalledTimes(1);
  } finally {
    jest.useRealTimers();
  }
});
it('reports Google SDK failure as recoverable credential unavailability', async () => {
  const api = createApiClient({
    baseUrl: 'https://fixture.invalid',
    getAccessToken: async () => {
      throw new Error('sdk offline');
    },
    fetchImpl: jest.fn(),
    platform: 'android',
    appVersion: 'test',
  });
  await expect(api.accountState()).rejects.toMatchObject({
    code: 'credential_unavailable',
    status: null,
  });
});

it('transmits the direct target and explicit battle consent without patching the global profile', async () => {
  const id = me.incarnation;
  const f = jest.fn().mockResolvedValue(
    resp(200, {
      challengeId: id,
      ownerId: 'owner',
      title: 'Scroll battle',
      metric: 'fewest_views',
      startDate: '2026-10-26',
      endDate: '2026-11-01',
      tz: 'UTC',
      maxMembers: 2,
      memberCount: 1,
      targetUserId: id,
      invitationState: 'pending',
    }),
  );
  const api = client(f);
  await api.createChallenge({
    title: 'Scroll battle',
    metric: 'fewest_views',
    startDate: '2026-10-26',
    endDate: '2026-11-01',
    tz: 'UTC',
    maxMembers: 2,
    targetUserId: id,
    operationId: id,
    scoreConsent: true,
  });
  expect(JSON.parse(f.mock.calls[0][1].body)).toMatchObject({
    targetUserId: id,
    operationId: id,
    scoreConsent: true,
  });
  await api.joinChallenge(id, true);
  expect(JSON.parse(f.mock.calls[1][1].body)).toEqual({ scoreConsent: true });
  await api.respondBattle(id, 'decline');
  expect(f.mock.calls[2][0]).toContain(`/challenges/${id}/invitation`);
  expect(JSON.parse(f.mock.calls[2][1].body)).toEqual({ action: 'decline' });
  await api.battleScoreConsent(id, false);
  expect(JSON.parse(f.mock.calls[3][1].body)).toEqual({ share: false });
  expect(f.mock.calls.some(([url]) => String(url).includes('/v1/me'))).toBe(false);
});

describe('link-based battle API', () => {
  it('creates and accepts only with explicit score consent', async () => {
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(resp(200, { code: 'ABCDEFGHJK', expiresAt: '2026-11-02T00:00:00Z' }))
      .mockResolvedValueOnce(resp(200, { ok: true }));
    const api = client(fetch);
    await api.createBattleInvite();
    await api.acceptBattleInvite('ABCDEFGHJK');
    expect(
      fetch.mock.calls.map(([url, init]) => [url, init.method, JSON.parse(init.body)]),
    ).toEqual([
      ['https://api.example.test/v1/battles/invites', 'POST', { scoreConsent: true }],
      [
        'https://api.example.test/v1/battles/invites/ABCDEFGHJK/accept',
        'POST',
        { scoreConsent: true },
      ],
    ]);
  });
});

const sharedClientPair = (f: jest.Mock, incarnation = me.incarnation) => {
  const options = {
    baseUrl: 'https://api.example.test',
    getAccessToken: async () => 'same-token',
    fetchImpl: f,
    platform: 'android' as const,
    appVersion: '1',
    incarnation,
  };
  return [createApiClient(options), createApiClient(options)] as const;
};
const allowance = {
  policy: { incarnation: me.incarnation, tz: 'UTC', activeFromMs: 1, rev: 1, policies: [] },
  snapshot: null,
  serverTimeMs: 1,
};

it('reuses sequential profile and goal GETs across clients only for the brief freshness window', async () => {
  const f = jest
    .fn()
    .mockImplementation(async (url: string) =>
      resp(200, url.includes('/goals') ? { goals: [] } : me),
    );
  const [a, b] = sharedClientPair(f);
  const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
  try {
    const first = await a.getMe();
    first.data.profile.displayName = 'caller mutation';
    expect((await b.getMe()).data.profile.displayName).toBeNull();
    await a.getGoals();
    await b.getGoals();
    expect(f).toHaveBeenCalledTimes(2);
    now.mockReturnValue(3000);
    await b.getMe();
    await b.getGoals();
    expect(f).toHaveBeenCalledTimes(4);
    now.mockReturnValue(500);
    await b.getMe();
    expect(f).toHaveBeenCalledTimes(5);
  } finally {
    now.mockRestore();
  }
});

it('hands verified startup reads to backup once, without caching subsequent allowance reads', async () => {
  const f = jest.fn().mockResolvedValue(resp(200, allowance));
  const [a, b] = sharedClientPair(f);
  a.primeStartupReads({ data: me, etag: '"1"' }, allowance, Date.now());
  await b.getMe();
  await b.getAccountUsage();
  expect(f).not.toHaveBeenCalled();
  await b.getAccountUsage();
  await b.getAccountUsage();
  expect(f).toHaveBeenCalledTimes(2);
});

it('does not reuse lifecycle reads or seed allowance data for another incarnation', async () => {
  const f = jest
    .fn()
    .mockResolvedValue(resp(200, { state: 'active', incarnation: me.incarnation }));
  const [a] = sharedClientPair(f);
  await a.accountState();
  await a.accountState();
  expect(f).toHaveBeenCalledTimes(2);
  a.primeStartupReads(
    { data: me, etag: null },
    {
      ...allowance,
      policy: { ...allowance.policy, incarnation: '00000000-0000-4000-8000-000000000098' },
    },
    Date.now(),
  );
  f.mockResolvedValue(resp(200, me));
  await a.getMe();
  expect(f).toHaveBeenCalledTimes(3);
});

it('invalidates reusable reads on successful writes and conflict responses', async () => {
  const f = jest.fn().mockResolvedValue(resp(200, me));
  const [a, b] = sharedClientPair(f);
  await a.getMe();
  await b.patchMe({ displayName: 'New' }, 1);
  await a.getMe();
  expect(f).toHaveBeenCalledTimes(3);
  f.mockResolvedValueOnce(
    resp(412, {
      title: 'Conflict',
      status: 412,
      code: 'conflict',
      type: 'https://fixture.invalid/conflict',
    }),
  );
  await expect(b.patchMe({ displayName: 'Other' }, 1)).rejects.toMatchObject({ status: 412 });
  await a.getMe();
  expect(f).toHaveBeenCalledTimes(5);
});

it('does not let a pre-mutation GET repopulate reusable data or join the post-mutation GET', async () => {
  let finish!: (response: Response) => void;
  const f = jest
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValue(resp(200, me));
  const [a, b] = sharedClientPair(f);
  const old = a.getMe();
  // Wait until its transport is running before starting the mutation.
  while (!finish) await Promise.resolve();
  await b.patchMe({ displayName: 'New' }, 1);
  finish(resp(200, me));
  await old;
  await b.getMe();
  expect(f).toHaveBeenCalledTimes(3);
});

it('still checks cancellation and signed-in generation before serving reusable data', async () => {
  const f = jest.fn().mockResolvedValue(resp(200, me));
  const [a, b] = sharedClientPair(f);
  await a.getMe();
  await expect(b.getMe(() => false)).rejects.toMatchObject({ code: 'sync_cancelled' });
  invalidateEntitlement();
  await expect(a.getMe()).rejects.toMatchObject({ code: 'sync_cancelled' });
  expect(f).toHaveBeenCalledTimes(1);
});

it('expires startup handoffs from their original read time and never extends old allowance data', async () => {
  const f = jest.fn().mockResolvedValue(resp(200, allowance));
  const [a] = sharedClientPair(f);
  a.primeStartupReads({ data: me, etag: null }, allowance, Date.now() - 2000);
  await a.getAccountUsage();
  expect(f).toHaveBeenCalledTimes(1);
  a.primeStartupReads({ data: me, etag: null }, allowance, Date.now() + 1000);
  await a.getAccountUsage();
  expect(f).toHaveBeenCalledTimes(2);
});

it('mutation invalidates startup allowance handoff before post-write refresh', async () => {
  const f = jest.fn().mockResolvedValue(resp(200, me));
  const [a, b] = sharedClientPair(f);
  a.primeStartupReads({ data: me, etag: null }, allowance, Date.now());
  await b.patchMe({ displayName: 'New name' }, 1);
  f.mockResolvedValue(resp(200, allowance));
  await a.getAccountUsage();
  expect(f).toHaveBeenCalledTimes(2);
});

it('manual refresh clears recent reads across clients sharing the same account', async () => {
  const f = jest.fn().mockResolvedValue(resp(200, me));
  const [a, b] = sharedClientPair(f);
  await a.getMe();
  await b.getMe();
  expect(f).toHaveBeenCalledTimes(1);
  b.clearReadReuse();
  await a.getMe();
  expect(f).toHaveBeenCalledTimes(2);
});

it('never caches rejected responses and retries them on the next read', async () => {
  const f = jest
    .fn()
    .mockResolvedValueOnce(
      resp(503, {
        title: 'Unavailable',
        status: 503,
        code: 'unavailable',
        type: 'https://fixture.invalid/unavailable',
      }),
    )
    .mockResolvedValue(resp(200, me));
  const [a, b] = sharedClientPair(f);
  await expect(a.getMe()).rejects.toMatchObject({ status: 503 });
  await b.getMe();
  expect(f).toHaveBeenCalledTimes(2);
});

const warDay = (localDate = '2026-10-29', views = 12) => ({
  localDate,
  self: { status: 'eligible', views, updatedAt: '2026-10-29T00:00:00Z' },
  friends: [],
});
it('reuses War across new clients for 15 seconds, isolates dates, and forces fresh reads', async () => {
  const clock = jest.spyOn(Date, 'now').mockReturnValue(100_000);
  try {
    const f = jest.fn().mockResolvedValue(resp(200, warDay()));
    const [a, b] = sharedClientPair(f);
    expect(a.cachedBattleDaily('2026-10-29')).toBeNull();
    const first = await a.battleDaily('2026-10-29');
    first.self.views = 999;
    clock.mockReturnValue(114_999);
    expect(b.cachedBattleDaily('2026-10-29')?.self.views).toBe(12);
    expect((await b.battleDaily('2026-10-29')).self.views).toBe(12);
    expect(f).toHaveBeenCalledTimes(1);
    expect(b.cachedBattleDaily('2026-10-28')).toBeNull();
    await expect(b.battleDaily('2026-10-29', () => false)).rejects.toMatchObject({
      code: 'sync_cancelled',
    });
    expect(f).toHaveBeenCalledTimes(1);
    clock.mockReturnValue(115_000);
    expect(b.cachedBattleDaily('2026-10-29')).toBeNull();
    await b.battleDaily('2026-10-29');
    expect(f).toHaveBeenCalledTimes(2);
    await a.battleDaily('2026-10-29', undefined, true);
    expect(f).toHaveBeenCalledTimes(3);
  } finally {
    clock.mockRestore();
  }
});
it('invalidates War snapshots on writes, access loss and signed-in generation changes', async () => {
  const f = jest.fn().mockResolvedValue(resp(200, warDay()));
  const [a, b] = sharedClientPair(f);
  await a.battleDaily('2026-10-29');
  f.mockResolvedValueOnce(resp(200, { ok: true }));
  await b.removeFriend('friend');
  expect(a.cachedBattleDaily('2026-10-29')).toBeNull();
  await b.battleDaily('2026-10-29');
  f.mockResolvedValueOnce(
    resp(403, {
      title: 'Forbidden',
      status: 403,
      code: 'forbidden',
      type: 'https://fixture.invalid/forbidden',
    }),
  );
  await expect(a.battleDaily('2026-10-29', undefined, true)).rejects.toMatchObject({ status: 403 });
  expect(b.cachedBattleDaily('2026-10-29')).toBeNull();
  await b.battleDaily('2026-10-29');
  invalidateEntitlement();
  expect(a.cachedBattleDaily('2026-10-29')).toBeNull();
});

it('retains a display-only War snapshot after TTL expiry without extending network freshness', async () => {
  const clock = jest.spyOn(Date, 'now').mockReturnValue(100000);
  try {
    const f = jest.fn().mockResolvedValue(resp(200, warDay()));
    const [a, b] = sharedClientPair(f);
    await a.battleDaily('2026-10-29');
    clock.mockReturnValue(115000);
    expect(b.cachedBattleDaily('2026-10-29')).toBeNull();
    expect(b.staleBattleDaily('2026-10-29')?.self.views).toBe(12);
    expect(b.staleBattleDaily('2026-10-28')).toBeNull();
    f.mockRejectedValueOnce(new Error('offline'));
    await expect(b.battleDaily('2026-10-29')).rejects.toMatchObject({ code: 'network' });
    expect(b.staleBattleDaily('2026-10-29')?.self.views).toBe(12);
    expect(f).toHaveBeenCalledTimes(2);
    const snapshot = b.staleBattleDaily('2026-10-29')!;
    snapshot.self.views = 900;
    expect(a.staleBattleDaily('2026-10-29')?.self.views).toBe(12);
    invalidateEntitlement();
    expect(a.staleBattleDaily('2026-10-29')).toBeNull();
  } finally {
    clock.mockRestore();
  }
});

it('an older War response cannot overwrite a newer response after invalidation', async () => {
  let finish!: (response: Response) => void;
  const f = jest
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValue(resp(200, { ...warDay(), self: { ...warDay().self, views: 25 } }));
  const [a, b] = sharedClientPair(f);
  const old = a.battleDaily('2026-10-29');
  const cancelled = expect(old).rejects.toMatchObject({ code: 'sync_cancelled' });
  await Promise.resolve();
  await Promise.resolve();
  b.clearReadReuse();
  await b.battleDaily('2026-10-29');
  finish(resp(200, warDay()));
  await cancelled;
  expect(b.staleBattleDaily('2026-10-29')?.self.views).toBe(25);
});
