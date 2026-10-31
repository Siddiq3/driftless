import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { View, StyleSheet, Pressable } from 'react-native';
import { ApiError } from '@/api/client';
import { useApi } from '@/api/useApi';
import { useSession } from '@/auth/session';
import type { BattleInvitePreview } from '@/api/battleLinks';
import { Button, LoadingState, Notice, Screen, T } from '@/ui/kit';
import { clearInvite, rememberInvite } from './pendingInvite';
import { ensureSocialProfile } from './profile';
import { Avatar } from './battleVisuals';

const invitationGone = (e: unknown) =>
  e instanceof ApiError && (e.status === 404 || e.code === 'invite_used');

export function BattleAcceptance({ code }: { code: string }) {
  const api = useApi(),
    session = useSession();
  const [preview, setPreview] = useState<BattleInvitePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gone, setGone] = useState(false);
  const [retry, setRetry] = useState(0),
    [busy, setBusy] = useState(false);
  const live = useRef(true),
    acting = useRef(false);
  // A used or expired link can never work, so stop reopening it.
  const closeGone = () => {
    setGone(true);
    setPreview(null);
    void clearInvite(code).catch(() => undefined);
  };
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
        if (!active) return;
        if (invitationGone(e)) closeGone();
        else setError(e instanceof Error ? e.message : 'Invitation unavailable.');
      });
    return () => {
      active = false;
      live.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      await ensureSocialProfile(
        api,
        session.status === 'signedIn' ? (session.displayName ?? null) : null,
        () => live.current,
      );
      await api.acceptBattleInvite(code, () => live.current);
      await clearInvite(code);
      if (live.current) router.replace('/friends');
    } catch (e) {
      if (!live.current) return;
      if (invitationGone(e)) closeGone();
      else setError(e instanceof Error ? e.message : 'The invitation could not be accepted.');
    } finally {
      acting.current = false;
      if (live.current) setBusy(false);
    }
  };
  return (
    <Screen hideHeader hideTabs backgroundColor="#633600" contentStyle={styles.screen}>
      <View style={styles.hero}>
        <T v="title" style={styles.title}>
          A friend invited you to the Friends Leaderboard
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
          <T style={{ fontSize: 28, color: '#E1C494' }}>🤝</T>
          <View style={styles.person}>
            <Avatar name="?" color="#009EAC" size={88} />
            <T style={styles.name}>Your friend</T>
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
      {gone && (
        <>
          <Notice
            title="This invitation is no longer available"
            body="It has already been used or has expired. Ask your friend for a new link."
          />
          <Button label="Back to leaderboard" onPress={() => router.replace('/friends')} />
        </>
      )}
      {api && !preview && !error && !gone && <LoadingState label="Opening your invitation…" />}
      <View style={{ gap: 18, paddingBottom: 20 }}>
        {preview && !preview.isSelf && (
          <>
            <T v="caption" style={{ color: '#F2DBB5', textAlign: 'center' }}>
              We don’t show who invited you until you accept, so check who sent you this link.
              Accepting makes that person your friend. Each of you can see the other’s Google
              account name and daily Reels and Shorts count from today on, including experimental
              counts. Your minutes stay private. To stop sharing, delete the friend. Counts already
              on their phone may show until it refreshes. iPhone video counting is unavailable.
            </T>
            <Button label="Accept Invitation" busy={busy} onPress={() => void accept()} />
          </>
        )}
        {preview?.isSelf && (
          <Notice
            title="This is your invitation"
            body="Share this link with a friend so they can accept your invitation."
          />
        )}
        {!api && !gone && (
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
