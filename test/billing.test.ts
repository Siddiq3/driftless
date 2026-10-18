import { createHash } from 'node:crypto';

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: async (_alg: string, s: string) =>
    require('node:crypto').createHash('sha256').update(s).digest('hex'),
}));
jest.mock('billing-android', () => ({ Billing: {} }));
jest.mock('tracking-android', () => ({ Tracking: { setEntitlement: jest.fn() } }));

import { Tracking } from 'tracking-android';
import { accountIdFor, cacheEntitlement } from '../src/billing/pro';

describe('Pro billing (app side)', () => {
  it('obfuscated account id matches the server formula exactly', async () => {
    const sub = '6f1063db-ceef-4260-972f-bc5f2e7dfad1';
    // driftless-backend services/api/src/modules/billing/play-state.ts: obfuscatedAccountId()
    const server = createHash('sha256').update(`driftless:${sub}`).digest('hex').slice(0, 64);
    await expect(accountIdFor(sub)).resolves.toBe(server);
  });

  it('caches exactly what the server returned', () => {
    cacheEntitlement(
      {
        tier: 'pro',
        source: 'play',
        state: 'active',
        expiresAt: '2026-11-18T00:00:00.000Z',
        verifiedAt: '2026-10-18T00:00:00.000Z',
      },
      0,
    );
    expect(Tracking.setEntitlement).toHaveBeenCalledWith(
      'pro',
      'active',
      Date.parse('2026-11-18T00:00:00.000Z'),
      Date.parse('2026-10-18T00:00:00.000Z'),
    );
  });
});
