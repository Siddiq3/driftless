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
  /** Prior disclosure acceptance needs renewal; never authorizes tracking. */
  disclosureRenewalRequired?: boolean;
  /** Switched on in Settings › Accessibility. */
  serviceEnabled: boolean;
  /** Android is running it right now (enabled ≠ running, e.g. after Advanced Protection revokes it). */
  serviceRunning: boolean;
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
export type Daily = {
  /** Personal display only; never restaged as local observations. */
  personalAppViews?: Record<string, number | null>;
  recordedTz?: string;
  measurementStatus?: 'validated' | 'experimental' | 'unavailable';
  usageObserved?: boolean;
  localDate: string;
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
  appViews?: Record<string, number | null>;
  localDate: string;
  views: number | null;
  minutes: number | null;
  status: 'experimental' | 'validated' | 'unavailable' | 'synced';
  tz: string;
  scope: string;
  source: 'phone' | 'account';
};
