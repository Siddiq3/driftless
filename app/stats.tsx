import { useState } from 'react';
import { View } from 'react-native';
import { useProgress } from '@/goals/useProgress';
import { Bars } from '@/ui/Bars';
import { Button, Card, Notice, Screen, T } from '@/ui/kit';

const short = (d: string) => d.slice(5).replace('-', '/');

export default function Stats() {
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

  return (
    <Screen>
      <T v="title">Stats</T>
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
        <T v="heading">Minutes per day</T>
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
        <T muted>
          {avg === null
            ? 'No tracked days in this range'
            : `Average ${avg} min on ${tracked.length} tracked days`}
          {s.goals.some((g) => g.enabled) ? ` · goal kept on ${kept} days` : ''}
        </T>
        <T v="caption" muted>
          Dashed bars are days that weren't tracked — they are not counted as zero.
        </T>
      </Card>
    </Screen>
  );
}
