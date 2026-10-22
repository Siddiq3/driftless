import type { v1 } from '@siddiq3/driftless-contracts';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Share, View } from 'react-native';
import { useApi } from '@/api/useApi';
import { useSession } from '@/auth/session';
import {
  Toggle,
  Button,
  Section,
  Notice,
  Screen,
  T,
  Details,
  Field,
  EmptyState,
  LoadingState,
} from '@/ui/kit';
import { CircleBoard } from '@/social/CircleBoard';
import { VisualBanner } from '@/ui/Focus';

type State = { me: v1.MeResponse; friends: v1.Friend[] };

export default function Friends() {
  return <CircleBoard friendsPanel={<FriendsManager />} />;
}

function FriendsManager() {
  const api = useApi();
  const session = useSession();
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

  if (session.status === 'loading')
    return (
      <Screen hideHeader hideTabs>
        <LoadingState label="Loading your friends…" />
      </Screen>
    );
  if (!api) {
    const unavailable = session.status === 'unconfigured';
    return (
      <Screen hideHeader hideTabs>
        <VisualBanner art="friends" />
        <T v="caption" muted>
          Sign in to invite friends, share progress, and start a battle.
        </T>
        <Notice
          title={unavailable ? 'Friends aren’t available in this build' : 'Sign in to add friends'}
          body={
            unavailable
              ? 'Counting and goals still work on this phone.'
              : 'Friends and challenges need an account. Counting works without one.'
          }
        />
        <Button
          label={unavailable ? 'Back to today' : 'Go to sign in'}
          onPress={() => router.push(unavailable ? '/' : '/welcome')}
        />
      </Screen>
    );
  }
  if (!s)
    return (
      <Screen hideHeader hideTabs>
        <VisualBanner art="friends" />
        {note ? (
          <Notice tone="warn" title={note.title} body={note.body} />
        ) : (
          <LoadingState label="Finding your circle…" />
        )}
      </Screen>
    );

  const p = s.me.profile;
  const pending = s.friends.filter((f) => f.status === 'pending_in');
  const accepted = s.friends.filter((f) => f.status === 'accepted');
  const sent = s.friends.filter((f) => f.status === 'pending_out');

  return (
    <Screen hideHeader hideTabs>
      <VisualBanner art="friends" />
      {note && <Notice tone={note.warn ? 'warn' : 'info'} title={note.title} body={note.body} />}

      {!p.handle ? (
        <Section>
          <T v="heading">Choose a handle</T>
          <T muted>Friends find you by this name. Lowercase letters, numbers and _ only.</T>
          <Field
            label="Your handle"
            autoCapitalize="none"
            autoCorrect={false}
            value={handle}
            onChangeText={(v) => setHandle(v.toLowerCase())}
            placeholder="e.g. calm_otter"
          />
          <Button
            label="Save handle"
            onPress={() => act(() => api.patchMe({ handle }, p.rev), 'Handle saved')}
          />
        </Section>
      ) : (
        <Section>
          <T v="heading">@{p.handle}</T>
          <Details title="Progress sharing" icon="shield">
            {' '}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <T muted>Share my progress with friends</T>
                <T v="caption" muted>
                  Daily totals only · off by default
                </T>
              </View>
              <Toggle
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
          </Details>
          <Button
            kind="secondary"
            label="Invite a friend"
            onPress={() =>
              act(async () => {
                const inv = await api.createInvite();
                await Share.share({
                  message: `Join me on ScrollSnooze — add me with this code: ${inv.code} (valid 7 days)`,
                });
              })
            }
          />
        </Section>
      )}

      {p.handle && (
        <Details title="Add a friend" icon="friends">
          <Field
            label="Handle or invite code"
            autoCapitalize="none"
            autoCorrect={false}
            value={input}
            onChangeText={setInput}
            placeholder="handle or invite code"
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
        </Details>
      )}

      {pending.length > 0 && (
        <Section>
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
        </Section>
      )}

      <Section>
        <T v="heading">Your friends</T>
        {accepted.length === 0 && (
          <EmptyState
            mark="♡"
            title="Your circle starts here"
            body="Add a friend by handle or share an invite. Progress feels better together."
          />
        )}
        {accepted.map((f) => (
          <View
            key={f.userId}
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 12,
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
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
      </Section>
      <Button kind="secondary" label="Challenges" onPress={() => router.push('/challenges')} />
    </Screen>
  );
}
