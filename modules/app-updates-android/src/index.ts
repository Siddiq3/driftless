import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

export type UpdateState = {
  supported: boolean;
  required: boolean;
  installedVersion: number;
  requiredVersion: number;
  inProgress: boolean;
};
type NativeUpdates = {
  cachedState(): UpdateState;
  check(): Promise<UpdateState>;
  startUpdate(): Promise<'completed' | 'cancelled' | 'store'>;
};
const native =
  Platform.OS === 'android'
    ? requireOptionalNativeModule<NativeUpdates>('ScrollSnoozeAppUpdates')
    : null;
const unavailable: UpdateState = {
  supported: false,
  required: false,
  installedVersion: 0,
  requiredVersion: 0,
  inProgress: false,
};
export const AppUpdates = {
  cachedState: () => native?.cachedState() ?? unavailable,
  check: async () => (native ? native.check() : unavailable),
  startUpdate: async () => {
    if (!native) throw new Error('Google Play updates require an Android build.');
    return native.startUpdate();
  },
};
