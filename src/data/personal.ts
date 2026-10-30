import {
  Tracking,
  type Daily,
  type TrackingHealth,
  type PersonalMeasurement,
} from 'tracking-android';
import { storageScope, observeStorage } from '@/db/scope';
import { recordedMeasurement } from './measurement';
import { currentTimeZone } from '@/sync/run';

type Snapshot = { daily: Daily; health: TrackingHealth; measurement: PersonalMeasurement };
let cachedScope = '';
const days = new Map<string, { at: number; value: Snapshot }>();
let refreshedAt = 0;
let refreshedDays = 0;
export function invalidatePersonalData() {
  days.clear();
  refreshedAt = 0;
  refreshedDays = 0;
}
observeStorage(invalidatePersonalData);
export function refreshPersonalData(window = 7) {
  const now = Date.now();
  const scope = storageScope();
  if (scope !== cachedScope) {
    invalidatePersonalData();
    cachedScope = scope;
  }
  if (now - refreshedAt < 10000 && window <= refreshedDays) return;
  try {
    Tracking.refreshUsage(Math.min(7, window));
  } catch {
    /* Saved records remain readable without Usage Access. */
  }
  refreshedAt = now;
  refreshedDays = window;
  days.clear();
}
export function personalSnapshot(date: string): Snapshot {
  if (cachedScope !== storageScope()) {
    invalidatePersonalData();
    cachedScope = storageScope();
  }
  const cached = days.get(date);
  if (cached && Date.now() - cached.at < 10000) return cached.value;
  const daily = Tracking.daily(date);
  const health = Tracking.health();
  const stored = Tracking.personalMeasurement?.(date);
  const measurement: PersonalMeasurement = stored ?? {
    localDate: date,
    ...recordedMeasurement(daily, health),
    tz: currentTimeZone(),
    scope: storageScope(),
    source: 'phone',
  };
  const value = {
    daily: { ...daily, personalAppViews: measurement.appViews },
    health,
    measurement,
  };
  days.set(date, { at: Date.now(), value });
  return value;
}
export const personalDay = (date: string) => personalSnapshot(date).measurement;
export const personalRawDay = (date: string) => personalSnapshot(date).daily;
export const personalHealth = () => Tracking.health();
