import { addDays, localDateOf } from '@siddiq3/driftless-contracts/domain';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Tracking, type Daily, type TrackingHealth } from 'tracking-android';
import { currentTimeZone } from '@/sync/run';
import { Button, Card, Notice, Screen, T, useTheme } from '@/ui/kit';
import { Icon } from '@/ui/Icon';

const DAYS = 14;

type Row = {
  date: string;
  minutes: number | null;
  videos: number | null;
  confirmed: boolean;
  gap: boolean;
};

function toRow(d: Daily, h: TrackingHealth): Row {
  const usage = d.apps.reduce((n, a) => n + a.usageMs, 0);
  const counter = d.apps.reduce((n, a) => n + a.surfaceMs + a.unknownMs, 0);
  const ran = d.heartbeatMinutes > 0;
  const hasRows = d.apps.length > 0;
  const minutes = !hasRows
    ? null
    : h.usageAccessGranted
      ? Math.round(usage / 60_000)
      : ran
        ? Math.round(counter / 60_000)
        : null;
  const videos = ran ? d.apps.reduce((n, a) => n + a.views, 0) : null;
  const confirmed =
    h.apps.filter((a) => a.installed).every((a) => a.validated) && h.apps.some((a) => a.installed);
  return {
    date: d.localDate,
    minutes,
    videos,
    confirmed,
    gap: !hasRows || (!ran && !h.usageAccessGranted),
  };
}

export default function History() {
  const t = useTheme();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const read = useCallback(() => {
    try {
      Tracking.refreshUsage(7);
      const h = Tracking.health();
      const today = localDateOf(Date.now(), currentTimeZone());
      setRows(Array.from({ length: DAYS }, (_, i) => toRow(Tracking.daily(addDays(today, -i)), h)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown error');
    }
  }, []);
  useFocusEffect(read);

  return (
    <Screen>
      <Button kind="secondary" label="Explore your stats ↗" onPress={() => router.push('/stats')} />
      {error && <Notice tone="warn" title="History could not be read" body={error} />}
      {rows?.every((r) => r.minutes === null && r.videos === null) && (
        <Notice
          title="Nothing yet"
          body="Turn on the counter or Usage Access to start building your history."
        />
      )}
      {rows && (
        <Card>
          {rows.map((r) => (
            <View
              key={r.date}
              accessible
              accessibilityLabel={`${r.date}: ${r.gap ? 'not tracked' : `${r.minutes ?? 'untracked'} minutes, ${r.videos ?? 'untracked'} videos${r.confirmed ? '' : ', unconfirmed'}`}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 12,
                borderBottomWidth: 0.5,
                borderColor: t.border,
              }}
            >
              <T v="label" style={{ flex: 1 }}>
                {r.date.slice(5).replace('-', '/')}
              </T>
              {r.gap ? (
                <T v="caption" muted>
                  Not tracked
                </T>
              ) : (
                <>
                  <Icon name="clock" size={16} color={t.textMuted} />
                  <T v="label">{r.minutes ?? '—'}m</T>
                  <Icon name="play" size={16} />
                  <T v="label">
                    {r.videos ?? '—'}
                    {r.videos !== null && !r.confirmed ? '*' : ''}
                  </T>
                </>
              )}
            </View>
          ))}
          {rows.some((r) => r.videos !== null && !r.confirmed) && (
            <T v="caption" muted>
              * Unconfirmed counts
            </T>
          )}
        </Card>
      )}
    </Screen>
  );
}
