import type { v1 } from '@siddiq3/driftless-contracts';
import { addDays, localDateOf } from '@siddiq3/driftless-contracts/domain';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Share, View } from 'react-native';
import { useApi } from '@/api/useApi';
import { apiSessionKey } from '@/api/sessionClient';
import { useSession } from '@/auth/session';
import { currentTimeZone } from '@/sync/run';
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
import { Icon } from '@/ui/Icon';

const METRIC: Record<v1.ChallengeSummary['metric'], { label: string; unit: string }> = {
  fewest_minutes: { label: 'Fewest minutes a day', unit: 'min/day' },
  fewest_views: { label: 'Fewest videos a day', unit: 'videos/day' },
  goal_days: { label: 'Most days within goal', unit: 'days' },
};

function Leaderboard({ id }: { id: string }) {
  const api = useApi();
  const [lb, setLb] = useState<v1.LeaderboardResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      api
        ?.leaderboard(id)
        .then((data) => {
          if (active) {
            setErr(null);
            setLb(data);
          }
        })
        .catch((e: unknown) => {
          if (active) setErr(e instanceof Error ? e.message : 'unknown');
        });
      return () => {
        active = false;
      };
    }, [api, id]),
  );
  if (err)
    return (
      <T v="caption" muted>
        {err}
      </T>
    );
  if (!lb) return <LoadingState label="Loading the scores…" />;
  return (
    <>
      {lb.entries.length === 0 && <T muted>Scores appear after your first synced day.</T>}
      {lb.entries.map((e) => (
        <View
          key={e.userId}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}
        >
          <Icon name="trophy" size={e.rank === 1 ? 28 : 22} />
          <View style={{ flex: 1 }}>
            <T v="label">@{e.handle}</T>
          </View>
          <T v="title">{e.score}</T>
        </View>
      ))}
      {(lb.hiddenMembers ?? 0) > 0 && (
        <T v="caption" muted>
          {lb.hiddenMembers} member(s) not shown (sharing off or no data yet).
        </T>
      )}
    </>
  );
}

export default function Challenges() {
  const api = useApi();
  return <ChallengesForSession key={api ? apiSessionKey(api) : 'guest'} />;
}

function ChallengesForSession() {
  const api = useApi();
  const session = useSession();
  const [list, setList] = useState<v1.ChallengeSummary[] | null>(null);
  const [code, setCode] = useState('');
  const [note, setNote] = useState<{ title: string; warn?: boolean } | null>(null);
  const submitting = useRef(false);
  const requestGeneration = useRef(0);

  const load = useCallback(
    (allowed: () => boolean = () => true) => {
      const generation = ++requestGeneration.current;
      const current = () => allowed() && generation === requestGeneration.current;
      api
        ?.challenges()
        .then((data) => {
          if (current()) setList(data);
        })
        .catch((e: unknown) => {
          if (current())
            setNote({ warn: true, title: e instanceof Error ? e.message : 'Could not load' });
        });
    },
    [api],
  );
  useFocusEffect(
    useCallback(() => {
      load();
      return () => {
        requestGeneration.current++;
      };
    }, [load]),
  );

  if (session.status === 'loading')
    return (
      <Screen>
        <LoadingState label="Loading your challenges…" />
      </Screen>
    );
  if (!api) {
    const unavailable = session.status === 'unconfigured';
    return (
      <Screen>
        <Notice
          title={
            unavailable ? 'Challenges aren’t available in this build' : 'Sign in for challenges'
          }
          body={
            unavailable
              ? 'Counting and goals still work on this phone.'
              : 'Challenges are with friends and need an account.'
          }
        />
        <Button
          label={unavailable ? 'Back to today' : 'Go to sign in'}
          onPress={() => router.push(unavailable ? '/' : '/welcome')}
        />
      </Screen>
    );
  }
  const act = async (fn: () => Promise<unknown>) => {
    if (submitting.current) return;
    submitting.current = true;
    try {
      await fn();
      load();
    } catch (e) {
      setNote({ warn: true, title: e instanceof Error ? e.message : 'That did not work' });
    } finally {
      submitting.current = false;
    }
  };

  const createWeek = (metric: v1.ChallengeSummary['metric']) =>
    act(async () => {
      const tz = currentTimeZone();
      const start = localDateOf(Date.now(), tz);
      const c = await api.createChallenge({
        title: `${METRIC[metric].label} week`,
        metric,
        startDate: start,
        endDate: addDays(start, 6),
        tz,
        maxMembers: 10,
      });
      await Share.share({
        message: `Join my ScrollSnooze challenge "${c.title}" — code: ${c.challengeId}`,
      });
    });

  return (
    <Screen>
      {note && <Notice tone={note.warn ? 'warn' : 'info'} title={note.title} body="" />}

      <VisualBanner art="friends" title="A little friendly competition" />
      <Section>
        <T v="heading">Start a 7-day challenge</T>
        <Button label={METRIC.fewest_minutes.label} onPress={() => createWeek('fewest_minutes')} />
        <Button
          kind="secondary"
          label={METRIC.goal_days.label}
          onPress={() => createWeek('goal_days')}
        />
        <T v="caption" muted>
          Video-count challenges aren’t available yet.
        </T>
      </Section>

      <Section>
        <T v="heading">Join with a code</T>
        <Field
          label="Challenge code"
          autoCapitalize="none"
          value={code}
          onChangeText={setCode}
          placeholder="paste the code your friend shared"
        />
        <Button
          label="Join"
          onPress={() => act(() => api.joinChallenge(code.trim().toLowerCase()))}
        />
      </Section>

      {list === null && !note && <LoadingState label="Loading your challenges…" />}
      {list?.length === 0 && (
        <Section>
          <EmptyState
            mark="⚑"
            title="Your next week starts here"
            body="Create a challenge above or join one with a friend’s code."
          />
        </Section>
      )}
      {list?.map((c) => (
        <Card key={c.challengeId}>
          <T v="heading">{c.title}</T>
          <T v="caption" muted>
            {c.startDate} → {c.endDate} · {c.memberCount}/{c.maxMembers} members ·{' '}
            {METRIC[c.metric].unit}
          </T>
          <Leaderboard id={c.challengeId} />
          <Button
            kind="secondary"
            label="Leave"
            onPress={() => act(() => api.leaveChallenge(c.challengeId))}
          />
        </Card>
      ))}
    </Screen>
  );
}
