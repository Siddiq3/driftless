import type { ReactNode } from 'react';
import { useFonts } from 'expo-font';
import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { addDays, localDateOf } from '@siddiq3/driftless-contracts/domain';
import type { v1 } from '@siddiq3/driftless-contracts';
import { AppState, Image, Modal, Pressable, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Tracking } from 'tracking-android';
import { useApi } from '@/api/useApi';
import { useSession } from '@/auth/session';
import { currentTimeZone } from '@/sync/run';
import { Button, Notice, Screen, T } from '@/ui/kit';
import { Icon } from '@/ui/Icon';

const invitations = [
  { label: 'Invite a Doomscroller', emoji: '🧟', action: 'Invite' },
  { label: 'Invite your Bestie', emoji: '🤝', action: 'Invite' },
  { label: 'Invite your Crush', emoji: '❤️', action: 'Invite' },
  { label: 'Invite your Roommate', emoji: '🛋️', action: 'Invite' },
  { label: 'Invite your coolie friend', emoji: '🧑‍💻', action: 'Invite' },
];
const colors = {
  bg: '#0B0B08',
  header: '#301A06',
  row: '#2C2116',
  muted: '#B1A58F',
  accent: '#FFD09D',
};

export function CircleBoard({ friendsPanel }: { friendsPanel: ReactNode }) {
  const [fonts] = useFonts({ LilitaOne: require('../../assets/fonts/LilitaOne-Regular.ttf') });
  const api = useApi();
  const session = useSession();
  const [today, setToday] = useState(() => localDateOf(Date.now(), currentTimeZone()));
  const [date, setDate] = useState(() => today);
  const [total, setTotal] = useState<number | null>(null);
  const [friends, setFriends] = useState<v1.Friend[]>([]);
  const [managerOpen, setManagerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const read = () => {
        if (active) setToday(localDateOf(Date.now(), currentTimeZone()));
        try {
          const daily = Tracking.daily(date);
          const health = Tracking.health();
          const count = daily.apps.reduce((sum, app) => sum + app.views, 0);
          if (active)
            setTotal(
              daily.heartbeatMinutes > 0 ||
                count > 0 ||
                (date === localDateOf(Date.now(), currentTimeZone()) && health.serviceRunning)
                ? count
                : null,
            );
        } catch {
          if (active) setTotal(null);
        }
      };
      read();
      const timer = setInterval(() => {
        if (AppState.currentState === 'active') read();
      }, 10_000);
      if (api && !managerOpen) {
        api
          .friends()
          .then((rows) => {
            if (active) setFriends(rows);
          })
          .catch(() => {
            if (active) setError('Could not load your friends. Open Friends to retry.');
          });
      } else if (!api) setFriends([]);
      return () => {
        active = false;
        clearInterval(timer);
      };
    }, [api, date, managerOpen]),
  );

  const requireLogin = () => {
    if (session.status === 'signedIn' && api) return true;
    router.push('/welcome');
    return false;
  };
  const invite = async () => {
    if (!requireLogin() || !api || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.createInvite();
      await Share.share({
        message: `Join my circle on Driftless. Add me with this code: ${result.code} (valid 7 days).`,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not share your invite.');
    } finally {
      setBusy(false);
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
        message: `Let’s battle on Driftless: fewer short videos for 7 days. Join with code: ${challenge.challengeId}`,
      });
      router.push('/challenges');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the battle.');
    } finally {
      setBusy(false);
    }
  };
  const accepted = friends.filter((friend) => friend.status === 'accepted');
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
              source={require('../../assets/branding/brain-mark.png')}
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
            source={require('../../assets/branding/brain-mark.png')}
            style={{ width: 33, height: 33, opacity: 0.8 }}
          />
        </View>
        <T style={styles.you}>You</T>
        <T style={styles.count}>{total === null ? '—' : total.toLocaleString()}</T>
      </View>

      {accepted.map((friend) => (
        <View key={friend.userId} style={styles.friendRow}>
          <Icon name="friends" color={colors.muted} size={23} />
          <View style={{ flex: 1 }}>
            <T style={styles.friendName}>{friend.displayName || `@${friend.handle}`}</T>
          </View>
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
        {invitations.map(({ label, emoji, action }, index) => (
          <View key={label} style={styles.inviteRow}>
            <T style={styles.position}>{accepted.length + index + 2}</T>
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
              <T style={styles.inviteLabel}>{action}</T>
            </Pressable>
          </View>
        ))}
      </View>
      <View style={styles.actions}>
        {error && <Notice title="Try again" body={error} tone="warn" />}
        <Button
          label={busy ? 'Getting ready…' : 'Start a 2-person battle'}
          busy={busy}
          onPress={() => void battle()}
        />
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
    paddingTop: 26,
    paddingBottom: 23,
  },
  date: { fontSize: 16, fontWeight: '700', minWidth: 90, textAlign: 'center' },
  arrow: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  youRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 18,
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
  you: { flex: 1, color: colors.muted, fontSize: 16 },
  count: { fontSize: 23, lineHeight: 30, fontWeight: '700', fontVariant: ['tabular-nums'] },
  invites: { paddingHorizontal: 26 },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 18,
    minHeight: 76,
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
    minHeight: 76,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#28241B',
  },
  friendName: { color: colors.muted, fontSize: 15 },
  actions: { paddingHorizontal: 26, paddingTop: 28, paddingBottom: 24, gap: 12 },
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
