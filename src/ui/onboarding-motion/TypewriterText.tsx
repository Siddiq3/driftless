import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, type TextStyle, type TextLayoutLine } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { ONBOARDING_MOTION as M } from './constants';

export function useTypewriter(
  text: string,
  msPerWord: number = M.wordDelay,
  {
    active = true,
    reducedMotion = false,
    paused = false,
    onDone,
  }: {
    active?: boolean;
    reducedMotion?: boolean;
    paused?: boolean;
    onDone?: () => void;
  } = {},
) {
  const words = useMemo(() => text.match(/\S+\s*/g) ?? [], [text]);
  const elapsed = useSharedValue(-1);
  const run = useMemo(
    () => ({ text, active, reducedMotion, msPerWord }),
    [text, active, reducedMotion, msPerWord],
  );
  const [done, setDone] = useState<object | null>(null);
  const callback = useRef(onDone);
  useEffect(() => {
    callback.current = onDone;
  }, [onDone]);
  useEffect(() => {
    cancelAnimation(elapsed);
    if (paused) return;
    elapsed.value = -1;
    if (!active) return;
    const duration = reducedMotion
      ? M.reducedFade
      : Math.max(0, words.length - 1) * msPerWord + M.wordFade;
    elapsed.value = withTiming(duration, { duration, easing: Easing.linear });
    const timer = setTimeout(() => {
      setDone(run);
      callback.current?.();
    }, duration);
    return () => {
      clearTimeout(timer);
      cancelAnimation(elapsed);
    };
  }, [active, elapsed, msPerWord, paused, reducedMotion, run, words.length]);
  return { words, elapsed, isTyping: active && !paused && done !== run };
}

function Word({
  word,
  index,
  elapsed,
  msPerWord,
  normal,
  reducedMotion,
  textStyle,
}: {
  word: string;
  index: number;
  elapsed: SharedValue<number>;
  msPerWord: number;
  normal: boolean;
  reducedMotion: boolean;
  textStyle: TextStyle;
}) {
  const style = useAnimatedStyle(() => {
    const age = elapsed.value - index * msPerWord;
    return {
      opacity: reducedMotion
        ? normal
          ? Math.max(0, Math.min(1, elapsed.value / M.reducedFade))
          : 0
        : age < 0
          ? 0
          : normal
            ? Math.min(1, age / M.wordFade)
            : 1,
    };
  });
  return (
    <Animated.Text
      accessible={false}
      numberOfLines={1}
      maxFontSizeMultiplier={2}
      style={[textStyle, style]}
    >
      {word.trimEnd()}
    </Animated.Text>
  );
}

/** Native paragraph measurement reserves the exact wrapping and height up front.
 * Words are real Text views: virtual inline spans cannot animate opacity in Fabric.
 * Invisible prefixes measure native shaping/spacing once, without animating layout. */
export function TypewriterText({
  text,
  active,
  reducedMotion,
  paused = false,
  onDone,
  style,
  mutedColor,
  msPerWord = M.wordDelay,
}: {
  text: string;
  active: boolean;
  paused?: boolean;
  reducedMotion: boolean;
  onDone: () => void;
  style: TextStyle;
  mutedColor: string;
  msPerWord?: number;
}) {
  const [paragraph, setParagraph] = useState<{ text: string; lines: TextLayoutLine[] } | null>(
    null,
  );
  const [prefixWidths, setPrefixWidths] = useState<Record<string, number>>({});
  const positionedWords = useMemo(() => {
    const lines = paragraph?.text === text ? paragraph.lines : [];
    let index = 0;
    return lines.flatMap((line, row) => {
      let prefix = '';
      return (line.text.match(/\S+\s*/g) ?? []).map((word, column) => {
        const item = {
          word,
          index: index++,
          prefix,
          id: `${text}:${row}:${column}`,
          x: line.x,
          y: line.y,
        };
        prefix += word;
        return item;
      });
    });
  }, [paragraph, text]);
  const measured =
    positionedWords.length > 0 &&
    positionedWords.every((word) => !word.prefix || prefixWidths[word.id] !== undefined);
  const { elapsed } = useTypewriter(text, msPerWord, {
    active: active && (reducedMotion || measured),
    reducedMotion,
    paused,
    onDone,
  });
  const fadeStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, Math.min(1, elapsed.value / M.reducedFade)),
  }));
  return (
    <View accessible accessibilityRole="text" accessibilityLabel={active ? text : undefined}>
      <View
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
      >
        <Text
          maxFontSizeMultiplier={2}
          style={[style, { opacity: 0 }]}
          onTextLayout={({ nativeEvent }) => {
            const next = { text, lines: nativeEvent.lines };
            setParagraph((previous) =>
              JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
            );
          }}
        >
          {text}
        </Text>
        {reducedMotion ? (
          <Animated.Text
            maxFontSizeMultiplier={2}
            style={[style, StyleSheet.absoluteFill, fadeStyle]}
          >
            {text}
          </Animated.Text>
        ) : (
          positionedWords.map((word) => (
            <View key={word.id} style={StyleSheet.absoluteFill}>
              {word.prefix !== '' && (
                <Text
                  maxFontSizeMultiplier={2}
                  numberOfLines={1}
                  style={[style, { position: 'absolute', top: 0, left: 0, opacity: 0 }]}
                  onTextLayout={({ nativeEvent }) => {
                    const width = nativeEvent.lines[0]?.width;
                    if (width === undefined) return;
                    setPrefixWidths((previous) =>
                      previous[word.id] === width ? previous : { ...previous, [word.id]: width },
                    );
                  }}
                >
                  {word.prefix}
                </Text>
              )}
              {[false, true].map((normal) => (
                <Word
                  key={String(normal)}
                  {...word}
                  {...{ elapsed, msPerWord, normal, reducedMotion }}
                  textStyle={{
                    ...style,
                    position: 'absolute',
                    top: word.y,
                    left: word.x + (prefixWidths[word.id] ?? 0),
                    color: normal ? style.color : mutedColor,
                  }}
                />
              ))}
            </View>
          ))
        )}
      </View>
    </View>
  );
}
