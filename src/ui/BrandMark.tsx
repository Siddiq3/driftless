import { Image } from 'react-native';

/** Shared ScrollSnooze identity, matched to the illustrated brain companion. */
export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <Image
      source={require('../../assets/branding/app-icon.png')}
      accessible={false}
      resizeMode="contain"
      style={{ width: size, height: size, borderRadius: size * 0.27, backgroundColor: '#FFE6AD' }}
    />
  );
}
