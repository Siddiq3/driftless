import { addDays, localDateOf } from '@siddiq3/driftless-contracts/domain';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Share, View } from 'react-native';
import { useApi } from '@/api/useApi';
import { ApiError, type ApiClient } from '@/api/client';
import type { Battle } from '@/api/challenges';
import { useSession } from '@/auth/session';
import { currentTimeZone } from '@/sync/run';
import { useAccountBackup } from '@/sync/AccountBackupProvider';
import { createBattle } from '@/social/battleRequests';
import { BattleInbox, invitationLabel } from '@/social/BattleInbox';
import { BATTLE_REFRESH_MS, useBattleFeed } from '@/social/useBattleFeed';
import {
  Button,
  Card,
  Section,
  Notice,
  Screen,
  T,
  Field,
  EmptyState,
  LoadingState,
} from '@/ui/kit';
import { VisualBanner } from '@/ui/Focus';

const METRIC = {
  fewest_minutes: { label: 'Fewest minutes a day', unit: 'min/day' },
  fewest_views: { label: 'Fewest videos a day', unit: 'videos/day' },
  goal_days: { label: 'Most days within goal', unit: 'days' },
};
const STATUS = {
  sharing_off: 'Battle score sharing is off',
  no_data: 'Waiting for recorded activity',
  expired: 'Battle ended · score sharing expired',
  unavailable: 'Participant unavailable',
  awaiting_opponent: 'Awaiting your friend’s acceptance',
  ready: 'Score ready',
};

function Leaderboard({ id, revision }: { id: string; revision: number }) {
  const api = useApi(),
    backup = useAccountBackup();
  const [result, setResult] = useState<{
    api: ApiClient;
    id: string;
    data: Awaited<ReturnType<ApiClient['leaderboard']>>;
    at: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const trigger = useRef<() => void>(() => {});
  useFocusEffect(
    useCallback(() => {
      if (!api) return;
      let alive = true,
        loading = false;
      const read = async () => {
        if (!alive || loading) return;
        loading = true;
        try {
          const data = await api.leaderboard(id, () => alive);
          if (alive) {
            setResult({ api, id, data, at: Date.now() });
            setError(null);
          }
        } catch (error) {
          if (alive) {
            if (error instanceof ApiError && [401, 403, 404, 409].includes(error.status ?? 0)) {
              setResult(null);
              setError(
                'This battle is no longer available to this account. Return to Your battles to check its status.',
              );
            } else
              setError(
                'Scores could not be updated. The last loaded scores may be out of date. We’ll check again automatically.',
              );
          }
        } finally {
          loading = false;
        }
      };
      trigger.current = () => {
        void read();
      };
      void read();
      const timer = setInterval(() => {
        if (AppState.currentState === 'active') void read();
      }, BATTLE_REFRESH_MS);
      const listener = AppState.addEventListener('change', (value) => {
        if (value === 'active') void read();
      });
      return () => {
        alive = false;
        clearInterval(timer);
        listener.remove();
        trigger.current = () => {};
      };
      // Membership/consent changes explicitly invalidate the selected board.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [api, id, revision]),
  );
  useEffect(() => {
    if (backup.status?.state === 'saved') trigger.current();
  }, [backup.status]);
  const current = result?.api === api && result.id === id ? result : null;
  return (
    <>
      {error && <Notice title="Scores not updated" body={error} tone="warn" />}
      {!current && !error && <LoadingState label="Loading the scores…" />}
      {current && (
        <>
          <T v="caption" muted>
            Through {current.data.asOf} · Updated {new Date(current.at).toLocaleTimeString()} ·
            Checks every minute
          </T>
          {current.data.entries.map((entry) => (
            <View
              key={entry.userId}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}
            >
              <T v="heading">{entry.rank}</T>
              <View style={{ flex: 1 }}>
                <T>@{entry.handle}</T>
              </View>
              <T v="title">{entry.score}</T>
            </View>
          ))}
          {current.data.participants?.map((p) => (
            <View key={p.userId} style={{ gap: 4, paddingVertical: 8 }}>
              <T v="caption" muted>
                {p.handle ? `@${p.handle}` : 'Participant'} ·{' '}
                {p.status === 'ready'
                  ? `${p.availableDays} of ${p.expectedDays} days recorded`
                  : STATUS[p.status]}
              </T>
              {p.status === 'ready' && p.availableDays < p.expectedDays && (
                <T v="caption" muted>
                  Provisional result · some days haven’t arrived yet.
                </T>
              )}
            </View>
          ))}
          {!current.data.entries.length && !current.data.participants?.length && (
            <T muted>Scores appear when participants have recorded activity.</T>
          )}
        </>
      )}
    </>
  );
}

export default function Challenges() {
  const api = useApi();
  return <ChallengesContent key={api ? (api.incarnation ?? 'account') : 'guest'} api={api} />;
}
function ChallengesContent({ api }: { api: ApiClient | null }) {
  const session = useSession();
  const params = useLocalSearchParams<{ battle?: string }>();
  const feed = useBattleFeed(api);
  const [code, setCode] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const live = useRef(api);
  useEffect(() => {
    live.current = api;
    return () => {
      live.current = null;
    };
  }, [api]);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const act = async (fn: (allowed: () => boolean) => Promise<unknown>) => {
    if (!api || pending.current) return;
    pending.current = true;
    setBusy(true);
    setNote(null);
    const allowed = () => mounted.current && live.current === api;
    try {
      await fn(allowed);
      if (allowed()) feed.reload();
    } catch (e) {
      if (allowed())
        setNote(e instanceof Error ? e.message : 'The battle could not be updated. Please retry.');
    } finally {
      pending.current = false;
      if (allowed()) setBusy(false);
    }
  };
  if (session.status === 'loading')
    return (
      <Screen>
        <LoadingState label="Loading your battles…" />
      </Screen>
    );
  if (!api)
    return (
      <Screen>
        <Notice title="Sign in for battles" body="Battles with friends need an account." />
        <Button label="Go to sign in" onPress={() => router.push('/welcome')} />
      </Screen>
    );
  const createWeek = (metric: Battle['metric']) =>
    void act(async (allowed) => {
      const tz = currentTimeZone(),
        start = localDateOf(Date.now(), tz);
      const c = await createBattle(
        api,
        {
          title: `${METRIC[metric].label} week`,
          metric,
          startDate: start,
          endDate: addDays(start, 6),
          tz,
          maxMembers: 10,
          scoreConsent: true,
        },
        allowed,
      );
      if (allowed()) {
        setSelected(c.challengeId);
        setNote('Battle created. Share this code with friends to join: ' + c.challengeId);
      }
    });
  const selectedId =
    selected ??
    (typeof params.battle === 'string' ? params.battle : null) ??
    feed.data?.challenges[0]?.challengeId;
  return (
    <Screen>
      <VisualBanner art="friends" title="A little friendly competition" />
      {note && <Notice title="Your battle" body={note} />}
      {feed.error && <Notice title="Battles not updated" body={feed.error} tone="warn" />}
      <BattleInbox api={api} feed={feed} />
      <Section>
        <T v="heading">Start a 7-day challenge</T>
        <T v="caption" muted>
          Starting or joining shares only your battle score with participants until its end date, in
          the battle’s timezone. Your other history is not shared by this action. Global sharing
          settings stay unchanged. You can stop sharing at any time below.
        </T>
        <Button
          label={METRIC.fewest_views.label}
          busy={busy}
          onPress={() => createWeek('fewest_views')}
        />
        <Button
          kind="secondary"
          label={METRIC.fewest_minutes.label}
          busy={busy}
          onPress={() => createWeek('fewest_minutes')}
        />
        <Button
          kind="secondary"
          label={METRIC.goal_days.label}
          busy={busy}
          onPress={() => createWeek('goal_days')}
        />
      </Section>
      <Section>
        <T v="heading">Join with a code</T>
        <T v="caption" muted>
          Joining shares your score only with this battle’s participants for its date window (up to
          31 days). You can stop sharing or leave at any time.
        </T>
        <Field
          label="Challenge code"
          autoCapitalize="none"
          value={code}
          onChangeText={setCode}
          placeholder="paste the code your friend shared"
        />
        <Button
          label="Join"
          busy={busy}
          onPress={() =>
            void act(async (allowed) => {
              const c = await api.joinChallenge(code.trim().toLowerCase(), true, allowed);
              if (allowed()) setSelected(c.challengeId);
            })
          }
        />
      </Section>
      {!feed.data && !feed.error && <LoadingState label="Loading your battles…" />}
      {feed.data?.challenges.length === 0 && (
        <EmptyState
          mark="⚑"
          title="Your next week starts here"
          body="Start a battle beside a friend in Circle, or join using a code."
        />
      )}
      {feed.data?.challenges.map((c) => (
        <Card key={c.challengeId}>
          <T v="heading">{c.title}</T>
          <T v="caption" muted>
            {c.startDate} → {c.endDate} · {c.tz} · {c.memberCount}/{c.maxMembers} members ·{' '}
            {METRIC[c.metric].unit}
          </T>
          {c.invitationState && <T muted>{invitationLabel[c.invitationState]}</T>}
          {c.invitationState === 'pending' && <T muted>Awaiting your friend’s response.</T>}
          <Button
            label={selectedId === c.challengeId ? 'Refresh scores' : 'View scores'}
            kind="secondary"
            onPress={() => {
              setSelected(c.challengeId);
              feed.reload();
            }}
          />
          {selectedId === c.challengeId && (
            <Leaderboard id={c.challengeId} revision={feed.revision} />
          )}
          <Button
            label={c.myScoreConsent ? 'Stop sharing my battle score' : 'Share my battle score'}
            kind="secondary"
            busy={busy}
            onPress={() =>
              void act((allowed) =>
                api.battleScoreConsent(c.challengeId, !c.myScoreConsent, allowed),
              )
            }
          />
          {c.targetUserId && c.invitationState === 'pending' && (
            <Button
              label="Cancel invitation"
              kind="secondary"
              busy={busy}
              onPress={() =>
                void act((allowed) => api.respondBattle(c.challengeId, 'cancel', allowed))
              }
            />
          )}
          <Button
            label="Share battle code"
            kind="secondary"
            onPress={() =>
              void Share.share({
                message: `Join my ScrollSnooze battle: ${c.challengeId}. ${c.startDate} through ${c.endDate} (${c.tz}).`,
              }).catch(() =>
                setNote('Sharing could not be opened. Your battle is still available here.'),
              )
            }
          />
          <Button
            label="Leave"
            kind="secondary"
            busy={busy}
            onPress={() => void act(() => api.leaveChallenge(c.challengeId))}
          />
        </Card>
      ))}
    </Screen>
  );
}
