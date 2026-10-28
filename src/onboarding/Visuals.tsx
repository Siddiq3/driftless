import { useEffect, useId, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import Reanimated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { ONBOARDING_MOTION as M } from '@/ui/onboarding-motion/constants';
import { Animated, Image, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { BrainCharacter } from '@/ui/BrainCharacter';
import { T } from '@/ui/kit';
import { useIdleMotion } from '@/ui/motion';

export const SETUP_COLORS = {
  bg: '#0B0B08',
  surface: '#29271F',
  text: '#FFFFF8',
  muted: '#B4B3AA',
  accent: '#FFD18E',
  brown: '#4B2C0C',
  teal: '#126D70',
};
export function SetupButton({
  label,
  onPress,
  secondary = false,
  busy = false,
  google = false,
  disabled = false,
  animate = false,
  reducedMotion = true,
}: {
  label: string;
  onPress: () => void | Promise<void>;
  secondary?: boolean;
  busy?: boolean;
  google?: boolean;
  disabled?: boolean;
  animate?: boolean;
  reducedMotion?: boolean;
}) {
  const gradientId = `cta-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const pressed = useSharedValue(1);
  const enabled = useSharedValue(disabled ? 0 : 1);
  const tapping = useRef(false);
  useEffect(() => {
    enabled.value = withTiming(disabled ? 0 : 1, {
      duration: reducedMotion ? M.reducedFade : M.buttonFade,
    });
    return () => cancelAnimation(enabled);
  }, [disabled, enabled, reducedMotion]);
  useEffect(() => () => cancelAnimation(pressed), [pressed]);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: pressed.value }] }));
  const disabledStyle = useAnimatedStyle(() => ({ opacity: (1 - enabled.value) * 0.55 }));
  return (
    <Reanimated.View style={animate ? pressStyle : undefined}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ busy, disabled: busy || disabled }}
        disabled={busy || disabled}
        onPressIn={() => {
          if (animate && !reducedMotion)
            pressed.set(withTiming(M.buttonPressScale, { duration: M.selectionDown }));
        }}
        onPressOut={() => {
          if (animate) pressed.set(withTiming(1, { duration: M.selectionUp }));
        }}
        onPress={() => {
          if (busy || disabled || tapping.current) return;
          if (animate) {
            tapping.current = true;
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
          }
          try {
            const result = onPress();
            void Promise.resolve(result).finally(() => {
              tapping.current = false;
            });
          } catch (error) {
            tapping.current = false;
            throw error;
          }
        }}
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
                <Stop offset="0" stopColor="#FFE8AD" />
                <Stop offset="1" stopColor="#FFB763" />
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
        {animate && (
          <Reanimated.View
            pointerEvents="none"
            accessible={false}
            style={[StyleSheet.absoluteFill, { backgroundColor: SETUP_COLORS.bg }, disabledStyle]}
          />
        )}
      </Pressable>
    </Reanimated.View>
  );
}
export function WidgetPreview() {
  return (
    <View
      style={{
        width: '84%',
        minHeight: 240,
        maxWidth: 300,
        alignSelf: 'center',
        borderRadius: 30,
        overflow: 'hidden',
        backgroundColor: SETUP_COLORS.teal,
      }}
    >
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="widget" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#104E56" />
            <Stop offset="1" stopColor="#2E9486" />
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
        <T style={{ fontSize: 18, color: '#DDF4EE' }}>short videos today</T>
        <T v="caption" style={{ color: '#DDF4EE' }}>
          Widget preview
        </T>
      </View>
      <View style={{ alignSelf: 'flex-end' }}>
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
        aspectRatio: 1,
        maxHeight: 330,
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
        aspectRatio: 0.85,
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
        borderWidth: 6,
        borderBottomWidth: 0,
        borderColor: '#191915',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <BrainCharacter pose="privacy" size={230} />
    </View>
  );
}
