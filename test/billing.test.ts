import { createHash } from 'node:crypto';

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: async (_alg: string, s: string) =>
    require('node:crypto').createHash('sha256').update(s).digest('hex'),
}));
jest.mock('billing-android', () => ({ Billing: { active: jest.fn(), purchase: jest.fn() } }));
jest.mock('tracking-android', () => ({ Tracking: { setEntitlement: jest.fn() } }));

import { Billing } from 'billing-android';
import { invalidateEntitlement, entitlementGeneration } from '../src/billing/cache';
import { Tracking } from 'tracking-android';
import {
  accountIdFor,
  cacheEntitlement,
  buyPro,
  restorePro,
  offerDisclosure,
} from '../src/billing/pro';

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

const entitlement = {
  tier: 'pro' as const,
  source: 'play' as const,
  state: 'active' as const,
  expiresAt: '2026-11-18T00:00:00Z',
  verifiedAt: '2026-10-21T00:00:00Z',
};
const offer = { offerToken: 'offer', basePlanId: 'monthly', price: '₹99', period: 'P1M' };
beforeEach(() => {
  jest.clearAllMocks();
});
test('empty restore clears previous native Pro only after a successful Play query', async () => {
  jest.mocked(Billing.active).mockResolvedValue([]);
  await expect(restorePro({ playVerify: jest.fn() })).resolves.toBeNull();
  expect(Tracking.setEntitlement).toHaveBeenCalledWith('free', 'none', null, expect.any(Number));
});
test('offline or failed restore preserves the bounded cache', async () => {
  jest.mocked(Billing.active).mockRejectedValue(new Error('offline'));
  await expect(restorePro({ playVerify: jest.fn() })).rejects.toThrow('offline');
  expect(Tracking.setEntitlement).not.toHaveBeenCalled();
});
test('a verification completing after sign-out cannot restore old-account access', async () => {
  jest.mocked(Billing.active).mockResolvedValue([
    {
      products: ['driftless_pro'],
      state: 'purchased',
      purchaseToken: 'token',
      acknowledged: true,
    },
  ]);
  let finish!: (value: { entitlement: typeof entitlement }) => void;
  const playVerify = jest.fn(
    () =>
      new Promise<{ entitlement: typeof entitlement }>((resolve) => {
        finish = resolve;
      }),
  );
  const pending = restorePro({ playVerify });
  await Promise.resolve();
  await Promise.resolve();
  invalidateEntitlement();
  jest.mocked(Tracking.setEntitlement).mockClear();
  finish({ entitlement });
  await expect(pending).rejects.toThrow('Account changed');
  expect(Tracking.setEntitlement).not.toHaveBeenCalled();
});
test('pending and unspecified purchases never verify or grant Pro', async () => {
  const api = { playVerify: jest.fn() };
  for (const state of ['pending', 'unspecified'] as const) {
    jest.mocked(Billing.purchase).mockResolvedValue({
      products: ['driftless_pro'],
      state,
      purchaseToken: 'token',
      acknowledged: false,
    });
    await expect(buyPro(api, 'user', offer)).rejects.toThrow();
  }
  expect(api.playVerify).not.toHaveBeenCalled();
  expect(Tracking.setEntitlement).not.toHaveBeenCalled();
});
test('stale profile results cannot regrant Pro after invalidation', () => {
  const generation = entitlementGeneration();
  invalidateEntitlement();
  jest.mocked(Tracking.setEntitlement).mockClear();
  cacheEntitlement(entitlement, Date.now(), generation);
  expect(Tracking.setEntitlement).not.toHaveBeenCalled();
});
test('discloses introductory phases and recurring renewal, with an older-binary fallback', () => {
  expect(
    offerDisclosure({
      ...offer,
      phases: [
        { price: '₹0', period: 'P1W', cycles: 1, mode: 2 },
        { price: '₹99', period: 'P1M', cycles: 0, mode: 1 },
      ],
    }),
  ).toBe(
    '₹0 per week for 1 billing period(s). ₹99 per month, renews automatically until cancelled.',
  );
  expect(offerDisclosure(offer)).toContain('full price');
});

test('foreground restore is serialized behind purchase verification', async () => {
  let finish!: (value: { entitlement: typeof entitlement }) => void;
  const playVerify = jest.fn(
    () =>
      new Promise<{ entitlement: typeof entitlement }>((resolve) => {
        finish = resolve;
      }),
  );
  jest.mocked(Billing.purchase).mockResolvedValue({
    products: ['driftless_pro'],
    state: 'purchased',
    purchaseToken: 'token',
    acknowledged: false,
  });
  jest.mocked(Billing.active).mockResolvedValue([]);
  const purchase = buyPro({ playVerify }, 'user', offer);
  for (let i = 0; i < 8; i++) await Promise.resolve();
  const restore = restorePro({ playVerify });
  expect(Billing.active).not.toHaveBeenCalled();
  finish({ entitlement });
  await purchase;
  await restore;
  expect(Billing.active).toHaveBeenCalledTimes(1);
});
