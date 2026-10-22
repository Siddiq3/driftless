import type { Offer } from 'billing-android';
import { Redirect } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, View } from 'react-native';
import { useApi } from '@/api/useApi';
import type { v1 } from '@siddiq3/driftless-contracts';
import { entitlementGeneration } from '@/billing/cache';
import { useSession } from '@/auth/session';
import { buyPro, loadOffers, MANAGE_URL, restorePro, offerDisclosure } from '@/billing/pro';
import { Button, Section, Notice, Screen, T, LoadingState } from '@/ui/kit';
import { VisualBanner } from '@/ui/Focus';
import { Icon } from '@/ui/Icon';

const FEATURES = [
  'Minute-based app pauses',
  'Preset focus & bedtime schedules',
  'Experimental feed limits and breaks',
];

export default function Pro() {
  const s = useSession();
  const api = useApi();
  const [entitlement, setEntitlement] = useState<v1.Entitlement | null>(null);
  const currentApi = useRef(api);
  const [profileApi, setProfileApi] = useState<typeof api>(null);
  const operation = useRef(false);
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ title: string; body: string; warn?: boolean } | null>(null);

  useEffect(() => {
    currentApi.current = api;
    if (!api) return;
    let active = true;
    const generation = entitlementGeneration();
    const refresh = () => {
      api
        ?.getMe()
        .then(({ data }) => {
          if (active && generation === entitlementGeneration()) {
            setProfileApi(api);
            setUserId(data.userId);
            setEntitlement(data.entitlement);
          }
        })
        .catch(() => {
          if (active)
            setNote({
              title: 'Subscription status unavailable',
              body: 'Check your connection and reopen this screen.',
              warn: true,
            });
        });
    };
    refresh();
    loadOffers()
      .then((value) => {
        if (active) setOffers(value);
      })
      .catch(() => {
        if (active)
          setNote({
            warn: true,
            title: 'Google Play is unavailable',
            body: 'Reopen this screen to try again.',
          });
      });
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      active = false;
      currentApi.current = null;
      listener.remove();
    };
  }, [api]);

  if (s.status === 'signedOut' || s.status === 'unconfigured') return <Redirect href="/welcome" />;

  const run = (fn: () => Promise<{ message: string; entitlement: v1.Entitlement | null }>) => {
    if (operation.current) return;
    operation.current = true;
    const generation = entitlementGeneration();
    const allowed = () => currentApi.current === api && generation === entitlementGeneration();
    setBusy(true);
    fn()
      .then(({ message, entitlement: result }) => {
        if (allowed()) {
          setNote({ title: message, body: '' });
          setEntitlement(
            result ?? {
              tier: 'free',
              source: 'none',
              state: 'none',
              expiresAt: null,
              verifiedAt: null,
            },
          );
        }
      })
      .catch((e: unknown) => {
        if (allowed())
          setNote({
            warn: true,
            title: 'That did not work',
            body: e instanceof Error ? e.message : '',
          });
      })
      .finally(() => {
        operation.current = false;
        if (allowed()) {
          setBusy(false);
        }
      });
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
            <Icon name={i === 0 ? 'lock' : i === 1 ? 'clock' : 'target'} />
            <T muted style={{ flex: 1 }}>
              {f}
            </T>
          </View>
        ))}
      </Section>
      <T v="caption" muted>
        Counting, goals and existing history stay free. Feed protection depends on supported app
        detection and may miss videos. Pro is an auto-renewing subscription; cancel in Google Play.
      </T>
      {entitlement && profileApi === api && (
        <Notice
          title={entitlement.tier === 'pro' ? 'Your plan: Pro' : 'Your plan: Free'}
          body={`Subscription state: ${entitlement.state}.${entitlement.expiresAt ? ` Access or billing-period end: ${new Date(entitlement.expiresAt).toLocaleDateString()}.` : ''} Manage renewal and payment details in Google Play.`}
        />
      )}
      {note && <Notice tone={note.warn ? 'warn' : 'info'} title={note.title} body={note.body} />}
      {offers === null && !note && <LoadingState label="Checking plans in Google Play…" />}
      {offers?.length === 0 && (
        <Notice title="Not available yet" body="Pro isn't on sale in this build." />
      )}
      {api &&
        profileApi === api &&
        userId &&
        offers?.map((o) => (
          <View key={o.offerToken} style={{ gap: 8 }}>
            <Button
              busy={busy}
              label={`Subscribe — ${o.price}${o.period === 'P1M' ? ' / month' : o.period === 'P1Y' ? ' / year' : ''}`}
              onPress={() =>
                run(async () => {
                  const result = await buyPro(api, userId, o);
                  return {
                    entitlement: result,
                    message:
                      result.tier === 'pro'
                        ? 'Pro is on. Thank you!'
                        : 'Purchase received but not active yet.',
                  };
                })
              }
            />
            <T v="caption" muted>
              {offerDisclosure(o)}
            </T>
          </View>
        ))}
      {api && (
        <Button
          kind="secondary"
          label="Restore purchase"
          busy={busy}
          onPress={() =>
            run(async () => {
              const result = await restorePro(api);
              return {
                entitlement: result,
                message:
                  result?.tier === 'pro'
                    ? 'Pro restored.'
                    : 'No active subscription found on this Google Play account.',
              };
            })
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
