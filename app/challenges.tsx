import type { v1 } from '@siddiq3/driftless-contracts';
import { addDays, localDateOf } from '@siddiq3/driftless-contracts/domain';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Share, TextInput } from 'react-native';
import { useApi } from '@/api/useApi';
import { currentTimeZone } from '@/sync/run';
import { Button, Card, Notice, Screen, T, useTheme } from '@/ui/kit';

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
      api
        ?.leaderboard(id)
        .then(setLb)
        .catch((e: unknown) => setErr(e instanceof Error ? e.message : 'unknown'));
    }, [api, id]),
  );
  if (err)
    return (
      <T v="caption" muted>
        {err}
      </T>
    );
  if (!lb) return null;
  return (
    <>
      {lb.entries.length === 0 && <T muted>No scores yet — they appear once members sync a day.</T>}
      {lb.entries.map((e) => (
        <T key={e.userId} muted>
          {e.rank}. @{e.handle} — {e.score}
        </T>
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
  const t = useTheme();
  const [list, setList] = useState<v1.ChallengeSummary[] | null>(null);
  const [code, setCode] = useState('');
  const [note, setNote] = useState<{ title: string; warn?: boolean } | null>(null);

  const load = useCallback(() => {
    api
      ?.challenges()
      .then(setList)
      .catch((e: unknown) =>
        setNote({ warn: true, title: e instanceof Error ? e.message : 'Could not load' }),
      );
  }, [api]);
  useFocusEffect(load);

  if (!api) {
    return (
      <Screen>
        <Notice
          title="Sign in for challenges"
          body="Challenges are with friends and need an account."
        />
      </Screen>
    );
  }
  const act = (fn: () => Promise<unknown>) =>
    fn()
      .then(load)
      .catch((e: unknown) =>
        setNote({ warn: true, title: e instanceof Error ? e.message : 'That did not work' }),
      );

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
        message: `Join my Driftless challenge "${c.title}" — code: ${c.challengeId}`,
      });
    });

  return (
    <Screen>
      <T v="title">Challenges</T>
      <T muted>With friends only. No prizes — just a friendly nudge.</T>
      {note && <Notice tone={note.warn ? 'warn' : 'info'} title={note.title} body="" />}

      <Card>
        <T v="heading">Start a 7-day challenge</T>
        <Button label={METRIC.fewest_minutes.label} onPress={() => createWeek('fewest_minutes')} />
        <Button
          kind="secondary"
          label={METRIC.goal_days.label}
          onPress={() => createWeek('goal_days')}
        />
        <T v="caption" muted>
          Video-count challenges open once counting accuracy is confirmed.
        </T>
      </Card>

      <Card>
        <T v="heading">Join with a code</T>
        <TextInput
          accessibilityLabel="Challenge code"
          style={{
            borderWidth: 1,
            borderColor: t.border,
            color: t.text,
            borderRadius: 12,
            padding: 12,
            fontSize: 16,
          }}
          autoCapitalize="none"
          value={code}
          onChangeText={setCode}
          placeholder="paste the code your friend shared"
          placeholderTextColor={t.textMuted}
        />
        <Button
          label="Join"
          onPress={() => act(() => api.joinChallenge(code.trim().toLowerCase()))}
        />
      </Card>

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
