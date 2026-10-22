import { ApiError, createApiClient } from '../src/api/client';

const me = {
  userId: 'u1',
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
