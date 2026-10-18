import { Image, type ImageStyle } from 'react-native';

const illustrations = {
  wick: require('../../assets/illustrations/wick.png'),
  focus: require('../../assets/illustrations/focus.png'),
  friends: require('../../assets/illustrations/friends.png'),
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
  return (
    <Image
      source={illustrations[name]}
      resizeMode="contain"
      accessible={!!label}
      accessibilityLabel={label}
      style={[{ width: size, height: size }, style]}
    />
  );
}
