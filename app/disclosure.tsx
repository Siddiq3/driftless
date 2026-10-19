import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Tracking } from 'tracking-android';
import { Notice, T } from '@/ui/kit';
import { SetupButton, SETUP_COLORS as C } from '@/onboarding/Visuals';
import { AccessibilityWalkthrough } from '@/permissions/AccessibilityWalkthrough';

/** Prominent consent remains visible before opening Android's real permission screen. */
export default function Disclosure() {
  const [error, setError] = useState<string | null>(null);
  const [alreadyAgreed] = useState(() => {
    try {
      return Tracking.health().disclosureAccepted;
    } catch {
      return false;
    }
  });
  const agree = () => {
    try {
      Tracking.setDisclosureAccepted(true);
      Tracking.openAccessibilityGuide();
      router.back();
    } catch {
      setError('Android settings could not be opened. Please try again.');
    }
  };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#666666' }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 16 }}>
        <View
          style={{
            width: '100%',
            maxWidth: 440,
            alignSelf: 'center',
            borderRadius: 20,
            overflow: 'hidden',
            backgroundColor: C.surface,
            paddingBottom: 16,
            gap: 12,
          }}
        >
          <AccessibilityWalkthrough />
          {!alreadyAgreed && (
            <T style={{ color: '#E3DFD1', fontSize: 12, lineHeight: 17, paddingHorizontal: 16 }}>
              Driftless reads Instagram and YouTube player layouts and video labels to count reels.
              Labels become one-way codes; only counts and times are saved on this phone. No
              messages, passwords or screenshots. Optional cloud sync shares daily totals only.
            </T>
          )}
          {error && <Notice tone="warn" title="Please try again" body={error} />}
          <View style={{ paddingHorizontal: 16, gap: 4 }}>
            <SetupButton label={alreadyAgreed ? 'Got it' : 'Got it · I agree'} onPress={agree} />
            <Pressable
              onPress={() => router.back()}
              accessibilityLabel="Not now"
              accessibilityRole="button"
              style={{ minHeight: 48, justifyContent: 'center' }}
            >
              <T style={{ color: C.muted, textAlign: 'center' }}>Not now</T>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
