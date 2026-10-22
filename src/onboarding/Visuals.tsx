import { useId, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { BrainCharacter } from '@/ui/BrainCharacter';
import { T } from '@/ui/kit';
import { useIdleMotion } from '@/ui/motion';

export const SETUP_COLORS = {
  bg: '#10102B',
  surface: '#29213F',
  text: '#F7F2FF',
  muted: '#B9AFCB',
  accent: '#C4A0FF',
  brown: '#241642',
  teal: '#60418C',
};
export function SetupButton({
  label,
  onPress,
  secondary = false,
  busy = false,
  google = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  busy?: boolean;
  google?: boolean;
}) {
  const gradientId = `cta-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy, disabled: busy }}
      disabled={busy}
      onPress={onPress}
      onLayout={({ nativeEvent: { layout } }) => {
        setBounds((previous) =>
          previous.width === layout.width && previous.height === layout.height
            ? previous
            : { width: layout.width, height: layout.height },
        );
      }}
      style={({ pressed }) => ({
        minHeight: 60,
        borderRadius: 40,
        overflow: 'hidden',
        justifyContent: 'center',
        backgroundColor: secondary ? SETUP_COLORS.surface : SETUP_COLORS.accent,
        opacity: pressed || busy ? 0.75 : 1,
      })}
    >
      {!secondary && bounds.width > 0 && bounds.height > 0 && (
        <Svg
          pointerEvents="none"
          accessible={false}
          width={bounds.width}
          height={bounds.height}
          viewBox="0 0 100 100"
          style={{ position: 'absolute', top: 0, left: 0 }}
          preserveAspectRatio="none"
        >
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#E4C5FF" />
              <Stop offset="1" stopColor="#C4A0FF" />
            </LinearGradient>
          </Defs>
          <Rect width={100} height={100} fill={`url(#${gradientId})`} />
        </Svg>
      )}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          minHeight: 60,
          paddingHorizontal: 20,
          paddingVertical: 16,
        }}
      >
        <T
          style={{
            color: secondary ? SETUP_COLORS.text : SETUP_COLORS.brown,
            fontWeight: '800',
            fontSize: 18,
            lineHeight: 26,
            textAlign: 'center',
            flexShrink: 1,
          }}
        >
          {busy ? 'One moment…' : label}
        </T>
        {google && (
          <Image
            source={require('../../assets/brands/google.png')}
            accessible={false}
            style={{ width: 26, height: 26 }}
          />
        )}
      </View>
    </Pressable>
  );
}
export function WidgetPreview() {
  return (
    <View
      style={{
        width: '84%',
        aspectRatio: 0.85,
        maxHeight: 320,
        alignSelf: 'center',
        borderRadius: 30,
        overflow: 'hidden',
        backgroundColor: SETUP_COLORS.teal,
      }}
    >
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="widget" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#382455" />
            <Stop offset="1" stopColor="#64418B" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#widget)" />
      </Svg>
      <View style={{ padding: 24, gap: 2 }}>
        <T
          accessibilityRole="text"
          style={{ fontSize: 68, lineHeight: 78, fontWeight: '900', color: '#FFFFFF' }}
        >
          12
        </T>
        <T style={{ fontSize: 18, color: '#F1E4FF' }}>short videos today</T>
        <T v="caption" style={{ color: '#F1E4FF' }}>
          Widget preview
        </T>
      </View>
      <View style={{ position: 'absolute', bottom: -18, right: -25 }}>
        <BrainCharacter size={170} />
      </View>
    </View>
  );
}
export function ChallengeArtwork() {
  const idle = useIdleMotion();
  return (
    <Animated.Image
      source={require('../../assets/branding/scrollsnooze/purple/friends.png')}
      accessibilityLabel="Two friends and their brain companions"
      resizeMode="contain"
      style={{
        width: '100%',
        height: 330,
        transform: [{ translateY: idle.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }],
      }}
    />
  );
}
export function PrivacyArtwork() {
  return (
    <View
      style={{
        width: '84%',
        alignSelf: 'center',
        maxWidth: 300,
        height: 330,
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
        borderWidth: 6,
        borderBottomWidth: 0,
        borderColor: '#211C3D',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <BrainCharacter pose="privacy" size={230} />
    </View>
  );
}
