import { requireOptionalNativeModule } from 'expo';
export type ScreenTimeStatus = {
  authorization: 'approved' | 'denied' | 'notDetermined';
  selectedCount: number;
  paused: boolean;
};
type Native = {
  controlsAvailable?(): boolean;
  isSimulator?(): boolean;
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
  if (native.controlsAvailable?.() === false)
    throw new Error('Screen Time is disabled in this UI-testing build.');
  return native;
};
export const ScreenTime = {
  isSimulator: () => native?.isSimulator?.() ?? false,
  supported: () => native !== null && (native.controlsAvailable?.() ?? true),
  status: () => ready().status(),
  authorize: () => ready().authorize(),
  chooseApps: () => ready().chooseApps(),
  setPaused: (paused: boolean) => ready().setPaused(paused),
  selectScope: (scope: string) => native?.selectScope(scope),
  reset: () => native?.reset(),
};
