import type { Daily, TrackingHealth, PersonalMeasurement } from './types';

type Store = { get(key: string): string | null; set(key: string, value: string): void };
type Hooks = { selectScope(scope: string): void; reset(): void };
const noop = () => undefined;
const unsupported = () => {
  throw new Error('Use iPhone app pauses in Screen Time. This control requires Android.');
};

/** Shared-screen adapter. Missing observations stay unavailable. Restored Android history
 * is account data only, never an iPhone observation or an upload candidate. */
export function createIOSTracking(store: Store, hooks: Hooks) {
  const scope = () => store.get('scope') ?? 'guest:ios';
  const key = (name: string) => `${scope()}:${name}`;
  const health = (): TrackingHealth => ({
    engineVersion: 0,
    implemented: false,
    rulesVersion: 0,
    disclosureAccepted: false,
    serviceEnabled: false,
    serviceRunning: false,
    lastConnectedMs: 0,
    lastEventMs: 0,
    heartbeatMinutesToday: 0,
    usageAccessGranted: false,
    debugBuild: false,
    subscriptionRequired: false,
    feedLimitsImplemented: false,
    apps: [],
  });
  const daily = (date: string | null = null): Daily => ({
    localDate: date ?? new Date().toLocaleDateString('en-CA'),
    apps: [],
    coverage: 0,
    heartbeatMinutes: 0,
    measurementStatus: 'unavailable',
    usageObserved: false,
  });
  const info = () => {
    const policy = JSON.parse(store.get(key('policy')) ?? '{}');
    return {
      tz: policy.policy?.tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
      active: false,
      status: 'unsupported_on_ios',
      nowMs: Date.now(),
      cutoffMs: Number(store.get(key('cutoff')) ?? 0),
      resetGeneration: Number(store.get(key('reset')) ?? 0),
    };
  };
  const checkScope = (target: string) => {
    if (target !== scope()) throw new Error('Account synchronization cancelled');
  };
  const reset = () => {
    store.set(key('history'), '[]');
    store.set(key('cutoff'), String(Date.now()));
    store.set(key('reset'), String(info().resetGeneration + 1));
    hooks.reset();
  };
  return {
    dataRevision: () => info().resetGeneration,
    dataScope: scope,
    selectDataScope: (target: string) => {
      if (!/^(guest|pending|account):[A-Za-z0-9-]+$/.test(target))
        throw new Error('Invalid data scope');
      hooks.selectScope(target);
      store.set('scope', target);
    },
    // There is no iOS recorder history; shared SQLite separately imports saved guest goals.
    importGuestScope: (source: string, target: string, _legacy = false) => {
      if (!source.startsWith('guest:') || !target.startsWith('account:'))
        throw new Error('Invalid guest import');
    },
    setSourceDevice: noop,
    mergeSyncedDays: (days: unknown[], target: string) => {
      checkScope(target);
      const saved = JSON.parse(store.get(key('history')) ?? '[]') as Record<string, unknown>[];
      const byDevice = new Map(saved.map((d) => [`${d.localDate}:${d.deviceId}`, d]));
      for (const entry of days) {
        const d = entry as Record<string, unknown>;
        const id = `${d.localDate}:${d.deviceId}`;
        if (Number(d.rev) >= Number(byDevice.get(id)?.rev ?? -1)) byDevice.set(id, d);
      }
      store.set(key('history'), JSON.stringify([...byDevice.values()]));
    },
    personalMeasurement: (date: string): PersonalMeasurement | null => {
      const rows = (
        JSON.parse(store.get(key('history')) ?? '[]') as {
          localDate: string;
          views: number | null;
          minutes: number | null;
        }[]
      ).filter((d) => d.localDate === date);
      const sum = (metric: 'views' | 'minutes') => {
        const values = rows.flatMap((d) => (d[metric] == null ? [] : [d[metric]!]));
        return values.length ? values.reduce((a, b) => a + b, 0) : null;
      };
      return rows.length
        ? {
            localDate: date,
            views: sum('views'),
            minutes: sum('minutes'),
            status: 'synced',
            tz: info().tz,
            scope: scope(),
            source: 'account',
          }
        : null;
    },
    runtimeSupport: () => ({ counting: false, minutes: false, blocking: false }),
    memeCardsSupported: () => false,
    memePreferences: () => ({ enabled: false }),
    setMemePreferences: noop,
    floatingCountSupported: () => false,
    floatingCountCustomizationSupported: () => false,
    floatingCountPreferences: () => ({ size: 54, pausedUntil: 0 }),
    setFloatingCountSize: noop,
    resumeFloatingCount: noop,
    floatingCountEnabled: () => false,
    setFloatingCountEnabled: noop,
    localActivityDetails: () => ({ available: false, days: [] }),
    wrappedDetails: () => ({ available: false, days: [] }),
    widgetSupported: () => false,
    requestCountWidget: () => false,
    refreshCountWidget: noop,
    openSupportedApp: unsupported,
    health,
    setDisclosureAccepted: noop,
    openAccessibilitySettings: unsupported,
    openAccessibilityGuide: unsupported,
    openUsageAccessSettings: unsupported,
    accountUsageInfo: info,
    installAccountUsage: (json: string, target: string) => {
      checkScope(target);
      JSON.parse(json);
      store.set(key('policy'), json);
    },
    accountUsageContributions: () => [],
    ackAccountUsage: noop,
    resetAccountHistory: reset,
    forgetAccountUsage: () => store.set(key('policy'), '{}'),
    refreshUsage: () => 0,
    storedDates: () => [],
    daily,
    // Android credit snapshots are not enforceable allowances or observations on iOS.
    installAccountHistory: (_json: string, target: string) => checkScope(target),
    backupDaily: daily,
    exportSessionLog: unsupported,
    scheduleStructureCapture: unsupported,
    lastStructureCapture: unsupported,
    enableGoalAlerts: noop,
    setLimits: noop,
    checkGoals: noop,
    setBlocking: unsupported,
    setEntitlement: noop,
    wipeLocalData: reset,
  } satisfies typeof import('./index').Tracking;
}
