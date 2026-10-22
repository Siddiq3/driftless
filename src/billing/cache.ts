import { Tracking } from 'tracking-android';

let generation = 0;
export const entitlementGeneration = () => generation;

/** Invalidate in-flight billing/profile results before changing account state. */
export function invalidateEntitlement() {
  generation++;
  Tracking.setEntitlement('free', 'none', null, Date.now());
}
