import { useResponsiveLayout } from '@/ui/responsive';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useFonts } from 'expo-font';
import { addDays } from '@siddiq3/driftless-contracts/domain';
import { Screen, T, Notice, Button } from '@/ui/kit';
import { AppIcon, Icon } from '@/ui/Icon';
import { WrapEntry } from '@/wrapped/Entry';
import { useActivity } from '@/activity/useActivity';
import { ActivityChart } from '@/activity/ActivityChart';
import type { ActivityPeriod } from '@/activity/model';
import { SetupButton } from '@/onboarding/Visuals';
const dateLabel = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
export default function ProgressScreen() {
  const layout = useResponsiveLayout();
  const [period, setPeriod] = useState<ActivityPeriod>('daily');
  const [offset, setOffset] = useState(0);
  const [state, refresh] = useActivity(period, offset);
  const [fonts] = useFonts({ LilitaOne: require('../assets/fonts/LilitaOne-Regular.ttf') });
  const data = state.state === 'ok' ? state.data : null;
  const title =
    state.state === 'ok'
      ? period === 'daily'
        ? offset === 0
          ? 'Today'
          : data!.from === addDays(state.today, -1)
            ? 'Yesterday'
            : dateLabel(data!.from)
        : offset === 0
          ? 'This week'
          : `${dateLabel(data!.from)} – ${dateLabel(data!.to)}`
      : '…';
  const limit = period === 'daily' ? 59 : 8;
  return (
    <Screen contentStyle={{ padding: 20, gap: 16 }}>
      <T
        v="title"
        style={{
          fontFamily: fonts ? 'LilitaOne' : undefined,
          color: '#FFE1A4',
          fontSize: 25,
          letterSpacing: 0.3,
        }}
      >
        PROGRESS
      </T>
      <Button kind="secondary" label="History and stats" onPress={() => router.push('/history')} />
      <View accessibilityRole="tablist" style={styles.switcher}>
        {(['daily', 'weekly'] as const).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityState={{ selected: period === value }}
            onPress={() => {
              setPeriod(value);
              setOffset(0);
            }}
            style={[styles.pill, { backgroundColor: period === value ? '#783F00' : '#29271F' }]}
          >
            <T
              style={{
                color: period === value ? '#FFF9ED' : '#B0ACA0',
                fontSize: 17,
                fontWeight: '600',
              }}
            >
              {value === 'daily' ? 'Daily' : 'Weekly'}
            </T>
          </Pressable>
        ))}
      </View>
      <View style={styles.dateRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Previous ${period === 'daily' ? 'day' : 'week'}`}
          disabled={offset >= limit}
          onPress={() => setOffset((n) => Math.min(limit, n + 1))}
          style={[styles.arrow, { opacity: offset >= limit ? 0.3 : 1 }]}
        >
          <Icon name="back" color="#F7F4E8" />
        </Pressable>
        <T v="label" style={{ textAlign: 'center', flex: 1, fontSize: 16, fontWeight: '700' }}>
          {title}
        </T>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Next ${period === 'daily' ? 'day' : 'week'}`}
          disabled={offset === 0}
          onPress={() => setOffset((n) => Math.max(0, n - 1))}
          style={[styles.arrow, { opacity: offset === 0 ? 0.3 : 1 }]}
        >
          <Icon name="chevron" color="#F7F4E8" />
        </Pressable>
      </View>
      {state.state === 'loading' ? (
        <View style={styles.loading}>
          <ActivityIndicator color="#FFE1A4" accessibilityLabel="Reading activity" />
        </View>
      ) : state.state === 'error' ? (
        <>
          <Notice
            tone="warn"
            title="Activity unavailable"
            body="Your phone’s activity could not be read."
          />
          <Button label="Try again" onPress={refresh} />
        </>
      ) : (
        data && (
          <>
            <ActivityChart data={data} period={period} />
            <View style={[styles.totals, layout.stack && { flexDirection: 'column' }]}>
              <View style={[styles.metric, layout.stack && { flexBasis: 'auto' }]}>
                <T v="display" style={styles.number}>
                  {data.views.value === null ? '—' : data.views.value.toLocaleString()}
                </T>
                <T style={styles.muted}>Total Reels</T>
                {data.views.days > 0 && data.views.days < data.expectedDays && (
                  <T v="caption" style={styles.muted}>
                    {data.views.days}/{data.expectedDays} days tracked
                  </T>
                )}
              </View>
              <View style={[styles.metric, layout.stack && { flexBasis: 'auto' }]}>
                <T v="display" style={styles.number}>
                  {data.minutes.value === null ? '—' : `${data.minutes.value}m`}
                </T>
                <T style={styles.muted}>Time spent</T>
                {data.minutes.days > 0 && data.minutes.days < data.expectedDays && (
                  <T v="caption" style={styles.muted}>
                    {data.minutes.days}/{data.expectedDays} days tracked
                  </T>
                )}
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Focus and app pauses"
              onPress={() => router.push('/blocking')}
              style={styles.pro}
            >
              <View style={styles.proBadge}>
                <Icon name="shield" size={22} color="#2C1A08" />
              </View>
              <T style={{ flex: 1, fontWeight: '700' }}>Focus &amp; app pauses</T>
              <Icon name="chevron" color="#FFF4DA" />
            </Pressable>
            <T style={{ fontSize: 17, fontWeight: '600', marginTop: 4 }}>Top apps</T>
            {data.apps.length ? (
              <View style={styles.apps}>
                {data.apps.map((app, i) => (
                  <View
                    key={app.package}
                    style={[
                      styles.appRow,
                      i > 0 && {
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderTopColor: '#29271F',
                      },
                    ]}
                  >
                    <AppIcon name={app.label} size={40} />
                    <T style={{ flex: 1, fontWeight: '600' }}>{app.label}</T>
                    <T>{app.views === null ? '—' : app.views.toLocaleString()}</T>
                  </View>
                ))}
              </View>
            ) : (
              <View style={[styles.apps, { padding: 22 }]}>
                <T style={styles.muted}>No tracked apps yet</T>
                <SetupButton label="Enable counting" onPress={() => router.push('/tracking')} />
              </View>
            )}
            <WrapEntry />
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/goals')}
              style={styles.goal}
            >
              <Icon name="target" size={18} />
              <T v="label">Daily goals</T>
              <Icon name="chevron" size={16} />
            </Pressable>
          </>
        )
      )}
    </Screen>
  );
}
const styles = StyleSheet.create({
  switcher: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 0,
    paddingBottom: 0,
  },
  pill: {
    borderRadius: 30,
    paddingHorizontal: 24,
    paddingVertical: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    width: '100%',
    minHeight: 48,
  },
  arrow: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  loading: { minHeight: 300, alignItems: 'center', justifyContent: 'center' },
  totals: {
    backgroundColor: '#15140F',
    borderRadius: 22,
    padding: 20,
    flexDirection: 'row',
    gap: 12,
    minHeight: 110,
  },
  metric: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, alignItems: 'center', gap: 6 },
  number: { textAlign: 'center', fontSize: 28, lineHeight: 36, fontWeight: '800' },
  muted: { color: '#AAA69A', fontSize: 14 },
  pro: {
    backgroundColor: '#783F00',
    borderRadius: 16,
    minHeight: 68,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  proBadge: {
    backgroundColor: '#FFE1A4',
    borderRadius: 30,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  apps: { backgroundColor: '#15140F', borderRadius: 22, overflow: 'hidden', gap: 0 },
  appRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, minHeight: 68 },
  goal: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    alignItems: 'center',
    minHeight: 48,
  },
});
