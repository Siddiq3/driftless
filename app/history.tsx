import { addDays, localDateOf } from '@siddiq3/driftless-contracts/domain';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Tracking, type Daily, type TrackingHealth } from 'tracking-android';
import { currentTimeZone } from '@/sync/run';
import { Card, Notice, Screen, T } from '@/ui/kit';

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
  const minutes = h.usageAccessGranted
    ? Math.round(usage / 60_000)
    : ran
      ? Math.round(counter / 60_000)
      : null;
  const videos = ran ? d.apps.reduce((n, a) => n + a.views, 0) : null;
  const confirmed =
    h.apps.filter((a) => a.installed).every((a) => a.validated) && h.apps.some((a) => a.installed);
  return { date: d.localDate, minutes, videos, confirmed, gap: !ran && !h.usageAccessGranted };
}

export default function History() {
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
      <T v="title">Last {DAYS} days</T>
      {error && <Notice tone="warn" title="History could not be read" body={error} />}
      {rows?.every((r) => r.minutes === null && r.videos === null) && (
        <Notice
          title="Nothing yet"
          body="Turn on the counter or Usage Access to start building your history."
        />
      )}
      {rows?.map((r) => (
        <Card key={r.date}>
          <T v="label">{r.date}</T>
          {r.gap ? (
            <T muted>Not tracked</T>
          ) : (
            <T muted>
              {r.minutes === null ? 'Minutes not tracked' : `${r.minutes} min`}
              {r.videos === null
                ? ''
                : ` · ${r.videos} videos${r.confirmed ? '' : ' (unconfirmed)'}`}
            </T>
          )}
        </Card>
      ))}
    </Screen>
  );
}
