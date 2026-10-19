import type { Offer } from 'billing-android';
import { Redirect } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, View } from 'react-native';
import { createApiClient } from '@/api/client';
import { useSession } from '@/auth/session';
import { buyPro, loadOffers, MANAGE_URL, restorePro } from '@/billing/pro';
import { APP_VERSION, readEnv } from '@/config/env';
import { Button, Section, Notice, Screen, T, LoadingState } from '@/ui/kit';
import { VisualBanner } from '@/ui/Focus';
import { Icon } from '@/ui/Icon';

const FEATURES = ['App pauses at your limit', 'Focus & bedtime schedules', 'More history & trends'];

export default function Pro() {
  const s = useSession();
  const env = readEnv();
  const api = useMemo(
    () =>
      s.status === 'signedIn' && env
        ? createApiClient({
            baseUrl: env.apiUrl,
            getAccessToken: s.getAccessToken,
            platform: 'android',
            appVersion: APP_VERSION,
          })
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s.status, env?.apiUrl],
  );
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ title: string; body: string; warn?: boolean } | null>(null);

  useEffect(() => {
    if (!api) return;
    api
      .getMe()
      .then(({ data }) => setUserId(data.userId))
      .catch(() => undefined);
    loadOffers()
      .then(setOffers)
      .catch((e: unknown) =>
        setNote({
          warn: true,
          title: 'Google Play is unavailable',
          body: e instanceof Error ? e.message : 'Try again later.',
        }),
      );
  }, [api]);

  if (s.status === 'signedOut' || s.status === 'unconfigured') return <Redirect href="/welcome" />;

  const run = (fn: () => Promise<string>) => {
    setBusy(true);
    fn()
      .then((msg) => setNote({ title: msg, body: '' }))
      .catch((e: unknown) =>
        setNote({
          warn: true,
          title: 'That did not work',
          body: e instanceof Error ? e.message : '',
        }),
      )
      .finally(() => setBusy(false));
  };

  return (
    <Screen>
      <VisualBanner art="focus" title="More room for life" />
      <Section>
        <T v="heading">What’s included</T>
        {FEATURES.map((f, i) => (
          <View
            key={f}
            style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 8 }}
          >
            <Icon name={i === 0 ? 'lock' : i === 1 ? 'clock' : 'chart'} />
            <T muted style={{ flex: 1 }}>
              {f}
            </T>
          </View>
        ))}
      </Section>
      <T v="caption" muted>
        Counting, goals, Wick and your history stay free. Pro is verified by our server with Google
        Play; cancel any time in Google Play.
      </T>
      {note && <Notice tone={note.warn ? 'warn' : 'info'} title={note.title} body={note.body} />}
      {offers === null && !note && <LoadingState label="Checking plans in Google Play…" />}
      {offers?.length === 0 && (
        <Notice title="Not available yet" body="Pro isn't on sale in this build." />
      )}
      {api &&
        userId &&
        offers?.map((o) => (
          <Button
            key={o.offerToken}
            busy={busy}
            label={`Subscribe — ${o.price}${o.period === 'P1M' ? ' / month' : o.period === 'P1Y' ? ' / year' : ''}`}
            onPress={() =>
              run(async () =>
                (await buyPro(api, userId, o)).tier === 'pro'
                  ? 'Pro is on. Thank you!'
                  : 'Purchase received but not active yet.',
              )
            }
          />
        ))}
      {api && (
        <Button
          kind="secondary"
          label="Restore purchase"
          busy={busy}
          onPress={() =>
            run(async () =>
              (await restorePro(api))?.tier === 'pro'
                ? 'Pro restored.'
                : 'No active subscription found.',
            )
          }
        />
      )}
      <Button
        kind="secondary"
        label="Manage subscription in Google Play"
        onPress={() => void Linking.openURL(MANAGE_URL)}
      />
    </Screen>
  );
}
