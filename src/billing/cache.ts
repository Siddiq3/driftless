import type { v1 } from '@siddiq3/driftless-contracts';
import { Tracking } from 'tracking-android';

let generation = 0;
export const entitlementGeneration = () => generation;

/** Invalidate in-flight profile results before changing account state. */
export function invalidateEntitlement() {
  generation++;
  Tracking.setEntitlement('free', 'none', null, Date.now());
}

/** Caches the server's entitlement verdict natively; it expires on its own. */
export function cacheEntitlement(e: v1.Entitlement, now = Date.now(), current = generation): void {
  if (current !== generation) return;
  Tracking.setEntitlement(
    e.tier,
    e.state,
    e.expiresAt ? Date.parse(e.expiresAt) : null,
    e.verifiedAt ? Date.parse(e.verifiedAt) : now,
  );
}
