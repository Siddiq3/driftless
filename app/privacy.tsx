import { openUsageAccess } from '@/permissions/usageAccess';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Platform, Pressable, Share, StyleSheet, View } from 'react-native';
import { websiteLinks } from '@/config/website';
import { Tracking } from 'tracking-android';
import { ApiError } from '@/api/client';
import { useApi } from '@/api/useApi';
import { useSession } from '@/auth/session';
import { Button, Section, Notice, Screen, T, Details } from '@/ui/kit';
import { wipePhone } from '@/data/reset';
import { useOnboarding } from '@/onboarding/context';
import { Icon } from '@/ui/Icon';
import { VisualBanner } from '@/ui/Focus';
import { useAccountBackup } from '@/sync/AccountBackupProvider';

export default function Privacy() {
  const api = useApi();
  const backup = useAccountBackup();
  const setup = useOnboarding();
  const s = useSession();
  const [note, setNote] = useState<{ title: string; body: string; warn?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  // Settings is reachable here only to turn off; enabling goes through the disclosure first.
  const [serviceEnabled] = useState(() => {
    try {
      return Tracking.health().serviceEnabled;
    } catch {
      return false;
    }
  });
  const links = websiteLinks();
  const openWebsite = (url: string) => {
    void Linking.openURL(url).catch(() =>
      setNote({
        title: 'Could not open website',
        body: 'Please try again or contact siddiqkolimi.dev@gmail.com.',
        warn: true,
      }),
    );
  };

  const confirm = (title: string, body: string, action: string, fn: () => void) =>
    Alert.alert(title, body, [
      { text: 'Cancel', style: 'cancel' },
      { text: action, style: 'destructive', onPress: fn },
    ]);

  const deleteAccount = () =>
    confirm(
      'Delete your account?',
      'This permanently deletes your account, history in the cloud, and friends.',
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
            await wipePhone(true);
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
      {links && (
        <Section>
          <T v="heading">Policies & support</T>
          <View style={styles.links}>
            {[
              { label: 'Read privacy policy', url: links.privacy },
              { label: 'Request deletion on the website', url: links.deletion },
              { label: 'Terms of use', url: links.terms },
              { label: 'Contact support', url: links.support },
            ].map(({ label, url }, i) => (
              <Pressable
                key={label}
                accessibilityRole="button"
                accessibilityLabel={label}
                onPress={() => openWebsite(url)}
                style={({ pressed }) => [
                  styles.link,
                  i > 0 && styles.linkDivider,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <T style={{ flex: 1, fontSize: 16 }}>{label}</T>
                <Icon name="chevron" size={18} color="#B4B3AA" />
              </Pressable>
            ))}
          </View>
        </Section>
      )}
      {note && <Notice tone={note.warn ? 'warn' : 'info'} title={note.title} body={note.body} />}

      <Details title="What we store" icon="shield">
        <T muted>
          On this phone: counts, minutes, goals and first-launch answers. Uninstalling or switching
          phones loses unbacked-up local data. Setup answers are not uploaded. When you sign in, we
          back up daily video and ad counts, minutes and goals to your account alongside your
          profile and friends. Signed-in backup also includes per-app counts and minutes, the date,
          timezone and a random device ID. Raw accessibility text, captions, interface trees and
          viewing events are not included in account backup.
        </T>
      </Details>

      <Section>
        <T v="heading">Saving your progress</T>
        <T muted>
          Without an account, progress stays on this phone. Signing in backs up saved goals and
          supported daily history automatically. Sign out to stop account backup. Signing in never
          shares with friends. Sharing starts only when an invitation is accepted: your friend sees
          your daily Reels and Shorts count from that day on, including experimental counts, and
          your Google account name. Delete the friend to stop. Signing out stops new counts, but
          friends can still see counts already backed up.
        </T>
      </Section>

      {Platform.OS === 'android' && (
        <Section>
          <Button
            kind="secondary"
            label="Read accessibility disclosure"
            onPress={() => router.push('/disclosure?mode=read')}
          />
        </Section>
      )}

      <Section>
        <T v="heading">Turn counting off</T>
        <T muted>
          Switch off “ScrollSnooze short-video counter” in Accessibility settings, and Usage Access
          for ScrollSnooze.
        </T>
        {serviceEnabled && (
          <Button
            kind="secondary"
            label="Turn off in Accessibility settings"
            onPress={Tracking.openAccessibilitySettings}
          />
        )}
        <Button kind="secondary" label="Usage Access settings" onPress={openUsageAccess} />
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
          label="Reset local history"
          onPress={() =>
            confirm(
              'Reset local history?',
              'Visible counts, minutes, goals and reminders on this phone will be removed. Cloud history stays saved. Account allowance accounting and pending accounting sync remain, so this does not give extra allowance. Cleared history will not be restored automatically.',
              'Reset',
              () => {
                backup.pause();
                wipePhone()
                  .then(() => {
                    setup.reload();
                    setNote({ title: 'Deleted from this phone', body: '' });
                    backup.resume();
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

const styles = StyleSheet.create({
  links: { borderRadius: 18, overflow: 'hidden', backgroundColor: '#17160F' },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 16,
  },
  linkDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#29271F' },
});
