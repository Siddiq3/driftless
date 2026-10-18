import type { v1 } from '@siddiq3/driftless-contracts';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Share, Switch, TextInput, View } from 'react-native';
import { useApi } from '@/api/useApi';
import { Button, Card, Notice, Screen, T, useTheme } from '@/ui/kit';

type State = { me: v1.MeResponse; friends: v1.Friend[] };

export default function Friends() {
  const api = useApi();
  const t = useTheme();
  const [s, setS] = useState<State | null>(null);
  const [input, setInput] = useState('');
  const [handle, setHandle] = useState('');
  const [note, setNote] = useState<{ title: string; body: string; warn?: boolean } | null>(null);

  const load = useCallback(() => {
    if (!api) return;
    Promise.all([api.getMe(), api.friends()])
      .then(([me, friends]) => setS({ me: me.data, friends }))
      .catch((e: unknown) =>
        setNote({
          warn: true,
          title: 'Could not load friends',
          body: e instanceof Error ? e.message : '',
        }),
      );
  }, [api]);
  useFocusEffect(load);

  const act = (fn: () => Promise<unknown>, ok?: string) =>
    fn()
      .then(() => {
        if (ok) setNote({ title: ok, body: '' });
        load();
      })
      .catch((e: unknown) =>
        setNote({
          warn: true,
          title: 'That did not work',
          body: e instanceof Error ? e.message : '',
        }),
      );

  if (!api) {
    return (
      <Screen>
        <Notice
          title="Sign in to add friends"
          body="Friends and challenges need an account. Counting works without one."
        />
      </Screen>
    );
  }
  if (!s)
    return <Screen>{note && <Notice tone="warn" title={note.title} body={note.body} />}</Screen>;

  const p = s.me.profile;
  const input12 = {
    borderWidth: 1,
    borderColor: t.border,
    color: t.text,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
  } as const;
  const pending = s.friends.filter((f) => f.status === 'pending_in');
  const accepted = s.friends.filter((f) => f.status === 'accepted');
  const sent = s.friends.filter((f) => f.status === 'pending_out');

  return (
    <Screen>
      <T v="title">Friends</T>
      {note && <Notice tone={note.warn ? 'warn' : 'info'} title={note.title} body={note.body} />}

      {!p.handle ? (
        <Card>
          <T v="heading">Choose a handle</T>
          <T muted>Friends find you by this name. Lowercase letters, numbers and _ only.</T>
          <TextInput
            accessibilityLabel="Handle"
            style={input12}
            autoCapitalize="none"
            autoCorrect={false}
            value={handle}
            onChangeText={(v) => setHandle(v.toLowerCase())}
            placeholder="e.g. calm_otter"
            placeholderTextColor={t.textMuted}
          />
          <Button
            label="Save handle"
            onPress={() => act(() => api.patchMe({ handle }, p.rev), 'Handle saved')}
          />
        </Card>
      ) : (
        <Card>
          <T v="heading">@{p.handle}</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <T muted>Share my progress with friends</T>
              <T v="caption" muted>
                Daily totals only, in challenges you join. Off means you’re never shown on a
                leaderboard.
              </T>
            </View>
            <Switch
              accessibilityLabel="Share my progress with friends"
              value={p.consent.shareWithFriends}
              onValueChange={(v) =>
                act(() =>
                  api.patchMe(
                    {
                      consent: v
                        ? { cloudSync: true, shareWithFriends: true }
                        : { shareWithFriends: false },
                    },
                    p.rev,
                  ),
                )
              }
            />
          </View>
          <Button
            kind="secondary"
            label="Invite a friend"
            onPress={() =>
              act(async () => {
                const inv = await api.createInvite();
                await Share.share({
                  message: `Join me on Driftless — add me with this code: ${inv.code} (valid 7 days)`,
                });
              })
            }
          />
        </Card>
      )}

      {p.handle && (
        <Card>
          <T v="heading">Add a friend</T>
          <TextInput
            accessibilityLabel="Friend's handle or invite code"
            style={input12}
            autoCapitalize="none"
            autoCorrect={false}
            value={input}
            onChangeText={setInput}
            placeholder="handle or invite code"
            placeholderTextColor={t.textMuted}
          />
          <Button
            label="Add"
            onPress={() => {
              const v = input.trim();
              const by = /^[A-HJ-NP-Z2-9]{10}$/.test(v)
                ? { inviteCode: v }
                : { handle: v.replace(/^@/, '').toLowerCase() };
              void act(() => api.addFriend(by), 'Done').then(() => setInput(''));
            }}
          />
        </Card>
      )}

      {pending.length > 0 && (
        <Card>
          <T v="heading">Requests</T>
          {pending.map((f) => (
            <View key={f.userId} style={{ gap: 8 }}>
              <T>@{f.handle}</T>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Button
                    label="Accept"
                    onPress={() => act(() => api.respondFriend(f.userId, true))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    kind="secondary"
                    label="Decline"
                    onPress={() => act(() => api.respondFriend(f.userId, false))}
                  />
                </View>
              </View>
            </View>
          ))}
        </Card>
      )}

      <Card>
        <T v="heading">Your friends</T>
        {accepted.length === 0 && <T muted>No friends yet.</T>}
        {accepted.map((f) => (
          <View
            key={f.userId}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <T>@{f.handle}</T>
            <Button
              kind="secondary"
              label="Remove"
              onPress={() => act(() => api.removeFriend(f.userId))}
            />
          </View>
        ))}
        {sent.length > 0 && (
          <T v="caption" muted>
            Waiting: {sent.map((f) => `@${f.handle}`).join(', ')}
          </T>
        )}
      </Card>
      <Button kind="secondary" label="Challenges" onPress={() => router.push('/challenges')} />
    </Screen>
  );
}
