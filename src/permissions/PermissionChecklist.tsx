import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import type { TrackingHealth } from 'tracking-android';
import { Icon } from '@/ui/Icon';
import { T } from '@/ui/kit';
import { SetupButton, SETUP_COLORS as C } from '@/onboarding/Visuals';

export function PermissionChecklist({ health }: { health: TrackingHealth | null }) {
  const ready = !!health?.serviceRunning;
  return (
    <View style={{ gap: 24, paddingTop: 18, paddingBottom: 30 }}>
      {['Display over other apps', 'Background counting'].map((label) => (
        <View
          key={label}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 }}
        >
          <View style={{ flex: 1, gap: 4 }}>
            <T style={{ color: ready ? C.text : '#9A9B91', fontWeight: '800', fontSize: 17 }}>
              {label}
            </T>
            <T v="caption" style={{ color: C.muted }}>
              {ready ? 'Ready' : 'Included with accessibility'}
            </T>
          </View>
          <View
            accessibilityLabel={
              ready ? `${label}: ready` : `${label}: provided when accessibility is enabled`
            }
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: ready ? C.accent : '#858A80',
            }}
          >
            <Icon name={ready ? 'check' : 'shield'} color="#171912" size={23} />
          </View>
        </View>
      ))}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64 }}>
        <View style={{ flex: 1, gap: 5 }}>
          <T style={{ color: C.text, fontWeight: '800', fontSize: 19 }}>Accessibility</T>
          <T style={{ color: C.muted, fontSize: 15 }}>To count reels</T>
        </View>
        {ready ? (
          <Icon name="check" color={C.accent} size={32} />
        ) : (
          <SetupButton
            label={health?.serviceEnabled ? 'Review' : 'Allow'}
            onPress={() => router.push('/disclosure')}
          />
        )}
      </View>
    </View>
  );
}

export function PermissionHelpButton() {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push('/disclosure')}
      style={{
        minHeight: 56,
        borderRadius: 32,
        backgroundColor: C.surface,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <Icon name="shield" color={C.accent} size={25} />
      <T style={{ color: C.text, flex: 1, fontSize: 14, fontWeight: '700' }}>
        Why should I give this permission?
      </T>
      <Icon name="chevron" color={C.text} size={18} />
    </Pressable>
  );
}
