import { Animated, Image, type ImageStyle } from 'react-native';
import { BrainCharacter } from './BrainCharacter';
import { useIdleMotion } from './motion';

const illustrations = {
  wick: require('../../assets/branding/scrollsnooze/purple/fresh.png'),
  focus: require('../../assets/branding/scrollsnooze/purple/focused.png'),
  friends: require('../../assets/branding/scrollsnooze/purple/friends.png'),
};

export function Illustration({
  name,
  size = 160,
  label,
  style,
}: {
  name: keyof typeof illustrations;
  size?: number;
  label?: string;
  style?: ImageStyle;
}) {
  const idle = useIdleMotion(name === 'friends');
  if (name !== 'friends') {
    return (
      <Animated.View style={style} accessible={!!label} accessibilityLabel={label}>
        <BrainCharacter pose={name === 'focus' ? 'focused' : 'fresh'} size={size} />
      </Animated.View>
    );
  }
  return (
    <Animated.View
      style={{
        transform: [{ translateY: idle.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }],
      }}
    >
      <Image
        source={illustrations[name]}
        resizeMode="contain"
        accessible={!!label}
        accessibilityLabel={label}
        style={[{ width: size, height: size }, style]}
      />
    </Animated.View>
  );
}
