import type { v1 } from '@siddiq3/driftless-contracts';
import { Billing, type Offer } from 'billing-android';
import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';
import { Tracking } from 'tracking-android';
import type { ApiClient } from '../api/client';

export const PRO_PRODUCT = 'driftless_pro';
export const MANAGE_URL = `https://play.google.com/store/account/subscriptions?sku=${PRO_PRODUCT}&package=com.siddiqkolimi.driftless`;

/** Must match the server's obfuscatedAccountId(): sha256("driftless:" + sub), hex. */
export async function accountIdFor(sub: string): Promise<string> {
  return (await digestStringAsync(CryptoDigestAlgorithm.SHA256, `driftless:${sub}`)).slice(0, 64);
}

/** Caches the server's verdict natively so blocking can run offline (expires on its own). */
export function cacheEntitlement(e: v1.Entitlement, now = Date.now()): void {
  Tracking.setEntitlement(
    e.tier,
    e.state,
    e.expiresAt ? Date.parse(e.expiresAt) : null,
    e.verifiedAt ? Date.parse(e.verifiedAt) : now,
  );
}

export async function loadOffers(): Promise<Offer[]> {
  const subs = await Billing.subscriptions([PRO_PRODUCT]);
  return subs.find((s) => s.productId === PRO_PRODUCT)?.offers ?? [];
}

/** Purchase → server verification → cached entitlement. The app never decides Pro itself. */
export async function buyPro(
  api: Pick<ApiClient, 'playVerify'>,
  userId: string,
  offer: Offer,
): Promise<v1.Entitlement> {
  const purchase = await Billing.purchase(
    PRO_PRODUCT,
    offer.offerToken,
    await accountIdFor(userId),
  );
  if (purchase.state === 'pending')
    throw new Error('Payment is pending. Pro will turn on once Google Play confirms it.');
  const { entitlement } = await api.playVerify(PRO_PRODUCT, purchase.purchaseToken);
  cacheEntitlement(entitlement);
  return entitlement;
}

/** Re-verifies any subscription Google Play reports for this device's Google account. */
export async function restorePro(
  api: Pick<ApiClient, 'playVerify'>,
): Promise<v1.Entitlement | null> {
  let best: v1.Entitlement | null = null;
  for (const p of await Billing.active()) {
    if (!p.products.includes(PRO_PRODUCT) || p.state !== 'purchased') continue;
    const { entitlement } = await api.playVerify(PRO_PRODUCT, p.purchaseToken);
    if (!best || entitlement.tier === 'pro') best = entitlement;
  }
  if (best) cacheEntitlement(best);
  return best;
}
