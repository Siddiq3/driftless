import type { WickStage } from '@siddiq3/driftless-contracts/domain';
import { Animated, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Stop } from 'react-native-svg';
import type { BrainMood } from './brainState';
import { useDataMotion, useIdleMotion } from './motion';

const STAGE_LABELS: Record<WickStage, string> = {
  ember: 'Ember',
  spark: 'Spark',
  flicker: 'Flicker',
  glow: 'Glow',
  beacon: 'Beacon',
  aurora: 'Aurora',
};
export function wickLabel(stage: WickStage) {
  return STAGE_LABELS[stage];
}

/** Original vector artwork: a warm, two-lobed brain with a tiny sprout of attention. */
export function Wick({
  stage,
  glow,
  size = 260,
  mood = 'idle',
  progress = null,
}: {
  stage: WickStage;
  glow: number;
  size?: number;
  mood?: BrainMood;
  progress?: number | null;
}) {
  const idle = useIdleMotion(mood !== 'unavailable');
  const transition = useDataMotion(`${stage}:${mood}:${progress}`);
  const tired = mood === 'high-usage' || mood === 'limit-reached';
  const off = mood === 'unavailable';
  const celebrate = mood === 'goal-reached';
  const ring = Math.max(0, Math.min(1, progress ?? 0));
  const color = tired ? '#FFAE94' : '#BEDC93';
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Wick brain, ${wickLabel(stage)}. ${mood.replaceAll('-', ' ')}${progress === null ? '. Allowance unavailable' : `. ${Math.round(progress * 100)} percent of daily allowance used`}`}
      style={{ width: size, height: size, maxWidth: '100%', alignSelf: 'center' }}
    >
      <Svg width="100%" height="100%" viewBox="0 0 320 320" accessible={false}>
        <Circle
          cx={160}
          cy={155}
          r={132}
          fill="#C4A0FF"
          opacity={off ? 0.025 : 0.045 + Math.min(1, Math.max(0, glow)) * 0.03}
        />
        <Circle
          cx={160}
          cy={155}
          r={125}
          fill="none"
          stroke="#493A63"
          strokeWidth={1}
          strokeDasharray="2 9"
        />
        <Circle cx={160} cy={155} r={139} fill="none" stroke="#30264E" strokeWidth={4} />
        <Ellipse cx={160} cy={279} rx={61} ry={7} fill="#000" opacity={0.22} />
        <Path d="m55 85 3-8 3 8 8 3-8 3-3 8-3-8-8-3Z" fill="#C4A0FF" opacity={0.6} />
        <Circle cx={265} cy={212} r={3} fill={color} opacity={0.7} />
        <Path d="M244 64v10m-5-5h10" stroke={color} strokeWidth={2} strokeLinecap="round" />
        {celebrate && (
          <G stroke="#BEDC93" strokeWidth={3} strokeLinecap="round">
            <Path d="m64 43 6 8m183-12-4 9M157 9v9m122 122 10-3M27 171l10-2" />
          </G>
        )}
      </Svg>
      <Animated.View
        pointerEvents="none"
        style={{ position: 'absolute', inset: 0, opacity: transition.opacity }}
      >
        <Svg width="100%" height="100%" viewBox="0 0 320 320" accessible={false}>
          {progress !== null && (
            <Circle
              cx={160}
              cy={155}
              r={139}
              fill="none"
              stroke={color}
              strokeWidth={4}
              strokeLinecap="round"
              strokeDasharray={`${ring * 873.36} 873.36`}
              rotation={-90}
              origin="160, 155"
            />
          )}
        </Svg>
      </Animated.View>
      <Animated.View
        style={{
          position: 'absolute',
          inset: 0,
          opacity: transition.opacity,
          transform: [
            { translateY: idle.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) },
            { scale: idle.interpolate({ inputRange: [0, 1], outputRange: [1, 1.015] }) },
          ],
        }}
      >
        <Svg width="100%" height="100%" viewBox="0 0 320 320" accessible={false}>
          <Defs>
            <LinearGradient id="brain" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={off ? '#C3AAA0' : '#FFE0B3'} />
              <Stop offset="1" stopColor={tired ? '#D88B7E' : off ? '#9F8176' : '#ECAB80'} />
            </LinearGradient>
          </Defs>
          <G stroke="#8E5945" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
            <Path
              d="M148 245c-14 16-49 9-55-10-25 2-40-16-38-38-20-15-21-44-7-60-7-22 4-46 25-52 3-24 25-38 48-30 13-14 33-10 39 2 7-12 28-16 40-2 24-8 45 6 48 30 23 6 33 30 26 52 15 17 14 45-6 60 2 22-13 40-38 38-7 20-40 26-55 10Z"
              fill="url(#brain)"
            />
            <Path
              d="M160 60v77m0 85v22M120 57c-17 9-20 25-13 40M74 85c22-2 37 11 35 28M49 137c20-10 37-3 40 11M56 197c1-21 14-30 30-29M94 234c-7-18-1-34 15-40M199 57c16 9 19 25 12 40m36-12c-22-2-37 11-35 28m60 24c-20-10-37-3-40 11m35 49c-1-21-14-30-30-29m-11 66c7-18 1-34-15-40M128 111c-14 0-23 8-22 20m86-20c14 0 23 8 22 20"
              fill="none"
              opacity={0.65}
            />
          </G>
          <Path
            d="M158 51c-10-22-2-37 5-43 8 15 10 27-5 43"
            fill="#BEDC93"
            stroke="#637C47"
            strokeWidth={2}
          />
          <Path
            d="M160 49c8-17 22-23 34-19-4 15-16 24-34 19"
            fill="#D7E9AD"
            stroke="#637C47"
            strokeWidth={2}
          />
          <Ellipse cx={107} cy={190} rx={15} ry={8} fill="#D97E77" opacity={off ? 0.18 : 0.45} />
          <Ellipse cx={213} cy={190} rx={15} ry={8} fill="#D97E77" opacity={off ? 0.18 : 0.45} />
          {tired || off ? (
            <G fill="none" stroke="#493A63" strokeWidth={5} strokeLinecap="round">
              <Path d={off ? 'M116 170h17m54 0h17' : 'm116 168 17 5m54 0 17-5'} />
            </G>
          ) : (
            <G fill="#493A63">
              <Ellipse cx={125} cy={170} rx={6} ry={9} />
              <Ellipse cx={195} cy={170} rx={6} ry={9} />
              <Circle cx={127} cy={167} r={2} fill="#F7F2FF" />
              <Circle cx={197} cy={167} r={2} fill="#F7F2FF" />
            </G>
          )}
          <Path
            d={tired ? 'M150 206q10-6 20 0' : off ? 'M152 203h16' : 'M145 199q15 18 30 0'}
            fill="none"
            stroke="#493A63"
            strokeWidth={4}
            strokeLinecap="round"
          />
          <Path
            d="m119 251-5 14m87-14 5 14"
            stroke="#D8A481"
            strokeWidth={6}
            strokeLinecap="round"
          />
        </Svg>
      </Animated.View>
    </View>
  );
}
