import { Animated, Image, View } from 'react-native';
import { useIdleMotion } from './motion';
import { CharacterFace } from './CharacterFace';
import { EXPRESSION_TIMING, useCharacterExpression } from './characterMotion';
const assets = {
  wave: require('../../assets/branding/scrollsnooze/purple/fresh.png'),
  fresh: require('../../assets/branding/scrollsnooze/purple/fresh.png'),
  focused: require('../../assets/branding/scrollsnooze/purple/focused.png'),
  tired: require('../../assets/branding/scrollsnooze/purple/tired.png'),
  drained: require('../../assets/branding/scrollsnooze/purple/drained.png'),
  wrapped: require('../../assets/branding/scrollsnooze/purple/wrapped.png'),
  privacy: require('../../assets/branding/scrollsnooze/purple/privacy.png'),
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
  const emotion = pose === 'wave' ? 'fresh' : pose;
  const timing = EXPRESSION_TIMING[emotion];
  const idle = useIdleMotion(!still, timing.breathe);
  const face = useCharacterExpression(emotion, !still);
  return (
    <View style={{ width: size, aspectRatio: 1, maxWidth: '100%', alignSelf: 'center' }}>
      <Animated.View
        style={{
          flex: 1,
          transform: [
            {
              translateY: idle.interpolate({ inputRange: [0, 1], outputRange: [0, -timing.lift] }),
            },
            {
              rotate: idle.interpolate({
                inputRange: [0, 1],
                outputRange: emotion === 'drained' ? ['0deg', '1deg'] : ['-0.6deg', '0.6deg'],
              }),
            },
            {
              scaleY: idle.interpolate({
                inputRange: [0, 1],
                outputRange: [1, emotion === 'focused' ? 1.018 : 1.008],
              }),
            },
          ],
        }}
      >
        <Image
          source={assets[pose]}
          accessibilityLabel={`ScrollSnooze brain companion, ${pose === 'wave' ? 'fresh' : pose}`}
          resizeMode="contain"
          style={{ width: '100%', height: '100%' }}
        />
        <CharacterFace emotion={emotion} {...face} />
      </Animated.View>
    </View>
  );
}
