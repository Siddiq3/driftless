import { useState } from 'react';
import { View } from 'react-native';
import { useProgress } from '@/goals/useProgress';
import { Bars } from '@/ui/Bars';
import { Button, Card, Notice, Screen, T, useTheme, Details } from '@/ui/kit';

const short = (d: string) => d.slice(5).replace('-', '/');

export default function Stats() {
  const t = useTheme();
  const [range, setRange] = useState<7 | 30>(7);
  const [s] = useProgress(30);
  if (s.state === 'loading') return <Screen>{null}</Screen>;
  if (s.state === 'error') {
    return (
      <Screen>
        <Notice tone="warn" title="Stats could not be read" body={s.message} />
      </Screen>
    );
  }
  const minuteGoal = s.goals.find((g) => g.enabled && g.metric === 'minutes');
  const days = s.p.days.slice(-range);
  const tracked = days.filter((d) => d.minutes !== null);
  const avg = tracked.length
    ? Math.round(tracked.reduce((n, d) => n + d.minutes!, 0) / tracked.length)
    : null;
  const kept = days.filter((d) => d.outcome === 'kept').length;
  const counted = days.filter((d) => d.views !== null);
  const totalViews = counted.length ? counted.reduce((n, d) => n + d.views!, 0) : null;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Button
            kind={range === 7 ? 'primary' : 'secondary'}
            label="7 days"
            onPress={() => setRange(7)}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            kind={range === 30 ? 'primary' : 'secondary'}
            label="30 days"
            onPress={() => setRange(30)}
          />
        </View>
      </View>
      <Card>
        <T v="heading">Reels & Shorts</T>
        <Bars
          unit="videos"
          bars={days.map((d) => ({ key: d.localDate, label: short(d.localDate), value: d.views }))}
        />
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            backgroundColor: t.accent,
            borderRadius: 22,
            padding: 20,
            gap: 16,
          }}
        >
          <View style={{ flex: 1, minWidth: 100 }}>
            <T v="display" style={{ color: t.onAccent }}>
              {totalViews === null ? '—' : totalViews.toLocaleString()}
            </T>
            <T v="caption" style={{ color: t.onAccent }}>
              Total videos
            </T>
          </View>
          <View style={{ flex: 1, minWidth: 100 }}>
            <T v="display" style={{ color: t.onAccent }}>
              {totalViews === null ? '—' : Math.round(totalViews / counted.length).toLocaleString()}
            </T>
            <T v="caption" style={{ color: t.onAccent }}>
              Daily average
            </T>
          </View>
        </View>
      </Card>
      <Card>
        <T v="heading">Minutes</T>
        <Bars
          unit="minutes"
          limit={minuteGoal?.dailyLimit}
          bars={days.map((d) => ({
            key: d.localDate,
            label: short(d.localDate),
            value: d.minutes,
            over:
              minuteGoal !== undefined && d.minutes !== null && d.minutes > minuteGoal.dailyLimit,
          }))}
        />
      </Card>
      <Details title="About these numbers" icon="help">
        <T v="caption" muted>
          Based on {counted.length} days with confirmed counts. Untracked days are excluded.
        </T>
        <T muted>
          {avg === null
            ? 'No tracked days in this range'
            : `Average ${avg} min on ${tracked.length} tracked days`}
          {s.goals.some((g) => g.enabled) ? ` · goal kept on ${kept} days` : ''}
        </T>
        <T v="caption" muted>
          Dashed bars are days that weren’t tracked — they are not counted as zero.
        </T>
      </Details>
    </Screen>
  );
}
