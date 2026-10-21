import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Tracking, type BlockingConfig } from 'tracking-android';
import { loadBlocking, PRESETS, saveBlocking } from '@/billing/blocking';
import { getDb } from '@/db';
import { Toggle, Button, Section, Notice, Screen, T, MetricPanel, Details } from '@/ui/kit';
import { VisualBanner } from '@/ui/Focus';
import { AppIcon, Icon } from '@/ui/Icon';

const LIMITS = [15, 20, 30, 45, 60, 90, 120];

function Row({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      {/Instagram|YouTube/i.test(label) ? (
        <AppIcon name={label} />
      ) : (
        <Icon name={label.startsWith('Pause') ? 'lock' : 'clock'} size={22} />
      )}
      <View style={{ flex: 1 }}>
        <T muted>{label}</T>
      </View>
      <Toggle accessibilityLabel={label} value={value} onValueChange={onChange} />
    </View>
  );
}

export default function Blocking() {
  const [cfg, setCfg] = useState<BlockingConfig | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      getDb()
        .then(loadBlocking)
        .then((c) => {
          setCfg(c);
          setRunning(Tracking.health().serviceRunning);
        })
        .catch((e: unknown) =>
          setError(e instanceof Error ? e.message : 'Try opening this screen again.'),
        );
    }, []),
  );

  if (!cfg)
    return (
      <Screen>
        {error ? <Notice tone="warn" title="App pauses could not be loaded" body={error} /> : null}
      </Screen>
    );
  const update = (next: BlockingConfig) => {
    setError(null);
    setCfg(next);
    void getDb()
      .then((db) => saveBlocking(db, next))
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'Could not save app pauses.'),
      );
  };
  const apps = Tracking.health().apps;
  const idx = Math.max(0, LIMITS.indexOf(cfg.dailyMinutes ?? 30));

  return (
    <Screen>
      {error && <Notice tone="warn" title="App pauses need attention" body={error} />}
      <VisualBanner art="focus" />
      {!running && (
        <Notice
          tone="warn"
          title="The counter isn't running"
          body="Pausing needs the Driftless counter switched on in Accessibility settings."
        />
      )}
      <Section>
        <T v="heading">Your pause switch</T>
        <Row
          label="Pause apps"
          value={cfg.enabled}
          onChange={(v) => update({ ...cfg, enabled: v })}
        />
        <T v="caption" muted>
          Requires an active Pro subscription.
        </T>
      </Section>
      <Section>
        <T v="heading">Apps</T>
        {apps.map((a) => (
          <Row
            key={a.package}
            label={a.label}
            value={cfg.apps.includes(a.package)}
            onChange={(v) =>
              update({
                ...cfg,
                apps: v ? [...cfg.apps, a.package] : cfg.apps.filter((p) => p !== a.package),
              })
            }
          />
        ))}
      </Section>
      <Section>
        <MetricPanel
          value={cfg.dailyMinutes ?? '—'}
          label="minutes per app each day"
          detail={
            cfg.dailyMinutes === null
              ? 'Daily limit is off'
              : 'A pause begins when you reach this limit'
          }
        />
        <Row
          label={`Daily limit per app: ${cfg.dailyMinutes ?? 30} min`}
          value={cfg.dailyMinutes !== null}
          onChange={(v) => update({ ...cfg, dailyMinutes: v ? 30 : null })}
        />
        {cfg.dailyMinutes !== null && (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Button
                kind="secondary"
                label="Less"
                onPress={() => update({ ...cfg, dailyMinutes: LIMITS[Math.max(0, idx - 1)]! })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                kind="secondary"
                label="More"
                onPress={() =>
                  update({ ...cfg, dailyMinutes: LIMITS[Math.min(LIMITS.length - 1, idx + 1)]! })
                }
              />
            </View>
          </View>
        )}
      </Section>
      <Section>
        <T v="heading">Focus times</T>
        {PRESETS.map((p) => {
          const on = cfg.schedules.some(
            (s) =>
              s.startMinute === p.startMinute &&
              s.endMinute === p.endMinute &&
              s.days.join() === p.days.join(),
          );
          return (
            <Row
              key={p.label}
              label={p.label}
              value={on}
              onChange={(v) =>
                update({
                  ...cfg,
                  schedules: v
                    ? [
                        ...cfg.schedules,
                        { days: p.days, startMinute: p.startMinute, endMinute: p.endMinute },
                      ]
                    : cfg.schedules.filter(
                        (s) =>
                          !(
                            s.startMinute === p.startMinute &&
                            s.endMinute === p.endMinute &&
                            s.days.join() === p.days.join()
                          ),
                      ),
                })
              }
            />
          );
        })}
      </Section>
      {Tracking.health().feedLimitsImplemented ? (
        <Section>
          <T v="heading">Reels &amp; Shorts limits and breaks</T>
          <T muted>
            These controls need the pause switch, selected apps and active Pro. They apply only to a
            detected short-video feed.
          </T>
          <Row
            label="Pause only Reels and Shorts"
            value={cfg.feedOnly ?? false}
            onChange={(v) => update({ ...cfg, feedOnly: v })}
          />
          <T muted>
            Applies your minute limits and focus times only inside the feed. Other screens stay
            available after you leave the feed. Unsupported or undetected screens remain usable.
          </T>
          <Row
            label="Enforce my daily video goal"
            value={cfg.enforceVideoGoal ?? false}
            onChange={(v) => update({ ...cfg, enforceVideoGoal: v })}
          />
          <T muted>
            Uses the enabled Videos a day goal. At the Nth qualifying video, the feed pauses until
            the next local day. A bypass temporarily allows more videos.
          </T>
          <Button
            kind="secondary"
            label="Edit daily video goal"
            onPress={() => router.push('/goals')}
          />
          <Row
            label="Timed feed breaks"
            value={cfg.breaksEnabled ?? false}
            onChange={(v) => update({ ...cfg, breaksEnabled: v })}
          />
          {(
            [
              ['Break every (videos)', 'breakEveryViews', [10, 25, 50, 100]],
              ['Break duration (minutes)', 'breakMinutes', [1, 5, 10, 15, 30]],
              ['Bypasses per local day', 'maxBypassesPerDay', [0, 1, 3, 5]],
              ['Bypass duration (minutes)', 'bypassMinutes', [1, 5, 10, 15]],
            ] as const
          ).map(([label, key, choices]) => (
            <View key={key} style={{ gap: 8 }}>
              <T>{label}</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {choices.map((value) => (
                  <Button
                    key={value}
                    label={`${value}${(cfg[key] ?? (key === 'breakEveryViews' ? 50 : key === 'maxBypassesPerDay' ? 3 : 5)) === value ? ' ✓' : ''}`}
                    kind="secondary"
                    onPress={() => update({ ...cfg, [key]: value })}
                  />
                ))}
              </View>
            </View>
          ))}
          <Row
            label="Use unverified local detection"
            value={cfg.allowUnvalidatedCounts ?? false}
            onChange={(v) => update({ ...cfg, allowUnvalidatedCounts: v })}
          />
          <T muted>
            Off by default. Without approved app versions, feed pauses stay unavailable unless you
            enable this experiment. It can miss videos or interrupt the wrong screen. It never makes
            counts eligible for cloud comparisons. Home, Back and Open Driftless remain available;
            media may keep playing underneath.
          </T>
        </Section>
      ) : (
        <Notice
          tone="warn"
          title="Feed limits need an updated Android build"
          body="Install the latest Driftless build to configure daily video enforcement and timed feed breaks."
        />
      )}
      <Details title="How app pauses work" icon="help">
        <T muted>
          Whole-app minute and schedule pauses show Driftless’s pause screen with five-minute
          snoozes, three per day. Feed pauses use the bypass budget above, shared across Reels and
          Shorts. Timed breaks resume after their countdown; a daily video cap remains until the
          next local day. Leaving the feed, Home and turning protection off remain available.
        </T>
      </Details>
      <Button kind="secondary" label="Driftless Pro" onPress={() => router.push('/pro')} />
    </Screen>
  );
}
