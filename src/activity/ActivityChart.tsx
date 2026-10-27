import { Animated, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { T } from '@/ui/kit';
import { useDataMotion } from '@/ui/motion';
import { Icon } from '@/ui/Icon';
import type { ActivityData, ActivityPeriod } from './model';
export function ActivityChart({ data, period }: { data: ActivityData; period: ActivityPeriod }) {
  const { fontScale } = useWindowDimensions();
  const labelHeight = 20 * Math.min(fontScale, 2);
  const columnWidth = (period === 'daily' ? 14 : 44) * Math.min(fontScale, 2);
  const max = Math.max(2, ...data.bars.map((b) => b.value ?? 0));
  const ceiling = max <= 10 ? Math.ceil(max / 2) * 2 : Math.ceil(max / 10) * 10;
  const motion = useDataMotion(data.bars.map((b) => `${b.key}:${b.value}`).join('|'));
  const known = data.bars.some((b) => b.value !== null);
  const sparse = data.bars.filter((b) => (b.value ?? 0) > 0).length <= 8;
  return (
    <View style={[styles.card, !known && styles.emptyCard]}>
      {!known ? (
        <View style={styles.empty}>
          <Icon name="chart" size={32} color="#FFE1A4" />
          <T v="label" style={{ color: '#B0ACA0', textAlign: 'center' }}>
            {period === 'daily' ? 'Hourly detail unavailable' : 'No confirmed counts yet'}
          </T>
        </View>
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator
            contentContainerStyle={{ minWidth: '100%', flexGrow: 1 }}
          >
            <View style={{ minWidth: data.bars.length * columnWidth + 56, flex: 1 }}>
              <View style={[styles.plot, { height: 140 + labelHeight }]}>
                <View style={styles.yAxis}>
                  {[ceiling, ceiling / 2, 0].map((v) => (
                    <T key={v} v="caption" style={{ color: '#AAA69A' }}>
                      {v}
                    </T>
                  ))}
                </View>
                <Animated.View style={[styles.bars, { height: 140 + labelHeight }, motion]}>
                  {data.bars.map((b) => (
                    <View
                      key={b.key}
                      accessible
                      accessibilityLabel={`${b.label}: ${b.value === null ? 'not recorded' : `${b.value} short videos`}`}
                      style={{
                        flex: 1,
                        height: '100%',
                        justifyContent: 'flex-end',
                        alignItems: 'center',
                      }}
                    >
                      {b.value === null ? (
                        <View style={{ height: 2, width: '70%', backgroundColor: '#575349' }} />
                      ) : b.value > 0 ? (
                        <View
                          style={{
                            width: '100%',
                            alignItems: 'center',
                          }}
                        >
                          {period !== 'daily' && (sparse || b.value === max) && (
                            <T
                              v="caption"
                              style={{
                                minHeight: labelHeight,
                                textAlign: 'center',
                                alignSelf: 'center',
                                color: '#FFF9ED',
                                fontSize: 11,
                              }}
                            >
                              {b.value}
                            </T>
                          )}
                          <Svg
                            width={period === 'daily' ? '85%' : '45%'}
                            height={(b.value / ceiling) * 140}
                          >
                            <Defs>
                              <LinearGradient id="activityBar" x1="0" y1="0" x2="0" y2="1">
                                <Stop offset="0" stopColor="#FFE9AD" />
                                <Stop offset="1" stopColor="#FFB763" />
                              </LinearGradient>
                            </Defs>
                            <Rect width="100%" height="100%" rx={5} fill="url(#activityBar)" />
                          </Svg>
                        </View>
                      ) : null}
                    </View>
                  ))}
                </Animated.View>
              </View>
              <View style={styles.xAxis}>
                {(period === 'daily'
                  ? ['12am', '6am', '12pm', '6pm', '12am']
                  : data.bars.map((b) => b.label)
                ).map((text, i) => (
                  <T key={i} v="caption" style={{ color: '#AAA69A', fontSize: 11 }}>
                    {text}
                  </T>
                ))}
              </View>
            </View>
          </ScrollView>
        </>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    backgroundColor: '#15140F',
    borderRadius: 22,
    padding: 18,
    paddingTop: 30,
    minHeight: 224,
  },
  plot: { height: 155, flexDirection: 'row', gap: 10 },
  yAxis: { minWidth: 22, justifyContent: 'space-between', paddingBottom: 0 },
  bars: { flex: 1, height: 155, flexDirection: 'row', gap: 2, alignItems: 'flex-end' },
  xAxis: { marginTop: 14, marginLeft: 32, flexDirection: 'row', justifyContent: 'space-between' },
  emptyCard: { minHeight: 0, padding: 16, paddingTop: 16 },
  empty: {
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
