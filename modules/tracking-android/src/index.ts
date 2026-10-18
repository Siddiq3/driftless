import { requireNativeModule } from 'expo';

export type TrackingHealth = {
  engineVersion: number;
  /** false until the Phase 2 engine ships — the UI must show "not available", never zeros. */
  implemented: boolean;
  serviceEnabled: boolean;
  usageAccessGranted: boolean;
};

type NativeTracking = { getHealth(): TrackingHealth };

const native = requireNativeModule<NativeTracking>('DriftlessTracking');

export function getTrackingHealth(): TrackingHealth {
  return native.getHealth();
}
