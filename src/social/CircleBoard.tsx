import type { ReactNode } from 'react';
import { useFonts } from 'expo-font';
import { useCallback, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { addDays, localDateOf } from '@siddiq3/driftless-contracts/domain';
import type { v1 } from '@siddiq3/driftless-contracts';
import { AppState, Image, Modal, Pressable, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApi } from '@/api/useApi';
import { ApiError, type ApiClient } from '@/api/client';
import { useSession } from '@/auth/session';
import { FriendInviteSheet } from './FriendInviteSheet';
import { InviteSignInSheet } from '@/auth/InviteSignInSheet';
import { personalDay, refreshPersonalData } from '@/data/personal';
import { observeStorage } from '@/db/scope';
import { currentTimeZone } from '@/sync/run';
import { useAccountBackup } from '@/sync/AccountBackupProvider';
import { Button, Notice, Screen, T } from '@/ui/kit';
import { Icon } from '@/ui/Icon';
import { shuffledInvitePrompts, type InvitePrompt } from './invitePrompts';
const colors = {
  bg: '#0B0B08',
  header: '#301A06',
  row: '#2C2116',
  muted: '#B1A58F',
  accent: '#FFD09D',
};

export function CircleBoard({
  friendsPanel,
  openFriends = false,
}: {
  friendsPanel: ReactNode;
  openFriends?: boolean;
}) {
  const [fonts] = useFonts({ LilitaOne: require('../../assets/fonts/LilitaOne-Regular.ttf') });
  const api = useApi();
  const backup = useAccountBackup();
  const session = useSession();
  const [invitations, setInvitations] = useState<InvitePrompt[]>([]);
  useFocusEffect(
    useCallback(() => {
      setInvitations((previous) => shuffledInvitePrompts(previous));
    }, []),
  );
  const liveApi = useRef(api);
  const focused = useRef(false);
  const [today, setToday] = useState(() => localDateOf(Date.now(), currentTimeZone()));
  const [date, setDate] = useState(() => today);
  const [total, setTotal] = useState<number | null>(null);
  const [friends, setFriends] = useState<v1.Friend[]>([]);
  const [managerOpen, setManagerOpen] = useState(openFriends);
  const [inviteApi, setInviteApi] = useState<ApiClient | null>(null);
  const [inviteSignInOpen, setInviteSignInOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comparison, setComparison] = useState<{
    api: ApiClient;
    data: v1.FriendsDailyResponse;
  } | null>(null);
  const [refresh, setRefresh] = useState(0);
  const currentComparison =
    comparison?.api === api && comparison.data.localDate === date ? comparison.data : null;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      liveApi.current = api;
      focused.current = true;
      setBusy(false);
      setError(null);
      setComparison(null);
      setFriends([]);
      const read = () => {
        if (active) setToday(localDateOf(Date.now(), currentTimeZone()));
        try {
          refreshPersonalData(1);
          const measurement = personalDay(date);
          if (active) setTotal(measurement.views);
        } catch {
          if (active) setTotal(null);
        }
      };
      read();
      const unsubscribe = observeStorage(read);
      const timer = setInterval(() => {
        if (AppState.currentState === 'active') read();
      }, 10_000);
      let loading = false;
      const readComparison = async () => {
        if (!api || managerOpen || loading) return;
        loading = true;
        try {
          const rows = await api.friends();
          if (active) setFriends(rows);
          const data = await api.friendsDaily(date);
          if (active) {
            setComparison({ api, data });
            setError(null);
          }
        } catch (e) {
          if (active) {
            setComparison(null);
            setError(
              e instanceof ApiError && e.code === 'consent_required'
                ? e.message
                : 'Daily comparisons are unavailable. Check your connection and try refreshing.',
            );
          }
        } finally {
          loading = false;
        }
      };
      void readComparison();
      const comparisonTimer = setInterval(() => {
        if (AppState.currentState === 'active') void readComparison();
      }, 60_000);
      return () => {
        unsubscribe();
        active = false;
        focused.current = false;
        clearInterval(timer);
        clearInterval(comparisonTimer);
      };
      // The refresh token reruns this effect after a successful upload.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [api, date, managerOpen, refresh]),
  );

  const requireLogin = () => {
    if (session.status === 'signedIn' && api) return true;
    router.push('/welcome');
    return false;
  };
  const invite = async () => {
    if (session.status !== 'signedIn') {
      setInviteSignInOpen(true);
      return;
    }
    if (!api || busy) return;
    setInviteApi(api);
  };
  const syncAndRefresh = async () => {
    if (!requireLogin() || !api || busy) return;
    setBusy(true);
    setError(null);
    const allowed = () => focused.current && liveApi.current === api;
    try {
      const me = await api.getMe();
      if (!allowed()) return;
      if (!me.data.profile.consent.cloudSync || !me.data.profile.consent.shareWithFriends)
        throw new Error(
          'Allow sharing progress in Friends to compare counts. Account backup starts automatically after sign-in.',
        );
      const backedUp = await backup.retry();
      if (!allowed()) return;
      if (!backedUp)
        throw new Error('Backup is still pending. Your local progress is safe; try again shortly.');
      setRefresh((value) => value + 1);
    } catch (e) {
      if (allowed()) setError(e instanceof Error ? e.message : 'Could not sync your counts.');
    } finally {
      if (allowed()) setBusy(false);
    }
  };
  const battle = async () => {
    if (!requireLogin() || !api || busy) return;
    setBusy(true);
    setError(null);
    try {
      const start = localDateOf(Date.now(), currentTimeZone());
      const challenge = await api.createChallenge({
        title: 'Scroll battle',
        metric: 'fewest_views',
        startDate: start,
        endDate: addDays(start, 6),
        tz: currentTimeZone(),
        maxMembers: 2,
      });
      await Share.share({
        message: `Let’s battle on ScrollSnooze: fewer short videos for 7 days. Join with code: ${challenge.challengeId}`,
      });
      router.push('/challenges');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the battle.');
    } finally {
      setBusy(false);
    }
  };
  const accepted =
    currentComparison?.friends ??
    friends
      .filter((friend) => friend.status === 'accepted')
      .map((friend) => ({ ...friend, daily: null }));
  const showingLocalCount = total !== null;
  const ownViews = total;
  const visibleFriends = accepted.slice(0, 4);
  const visibleInvitations = invitations.slice(0, 4 - visibleFriends.length);
  const requests = friends.filter((friend) => friend.status === 'pending_in').length;
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
    <Screen
      hideHeader
      backgroundColor={colors.bg}
      contentStyle={{ padding: 0, gap: 0, flexGrow: 1 }}
    >
      <View style={styles.header}>
        <View style={styles.topbar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Your profile"
            onPress={() => router.push('/settings')}
            style={styles.profile}
          >
            <Image
              source={require('../../assets/branding/scrollsnooze/purple/icon-master.png')}
              style={{ width: 30, height: 30 }}
            />
          </Pressable>
          <T
            style={{
              ...styles.title,
              fontFamily: fonts ? 'LilitaOne' : undefined,
              fontWeight: fonts ? '400' : '900',
            }}
          >
            SCROLL BATTLE
          </T>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={requests ? `Friends, ${requests} requests` : 'Friends'}
            onPress={() => {
              if (requireLogin()) setManagerOpen(true);
            }}
            style={styles.friendsButton}
          >
            <Icon name="friends" size={18} color="#FFF9ED" />
            <T style={styles.friendsLabel}>Friends{requests ? ` (${requests})` : ''}</T>
          </Pressable>
        </View>
        <View style={styles.dateNav}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous day"
            onPress={() => setDate(addDays(date, -1))}
            style={styles.arrow}
          >
            <Icon name="back" color={colors.muted} size={23} />
          </Pressable>
          <T style={styles.date}>{dateLabel}</T>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next day"
            accessibilityState={{ disabled: date >= today }}
            disabled={date >= today}
            onPress={() => setDate(addDays(date, 1))}
            style={[styles.arrow, { opacity: date >= today ? 0.3 : 1 }]}
          >
            <Icon name="chevron" color={colors.muted} size={23} />
          </Pressable>
        </View>
      </View>

      <View style={styles.youRow}>
        <View style={styles.rank}>
          <Icon name="trophy" size={27} color="#FFD36D" />
        </View>
        <View style={styles.avatar}>
          <Image
            source={require('../../assets/branding/scrollsnooze/purple/icon-master.png')}
            style={{ width: 33, height: 33, opacity: 0.8 }}
          />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <T style={styles.you}>
            {session.status === 'signedIn' ? session.displayName || 'You' : 'You'}
          </T>
          {showingLocalCount && (
            <T v="caption" muted>
              Your saved count · rankings are separate
            </T>
          )}
        </View>
        <T
          accessibilityLabel={`Your daily count: ${ownViews ?? 'unavailable'}`}
          style={styles.count}
        >
          {ownViews === null ? '—' : ownViews.toLocaleString()}
        </T>
      </View>

      {visibleFriends.map((friend) => (
        <View key={friend.userId} style={styles.friendRow}>
          <Icon name="friends" color={colors.muted} size={23} />
          <View style={{ flex: 1 }}>
            <T style={styles.friendName}>{friend.displayName || `@${friend.handle}`}</T>
            <T muted>
              {friend.daily?.status === 'private'
                ? 'Sharing off'
                : friend.daily?.status !== 'eligible'
                  ? 'No eligible count'
                  : 'Eligible videos'}
            </T>
          </View>
          <T
            accessibilityLabel={`Daily count for ${friend.handle}: ${friend.daily?.views ?? 'unavailable'}`}
            style={styles.count}
          >
            {friend.daily?.views?.toLocaleString() ?? '—'}
          </T>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Start a battle with ${friend.handle}`}
            disabled={busy}
            onPress={() => void battle()}
            style={styles.invite}
          >
            <T style={styles.inviteLabel}>Battle</T>
          </Pressable>
        </View>
      ))}
      <View style={styles.invites}>
        {visibleInvitations.map(({ label, emoji }, index) => (
          <View key={label} style={styles.inviteRow}>
            <T style={styles.position}>{visibleFriends.length + index + 2}</T>
            <T style={styles.inviteText}>
              {label} {emoji}
            </T>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={() => void invite()}
              style={[styles.invite, { opacity: busy ? 0.5 : 1 }]}
            >
              <T style={styles.inviteLabel}>Invite</T>
            </Pressable>
          </View>
        ))}
      </View>
      <View style={styles.actions}>
        {api && (
          <Button
            label="Sync and refresh counts"
            kind="secondary"
            busy={busy}
            onPress={() => void syncAndRefresh()}
          />
        )}
        {error && <Notice title="Try again" body={error} tone="warn" />}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View your battles"
          onPress={() => {
            if (requireLogin()) router.push('/challenges');
          }}
          style={styles.allBattles}
        >
          <T style={{ color: colors.muted, fontSize: 13 }}>View your battles</T>
          <Icon name="chevron" size={16} color={colors.muted} />
        </Pressable>
      </View>
      {managerOpen && (
        <Modal visible animationType="slide" onRequestClose={() => setManagerOpen(false)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
            <View style={styles.modalHeader}>
              <T v="title">Your friends</T>
              <Button label="Done" kind="secondary" onPress={() => setManagerOpen(false)} />
            </View>
            {friendsPanel}
          </SafeAreaView>
        </Modal>
      )}
      {inviteApi === api && api && (
        <FriendInviteSheet
          visible
          api={api}
          displayName={session.status === 'signedIn' ? (session.displayName ?? null) : null}
          onClose={() => setInviteApi(null)}
        />
      )}
      {inviteSignInOpen && (
        <InviteSignInSheet
          visible
          onClose={() => {
            setInviteSignInOpen(false);
            if (session.status === 'signedIn' && api) setInviteApi(api);
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: colors.header, paddingTop: 12 },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20 },
  profile: { width: 36, minHeight: 48, justifyContent: 'center' },
  title: {
    flex: 1,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '900',
    letterSpacing: -0.7,
    color: '#FFE4AB',
  },
  friendsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#402B13',
    borderRadius: 32,
    paddingHorizontal: 16,
    minHeight: 48,
  },
  friendsLabel: { fontSize: 16, fontWeight: '700' },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
    paddingTop: 8,
    paddingBottom: 8,
  },
  date: { fontSize: 16, fontWeight: '700', minWidth: 90, textAlign: 'center' },
  arrow: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  youRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 10,
    minHeight: 80,
    backgroundColor: colors.row,
  },
  rank: { width: 38, alignItems: 'flex-start' },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 24,
    backgroundColor: '#483C23',
    alignItems: 'center',
    justifyContent: 'center',
  },
  you: { color: colors.muted, fontSize: 16 },
  count: { fontSize: 23, lineHeight: 30, fontWeight: '700', fontVariant: ['tabular-nums'] },
  invites: { paddingHorizontal: 26 },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    minHeight: 68,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#28241B',
  },
  position: { width: 38, fontSize: 16 },
  inviteText: { flex: 1, color: colors.muted, fontSize: 15, lineHeight: 21 },
  invite: {
    backgroundColor: colors.accent,
    borderRadius: 30,
    paddingHorizontal: 17,
    minHeight: 48,
    justifyContent: 'center',
  },
  inviteLabel: { fontSize: 15, fontWeight: '600', color: '#51320F' },
  friendRow: {
    marginHorizontal: 26,
    gap: 16,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 68,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#28241B',
  },
  friendName: { color: colors.muted, fontSize: 15 },
  actions: { paddingHorizontal: 26, paddingTop: 16, paddingBottom: 20, gap: 12 },
  allBattles: {
    minHeight: 48,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
});
