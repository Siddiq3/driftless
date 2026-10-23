import type { v1 } from '@siddiq3/driftless-contracts';
import { Billing, type Offer } from 'billing-android';
import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';
import { Tracking } from 'tracking-android';
import type { ApiClient } from '../api/client';
import { entitlementGeneration } from './cache';
import { SUBSCRIPTIONS_REQUIRED } from '../config/access';

export const PRO_PRODUCT = 'driftless_pro';
export const MANAGE_URL = `https://play.google.com/store/account/subscriptions?sku=${PRO_PRODUCT}&package=com.siddiqkolimi.scrollsnooze`;

/** Must match the server's obfuscatedAccountId(): sha256("driftless:" + sub), hex. */
export async function accountIdFor(sub: string): Promise<string> {
  return (await digestStringAsync(CryptoDigestAlgorithm.SHA256, `driftless:${sub}`)).slice(0, 64);
}

/** Caches the server's verdict natively so blocking can run offline (expires on its own). */
export function cacheEntitlement(
  e: v1.Entitlement,
  now = Date.now(),
  generation = entitlementGeneration(),
): void {
  if (generation !== entitlementGeneration()) return;
  Tracking.setEntitlement(
    e.tier,
    e.state,
    e.expiresAt ? Date.parse(e.expiresAt) : null,
    e.verifiedAt ? Date.parse(e.verifiedAt) : now,
  );
}

export async function loadOffers(): Promise<Offer[]> {
  if (!SUBSCRIPTIONS_REQUIRED) return [];
  const subs = await Billing.subscriptions([PRO_PRODUCT]);
  return subs.find((s) => s.productId === PRO_PRODUCT)?.offers ?? [];
}

// A foreground restore must not race a purchase and clear its newly verified entitlement.
let billingTail: Promise<unknown> = Promise.resolve();
function serializedBilling<T>(generation: number, run: () => Promise<T>): Promise<T> {
  const task = billingTail.then(() => {
    if (generation !== entitlementGeneration())
      throw new Error('Account changed. Please try again.');
    return run();
  });
  billingTail = task.catch(() => undefined);
  return task;
}

/** Purchase → server verification → cached entitlement. The app never decides Pro itself. */
export async function buyPro(
  api: Pick<ApiClient, 'playVerify'>,
  userId: string,
  offer: Offer,
): Promise<v1.Entitlement> {
  if (!SUBSCRIPTIONS_REQUIRED)
    throw new Error('All features are included. Subscriptions are not on sale.');
  const generation = entitlementGeneration();
  return serializedBilling(generation, async () => {
    const accountId = await accountIdFor(userId);
    if (generation !== entitlementGeneration())
      throw new Error('Account changed. Please try again.');
    const purchase = await Billing.purchase(PRO_PRODUCT, offer.offerToken, accountId);
    if (generation !== entitlementGeneration())
      throw new Error('Account changed. Please try again.');
    if (purchase.state === 'pending')
      throw new Error(
        'Payment is pending. Reopen ScrollSnooze after Google Play confirms it, or use Restore purchase.',
      );
    if (purchase.state !== 'purchased')
      throw new Error('Purchase is not complete. Try Restore purchase after payment finishes.');
    const { entitlement } = await api.playVerify(PRO_PRODUCT, purchase.purchaseToken);
    cacheEntitlement(entitlement, Date.now(), generation);
    return entitlement;
  });
}

/** Re-verifies any subscription Google Play reports for this device's Google account. */
export async function restorePro(
  api: Pick<ApiClient, 'playVerify'>,
): Promise<v1.Entitlement | null> {
  const generation = entitlementGeneration();
  return serializedBilling(generation, async () => {
    let best: v1.Entitlement | null = null;
    const purchases = await Billing.active();
    if (generation !== entitlementGeneration())
      throw new Error('Account changed. Please try again.');
    for (const p of purchases) {
      if (!p.products.includes(PRO_PRODUCT) || p.state !== 'purchased') continue;
      const { entitlement } = await api.playVerify(PRO_PRODUCT, p.purchaseToken);
      if (generation !== entitlementGeneration())
        throw new Error('Account changed. Please try again.');
      if (!best || entitlement.tier === 'pro') best = entitlement;
    }
    if (best) cacheEntitlement(best, Date.now(), generation);
    else
      cacheEntitlement(
        { tier: 'free', state: 'none', source: 'none', expiresAt: null, verifiedAt: null },
        Date.now(),
        generation,
      );
    return best;
  });
}

export function offerDisclosure(offer: Offer): string {
  const phases = offer.phases;
  if (!phases?.length)
    return 'Review the full price, billing period and any introductory offer in Google Play before confirming.';
  const period = (value: string) =>
    ({ P1M: 'month', P1Y: 'year', P1W: 'week', P7D: '7 days', P1D: 'day' })[value] ?? value;
  return phases
    .map((phase) =>
      phase.mode === 1
        ? `${phase.price} per ${period(phase.period)}, renews automatically until cancelled.`
        : phase.mode === 2
          ? `${phase.price} per ${period(phase.period)} for ${phase.cycles} billing period(s).`
          : `${phase.price} for ${period(phase.period)} (non-renewing).`,
    )
    .join(' ');
}
