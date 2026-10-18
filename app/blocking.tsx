import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Tracking, type BlockingConfig } from 'tracking-android';
import { loadBlocking, PRESETS, saveBlocking } from '@/billing/blocking';
import { getDb } from '@/db';
import { Toggle, Button, Card, Notice, Screen, T, MetricPanel, Details } from '@/ui/kit';
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
      <Card>
        <T v="heading">Your pause switch</T>
        <Row
          label="Pause apps"
          value={cfg.enabled}
          onChange={(v) => update({ ...cfg, enabled: v })}
        />
        <T v="caption" muted>
          Requires an active Pro subscription.
        </T>
      </Card>
      <Card>
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
      </Card>
      <Card>
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
      </Card>
      <Card>
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
      </Card>
      <Details title="How app pauses work" icon="help">
        {' '}
        <T muted>
          When a limit is reached or a focus time starts, Driftless shows its own pause screen. You
          can always close it, take 5 more minutes (3 times a day), or turn this off.
        </T>
      </Details>
      <Button kind="secondary" label="Driftless Pro" onPress={() => router.push('/pro')} />
    </Screen>
  );
}
