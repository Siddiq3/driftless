import { apiSessionKey, sessionApiClient } from '../src/api/sessionClient';

const options = { baseUrl: 'https://api.example.test', platform: 'android' as const, appVersion: '1' };
it('shares one client across consumers of the same credential generation', () => {
  const getAccessToken = async () => 'a';
  const a = sessionApiClient({ ...options, getAccessToken });
  const b = sessionApiClient({ ...options, baseUrl: options.baseUrl + '/', getAccessToken });
  expect(a).toBe(b);
  expect(apiSessionKey(a)).toBe(apiSessionKey(b));
});
it('separates accounts, API origins and app versions', () => {
  const getAccessToken = async () => 'a';
  const a = sessionApiClient({ ...options, getAccessToken });
  const b = sessionApiClient({ ...options, getAccessToken: async () => 'b' });
  const c = sessionApiClient({ ...options, getAccessToken, baseUrl: 'https://other.example.test' });
  const d = sessionApiClient({ ...options, getAccessToken, appVersion: '2' });
  expect(new Set([a, b, c, d]).size).toBe(4);
  expect(apiSessionKey(a)).not.toBe(apiSessionKey(b));
});
