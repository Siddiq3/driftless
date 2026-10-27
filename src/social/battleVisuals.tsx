import { View } from 'react-native';
import { T } from '@/ui/kit';
export function Avatar({
  name,
  size = 46,
  color = '#008E80',
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  return (
    <View
      style={{
        height: size,
        width: size,
        borderRadius: size / 2,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <T
        allowFontScaling={false}
        style={{ fontSize: size * 0.5, lineHeight: size * 0.65, color: '#FFF', fontWeight: '500' }}
      >
        {[...name.trim()][0]?.toUpperCase() || '?'}
      </T>
    </View>
  );
}
