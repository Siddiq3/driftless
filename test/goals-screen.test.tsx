import React from 'react';
import { Platform } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import Goals, { stepFrom } from '../app/goals';

const mockSaveGoal = jest.fn(async (_db: unknown, g: object) => g);
jest.mock('@/goals/store', () => ({
  saveGoal: (...a: [unknown, object]) => mockSaveGoal(...a),
  loadGoals: async () => [],
}));
jest.mock('@/db', () => ({ getDb: async () => ({}) }));
jest.mock('@/db/scope', () => ({ storageScope: () => 'guest:x' }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'id-1' }));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
}));
jest.mock('expo-font', () => ({ useFonts: () => [true] }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('tracking-android', () => ({ Tracking: { setLimits: jest.fn() } }));
jest.mock('@/billing/ProtectionNotice', () => ({ ProtectionNotice: () => null }));
jest.mock('@/goals/reminders', () => ({
  ensureNotificationPermission: async () => true,
  eveningReminderEnabled: async () => false,
  setEveningReminder: async () => true,
}));
jest.mock('@/tracking/candidateCount', () => ({ candidateCount: () => null }));
jest.mock('@/goals/useProgress', () => ({
  useProgress: () => [
    {
      state: 'ok',
      goals: [{ goalId: 'g', metric: 'views', dailyLimit: 50, enabled: true }],
      p: { today: { views: 60, minutes: null } },
      daily: {},
      health: {},
    },
  ],
}));
jest.mock('@/ui/Icon', () => ({ Icon: () => null }));
jest.mock('@/ui/kit', () => ({
  T: require('react-native').Text,
  Toggle: () => null,
  Notice: ({ body }: { body: string }) =>
    require('react').createElement(require('react-native').Text, null, body),
}));
jest.mock('@/onboarding/Visuals', () => ({ SETUP_COLORS: {} }));

let tree: ReactTestRenderer;
const text = () => JSON.stringify(tree.toJSON());
beforeEach(async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  await act(async () => {
    tree = create(<Goals />);
  });
});
afterEach(async () => {
  await act(async () => tree.unmount());
});

it('steps snap to the allowed list', () => {
  expect(stepFrom('views', 50, 1)).toBe(75);
  expect(stepFrom('views', 55, -1)).toBe(50);
  expect(stepFrom('minutes', 120, 1)).toBe(120);
});

it('shows only the two goals, today against the limit and the reminder', () => {
  expect(text()).toContain('Reels & Shorts');
  expect(text()).toContain('Time in Instagram & YouTube');
  expect(text()).toContain('Today: 60 of 50 · Limit reached');
  expect(text()).toContain('Evening check-in');
  expect(text()).not.toMatch(/allowance|About video goals|Done/);
});

it('saves the next step when raising the limit', async () => {
  await act(async () => {
    tree.root
      .findAll((n) => n.props.accessibilityLabel === 'Raise Reels & Shorts limit')[0]!
      .props.onPress();
  });
  expect(mockSaveGoal).toHaveBeenCalledWith(
    {},
    expect.objectContaining({ metric: 'views', dailyLimit: 75, enabled: true }),
  );
  expect(text()).toContain('Saved');
});
