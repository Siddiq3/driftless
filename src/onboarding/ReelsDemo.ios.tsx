import { View } from 'react-native';
import { BrainCharacter } from '@/ui/BrainCharacter';

/** Reuse the app's character without loading Android's native reels preview. */
export function ReelsDemo({ height }: { height: number }) {
  return (
    <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
      <BrainCharacter size={Math.min(height, 280)} />
    </View>
  );
}
