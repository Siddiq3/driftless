import { createApiClient, type ApiClient, type ApiClientOptions } from './client';

// The token callback captures the credential generation, so a new login always
// receives a separate registry. Weak keys let retired sessions be collected.
const sessions = new WeakMap<ApiClientOptions['getAccessToken'], Map<string, ApiClient>>();
const identities = new WeakMap<ApiClient, number>();
let nextIdentity = 0;

export function apiSessionKey(api: ApiClient): number {
  let id = identities.get(api);
  if (id === undefined) {
    id = ++nextIdentity;
    identities.set(api, id);
  }
  return id;
}

export function sessionApiClient(options: ApiClientOptions): ApiClient {
  // Injected transports belong to their caller (tests/custom clients).
  if (options.fetchImpl) return createApiClient(options);
  let clients = sessions.get(options.getAccessToken);
  if (!clients) {
    clients = new Map();
    sessions.set(options.getAccessToken, clients);
  }
  const key = JSON.stringify([
    options.baseUrl.replace(/\/+$/, ''),
    options.platform,
    options.appVersion,
    options.timeoutMs ?? 15_000,
  ]);
  let client = clients.get(key);
  if (!client) {
    client = createApiClient(options);
    clients.set(key, client);
  }
  return client;
}
