import { addDays, localDateOf } from '@siddiq3/driftless-contracts/domain';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { currentAccountTime, currentTimeZone } from '@/sync/run';
import { personalDay, refreshPersonalData } from '@/data/personal';
import { observeStorage } from '@/db/scope';
import { Button, Section, Notice, Screen, T, useTheme, Details } from '@/ui/kit';
import { Icon } from '@/ui/Icon';

const DAYS = 14;

type Row = {
  date: string;
  minutes: number | null;
  videos: number | null;
  gap: boolean;
};

export default function History() {
  const t = useTheme();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const read = useCallback(() => {
    try {
      refreshPersonalData(7);
      const today = localDateOf(currentAccountTime(), currentTimeZone());
      setRows(
        Array.from({ length: DAYS }, (_, i) =>
          (() => {
            const d = personalDay(addDays(today, -i));
            return {
              date: d.localDate,
              minutes: d.minutes,
              videos: d.views,
              gap: d.views === null && d.minutes === null,
            };
          })(),
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown error');
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      read();
      return observeStorage(read);
    }, [read]),
  );

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
      <Details title="About your history">
        <T v="caption" muted>
          These are local counts and minutes. Your personal screens use the same saved measurements.
          Competitive scores apply separate eligibility checks. Missing data is shown as a dash.
        </T>
      </Details>
      {rows && (
        <Section>
          {rows.map((r) => (
            <View
              key={r.date}
              accessible
              accessibilityLabel={`${r.date}: ${r.gap ? 'not tracked' : `${r.minutes ?? 'untracked'} minutes, ${r.videos ?? 'untracked'} videos`}`}
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
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
                  <T v="label">{r.videos ?? '—'}</T>
                </>
              )}
            </View>
          ))}
        </Section>
      )}
    </Screen>
  );
}
