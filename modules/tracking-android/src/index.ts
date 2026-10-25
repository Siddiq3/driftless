import { requireOptionalNativeModule } from 'expo';

export type TrackedApp = {
  package: string;
  label: string;
  installed: boolean;
  version: string | null;
  /** True only when this exact app version passed the labelled accuracy gate (G-2). */
  validated: boolean;
  /** False when no app-specific short-video player selectors have been captured yet. */
  videoDetectionImplemented?: boolean;
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
  /** Release access policy; absent in older, subscription-gated binaries. */
  subscriptionRequired?: boolean;
  /** Present only in binaries with daily feed limits and timed breaks. */
  feedLimitsImplemented?: boolean;
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
  recordedTz?: string;
  measurementStatus?: 'validated' | 'experimental' | 'unavailable';
  usageObserved?: boolean;
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
  /** Old saved configurations retain whole-app pauses. */
  feedOnly?: boolean;
  enforceVideoGoal?: boolean;
  breaksEnabled?: boolean;
  breakEveryViews?: number;
  breakMinutes?: number;
  maxBypassesPerDay?: number;
  bypassMinutes?: number;
  /** Explicit local experiment; never changes cloud/goal-score eligibility. */
  allowUnvalidatedCounts?: boolean;
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

export type PersonalMeasurement = {
  localDate: string;
  views: number | null;
  minutes: number | null;
  status: 'experimental' | 'validated' | 'unavailable' | 'synced';
  tz: string;
  scope: string;
  source: 'phone' | 'account';
};

type NativeTracking = {
  getDataRevision?(): number;
  getDataScope?(): string;
  selectDataScope?(scope: string): void;
  importGuestScope?(source: string, target: string, legacy: boolean): void;
  setSourceDevice?(id: string): void;
  mergeSyncedDays?(json: string, scope: string): void;
  getPersonalMeasurement?(date: string): PersonalMeasurement;
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
  accountUsageInfo(): string;
  installAccountUsage(json:string,scope:string): void;
  accountUsageContributions(device:string):string;
  ackAccountUsage(date:string,rev:number):void;
  resetAccountHistory():void;
  forgetAccountUsage():void;
  refreshUsage(days: number): number;
  getDaily(localDate: string | null): Daily;
  installAccountHistory?(json:string,scope:string): void;
  getBackupDaily?(localDate: string | null): Daily;
  getStoredDates?(from: string, to: string): string[];
  exportSessionLog(days: number): { uri: string; count: number };
  scheduleStructureCapture(delayMs: number): void;
  lastStructureCapture(): string;
  enableGoalAlerts?():void;
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
  dataRevision: () => native.getDataRevision?.() ?? 0,
  dataScope: () => {
    if (!native.getDataScope) throw new Error('Update the app to use account-isolated history.');
    return native.getDataScope();
  },
  selectDataScope: (scope: string) => {
    if (!native.selectDataScope) throw new Error('Update the app to use account-isolated history.');
    native.selectDataScope(scope);
  },
  importGuestScope: (source: string, target: string, legacy = false) => {
    if (!native.importGuestScope) throw new Error('Update the app to import guest history.');
    native.importGuestScope(source, target, legacy);
  },
  setSourceDevice: (id: string) => native.setSourceDevice?.(id),
  mergeSyncedDays: (days: unknown[], scope: string) => {
    if (!native.mergeSyncedDays) throw new Error('Update the app to restore history.');
    native.mergeSyncedDays(JSON.stringify(days), scope);
  },
  personalMeasurement: (date: string) => native.getPersonalMeasurement?.(date) ?? null,

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
  accountUsageInfo: (): {tz:string;active:boolean;status:string;cutoffMs:number;resetGeneration:number;nowMs:number;accountTz?:string;limits?:Record<string,number>;used?:Record<string,number|null>;remaining?:Record<string,number|null>} => {
    if(typeof native.accountUsageInfo !== 'function') throw new Error('Rebuild the Android app to enable account usage protection.');
    return JSON.parse(native.accountUsageInfo());
  },
  installAccountUsage: (json:string,scope:string) => native.installAccountUsage(json,scope),
  accountUsageContributions: (device:string):unknown[] => JSON.parse(native.accountUsageContributions(device)),
  ackAccountUsage: (date:string,rev:number) => native.ackAccountUsage(date,rev),
  resetAccountHistory: () => native.resetAccountHistory(),
  forgetAccountUsage: () => native.forgetAccountUsage(),
  refreshUsage: (days = 7) => native.refreshUsage(days),
  storedDates: (from: string, to: string) => {
    if (!native.getStoredDates)
      throw new Error(
        'Update ScrollSnooze to back up all saved history. Your data is still on this phone.',
      );
    return native.getStoredDates(from, to);
  },
  daily: (localDate: string | null = null) => native.getDaily(localDate),
  installAccountHistory: (json:string,scope:string) => {
    if(!native.installAccountHistory) throw new Error('Rebuild Android for account history support');
    native.installAccountHistory(json,scope);
  },
  backupDaily: (localDate: string | null = null) => native.getBackupDaily?.(localDate) ?? native.getDaily(localDate),
  exportSessionLog: (days = 7) => native.exportSessionLog(days),
  scheduleStructureCapture: (delayMs = 8000) => native.scheduleStructureCapture(delayMs),
  lastStructureCapture: () => native.lastStructureCapture(),
  enableGoalAlerts: () => native.enableGoalAlerts?.(),
  setLimits: (limits: { metric: 'views' | 'minutes'; dailyLimit: number }[]) =>
    native.setLimits(limits),
  checkGoals: () => native.checkGoals(),
  setBlocking: (config: BlockingConfig) => native.setBlocking(config),
  setEntitlement: (tier: string, state: string, expiresAtMs: number | null, verifiedAtMs: number) =>
    native.setEntitlement(tier, state, expiresAtMs, verifiedAtMs),
  wipeLocalData: () => native.wipeLocalData(),
};
