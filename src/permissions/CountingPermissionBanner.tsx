import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import type { TrackingHealth } from 'tracking-android';

/** In-app permission reminder; follows live native health when returning from Settings. */
export function CountingPermissionBanner({ health }: { health: TrackingHealth | null }) {
  if (
    !health?.implemented ||
    (health.disclosureAccepted && health.serviceEnabled && health.serviceRunning)
  )
    return null;
  const stopped = health.disclosureAccepted && health.serviceEnabled && !health.serviceRunning;
  return (
    <View style={{ backgroundColor: '#4D1D1A', width: '100%' }}>
      <View
        style={{
          width: '100%',
          maxWidth: 680,
          alignSelf: 'center',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 16,
          paddingHorizontal: 18,
          paddingVertical: 14,
        }}
      >
        <Text
          accessibilityLiveRegion="polite"
          style={{
            flex: 1,
            color: '#FFF7ED',
            fontSize: 16,
            lineHeight: 23,
            fontWeight: '600',
          }}
        >
          {stopped
            ? 'Counting has stopped. Review access to keep counting.'
            : 'Driftless needs permission to count Reels & Shorts.'}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={stopped ? 'Review counting access' : 'Allow counting permissions'}
          accessibilityHint="Opens the counting permission setup"
          onPress={() => router.push('/disclosure')}
          style={({ pressed }) => ({
            minWidth: 96,
            minHeight: 48,
            paddingHorizontal: 20,
            paddingVertical: 12,
            borderRadius: 32,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#FFFDF6',
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Text style={{ color: '#171912', fontSize: 17, lineHeight: 24, fontWeight: '800' }}>
            {stopped ? 'Review' : 'Allow'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
