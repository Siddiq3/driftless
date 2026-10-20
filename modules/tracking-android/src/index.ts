import { requireOptionalNativeModule } from 'expo';

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
  /** Usage Access granted: minutes come from Android UsageStats (works without the service). */
  usageAccessGranted: boolean;
  debugBuild: boolean;
  /** Current native entitlement gate, absent on older binaries. */
  blockingEntitled?: boolean;
  apps: TrackedApp[];
};

export type DailyApp = {
  package: string;
  views: number;
  adViews: number;
  /** Time on the short-video surface seen by the accessibility counter. */
  surfaceMs: number;
  unknownMs: number;
  /** Foreground time from Android UsageStats. */
  usageMs: number;
};
/** coverage: share of the day the accessibility counter was running (0..1). */
export type Daily = {
  localDate: string;
  heartbeatMinutes: number;
  coverage: number;
  apps: DailyApp[];
};

/** Days: 1 = Monday … 7 = Sunday. Minutes since local midnight; end may be < start (overnight). */
export type FocusSchedule = { days: number[]; startMinute: number; endMinute: number };
export type BlockingConfig = {
  enabled: boolean;
  apps: string[];
  dailyMinutes: number | null;
  schedules: FocusSchedule[];
};

export type WrapSession = {
  package: string;
  startMs: number;
  endMs: number;
  startMinute: number;
  endMinute: number;
  views: number;
};
export type WrapDetails = {
  available: boolean;
  days: { localDate: string; hourlyViews: number[]; sessions: WrapSession[] }[];
};

export type MemePreferences = { enabled: boolean };

type NativeTracking = {
  memePreferences(): MemePreferences;
  setMemePreferences(enabled: boolean, legacyLanguage: string): void;
  floatingCountPreferences(): { size: number; pausedUntil: number };
  setFloatingCountSize(size: number): void;
  resumeFloatingCount(): void;
  floatingCountEnabled(): boolean;
  setFloatingCountEnabled(enabled: boolean): void;
  getLocalActivityDetails(from: string, to: string): WrapDetails;
  getWrappedDetails(from: string, to: string): WrapDetails;
  widgetSupported(): boolean;
  requestCountWidget(): boolean;
  refreshCountWidget(): void;
  openSupportedApp(pkg: string): void;
  getHealth(): TrackingHealth;
  setDisclosureAccepted(accepted: boolean): void;
  openAccessibilitySettings(): void;
  openAccessibilityGuide(): void;
  openUsageAccessSettings(): void;
  refreshUsage(days: number): number;
  getDaily(localDate: string | null): Daily;
  exportSessionLog(days: number): { uri: string; count: number };
  scheduleStructureCapture(delayMs: number): void;
  lastStructureCapture(): string;
  setLimits(limits: { metric: 'views' | 'minutes'; dailyLimit: number }[]): void;
  checkGoals(): void;
  setBlocking(config: BlockingConfig): void;
  setEntitlement(
    tier: string,
    state: string,
    expiresAtMs: number | null,
    verifiedAtMs: number,
  ): void;
  wipeLocalData(): void;
};

const native =
  requireOptionalNativeModule<NativeTracking>('DriftlessTracking') ?? ({} as NativeTracking);

export const Tracking = {
  runtimeSupport: () => ({
    counting: typeof native.getHealth === 'function' && typeof native.getDaily === 'function',
    minutes: typeof native.refreshUsage === 'function' && typeof native.getDaily === 'function',
    blocking:
      typeof native.setBlocking === 'function' && typeof native.setEntitlement === 'function',
  }),
  memeCardsSupported: () => typeof native.setMemePreferences === 'function',
  memePreferences: (): MemePreferences => native.memePreferences?.() ?? { enabled: true },
  setMemePreferences: (enabled: boolean) => native.setMemePreferences?.(enabled, 'auto'),
  floatingCountSupported: () => typeof native.setFloatingCountEnabled === 'function',
  floatingCountCustomizationSupported: () => typeof native.setFloatingCountSize === 'function',
  floatingCountPreferences: () =>
    native.floatingCountPreferences?.() ?? { size: 54, pausedUntil: 0 },
  setFloatingCountSize: (size: number) => native.setFloatingCountSize?.(size),
  resumeFloatingCount: () => native.resumeFloatingCount?.(),
  floatingCountEnabled: () => native.floatingCountEnabled?.() ?? false,
  setFloatingCountEnabled: (enabled: boolean) => native.setFloatingCountEnabled?.(enabled),
  /** Local recorded events; do not use for sync, goals or battle scoring. */
  localActivityDetails: (from: string, to: string): WrapDetails =>
    native.getLocalActivityDetails?.(from, to) ?? { available: false, days: [] },
  wrappedDetails: (from: string, to: string): WrapDetails =>
    native.getWrappedDetails?.(from, to) ?? { available: false, days: [] },
  widgetSupported: () => native.widgetSupported?.() ?? false,
  requestCountWidget: () => native.requestCountWidget?.() ?? false,
  refreshCountWidget: () => native.refreshCountWidget?.(),
  openSupportedApp: (pkg: string) => native.openSupportedApp(pkg),
  health: () => native.getHealth(),
  setDisclosureAccepted: (v: boolean) => native.setDisclosureAccepted(v),
  openAccessibilitySettings: () => native.openAccessibilitySettings(),
  openAccessibilityGuide: () =>
    typeof native.openAccessibilityGuide === 'function'
      ? native.openAccessibilityGuide()
      : native.openAccessibilitySettings(),
  openUsageAccessSettings: () => native.openUsageAccessSettings(),
  refreshUsage: (days = 7) => native.refreshUsage(days),
  daily: (localDate: string | null = null) => native.getDaily(localDate),
  exportSessionLog: (days = 7) => native.exportSessionLog(days),
  scheduleStructureCapture: (delayMs = 8000) => native.scheduleStructureCapture(delayMs),
  lastStructureCapture: () => native.lastStructureCapture(),
  setLimits: (limits: { metric: 'views' | 'minutes'; dailyLimit: number }[]) =>
    native.setLimits(limits),
  checkGoals: () => native.checkGoals(),
  setBlocking: (config: BlockingConfig) => native.setBlocking(config),
  setEntitlement: (tier: string, state: string, expiresAtMs: number | null, verifiedAtMs: number) =>
    native.setEntitlement(tier, state, expiresAtMs, verifiedAtMs),
  wipeLocalData: () => native.wipeLocalData(),
};
