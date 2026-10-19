import { Animated, Image, View } from 'react-native';
import { useIdleMotion } from './motion';
const assets = {
  wrapped: require('../../assets/illustrations/brain-wrapped.png'),
  wave: require('../../assets/illustrations/brain-wave.png'),
  privacy: require('../../assets/illustrations/brain-privacy.png'),
  tired: require('../../assets/illustrations/brain-tired.png'),
};
/** Illustrated character with restrained native-driver motion, never a flattened screen image. */
export function BrainCharacter({
  pose = 'wave',
  size = 240,
  still = false,
}: {
  pose?: keyof typeof assets;
  size?: number;
  still?: boolean;
}) {
  const idle = useIdleMotion(!still);
  return (
    <View style={{ width: size, height: size, maxWidth: '100%', alignSelf: 'center' }}>
      <Animated.View
        style={{
          flex: 1,
          transform: [
            { translateY: idle.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) },
            { rotate: idle.interpolate({ inputRange: [0, 1], outputRange: ['-1deg', '1deg'] }) },
          ],
        }}
      >
        <Image
          source={assets[pose]}
          accessibilityLabel="Driftless brain companion"
          resizeMode="contain"
          style={{ width: '100%', height: '100%' }}
        />
      </Animated.View>
    </View>
  );
}
