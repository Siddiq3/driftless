import { requireNativeModule } from 'expo';

export type TrackedApp = {
  package: string;
  label: string;
  installed: boolean;
  version: string | null;
  /** True only when this exact app version passed the labelled accuracy gate (G-2). */
  validated: boolean;
};

export type TrackingHealth = {
  engineVersion: number;
  implemented: boolean;
  rulesVersion: number;
  disclosureAccepted: boolean;
  /** Switched on in Settings › Accessibility. */
  serviceEnabled: boolean;
  /** Android is running it right now (enabled ≠ running, e.g. after Advanced Protection revokes it). */
  serviceRunning: boolean;
  lastConnectedMs: number;
  lastEventMs: number;
  heartbeatMinutesToday: number;
  debugBuild: boolean;
  apps: TrackedApp[];
};

export type DailyApp = {
  package: string;
  views: number;
  adViews: number;
  surfaceMs: number;
  unknownMs: number;
};
export type Daily = { localDate: string; heartbeatMinutes: number; apps: DailyApp[] };

type NativeTracking = {
  getHealth(): TrackingHealth;
  setDisclosureAccepted(accepted: boolean): void;
  openAccessibilitySettings(): void;
  getDaily(localDate: string | null): Daily;
  exportSessionLog(days: number): { uri: string; count: number };
  scheduleStructureCapture(delayMs: number): void;
  lastStructureCapture(): string;
  wipeLocalData(): void;
};

const native = requireNativeModule<NativeTracking>('DriftlessTracking');

export const Tracking = {
  health: () => native.getHealth(),
  setDisclosureAccepted: (v: boolean) => native.setDisclosureAccepted(v),
  openAccessibilitySettings: () => native.openAccessibilitySettings(),
  daily: (localDate: string | null = null) => native.getDaily(localDate),
  exportSessionLog: (days = 7) => native.exportSessionLog(days),
  scheduleStructureCapture: (delayMs = 8000) => native.scheduleStructureCapture(delayMs),
  lastStructureCapture: () => native.lastStructureCapture(),
  wipeLocalData: () => native.wipeLocalData(),
};
