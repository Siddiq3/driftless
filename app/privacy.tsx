import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Share } from 'react-native';
import { Tracking } from 'tracking-android';
import { ApiError } from '@/api/client';
import { useApi } from '@/api/useApi';
import { useSession } from '@/auth/session';
import { getDb } from '@/db';
import { Button, Section, Notice, Screen, T, Details } from '@/ui/kit';
import { clearSetup } from '@/onboarding/store';
import { useOnboarding } from '@/onboarding/context';
import { VisualBanner } from '@/ui/Focus';
import { useAccountBackup } from '@/sync/AccountBackupProvider';

/** Wipes everything ScrollSnooze stored on this phone (native counts + app database). */
async function wipePhone(): Promise<void> {
  Tracking.wipeLocalData();
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (tx) => {
    await clearSetup(tx);
    await tx.runAsync("DELETE FROM settings WHERE key LIKE 'wrapped_seen_%'");
    await tx.runAsync(
      "DELETE FROM settings WHERE key IN ('goal_backup_owner', 'account_backup_owner')",
    );
    for (const table of [
      'sync_days',
      'sync_batch',
      'goals',
      'goal_id_aliases',
      'goal_sync_state',
      'daily_cache',
      'outbox',
    ])
      await tx.runAsync(`DELETE FROM ${table}`);
  });
}

export default function Privacy() {
  const api = useApi();
  const backup = useAccountBackup();
  const setup = useOnboarding();
  const s = useSession();
  const [note, setNote] = useState<{ title: string; body: string; warn?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const confirm = (title: string, body: string, action: string, fn: () => void) =>
    Alert.alert(title, body, [
      { text: 'Cancel', style: 'cancel' },
      { text: action, style: 'destructive', onPress: fn },
    ]);

  const deleteAccount = () =>
    confirm(
      'Delete your account?',
      'This permanently deletes your account, history in the cloud, friends and challenge memberships. Cancel any Pro subscription in Google Play separately.',
      'Delete account',
      () => {
        if (!api || s.status !== 'signedIn') return;
        backup.pause();
        setBusy(true);
        let cloudDeleted = false;
        api
          .deleteAccount()
          .then(async () => {
            cloudDeleted = true;
            await wipePhone();
            setup.reload();
            await s.disconnect();
            router.replace('/welcome');
          })
          .catch((e: unknown) => {
            if (cloudDeleted) {
              setNote({
                warn: true,
                title: 'Cloud account deleted',
                body: 'Local cleanup or Google sign-out did not finish. Try signing out in Settings.',
              });
            } else if (e instanceof ApiError && e.status === 403) {
              setNote({
                warn: true,
                title: 'Please sign in again first',
                body: 'For your safety, deleting an account needs a fresh Google identity token. Sign out, sign back in, and try again within 5 minutes.',
              });
            } else {
              setNote({
                warn: true,
                title: 'Account was not deleted',
                body: e instanceof Error ? e.message : '',
              });
            }
          })
          .finally(() => setBusy(false));
      },
    );

  return (
    <Screen>
      <VisualBanner art="focus" title="Your data stays yours" />
      {note && <Notice tone={note.warn ? 'warn' : 'info'} title={note.title} body={note.body} />}

      <Details title="What we store" icon="shield">
        <T muted>
          On this phone: counts, minutes, goals and first-launch answers. Uninstalling or switching
          phones loses unbacked-up local data. Setup answers are never uploaded. When you sign in,
          we back up daily totals and goals to your account alongside your profile and friends.
          Never what you watched, messages or screenshots.
        </T>
      </Details>

      <Section>
        <T v="heading">Saving your progress</T>
        <T muted>
          Without an account, progress stays on this phone. Signing in backs up saved goals and
          supported daily history automatically. Sign out to stop account backup. Sharing with
          friends is a separate choice.
        </T>
      </Section>

      <Section>
        <T v="heading">Turn counting off</T>
        <T muted>
          Switch off “ScrollSnooze Reels &amp; Shorts counter” in Accessibility settings, and Usage
          Access for ScrollSnooze.
        </T>
        <Button
          kind="secondary"
          label="Accessibility settings"
          onPress={Tracking.openAccessibilitySettings}
        />
        <Button
          kind="secondary"
          label="Usage Access settings"
          onPress={Tracking.openUsageAccessSettings}
        />
      </Section>

      {api && (
        <Section>
          <T v="heading">Your account</T>
          <Button
            kind="secondary"
            label="Download my data"
            busy={busy}
            onPress={() => {
              setBusy(true);
              api
                .exportData()
                .then((d) =>
                  Share.share({
                    message: JSON.stringify(d, null, 2),
                    title: 'ScrollSnooze data export',
                  }),
                )
                .catch((e: unknown) =>
                  setNote({
                    warn: true,
                    title: 'Export failed',
                    body: e instanceof Error ? e.message : '',
                  }),
                )
                .finally(() => setBusy(false));
            }}
          />
          <Button kind="danger" label="Delete my account" busy={busy} onPress={deleteAccount} />
        </Section>
      )}

      <Section>
        <T v="heading">This phone</T>
        <Button
          kind="danger"
          label="Delete everything on this phone"
          onPress={() =>
            confirm(
              'Delete data on this phone?',
              'Counts, minutes and goals stored on this phone will be removed.',
              'Delete',
              () => {
                backup.pause();
                wipePhone()
                  .then(() => {
                    setup.reload();
                    setNote({ title: 'Deleted from this phone', body: '' });
                  })
                  .catch((e: unknown) =>
                    setNote({
                      warn: true,
                      title: 'Could not delete',
                      body: e instanceof Error ? e.message : '',
                    }),
                  );
              },
            )
          }
        />
      </Section>
    </Screen>
  );
}
