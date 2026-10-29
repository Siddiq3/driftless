import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { startupTheme as t, startupStyles as s } from '@/startup/theme';
import { STARTUP_HELP_DELAY_MS } from '@/startup/timing';

/** One quiet, truthful startup surface. Recovery is offered only if startup takes longer. */
export function StartupScreen({
  onSignOut,
  message = 'Opening saved progress…',
}: {
  onSignOut?: () => void;
  message?: string;
}) {
  const [delayed, setDelayed] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setDelayed(true), STARTUP_HELP_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);
  return (
    <LinearGradient
      colors={[t.warm, t.background]}
      start={{ x: 1, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={s.screen}
    >
      <SafeAreaView style={s.screen}>
        <ScrollView contentContainerStyle={s.content} bounces={false}>
          <View style={s.center}>
            <Image
              source={require('../../assets/branding/scrollsnooze/purple/fresh.png')}
              style={s.character}
              accessible={false}
              resizeMode="contain"
            />
            <Text accessibilityRole="header" style={s.title}>
              ScrollSnooze
            </Text>
            <View style={s.status} accessibilityLiveRegion="polite">
              <ActivityIndicator color={t.accent} accessible={false} />
              <Text style={s.message}>{message}</Text>
            </View>
            {delayed && (
              <View style={s.help}>
                <Text style={s.message}>
                  Taking longer than usual. Your saved phone data is retained.
                </Text>
                {onSignOut && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Sign out"
                    onPress={onSignOut}
                    style={({ pressed }) => [s.signOut, { opacity: pressed ? 0.6 : 1 }]}
                  >
                    <Text style={s.link}>Sign out</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}
