let mockSubscriptionsRequired = true;
jest.mock('../src/config/access', () => ({
  get SUBSCRIPTIONS_REQUIRED() {
    return mockSubscriptionsRequired;
  },
}));
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import Pro from '../app/pro';
import { buyPro, restorePro } from '../src/billing/pro';
const paid = {
  tier: 'pro',
  state: 'active',
  source: 'play',
  expiresAt: '2026-11-18T00:00:00Z',
  verifiedAt: '2026-10-21T00:00:00Z',
};
const mockApi = { getMe: jest.fn() };
jest.mock('@/api/useApi', () => ({ useApi: () => mockApi }));
jest.mock('@/auth/session', () => ({ useSession: () => ({ status: 'signedIn' }) }));
jest.mock('expo-router', () => ({ Redirect: () => null }));
jest.mock('@/billing/cache', () => ({ entitlementGeneration: () => 0 }));
jest.mock('@/billing/pro', () => ({
  loadOffers: jest.fn(async () => [
    { offerToken: 'offer', basePlanId: 'month', price: '₹99', period: 'P1M' },
  ]),
  offerDisclosure: () => '₹0 for one week, then ₹99 per month until cancelled.',
  restorePro: jest.fn(),
  buyPro: jest.fn(),
  MANAGE_URL: 'https://example.test/subscriptions',
}));
jest.mock('@/ui/Focus', () => ({ VisualBanner: () => null }));
jest.mock('@/ui/Icon', () => ({ Icon: () => null }));
jest.mock('@/ui/kit', () => {
  const { View, Text, Pressable } = require('react-native');
  const React = require('react');
  return {
    Screen: View,
    Section: View,
    T: Text,
    LoadingState: () => null,
    Notice: ({ title, body }: { title: string; body: string }) =>
      React.createElement(Text, null, title, body),
    Button: ({ label, onPress }: { label: string; onPress: () => void }) =>
      React.createElement(Pressable, { accessibilityLabel: label, onPress }),
  };
});
let tree: ReactTestRenderer;
const content = () => JSON.stringify(tree.toJSON());
const tap = async (label: string) => {
  await act(async () => {
    await tree.root
      .findAll(
        (node) =>
          node.props.accessibilityLabel === label && typeof node.props.onPress === 'function',
      )[0]!
      .props.onPress();
  });
};
beforeEach(async () => {
  mockSubscriptionsRequired = true;
  jest.clearAllMocks();
  mockApi.getMe.mockResolvedValue({ data: { userId: 'current-user', entitlement: paid } });
  jest.mocked(restorePro).mockResolvedValue(null);
  await act(async () => {
    tree = create(<Pro />);
  });
});
afterEach(async () => {
  await act(async () => tree.unmount());
});
test('shows offer disclosures without advertising nonexistent paid history', () => {
  expect(content()).toContain('₹0 for one week');
  expect(content()).toContain('Your plan: Pro');
  expect(content()).not.toContain('More history & trends');
});
test('empty restore updates the displayed plan and does not overwrite it with an old profile', async () => {
  await tap('Restore purchase');
  expect(content()).toContain('Your plan: Free');
  expect(content()).toContain('No active subscription found on this Google Play account');
  expect(mockApi.getMe).toHaveBeenCalledTimes(1);
});
test('uses the profile account for purchase and displays the server verification result', async () => {
  jest.mocked(buyPro).mockResolvedValue(paid as never);
  await tap('Subscribe — ₹99 / month');
  expect(buyPro).toHaveBeenCalledWith(
    mockApi,
    'current-user',
    expect.objectContaining({ offerToken: 'offer' }),
  );
  expect(content()).toContain('Pro is on. Thank you!');
});

test('included release redirects old purchase links without loading offers or billing', async () => {
  await act(async () => tree.unmount());
  mockSubscriptionsRequired = false;
  jest.clearAllMocks();
  await act(async () => {
    tree = create(<Pro />);
  });
  expect(mockApi.getMe).not.toHaveBeenCalled();
  expect(buyPro).not.toHaveBeenCalled();
  expect(restorePro).not.toHaveBeenCalled();
  expect(content()).not.toContain('Subscribe');
});
