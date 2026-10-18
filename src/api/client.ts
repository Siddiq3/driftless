import { Problem, v1 } from '@siddiq3/driftless-contracts';
import type { z } from 'zod';

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
    init: { body?: unknown; headers?: Record<string, string> } = {},
  ): Promise<{ data: z.infer<S>; etag: string | null }> {
    const token = await o.getAccessToken();
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
    getMe: () =>
      request(
        'GET',
        `/v1/me?platform=${o.platform}&appVersion=${encodeURIComponent(o.appVersion)}`,
        v1.MeResponse,
      ),
    patchMe: (patch: v1.PatchMeRequest, rev: number) =>
      request('PATCH', '/v1/me', v1.MeResponse, {
        body: patch,
        headers: { 'if-match': `"${rev}"` },
      }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
