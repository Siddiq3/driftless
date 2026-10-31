import { Alert } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ApiError } from '../src/api/client';
import Privacy from '../app/privacy';

const mockApi = { deleteAccount: jest.fn(), exportData: jest.fn() };
const mockSession = {
  status: 'signedIn',
  confirmIdentity: jest.fn(),
  disconnect: jest.fn(async () => undefined),
};
const mockWipe = jest.fn(async () => undefined);
const mockBackup = { pause: jest.fn(), resume: jest.fn() };
jest.mock('@/api/useApi', () => ({ useApi: () => mockApi }));
jest.mock('@/auth/session', () => ({ useSession: () => mockSession }));
jest.mock('@/auth/verifiedAccount', () => ({ setDeletingAccount: jest.fn() }));
jest.mock('@/data/reset', () => ({ wipePhone: (...a: unknown[]) => mockWipe(...(a as [])) }));
jest.mock('@/sync/AccountBackupProvider', () => ({ useAccountBackup: () => mockBackup }));
jest.mock('@/onboarding/context', () => ({ useOnboarding: () => ({ reload: jest.fn() }) }));
jest.mock('@/config/website', () => ({ websiteLinks: () => null }));
jest.mock('@/permissions/usageAccess', () => ({ openUsageAccess: jest.fn() }));
jest.mock('@/ui/Icon', () => ({ Icon: () => null }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));
jest.mock('tracking-android', () => ({
  Tracking: { health: () => ({ serviceEnabled: false }), openAccessibilitySettings: jest.fn() },
}));
jest.mock('@/ui/kit', () => {
  const { View, Text: RNText } = require('react-native');
  return { Screen: View, T: RNText, Details: View };
});

let tree: ReactTestRenderer;
const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
const startDeletion = async () => {
  await act(async () => {
    tree = create(<Privacy />);
  });
  await act(async () => {
    tree.root.findByProps({ accessibilityLabel: 'Delete my account' }).props.onPress();
  });
  const buttons = alert.mock.calls[0]![2] as { text: string; onPress?: () => void }[];
  await act(async () => {
    buttons.find((b) => b.text === 'Delete account')!.onPress!();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSession.confirmIdentity.mockResolvedValue(true);
  mockApi.deleteAccount.mockResolvedValue({});
});

it('confirms with Google, then deletes', async () => {
  await startDeletion();
  expect(mockSession.confirmIdentity.mock.invocationCallOrder[0]).toBeLessThan(
    mockApi.deleteAccount.mock.invocationCallOrder[0]!,
  );
  expect(mockWipe).toHaveBeenCalledWith(true);
  expect(mockSession.disconnect).toHaveBeenCalled();
});

it('cancelling Google deletes nothing and resumes backup', async () => {
  mockSession.confirmIdentity.mockResolvedValue(false);
  await startDeletion();
  expect(mockApi.deleteAccount).not.toHaveBeenCalled();
  expect(mockBackup.resume).toHaveBeenCalled();
});

it('a refusal is shown in a dialog and keeps local data', async () => {
  mockApi.deleteAccount.mockRejectedValue(new ApiError(403, 'forbidden', 'recent'));
  await startDeletion();
  expect(alert.mock.calls.at(-1)![0]).toBe('Please try again');
  expect(mockWipe).not.toHaveBeenCalled();
});

it('offers phone-only deletion separately from the account', async () => {
  await act(async () => {
    tree = create(<Privacy />);
  });
  expect(JSON.stringify(tree.toJSON())).toContain('Your account stays');
});
