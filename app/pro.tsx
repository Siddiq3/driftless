import type { Offer } from 'billing-android';
import { Redirect, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking } from 'react-native';
import { createApiClient } from '@/api/client';
import { useSession } from '@/auth/session';
import { buyPro, loadOffers, MANAGE_URL, restorePro } from '@/billing/pro';
import { APP_VERSION, readEnv } from '@/config/env';
import { Button, Card, Notice, Screen, T } from '@/ui/kit';

const FEATURES = [
  'Pause Instagram or YouTube when you reach your daily limit',
  'Focus schedules, like work hours or bedtime',
  'Longer history and trends',
];

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
      <T v="title">Driftless Pro</T>
      <Card>
        {FEATURES.map((f) => (
          <T key={f} muted>
            • {f}
          </T>
        ))}
      </Card>
      <T v="caption" muted>
        Counting, goals, Wick and your history stay free. Pro is verified by our server with Google
        Play; cancel any time in Google Play.
      </T>
      {note && <Notice tone={note.warn ? 'warn' : 'info'} title={note.title} body={note.body} />}
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
      <Button kind="secondary" label="Back" onPress={() => router.back()} />
    </Screen>
  );
}
