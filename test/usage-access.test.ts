import { Alert } from 'react-native';
import { Tracking } from 'tracking-android';
import { openUsageAccess, USAGE_ACCESS_BODY } from '@/permissions/usageAccess';

jest.mock('tracking-android', () => ({
  Tracking: { health: jest.fn(), openUsageAccessSettings: jest.fn() },
}));

const health = Tracking.health as jest.Mock;
const open = Tracking.openUsageAccessSettings as jest.Mock;
const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
const button = (text: string) =>
  (alert.mock.calls[0]![2] as { text: string; onPress?: () => void }[]).find(
    (b) => b.text === text,
  )!;

beforeEach(() => {
  jest.clearAllMocks();
  health.mockReturnValue({ usageAccessGranted: false });
});

test('explains first and does not open Settings by itself', () => {
  openUsageAccess();
  expect(open).not.toHaveBeenCalled();
  for (const words of ['time in Instagram and YouTube', 'on your phone', 'backed up', 'Friends don’t see'])
    expect(USAGE_ACCESS_BODY).toContain(words);
});

test('cancel stays in the app, continue opens Settings', () => {
  openUsageAccess();
  expect(button('Cancel').onPress).toBeUndefined();
  button('Continue').onPress!();
  expect(open).toHaveBeenCalledTimes(1);
});

test('still explains when the current state cannot be read', () => {
  health.mockImplementation(() => {
    throw new Error('unavailable');
  });
  openUsageAccess();
  expect(alert).toHaveBeenCalledTimes(1);
  expect(open).not.toHaveBeenCalled();
});

test('going back to turn it off opens Settings directly', () => {
  health.mockReturnValue({ usageAccessGranted: true });
  openUsageAccess();
  expect(alert).not.toHaveBeenCalled();
  expect(open).toHaveBeenCalledTimes(1);
});
