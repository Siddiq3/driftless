import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { View, StyleSheet, Pressable } from 'react-native';
import { useApi } from '@/api/useApi';
import { useSession } from '@/auth/session';
import type { BattleInvitePreview } from '@/api/battleLinks';
import { Button, LoadingState, Notice, Screen, T } from '@/ui/kit';
import { clearInvite, rememberInvite } from './pendingInvite';
import { Avatar } from './battleVisuals';

export function BattleAcceptance({ code }: { code: string }) {
  const api = useApi(),
    session = useSession();
  const [preview, setPreview] = useState<BattleInvitePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0),
    [busy, setBusy] = useState(false);
  const live = useRef(true),
    acting = useRef(false);
  useEffect(() => {
    live.current = true;
    let active = true;
    void rememberInvite(code)
      .then(async () => {
        if (api) {
          const data = await api.battleInvite(code, () => active);
          if (active) setPreview(data);
        }
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Invitation unavailable.');
      });
    return () => {
      active = false;
      live.current = false;
    };
  }, [api, code, retry]);
  const later = async () => {
    await clearInvite(code);
    if (live.current) router.replace('/friends');
  };
  const accept = async () => {
    if (!api || acting.current) return;
    acting.current = true;
    setBusy(true);
    setError(null);
    try {
      await api.acceptBattleInvite(code, () => live.current);
      await clearInvite(code);
      if (live.current) router.replace('/friends');
    } catch (e) {
      if (live.current) setError(e instanceof Error ? e.message : 'Battle could not be accepted.');
    } finally {
      acting.current = false;
      if (live.current) setBusy(false);
    }
  };
  return (
    <Screen hideHeader hideTabs backgroundColor="#633600" contentStyle={styles.screen}>
      <View style={styles.hero}>
        <T v="title" style={styles.title}>
          {preview
            ? `${preview.inviterName} invited you to a Scroll Battle`
            : 'You’re invited to a Scroll Battle'}
        </T>
        <View style={styles.bubble}>
          <T style={{ fontSize: 18, color: '#13140E', fontWeight: '700', textAlign: 'center' }}>
            Let’s see who scrolls less! 🤜
          </T>
        </View>
        <View style={styles.versus}>
          <View style={styles.person}>
            <Avatar
              name={session.status === 'signedIn' ? session.displayName || 'You' : 'You'}
              size={88}
            />
            <T style={styles.name}>You</T>
          </View>
          <T style={{ fontSize: 28, color: '#E1C494' }}>⚔</T>
          <View style={styles.person}>
            <Avatar name={preview?.inviterName || '?'} color="#009EAC" size={88} />
            <T style={styles.name}>{preview?.inviterName || 'Your friend'}</T>
          </View>
        </View>
      </View>
      {error && (
        <>
          <Notice title="Invitation needs attention" body={error} tone="warn" />
          <Button
            label="Retry"
            kind="secondary"
            onPress={() => {
              setPreview(null);
              setError(null);
              setRetry((v) => v + 1);
            }}
          />
        </>
      )}
      {api && !preview && !error && <LoadingState label="Opening your invitation…" />}
      <View style={{ gap: 18, paddingBottom: 20 }}>
        {preview && !preview.isSelf && (
          <>
            <T v="caption" style={{ color: '#F2DBB5', textAlign: 'center' }}>
              Accepting adds {preview.inviterName} as a friend and shares your daily video totals
              from today. Either person can stop sharing by removing the friend. Missing counts stay
              unavailable. iPhone video counting is unavailable.
            </T>
            <Button label="Accept Battle" busy={busy} onPress={() => void accept()} />
          </>
        )}
        {preview?.isSelf && (
          <Notice
            title="This is your invitation"
            body="Share this link with a friend so they can accept your battle."
          />
        )}
        {!api && (
          <>
            <T style={{ textAlign: 'center' }}>
              Finish setup and sign in to accept your invitation.
            </T>
            <Button label="Sign in to accept" onPress={() => router.push('/welcome')} />
          </>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="I’ll do it later"
          disabled={busy}
          onPress={() =>
            void later().catch(() => setError('Could not save your choice. Please retry.'))
          }
          style={{ minHeight: 52, justifyContent: 'center' }}
        >
          <T style={{ color: '#FFE4AB', fontWeight: '800', textAlign: 'center', fontSize: 18 }}>
            I’ll Do It Later
          </T>
        </Pressable>
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    justifyContent: 'space-between',
    gap: 24,
    paddingHorizontal: 24,
    paddingTop: 48,
  },
  hero: { gap: 30, paddingVertical: 35 },
  title: { fontSize: 30, lineHeight: 39, fontWeight: '900', textAlign: 'center', color: '#FFFDF2' },
  bubble: {
    backgroundColor: '#FFFDF4',
    borderRadius: 40,
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  versus: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  person: { flex: 1, gap: 14, alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '600', textAlign: 'center', color: '#FFFDF2' },
});
