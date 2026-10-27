import { useResponsiveLayout } from '@/ui/responsive';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useCallback, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { getDb } from '@/db';
import { ModalContent, T, useTheme } from '@/ui/kit';
import { BrainCharacter } from '@/ui/BrainCharacter';
import { Icon } from '@/ui/Icon';
import { useReducedMotion } from '@/ui/motion';
import { SetupButton } from '@/onboarding/Visuals';
import { defaultEnd, readPhoneWrap } from './model';
import type { WrapPeriod } from '@siddiq3/driftless-contracts/domain';

const seenKey = (period: WrapPeriod, end: string) => `wrapped_seen_${period}_${end}`;
export function WrapEntry({ prompt = false }: { prompt?: boolean }) {
  const t = useTheme();
  const layout = useResponsiveLayout();
  const reduced = useReducedMotion();
  const [ready, setReady] = useState<{ period: WrapPeriod; end: string } | null>(null);
  const dismissing = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!prompt) return;
      let active = true;
      (async () => {
        const db = await getDb();
        // Weekly takes priority. Only locally measured periods trigger an unsolicited prompt.
        for (const period of ['weekly', 'daily'] as const) {
          const end = defaultEnd(period);
          const existing = await db.getFirstAsync(
            'SELECT value FROM settings WHERE key = ?',
            seenKey(period, end),
          );
          const recap = readPhoneWrap(period, end);
          if (!existing && (recap.views.value !== null || recap.minutes.value !== null)) {
            if (active) setReady({ period, end });
            break;
          }
        }
      })().catch(() => undefined);
      return () => {
        active = false;
      };
    }, [prompt]),
  );
  async function dismiss(open: boolean) {
    if (!ready || dismissing.current) return;
    dismissing.current = true;
    const selected = ready;
    try {
      await (
        await getDb()
      ).runAsync(
        'INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)',
        seenKey(selected.period, selected.end),
        'true',
      );
    } catch {
      // A failed reminder marker must not trap someone in a dialog or block their local recap.
    } finally {
      setReady(null);
      dismissing.current = false;
    }
    if (open) router.push({ pathname: '/wrapped', params: { period: selected.period } });
  }

  return (
    <>
      <View style={{ flexDirection: layout.stack ? 'column' : 'row', gap: 10 }}>
        {(['daily', 'weekly'] as const).map((period) => (
          <Pressable
            key={period}
            accessibilityRole="button"
            accessibilityLabel={`Open ${period} Wrapped`}
            onPress={() => router.push({ pathname: '/wrapped', params: { period } })}
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
      <Modal
        visible={!!ready}
        transparent
        animationType={reduced ? 'none' : 'fade'}
        onRequestClose={() => void dismiss(false)}
      >
        <ModalContent centered style={styles.card} onClose={() => void dismiss(false)}>
          <Svg
            pointerEvents="none"
            width="100%"
            height="100%"
            style={StyleSheet.absoluteFill}
            preserveAspectRatio="none"
          >
            <Defs>
              <LinearGradient id="ready" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#994E16" />
                <Stop offset="1" stopColor="#2B1608" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#ready)" rx={38} />
          </Svg>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss Wrapped"
            onPress={() => void dismiss(false)}
            style={styles.close}
          >
            <T style={{ fontSize: 26 }}>×</T>
          </Pressable>
          <T v="title" style={{ color: '#FFE9AD', textAlign: 'center', fontWeight: '900' }}>
            REELS WRAPPED
          </T>
          <BrainCharacter pose="wrapped" size={240} />
          <T style={{ textAlign: 'center', fontSize: 20 }}>
            Your {ready?.period === 'weekly' ? 'week' : 'day'} in reels is ready.
          </T>
          <SetupButton label="See my Wrapped" onPress={() => void dismiss(true)} />
        </ModalContent>
      </Modal>
    </>
  );
}
const styles = StyleSheet.create({
  card: {
    backgroundColor: '#6C350E',
    borderWidth: 1,
    borderColor: '#AD6C2D',
    borderRadius: 38,
    padding: 26,
    paddingTop: 52,
    gap: 22,
  },
  close: {
    position: 'absolute',
    right: 8,
    top: 8,
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
});
