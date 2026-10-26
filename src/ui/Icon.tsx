import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { Image, View } from 'react-native';

export type IconName =
  | 'home'
  | 'counter'
  | 'flame'
  | 'chart'
  | 'friends'
  | 'war'
  | 'lock'
  | 'target'
  | 'shield'
  | 'settings'
  | 'chevron'
  | 'back'
  | 'check'
  | 'trophy'
  | 'clock'
  | 'play'
  | 'help'
  | 'cloud'
  | 'trash';
const paths: Partial<Record<IconName, string>> = {
  home: 'M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
  counter: 'M5 4v4M5 12v8M12 4v9M12 17v3M19 4v2M19 10v10M3 8h4M10 13h4M17 6h4',
  flame:
    'M13 2c1 5-4 6-2 10 2-1 3-3 3-5 5 4 6 7 4 11-3 5-11 5-13-1C3 12 7 7 9 5c-1 4 0 5 1 6 2-3 3-5 3-9Z',
  chart: 'M4 20V10M12 20V4M20 20v-7',
  friends: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87M16 3a4 4 0 0 1 0 8',
  war: 'M3 3l6 2 8 10-2 2L5 9ZM21 3l-6 2-8 10 2 2L19 9ZM12 17l5-5M7 12l5 5M16 16l5 5M8 16l-5 5M18 21l3-3M3 18l3 3',
  lock: 'M7 10V7a5 5 0 0 1 10 0v3M12 14v3',
  target: 'm12 12 8-8M16 4h4v4',
  shield: 'M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6Z M8 12l3 3 5-6',
  settings:
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M10 2h4l1 3 3 1 3 1v4l-2 1 1 3 1 3-3 3-3-1-3 2-2-2-3 1-3-3 1-3-1-3 2-2 1-3Z',
  chevron: 'm9 5 7 7-7 7',
  back: 'm15 5-7 7 7 7',
  check: 'm5 12 4 4L19 6',
  trophy: 'M8 3h8v6a4 4 0 0 1-8 0ZM8 5H4v3a4 4 0 0 0 4 4M16 5h4v3a4 4 0 0 1-4 4M12 13v6M8 21h8',
  clock: 'M12 6v6l4 2',
  play: 'm9 6 10 6-10 6Z',
  help: 'M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3M12 17h.01',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
  cloud: 'M6 19a5 5 0 1 1 1-10 6 6 0 0 1 12-1 5 5 0 0 1-1 11Z',
};

export function Icon({
  name,
  size = 24,
  color = '#FFE8B0',
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessible={false}
    >
      {(name === 'clock' || name === 'help') && <Circle cx={12} cy={12} r={9} />}
      {name === 'target' && (
        <>
          <Circle cx={12} cy={12} r={9} />
          <Circle cx={12} cy={12} r={5} />
        </>
      )}
      {name === 'friends' && <Circle cx={9} cy={7} r={4} />}
      {name === 'lock' && <Rect x={4} y={10} width={16} height={11} rx={3} />}
      <Path d={paths[name]} />
    </Svg>
  );
}

/** Compatibility for existing tiles while using a consistent vector icon family. */
export function iconForMark(mark: string): IconName {
  return (
    (
      {
        '◉': 'home',
        '▥': 'counter',
        '✦': 'flame',
        '▤': 'chart',
        '♡': 'friends',
        '⚔': 'war',
        Ⅱ: 'lock',
        '◎': 'target',
        '⚑': 'trophy',
        '◇': 'shield',
        '↗': 'chart',
      } as Record<string, IconName>
    )[mark] ?? 'flame'
  );
}

export function AppIcon({ name, size = 40 }: { name: string; size?: number }) {
  const youtube = /youtube|shorts/i.test(name);
  const instagram = /instagram/i.test(name);
  if (instagram)
    return (
      <Image
        source={require('../../assets/brands/instagram.png')}
        accessibilityLabel="Instagram"
        style={{ width: size, height: size }}
      />
    );
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        backgroundColor: youtube ? '#DB2222' : instagram ? '#B73287' : '#3A2915',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {youtube ? (
        <Svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24">
          <Path d="m9 5 11 7-11 7Z" fill="#FFF" />
        </Svg>
      ) : instagram ? (
        <Svg
          width={size * 0.65}
          height={size * 0.65}
          viewBox="0 0 24 24"
          stroke="#FFF"
          fill="none"
          strokeWidth={2}
        >
          <Rect x={3} y={3} width={18} height={18} rx={5} />
          <Circle cx={12} cy={12} r={4} />
          <Circle cx={17.5} cy={6.5} r={1} fill="#FFF" />
        </Svg>
      ) : (
        <Icon name="play" size={size * 0.6} />
      )}
    </View>
  );
}
