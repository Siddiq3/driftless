import { useCallback, useRef, useState } from 'react';
import { useFonts } from 'expo-font';
import { router, useFocusEffect } from 'expo-router';
import type { v1 } from '@siddiq3/driftless-contracts';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import type { ApiClient } from '@/api/client';
import { ModalContent, Button, LoadingState, Notice, Screen, T } from '@/ui/kit';
import { Icon } from '@/ui/Icon';
import { Avatar } from './battleVisuals';
import { friendName } from './ranking';
export function FriendsList({ api }: { api: ApiClient | null }) {
  const [fonts] = useFonts({ LilitaOne: require('../../assets/fonts/LilitaOne-Regular.ttf') });
  const [friends, setFriends] = useState<v1.Friend[] | null>(null),
    [selected, setSelected] = useState<v1.Friend | null>(null);
  const [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0);
  const live = useRef(true),
    acting = useRef(false);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      live.current = true;
      if (api)
        void api
          .friends()
          .then((rows) => {
            if (active) {
              setFriends(rows);
              setError(null);
            }
          })
          .catch(() => {
            if (active) setError('Friends could not be loaded. Please retry.');
          });
      return () => {
        active = false;
        live.current = false;
      };
      // Revision explicitly retries this focused read.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [api, revision]),
  );
  const remove = async () => {
    if (!api || !selected || acting.current) return;
    acting.current = true;
    setBusy(true);
    setError(null);
    const id = selected.userId;
    try {
      await api.removeFriend(id);
      if (live.current) {
        setFriends((rows) => rows?.filter((f) => f.userId !== id) ?? []);
        setSelected(null);
      }
    } catch {
      if (live.current) setError('Your friend could not be removed. Please retry.');
    } finally {
      acting.current = false;
      if (live.current) setBusy(false);
    }
  };
  const name = friendName;
  return (
    <Screen hideHeader hideTabs backgroundColor="#0B0B08" contentStyle={{ padding: 24, gap: 24 }}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to leaderboard"
          style={styles.back}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/friends'))}
        >
          <Icon name="back" />
        </Pressable>
        <T
          v="title"
          style={{
            color: '#FFFFF8',
            fontSize: 28,
            lineHeight: 36,
            fontFamily: fonts ? 'LilitaOne' : undefined,
            fontWeight: fonts ? '400' : '900',
          }}
        >
          Friends
        </T>
      </View>
      {!api && (
        <>
          <Notice
            title="Sign in to see your friends"
            body="Your friends are linked to your account."
          />
          <Button label="Sign in" onPress={() => router.push('/welcome')} />
        </>
      )}
      {error && (
        <>
          <Notice title="Friends need attention" body={error} tone="warn" />
          <Button kind="secondary" label="Retry" onPress={() => setRevision((v) => v + 1)} />
        </>
      )}
      {api && !friends && !error && <LoadingState label="Loading friends…" />}
      {friends
        ?.filter((f) => f.status === 'accepted')
        .map((friend) => (
          <View key={friend.userId} style={styles.row}>
            <Avatar name={name(friend)} size={52} />
            <T style={{ flex: 1, fontWeight: '600', fontSize: 18 }}>{name(friend)}</T>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Options for ${name(friend)}`}
              style={styles.option}
              onPress={() => {
                setSelected(friend);
                setError(null);
              }}
            >
              <T style={{ fontSize: 28 }}>⋮</T>
            </Pressable>
          </View>
        ))}
      {friends
        ?.filter((f) => f.status === 'pending_in')
        .map((friend) => (
          <View key={friend.userId} style={{ gap: 10 }}>
            <T>{name(friend)} wants to be friends</T>
            <Button
              label={`Accept ${name(friend)}`}
              onPress={() =>
                void api
                  ?.respondFriend(friend.userId, true)
                  .then(() => setRevision((v) => v + 1))
                  .catch(() => setError('Could not accept this friend.'))
              }
            />
          </View>
        ))}
      {friends?.filter((f) => f.status === 'accepted').length === 0 && (
        <T muted>Your friends will appear here after they accept an invitation.</T>
      )}
      <Modal
        visible={!!selected}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!busy) setSelected(null);
        }}
      >
        <ModalContent
          dismissLabel="Close friend options"
          style={styles.sheet}
          onClose={() => {
            if (!busy) setSelected(null);
          }}
        >
          {selected && (
            <View style={{ gap: 24 }}>
              <View style={styles.handle} />
              <View style={{ alignItems: 'center' }}>
                <Avatar name={name(selected)} size={84} />
              </View>
              <T v="title" style={{ textAlign: 'center' }}>
                {name(selected)}
              </T>
              <T v="caption" muted style={{ textAlign: 'center' }}>
                This stops sharing both ways. Counts already on their phone may show until it
                refreshes.
              </T>
              {error && <Notice title="Could not remove friend" body={error} tone="warn" />}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete friend"
                accessibilityState={{ disabled: busy, busy }}
                disabled={busy}
                onPress={() => void remove()}
                style={{
                  backgroundColor: '#541D1C',
                  borderRadius: 20,
                  minHeight: 82,
                  paddingHorizontal: 22,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 16,
                  opacity: busy ? 0.6 : 1,
                }}
              >
                <Icon name="trash" color="#FF565F" size={30} />
                <T style={{ color: '#FF565F', fontSize: 19, fontWeight: '600' }}>
                  {busy ? 'Removing…' : 'Delete friend'}
                </T>
              </Pressable>
            </View>
          )}
        </ModalContent>
      </Modal>
    </Screen>
  );
}
const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 28 },
  back: {
    height: 56,
    width: 56,
    borderRadius: 28,
    backgroundColor: '#22211B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 76 },
  option: { minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center' },
  sheet: {
    backgroundColor: '#0B0B08',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    gap: 24,
    alignItems: 'stretch',
  },
  handle: {
    height: 4,
    width: 44,
    borderRadius: 4,
    backgroundColor: '#65675B',
    alignSelf: 'center',
  },
});
