import { useResponsiveLayout } from '@/ui/responsive';
import { useCallback, useState } from 'react';
import { AppState, Pressable, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { observeStorage, storageScope } from '@/db/scope';
import { T, useTheme } from '@/ui/kit';
import { Icon } from '@/ui/Icon';
import { defaultEnd, hasWrapData, readPhoneWrap } from './model';
import type { WrapPeriod } from '@siddiq3/driftless-contracts/domain';

type ReadyWrap = { period: WrapPeriod; end: string };
export function WrapEntry() {
  const t = useTheme();
  const layout = useResponsiveLayout();
  const [available, setAvailable] = useState<{ scope: string; wraps: ReadyWrap[] } | null>(null);
  useFocusEffect(
    useCallback(() => {
      const refresh = () => {
        const scope = storageScope();
        const wraps: ReadyWrap[] = [];
        for (const period of ['daily', 'weekly'] as const) {
          try {
            const end = defaultEnd(period);
            if (hasWrapData(readPhoneWrap(period, end))) wraps.push({ period, end });
          } catch {
            // A failed read cannot advertise an available recap.
          }
        }
        setAvailable({ scope, wraps });
      };
      refresh();
      const unsubscribe = observeStorage(refresh);
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') refresh();
      });
      // A completed period can change while Progress stays open across midnight.
      const timer = setInterval(refresh, 60_000);
      return () => {
        unsubscribe();
        subscription.remove();
        clearInterval(timer);
      };
    }, []),
  );
  const ready = available?.scope === storageScope() ? available.wraps : [];
  if (!ready.length) return null;
  return (
    <View style={{ flexDirection: layout.stack ? 'column' : 'row', gap: 10 }}>
      {ready.map(({ period, end }) => (
        <Pressable
          key={period}
          accessibilityRole="button"
          accessibilityLabel={`Open ${period} Wrapped`}
          onPress={() => router.push({ pathname: '/wrapped', params: { period, end } })}
          style={({ pressed }) => ({
            flex: layout.stack ? undefined : 1,
            minHeight: 52,
            borderRadius: 18,
            backgroundColor: t.surfaceRaised,
            padding: 14,
            flexDirection: 'row',
            gap: 8,
            alignItems: 'center',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Icon name="chart" size={18} />
          <T v="label" style={{ flex: 1, fontSize: 14 }}>
            {period === 'daily' ? 'Daily wrap' : 'Weekly wrap'}
          </T>
          <Icon name="chevron" size={14} />
        </Pressable>
      ))}
    </View>
  );
}
