import { openUsageAccess } from '@/permissions/usageAccess';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import { Tracking } from 'tracking-android';
import { ApiError } from '@/api/client';
import { useApi } from '@/api/useApi';
import { useSession } from '@/auth/session';
import { setDeletingAccount } from '@/auth/verifiedAccount';
import { Screen, T, Details } from '@/ui/kit';
import { wipePhone } from '@/data/reset';
import { useOnboarding } from '@/onboarding/context';
import { Icon } from '@/ui/Icon';
import { useAccountBackup } from '@/sync/AccountBackupProvider';

const RESET_BODY =
  'Visible counts, minutes, goals and reminders on this phone will be removed. Cloud history stays saved. Account allowance accounting and pending accounting sync remain, so this does not give extra allowance. Cleared history will not be restored automatically.';

export default function Privacy() {
  const api = useApi();
  const backup = useAccountBackup();
  const setup = useOnboarding();
  const s = useSession();
  const [busy, setBusy] = useState(false);
  // Settings is reachable here only to turn off; enabling goes through the disclosure first.
  const [serviceEnabled] = useState(() => {
    try {
      return Tracking.health().serviceEnabled;
    } catch {
      return false;
    }
  });
  const confirm = (title: string, body: string, action: string, fn: () => void) =>
    Alert.alert(title, body, [
      { text: 'Cancel', style: 'cancel' },
      { text: action, style: 'destructive', onPress: fn },
    ]);

  const deleteAccount = () =>
    confirm(
      'Delete your account?',
      'This permanently deletes your account, history in the cloud, and friends. Google will ask you to confirm it’s you.',
      'Delete account',
      () => void runDeletion(),
    );

  const runDeletion = async () => {
    if (!api || s.status !== 'signedIn' || busy) return;
    setBusy(true);
    backup.pause();
    setDeletingAccount(true);
    let cloudDeleted = false;
    try {
      if (!(await s.confirmIdentity())) {
        backup.resume();
        return;
      }
      await api.deleteAccount();
      cloudDeleted = true;
      await wipePhone(true);
      setup.reload();
      await s.disconnect();
      router.replace('/welcome');
    } catch (e) {
      if (cloudDeleted) {
        Alert.alert(
          'Cloud account deleted',
          'Local cleanup or Google sign-out did not finish. Try signing out in Settings.',
        );
      } else {
        backup.resume();
        Alert.alert(
          e instanceof ApiError && e.status === 403
            ? 'Please try again'
            : 'Account was not deleted',
          e instanceof ApiError && e.status === 403
            ? 'For your safety, deleting an account needs a fresh Google sign-in. Your account has not changed.'
            : e instanceof Error
              ? e.message
              : 'Please try again.',
        );
      }
    } finally {
      setDeletingAccount(false);
      setBusy(false);
    }
  };

  const downloadData = () => {
    if (!api || busy) return;
    setBusy(true);
    api
      .exportData()
      .then((d) =>
        Share.share({ message: JSON.stringify(d, null, 2), title: 'ScrollSnooze data export' }),
      )
      .catch((e: unknown) =>
        Alert.alert('Export failed', e instanceof Error ? e.message : 'Please try again.'),
      )
      .finally(() => setBusy(false));
  };

  const deletePhoneData = () =>
    confirm('Delete data on this phone?', RESET_BODY, 'Delete', () => {
      backup.pause();
      wipePhone()
        .then(() => {
          setup.reload();
          Alert.alert('Deleted from this phone');
          backup.resume();
        })
        .catch((e: unknown) =>
          Alert.alert('Could not delete', e instanceof Error ? e.message : 'Please try again.'),
        );
    });

  return (
    <Screen>
      {api && (
        <Group title="Your account">
          <Row label="Download my data" busy={busy} onPress={downloadData} />
        </Group>
      )}

      <Group title="Privacy">
        <Details title="What we store" icon="shield">
          <T muted>
            On this phone: counts, minutes, goals and first-launch answers. Uninstalling or
            switching phones loses unbacked-up local data. Setup answers are not uploaded. When you
            sign in, we back up daily video and ad counts, minutes and goals to your account
            alongside your profile and friends. Signed-in backup also includes per-app counts and
            minutes, the date, timezone and a random device ID. Raw accessibility text, captions,
            interface trees and viewing events are not included in account backup.
          </T>
        </Details>
        {Platform.OS === 'android' && (
          <Row
            label="Read accessibility disclosure"
            onPress={() => router.push('/disclosure?mode=read')}
          />
        )}
        {serviceEnabled && (
          <Row
            label="Turn off in Accessibility settings"
            onPress={Tracking.openAccessibilitySettings}
          />
        )}
        <Row label="Usage Access settings" onPress={openUsageAccess} />
      </Group>

      <Group title="Delete">
        <Row
          danger
          label="Delete data on this phone"
          detail="Removes counts, minutes, goals and reminders here. Your account stays."
          onPress={deletePhoneData}
        />
        {api && (
          <Row
            danger
            busy={busy}
            label="Delete my account"
            detail="Permanently deletes your account, cloud history and friends."
            onPress={deleteAccount}
          />
        )}
      </Group>
    </Screen>
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <T accessibilityRole="header" style={styles.groupTitle}>
        {title}
      </T>
      <View style={styles.card}>{children}</View>
      {hint && <T style={styles.hint}>{hint}</T>}
    </View>
  );
}

function Row({
  label,
  detail,
  danger = false,
  busy = false,
  onPress,
}: {
  label: string;
  detail?: string;
  danger?: boolean;
  busy?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy, disabled: busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed || busy ? 0.6 : 1 }]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <T style={danger ? styles.danger : styles.rowLabel}>{label}</T>
        {detail && <T style={styles.hint}>{detail}</T>}
      </View>
      {busy ? (
        <ActivityIndicator color="#B4B3AA" />
      ) : (
        <Icon name="chevron" size={18} color="#B4B3AA" />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  groupTitle: { color: '#FFFFF8', fontSize: 17, fontWeight: '800' },
  hint: { color: '#B4B3AA', fontSize: 13, lineHeight: 18 },
  card: { borderRadius: 18, overflow: 'hidden', backgroundColor: '#17160F', paddingHorizontal: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  rowLabel: { color: '#FFFFF8', fontSize: 16 },
  danger: { color: '#FF8A65', fontSize: 16, fontWeight: '700' },
});
