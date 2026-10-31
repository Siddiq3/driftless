import type { TrackingHealth } from 'tracking-android';
import { STATE_COPY, trackingState } from '../src/tracking/state';

const base: TrackingHealth = {
  engineVersion: 1,
  implemented: true,
  rulesVersion: 1,
  disclosureAccepted: true,
  serviceEnabled: true,
  serviceRunning: true,
  usageAccessGranted: false,
  debugBuild: false,
  apps: [
    {
      package: 'com.instagram.android',
      label: 'Instagram Reels',
      installed: true,
      version: '400.0',
      validated: false,
    },
    {
      package: 'com.google.android.youtube',
      label: 'YouTube Shorts',
      installed: false,
      version: null,
      validated: false,
    },
  ],
};

describe('trackingState', () => {
  it('requires the prominent disclosure first, even if the service is on', () => {
    expect(trackingState({ ...base, disclosureAccepted: false })).toBe('needs_disclosure');
  });
  it('asks to enable the service', () => {
    expect(trackingState({ ...base, serviceEnabled: false })).toBe('needs_service');
  });
  it('distinguishes enabled-but-stopped (e.g. Advanced Protection revoked it)', () => {
    expect(trackingState({ ...base, serviceRunning: false })).toBe('enabled_not_running');
  });
  it('never claims confirmed accuracy for unvalidated app versions', () => {
    expect(trackingState(base)).toBe('tracking_unvalidated');
  });
  it('reports tracking only when every installed app is validated', () => {
    const apps = base.apps.map((a) => (a.installed ? { ...a, validated: true } : a));
    expect(trackingState({ ...base, apps })).toBe('tracking');
  });
  it('with no supported app installed, accuracy is not claimed', () => {
    const apps = base.apps.map((a) => ({ ...a, installed: false, version: null }));
    expect(trackingState({ ...base, apps })).toBe('tracking_unvalidated');
  });
  it('has copy for every state', () => {
    for (const k of Object.keys(STATE_COPY))
      expect(STATE_COPY[k as keyof typeof STATE_COPY].title).toBeTruthy();
  });
});
