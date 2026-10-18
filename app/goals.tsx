import type { v1 } from '@siddiq3/driftless-contracts';
import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { getDb } from '@/db';
import { canUseViewGoals } from '@/goals/progress';
import {
  ensureNotificationPermission,
  eveningReminderEnabled,
  setEveningReminder,
} from '@/goals/reminders';
import { loadGoals, saveGoal } from '@/goals/store';
import { Tracking } from 'tracking-android';
import { useProgress } from '@/goals/useProgress';
import { Details, MetricPanel, Toggle, Button, Card, Notice, Screen, T } from '@/ui/kit';
import { VisualBanner } from '@/ui/Focus';

const STEPS: Record<v1.Goal['metric'], number[]> = {
  minutes: [10, 15, 20, 30, 45, 60, 90, 120],
  views: [10, 20, 30, 50, 75, 100, 150],
};

function GoalEditor({
  metric,
  existing,
  enabledAllowed,
}: {
  metric: v1.Goal['metric'];
  existing?: v1.Goal;
  enabledAllowed: boolean;
}) {
  const [limit, setLimit] = useState(existing?.dailyLimit ?? (metric === 'minutes' ? 30 : 50));
  const [enabled, setEnabled] = useState(existing?.enabled ?? false);
  const [saved, setSaved] = useState<string | null>(null);
  const steps = STEPS[metric];
  const idx = Math.max(
    0,
    steps.findIndex((v) => v >= limit),
  );

  const save = async (next: { limit?: number; enabled?: boolean }) => {
    const db = await getDb();
    const g = await saveGoal(db, {
      goalId: existing?.goalId ?? randomUUID(),
      metric,
      dailyLimit: next.limit ?? limit,
      enabled: next.enabled ?? enabled,
    });
    const all = await loadGoals(db);
    Tracking.setLimits(
      all.filter((x) => x.enabled).map((x) => ({ metric: x.metric, dailyLimit: x.dailyLimit })),
    );
    if (g.enabled) void ensureNotificationPermission();
    setSaved(`Saved (${g.dailyLimit} ${metric === 'minutes' ? 'min' : 'videos'} a day)`);
  };

  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <T v="heading" style={{ flex: 1 }}>
          {metric === 'minutes' ? 'Minutes a day' : 'Videos a day'}
        </T>
        <Toggle
          accessibilityLabel={`${metric} goal`}
          value={enabled}
          disabled={!enabledAllowed}
          onValueChange={(v) => {
            setEnabled(v);
            void save({ enabled: v });
          }}
        />
      </View>
      {!enabledAllowed && (
        <T v="caption" muted>
          Available once video counting accuracy is confirmed for your app versions.
        </T>
      )}
      <MetricPanel
        value={limit}
        label={metric === 'minutes' ? 'minutes per day' : 'videos per day'}
      />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Button
            kind="secondary"
            label="Less"
            onPress={() => {
              const v = steps[Math.max(0, idx - 1)]!;
              setLimit(v);
              void save({ limit: v });
            }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            kind="secondary"
            label="More"
            onPress={() => {
              const v = steps[Math.min(steps.length - 1, idx + 1)]!;
              setLimit(v);
              void save({ limit: v });
            }}
          />
        </View>
      </View>
      {saved && (
        <T v="caption" muted>
          {saved}
        </T>
      )}
    </Card>
  );
}

function EveningReminder() {
  const [on, setOn] = useState<boolean | null>(null);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    getDb()
      .then(eveningReminderEnabled)
      .then(setOn)
      .catch(() => setOn(false));
  }, []);
  if (on === null) return null;
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <T v="heading">Evening check-in</T>
          <T muted>9 pm reminder</T>
        </View>
        <Toggle
          accessibilityLabel="Evening check-in reminder"
          value={on}
          onValueChange={(v) => {
            getDb()
              .then((db) => setEveningReminder(db, v))
              .then((result) => {
                setOn(result);
                setNote(
                  v && !result ? 'Notifications are off for Driftless in Android settings.' : null,
                );
              })
              .catch((e: unknown) =>
                setNote(e instanceof Error ? e.message : 'Could not change reminder'),
              );
          }}
        />
      </View>
      {note && (
        <T v="caption" muted>
          {note}
        </T>
      )}
      <T v="caption" muted>
        You also get a notice at 80% and 100% of a goal (needs the counter or Usage Access).
      </T>
    </Card>
  );
}

export default function Goals() {
  const [s] = useProgress(1);
  if (s.state === 'loading') return <Screen>{null}</Screen>;
  if (s.state === 'error') {
    return (
      <Screen>
        <Notice tone="warn" title="Goals could not be loaded" body={s.message} />
      </Screen>
    );
  }
  const find = (m: v1.Goal['metric']) => s.goals.find((g) => g.metric === m);
  return (
    <Screen>
      <VisualBanner art="wick" />
      <GoalEditor metric="minutes" existing={find('minutes')} enabledAllowed />
      <GoalEditor
        metric="views"
        existing={find('views')}
        enabledAllowed={canUseViewGoals(s.health)}
      />
      <Details title="Reminders" icon="clock">
        <EveningReminder />
      </Details>
      <Button label="Done" onPress={() => router.back()} />
    </Screen>
  );
}
