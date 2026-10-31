import type { ReactNode } from 'react';
import { useFonts } from 'expo-font';
import { useCallback, useEffect, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { addDays, localDateOf } from '@siddiq3/driftless-contracts/domain';
import { AppState, Clipboard, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useApi } from '@/api/useApi';
import { type ApiClient } from '@/api/client';
import type { LeaderboardResponse } from '@/api/challenges';
import { useSession } from '@/auth/session';
import { useAccountBackup } from '@/sync/AccountBackupProvider';
import { FriendInviteSheet } from './FriendInviteSheet';
import { InviteSignInSheet } from '@/auth/InviteSignInSheet';
import { personalDay, refreshPersonalData } from '@/data/personal';
import { currentTimeZone } from '@/sync/run';
import { ModalContent, Button, Field, Notice, Screen, T } from '@/ui/kit';
import { Icon } from '@/ui/Icon';
import { shuffledInvitePrompts } from './invitePrompts';
import { Avatar } from './battleVisuals';
import { friendName, rankBattle } from './ranking';
import { parseInvite, rememberInvite } from './pendingInvite';
import { warHeaderTheme as header } from './warTheme';
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
    [data, setData] = useState<LeaderboardResponse | null>(
      () => api?.staleBattleDaily?.(today) ?? api?.cachedBattleDaily?.(today) ?? null,
    );
  const [requestRunning, setRequestRunning] = useState(false);
  const [guestLoaded, setGuestLoaded] = useState(false);
  const [guest, setGuest] = useState<{ views: number | null; experimental: boolean }>({
    views: null,
    experimental: false,
  });
  const [issue, setIssue] = useState<string | null>(null),
    [inviteOpen, setInviteOpen] = useState(false),
    [signIn, setSignIn] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false),
    [code, setCode] = useState(''),
    [codeError, setCodeError] = useState<string | null>(null);
  const [prompts, setPrompts] = useState(() => shuffledInvitePrompts([]));
  const refresh = useRef<() => void>(() => {});
  const previousBackup = useRef(backup.status);
  useFocusEffect(
    useCallback(() => {
      setPrompts((previous) => shuffledInvitePrompts(previous));
    }, []),
  );
  useFocusEffect(
    useCallback(() => {
      let alive = true,
        loading = false;
      setData(
        (previous) =>
          (previous?.localDate === date ? previous : null) ??
          api?.staleBattleDaily?.(date) ??
          api?.cachedBattleDaily?.(date) ??
          null,
      );
      setIssue(null);
      const read = async (fresh = false) => {
        if (!alive || loading) return;
        loading = true;
        setRequestRunning(true);
        const nextToday = localDateOf(Date.now(), currentTimeZone());
        setToday(nextToday);
        // A board left on Today follows midnight; explicitly chosen historical dates stay put.
        if (date === today && date !== nextToday) setDate(nextToday);
        try {
          if (api) {
            const result = await api.battleDaily(date, () => alive, fresh);
            if (alive) {
              setData(result);
              setIssue(null);
            }
          } else {
            refreshPersonalData(1);
            if (alive) {
              const day = personalDay(date);
              setGuest({ views: day.views, experimental: day.status === 'experimental' });
              setGuestLoaded(true);
            }
          }
        } catch {
          if (alive) {
            setIssue('Counts could not be updated. Previously loaded counts may be out of date.');
          }
        } finally {
          loading = false;
          if (alive) setRequestRunning(false);
        }
      };
      refresh.current = () => void read(true);
      void read();
      const timer = setInterval(() => {
        if (AppState.currentState === 'active') void read(true);
      }, 60000);
      const app = AppState.addEventListener('change', (s) => {
        if (s === 'active') void read(true);
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
    const changed = previousBackup.current !== backup.status;
    previousBackup.current = backup.status;
    if (changed && backup.status?.state === 'saved') refresh.current();
  }, [backup.status]);
  const visibleData = data?.localDate === date ? data : null;
  const hasData = api ? Boolean(visibleData) : guestLoaded;
  const initialLoading = !issue && !hasData;
  const refreshing = requestRunning && hasData;
  const selfName = session.status === 'signedIn' ? session.displayName || 'You' : 'You';
  const rows = rankBattle([
    {
      id: 'self',
      name: 'You',
      handle: 'You',
      views: api ? (visibleData?.self.views ?? null) : guest.views,
      experimental: api ? visibleData?.self.experimental === true : guest.experimental,
      self: true,
    },
    ...(visibleData?.friends ?? []).map((friend) => ({
      id: friend.userId,
      name: friendName(friend),
      handle: friend.handle,
      views: friend.daily.views,
      experimental: friend.daily.experimental === true,
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
      setCodeError('Paste the ScrollSnooze invitation link your friend shared.');
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
            style={{ minWidth: 48, minHeight: 48, justifyContent: 'center' }}
          >
            <Avatar name={selfName} size={36} />
          </Pressable>
          <T
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: header.titleSize,
              lineHeight: header.titleLine,
              fontFamily: fonts ? 'LilitaOne' : undefined,
              fontWeight: fonts ? '400' : '900',
              color: '#FFE4AB',
            }}
          >
            Friends Leaderboard
          </T>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Friends"
            onPress={() => (api ? router.push('/friend-list') : setSignIn(true))}
            style={styles.friends}
          >
            <Icon name="friends" size={header.friendIcon} />
            <T
              style={{
                fontWeight: '700',
                fontSize: header.friendSize,
                lineHeight: header.friendLine,
              }}
            >
              Friends
            </T>
          </Pressable>
        </View>
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
      {initialLoading && (
        <View
          accessibilityRole="progressbar"
          accessible
          accessibilityLabel="Loading your counts"
          style={{ padding: 24 }}
        >
          <T>Loading your counts…</T>
        </View>
      )}
      <View accessibilityState={{ busy: refreshing }}>
        {(!initialLoading ? rows : []).map((row) => (
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
            <Avatar
              name={row.self ? selfName : row.name}
              color={row.self ? '#008E80' : '#009EAC'}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <T style={styles.person}>{row.name}</T>
              {row.views === null && <T style={styles.tag}>No count yet</T>}
            </View>
            <T
              accessibilityLabel={`${row.self ? 'Your daily count' : `Daily count for ${row.name}`}: ${
                row.views ?? 'no count yet'
              }${row.views !== null && row.experimental ? ', experimental' : ''}`}
              style={styles.count}
            >
              {row.views?.toLocaleString() ?? '—'}
            </T>
          </View>
        ))}
      </View>
      <View style={{ paddingHorizontal: 24 }}>
        {prompts
          .slice(0, Math.max(0, 4 - (visibleData?.friends.length ?? 0)))
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
        {issue && <Notice title="Leaderboard not updated" body={issue} tone="warn" />}
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
          displayName={session.status === 'signedIn' ? (session.displayName ?? null) : null}
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
        <ModalContent centered style={styles.dialog} onClose={() => setCodeOpen(false)}>
          <T v="title">Open your invitation</T>
          <Field
            label="Invitation link"
            value={code}
            onChangeText={setCode}
            autoCapitalize="none"
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
        </ModalContent>
      </Modal>
    </Screen>
  );
}
const styles = StyleSheet.create({
  header: { backgroundColor: C.header, paddingVertical: header.space.sm },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: header.space.sm,
    paddingHorizontal: header.space.lg,
  },
  friends: {
    flexDirection: 'row',
    gap: header.space.sm,
    alignItems: 'center',
    paddingHorizontal: header.space.sm,
    minHeight: header.touch,
    flexShrink: 0,
    marginLeft: 'auto',
  },
  dateNav: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: header.space.xs,
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
  rank: { fontSize: 25, minWidth: 30, maxWidth: 60, textAlign: 'center' },
  person: { flex: 1, color: C.muted, fontSize: 16, lineHeight: 22 },
  tag: { color: C.muted, fontSize: 13, lineHeight: 18 },
  count: { maxWidth: '40%', fontSize: 23, fontWeight: '700', fontVariant: ['tabular-nums'] },
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
    minHeight: 48,
    justifyContent: 'center',
  },
  dialog: { backgroundColor: '#201B16', borderRadius: 28, padding: 24, gap: 16 },
});
