import { requireOptionalNativeModule } from 'expo';
export type ScreenTimeStatus = {
  authorization: 'approved' | 'denied' | 'notDetermined';
  selectedCount: number;
  paused: boolean;
};
type Native = {
  status(): ScreenTimeStatus;
  authorize(): Promise<void>;
  chooseApps(): Promise<void>;
  setPaused(paused: boolean): Promise<void>;
  selectScope(scope: string): void;
  reset(): void;
};
const native = requireOptionalNativeModule<Native>('ScrollSnoozeScreenTime');
const ready = () => {
  if (!native) throw new Error('Install an iOS development build to use Screen Time.');
  return native;
};
export const ScreenTime = {
  supported: () => native !== null,
  status: () => ready().status(),
  authorize: () => ready().authorize(),
  chooseApps: () => ready().chooseApps(),
  setPaused: (paused: boolean) => ready().setPaused(paused),
  selectScope: (scope: string) => native?.selectScope(scope),
  reset: () => native?.reset(),
};
