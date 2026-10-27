import type { ReactNode } from 'react';
import { useFonts } from 'expo-font';
import { useCallback, useEffect, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { addDays, localDateOf } from '@siddiq3/driftless-contracts/domain';
import type { v1 } from '@siddiq3/driftless-contracts';
import { AppState, Clipboard, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useApi } from '@/api/useApi';
import { ApiError, type ApiClient } from '@/api/client';
import { useSession } from '@/auth/session';
import { useAccountBackup } from '@/sync/AccountBackupProvider';
import { FriendInviteSheet } from './FriendInviteSheet';
import { InviteSignInSheet } from '@/auth/InviteSignInSheet';
import { personalDay, refreshPersonalData } from '@/data/personal';
import { currentTimeZone } from '@/sync/run';
import { Button, Field, Notice, Screen, T } from '@/ui/kit';
import { Icon } from '@/ui/Icon';
import { shuffledInvitePrompts } from './invitePrompts';
import { Avatar } from './battleVisuals';
import { rankBattle } from './ranking';
import { parseInvite, rememberInvite } from './pendingInvite';
const C = { bg: '#0B0B08', header: '#301A06', row: '#2C2116', muted: '#A49E90', accent: '#FFD09D' };
export function CircleBoard(_props: { friendsPanel?: ReactNode; openFriends?: boolean }) {
  const api = useApi();
  return <WarBoard key={api?.incarnation ?? 'guest'} api={api} />;
}
function WarBoard({ api }: { api: ApiClient | null }) {
  const session = useSession(),
    backup = useAccountBackup();
  const [fonts] = useFonts({ LilitaOne: require('../../assets/fonts/LilitaOne-Regular.ttf') });
  const [today, setToday] = useState(() => localDateOf(Date.now(), currentTimeZone()));
  const [date, setDate] = useState(today),
    [data, setData] = useState<v1.FriendsDailyResponse | null>(null);
  const [guestViews, setGuestViews] = useState<number | null>(null);
  const [issue, setIssue] = useState<string | null>(null),
    [inviteOpen, setInviteOpen] = useState(false),
    [signIn, setSignIn] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false),
    [code, setCode] = useState(''),
    [codeError, setCodeError] = useState<string | null>(null);
  const [prompts, setPrompts] = useState(() => shuffledInvitePrompts([]));
  const refresh = useRef<() => void>(() => {});
  useFocusEffect(
    useCallback(() => {
      setPrompts((previous) => shuffledInvitePrompts(previous));
    }, []),
  );
  useFocusEffect(
    useCallback(() => {
      let alive = true,
        loading = false;
      setData(null);
      setIssue(null);
      const read = async () => {
        if (!alive || loading) return;
        loading = true;
        const nextToday = localDateOf(Date.now(), currentTimeZone());
        setToday(nextToday);
        // A board left on Today follows midnight; explicitly chosen historical dates stay put.
        if (date === today && date !== nextToday) setDate(nextToday);
        try {
          if (api) {
            const result = await api.battleDaily(date, () => alive);
            if (alive) {
              setData(result);
              setIssue(null);
            }
          } else {
            refreshPersonalData(1);
            if (alive) setGuestViews(personalDay(date).views);
          }
        } catch (e) {
          if (alive) {
            if (e instanceof ApiError && [401, 403, 404, 409].includes(e.status ?? 0))
              setData(null);
            setIssue('Counts could not be updated. Previously loaded counts may be out of date.');
          }
        } finally {
          loading = false;
        }
      };
      refresh.current = () => void read();
      void read();
      const timer = setInterval(() => {
        if (AppState.currentState === 'active') void read();
      }, 60000);
      const app = AppState.addEventListener('change', (s) => {
        if (s === 'active') void read();
      });
      return () => {
        alive = false;
        clearInterval(timer);
        app.remove();
        refresh.current = () => {};
      };
    }, [api, date, today]),
  );
  useEffect(() => {
    if (backup.status?.state === 'saved') refresh.current();
  }, [backup.status]);
  const selfName = session.status === 'signedIn' ? session.displayName || 'You' : 'You';
  const rows = rankBattle([
    {
      id: 'self',
      name: 'You',
      handle: 'You',
      views: api ? (data?.self.views ?? null) : guestViews,
      self: true,
    },
    ...(data?.friends ?? []).map((friend) => ({
      id: friend.userId,
      name: friend.displayName || `@${friend.handle}`,
      handle: friend.handle,
      views: friend.daily.views,
      self: false,
    })),
  ]);
  const invite = () => {
    if (session.status !== 'signedIn' || !api) setSignIn(true);
    else setInviteOpen(true);
  };
  const openCode = async () => {
    const parsed = parseInvite(code);
    if (!parsed) {
      setCodeError('Paste a ScrollSnooze invite link or its 10-character code.');
      return;
    }
    try {
      await rememberInvite(parsed);
      setCodeOpen(false);
      router.push(`/battle-invite?code=${parsed}`);
    } catch {
      setCodeError('Could not save the invitation. Please retry.');
    }
  };
  const dateLabel =
    date === today
      ? 'Today'
      : date === addDays(today, -1)
        ? 'Yesterday'
        : new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          });
  return (
    <Screen hideHeader backgroundColor={C.bg} contentStyle={{ padding: 0, gap: 0, flexGrow: 1 }}>
      <View style={styles.header}>
        <View style={styles.topbar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Your profile"
            onPress={() => router.push('/settings')}
            style={{ minHeight: 48, justifyContent: 'center' }}
          >
            <Avatar name={selfName} size={36} />
          </Pressable>
          <T
            style={{
              flex: 1,
              fontSize: 21,
              lineHeight: 28,
              fontFamily: fonts ? 'LilitaOne' : undefined,
              fontWeight: fonts ? '400' : '900',
              color: '#FFE4AB',
            }}
          >
            SCROLL BATTLE
          </T>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Friends"
            onPress={() => (api ? router.push('/friend-list') : setSignIn(true))}
            style={styles.friends}
          >
            <Icon name="friends" size={19} />
            <T style={{ fontWeight: '700' }}>Friends</T>
          </Pressable>
        </View>
        <View style={styles.dateNav}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous day"
            onPress={() => setDate(addDays(date, -1))}
            style={styles.arrow}
          >
            <Icon name="back" color={C.muted} />
          </Pressable>
          <T style={{ fontWeight: '700', fontSize: 17, minWidth: 100, textAlign: 'center' }}>
            {dateLabel}
          </T>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next day"
            accessibilityState={{ disabled: date >= today }}
            disabled={date >= today}
            onPress={() => setDate(addDays(date, 1))}
            style={[styles.arrow, { opacity: date >= today ? 0.3 : 1 }]}
          >
            <Icon name="chevron" color={C.muted} />
          </Pressable>
        </View>
      </View>
      {rows.map((row) => (
        <View key={row.id} style={[styles.row, row.self && { backgroundColor: C.row }]}>
          <T accessibilityLabel={row.rank ? `Rank ${row.rank}` : 'Unranked'} style={styles.rank}>
            {row.rank === 1
              ? '🥇'
              : row.rank === 2
                ? '🥈'
                : row.rank === 3
                  ? '🥉'
                  : (row.rank ?? '—')}
          </T>
          <Avatar name={row.self ? selfName : row.name} color={row.self ? '#008E80' : '#009EAC'} />
          <T style={styles.person}>{row.name}</T>
          <T
            accessibilityLabel={
              row.self
                ? `Your daily count: ${row.views ?? 'unavailable'}`
                : `Daily count for ${row.handle}: ${row.views ?? 'unavailable'}`
            }
            style={styles.count}
          >
            {row.views?.toLocaleString() ?? '—'}
          </T>
        </View>
      ))}
      <View style={{ paddingHorizontal: 24 }}>
        {prompts
          .slice(0, Math.max(0, 4 - (data?.friends.length ?? 0)))
          .map(({ label, emoji }, index) => (
            <View key={label} style={styles.inviteRow}>
              <T style={{ width: 30, color: '#FFF9ED', fontSize: 16 }}>{rows.length + index + 1}</T>
              <T style={styles.person}>
                {label} {emoji}
              </T>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={label}
                onPress={invite}
                style={styles.invite}
              >
                <T style={{ color: '#673C12', fontWeight: '700', fontSize: 15 }}>Invite</T>
              </Pressable>
            </View>
          ))}
        {issue && <Notice title="War not updated" body={issue} tone="warn" />}
        {!!data?.friends.some((f) => f.daily.views === null) && (
          <T v="caption" muted style={{ paddingTop: 18 }}>
            — means no count is available yet. Missing activity isn’t ranked as zero.
          </T>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open an invitation"
          onPress={() => {
            setCodeOpen(true);
            setCodeError(null);
          }}
          style={{ minHeight: 56, justifyContent: 'center', alignSelf: 'center' }}
        >
          <T v="caption" muted>
            Have an invitation?
          </T>
        </Pressable>
      </View>
      {inviteOpen && api && (
        <FriendInviteSheet
          visible
          api={api}
          displayName={selfName}
          onClose={() => setInviteOpen(false)}
        />
      )}
      {signIn && (
        <InviteSignInSheet
          visible
          onClose={() => {
            setSignIn(false);
            if (session.status === 'signedIn' && api) setInviteOpen(true);
          }}
        />
      )}
      <Modal
        visible={codeOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCodeOpen(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <T v="title">Open your invitation</T>
            <Field
              label="Invitation link or code"
              value={code}
              onChangeText={setCode}
              autoCapitalize="characters"
            />
            {codeError && <Notice title="Check your invitation" body={codeError} tone="warn" />}
            <Button
              kind="secondary"
              label="Paste invitation"
              onPress={() =>
                void Clipboard.getString()
                  .then(setCode)
                  .catch(() => setCodeError('Paste the link in the field above.'))
              }
            />
            <Button label="Open invitation" onPress={() => void openCode()} />
            <Button kind="secondary" label="Cancel" onPress={() => setCodeOpen(false)} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
const styles = StyleSheet.create({
  header: { backgroundColor: C.header, paddingTop: 20 },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20 },
  friends: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    backgroundColor: '#402B13',
    borderRadius: 32,
    paddingHorizontal: 16,
    minHeight: 48,
  },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingTop: 25,
    paddingBottom: 20,
  },
  arrow: { minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center' },
  row: {
    minHeight: 90,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  rank: { fontSize: 25, width: 38, textAlign: 'center' },
  person: { flex: 1, color: C.muted, fontSize: 16, lineHeight: 22 },
  count: { fontSize: 23, fontWeight: '700', fontVariant: ['tabular-nums'] },
  inviteRow: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#28241B',
  },
  invite: {
    backgroundColor: C.accent,
    borderRadius: 30,
    paddingHorizontal: 16,
    minHeight: 45,
    justifyContent: 'center',
  },
  overlay: { flex: 1, backgroundColor: '#000B', justifyContent: 'center', padding: 24 },
  dialog: { backgroundColor: '#201B16', borderRadius: 28, padding: 24, gap: 16 },
});
