import { useId } from 'react';
import Svg, { ClipPath, Defs, Ellipse, G, LinearGradient, Path, Stop } from 'react-native-svg';
import type { CharacterEmotion } from './characterMotion';

// Coordinates measured against each 1254 × 1254 transparent master.
const EYES = {
  fresh: [
    [426, 548, 591, 693, -20],
    [728, 506, 883, 652, -18],
  ],
  drained: [
    [426, 651, 592, 726, -34],
    [718, 610, 892, 684, -15],
  ],
  tired: [
    [469, 626, 594, 699, -30],
    [722, 568, 888, 654, -19],
  ],
  wrapped: [
    [421, 590, 585, 690, -22],
    [720, 546, 887, 658, -20],
  ],
  privacy: [
    [424, 565, 590, 694, -18],
    [730, 517, 886, 652, -18],
  ],
  focused: [],
} as const;

/** Transparent facial layer: only the eye openings and mouth move, not rectangular image patches. */
export function CharacterFace({
  emotion,
  blink,
  expression,
}: {
  emotion: CharacterEmotion;
  blink: number;
  expression: number;
}) {
  const id = useId().replace(/:/g, '');
  return (
    <Svg
      pointerEvents="none"
      accessible={false}
      style={{ position: 'absolute', inset: 0 }}
      width="100%"
      height="100%"
      viewBox="0 0 1254 1254"
    >
      <Defs>
        <LinearGradient id={`${id}lid`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#C4A0FF" />
          <Stop offset="1" stopColor="#D899EF" />
        </LinearGradient>
        {EYES[emotion].map(([left, top, right, bottom, tilt], index) => (
          <ClipPath key={index} id={`${id}eye${index}`}>
            <Path
              d={`M ${left} ${top} Q ${(left + right) / 2} ${top + tilt} ${right} ${top + tilt} Q ${right + 6} ${bottom + 12} ${(left + right) / 2} ${bottom} Q ${left - 4} ${bottom} ${left} ${top} Z`}
            />
          </ClipPath>
        ))}
      </Defs>
      {blink > 0 &&
        EYES[emotion].map(([left, top, right, bottom, tilt], index) => {
          const edge = top + (bottom - top + 32) * blink;
          return (
            <G key={index} clipPath={`url(#${id}eye${index})`}>
              <Path
                d={`M ${left - 10} ${top - 40} H ${right + 10} V ${edge + tilt} Q ${(left + right) / 2} ${edge + 14} ${left - 10} ${edge} Z`}
                fill={`url(#${id}lid)`}
              />
              <Path
                d={`M ${left - 10} ${edge} Q ${(left + right) / 2} ${edge + 14} ${right + 10} ${edge + tilt}`}
                fill="none"
                stroke="#241642"
                strokeWidth={8}
                strokeLinecap="round"
              />
            </G>
          );
        })}
      {expression > 0 && emotion === 'tired' && (
        <G opacity={expression}>
          <Ellipse cx={666} cy={711} rx={46} ry={51 + 14 * expression} fill="#392056" />
          <Ellipse cx={666} cy={740 + 8 * expression} rx={30} ry={17} fill="#C878DC" />
        </G>
      )}
      {expression > 0 && emotion === 'drained' && (
        <G opacity={expression}>
          <Ellipse cx={664} cy={711} rx={43} ry={28} fill={`url(#${id}lid)`} />
          <Path
            d={`M 637 719 Q 664 ${680 - 10 * expression} 691 719`}
            fill="none"
            stroke="#241642"
            strokeWidth={10}
            strokeLinecap="round"
          />
        </G>
      )}
      {expression > 0 && emotion !== 'drained' && emotion !== 'tired' && emotion !== 'focused' && (
        <G opacity={expression * 0.35}>
          <Ellipse cx={434} cy={714} rx={36} ry={19} fill="#D899EF" />
          <Ellipse cx={872} cy={683} rx={36} ry={19} fill="#D899EF" />
        </G>
      )}
    </Svg>
  );
}
