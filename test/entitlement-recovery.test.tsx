import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AppState } from 'react-native';
import { Billing } from 'billing-android';
import { Tracking } from 'tracking-android';
import { EntitlementRecovery } from '../src/billing/EntitlementRecovery';
import { invalidateEntitlement } from '../src/billing/cache';
const mockApi = { getMe: jest.fn(), playVerify: jest.fn() };
jest.mock('@/api/useApi', () => ({ useApi: () => mockApi }));
jest.mock('billing-android', () => ({ Billing: { active: jest.fn() } }));
jest.mock('tracking-android', () => ({ Tracking: { setEntitlement: jest.fn() } }));
const free = { tier: 'free', source: 'none', state: 'none', expiresAt: null, verifiedAt: null };
const paid = {
  tier: 'pro',
  source: 'play',
  state: 'active',
  expiresAt: '2026-12-01T00:00:00Z',
  verifiedAt: '2026-10-21T00:00:00Z',
};
let tree: ReactTestRenderer;
let foreground: (state: string) => void;
const mount = async () => {
  await act(async () => {
    tree = create(<EntitlementRecovery />);
  });
};
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_name, listener) => {
    foreground = listener as typeof foreground;
    return { remove: jest.fn() };
  });
  mockApi.getMe.mockResolvedValue({ data: { entitlement: free } });
  mockApi.playVerify.mockResolvedValue({ entitlement: paid });
  jest.mocked(Billing.active).mockResolvedValue([]);
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  jest.useRealTimers();
  jest.restoreAllMocks();
});
test('rechecks completed payments on foreground and coalesces rapid foreground events', async () => {
  await mount();
  expect(mockApi.playVerify).not.toHaveBeenCalled();
  jest.mocked(Billing.active).mockResolvedValue([
    {
      products: ['driftless_pro'],
      purchaseToken: 'completed-payment',
      state: 'purchased',
      acknowledged: false,
    },
  ]);
  await act(async () => {
    foreground('active');
    foreground('active');
  });
  expect(Billing.active).toHaveBeenCalledTimes(1);
  await act(async () => {
    jest.advanceTimersByTime(60001);
    foreground('active');
  });
  expect(mockApi.playVerify).toHaveBeenCalledWith('driftless_pro', 'completed-payment');
  expect(Tracking.setEntitlement).toHaveBeenLastCalledWith(
    'pro',
    'active',
    Date.parse(paid.expiresAt),
    Date.parse(paid.verifiedAt),
  );
});
test('a delayed previous-session profile cannot cache access or start Play recovery', async () => {
  let finish!: (value: unknown) => void;
  mockApi.getMe.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await mount();
  invalidateEntitlement();
  jest.mocked(Tracking.setEntitlement).mockClear();
  await act(async () => {
    finish({ data: { entitlement: paid } });
  });
  expect(Tracking.setEntitlement).not.toHaveBeenCalled();
  expect(Billing.active).not.toHaveBeenCalled();
});
test('network failure preserves the existing bounded native cache', async () => {
  mockApi.getMe.mockRejectedValue(new Error('offline'));
  await mount();
  expect(Tracking.setEntitlement).not.toHaveBeenCalled();
});
