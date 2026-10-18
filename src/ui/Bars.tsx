import { View } from 'react-native';
import { radius, space } from '../design-tokens';
import { T, useTheme } from './kit';

export type Bar = { key: string; label: string; value: number | null; over?: boolean };

/**
 * Accessible bar chart without a chart library. `null` = not tracked, drawn as a dashed gap,
 * never as zero. Each bar is announced individually to screen readers.
 */
export function Bars({ bars, unit, limit }: { bars: Bar[]; unit: string; limit?: number }) {
  const t = useTheme();
  const validLimit =
    limit !== undefined && Number.isFinite(limit) && limit >= 0 ? limit : undefined;
  const max = Math.max(1, validLimit ?? 0, ...bars.map((b) => b.value ?? 0));
  const H = 120;
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ height: H }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: H, gap: 6 }}>
          {bars.map((b) => {
            const h = b.value === null ? H * 0.3 : Math.max(2, (b.value / max) * H);
            return (
              <View
                key={b.key}
                accessible
                accessibilityLabel={`${b.label}: ${b.value === null ? 'not tracked' : `${b.value} ${unit}`}${b.over ? ', over goal' : ''}`}
                style={{
                  flex: 1,
                  height: h,
                  borderTopLeftRadius: radius.sm,
                  borderTopRightRadius: radius.sm,
                  borderBottomLeftRadius: 3,
                  borderBottomRightRadius: 3,
                  backgroundColor: b.value === null ? 'transparent' : b.over ? t.warning : t.accent,
                  borderWidth: b.value === null ? 1 : 0,
                  borderStyle: b.value === null ? 'dashed' : 'solid',
                  borderColor: t.border,
                }}
              />
            );
          })}
        </View>
        {validLimit !== undefined && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: (validLimit / max) * H,
              borderTopWidth: 1,
              borderStyle: 'dashed',
              borderColor: t.textMuted,
            }}
          />
        )}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: space.xs }}>
        <T v="caption" muted>
          {bars[0]?.label ?? ''}
        </T>
        <T v="caption" muted>
          {bars.at(-1)?.label ?? ''}
        </T>
      </View>
      {validLimit !== undefined && (
        <T v="caption" muted>
          Daily goal · {validLimit} {unit}
        </T>
      )}
    </View>
  );
}
