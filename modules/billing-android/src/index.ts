import { requireOptionalNativeModule } from 'expo';

export type Offer = {
  offerToken: string;
  basePlanId: string;
  price: string;
  period: string;
  phases?: { price: string; period: string; cycles: number; mode: number }[];
};
export type Subscription = { productId: string; title: string; offers: Offer[] };
export type Purchase = {
  purchaseToken: string;
  products: string[];
  state: 'purchased' | 'pending' | 'unspecified';
  acknowledged: boolean;
};

type NativeBilling = {
  getSubscriptions(productIds: string[]): Promise<Subscription[]>;
  purchase(productId: string, offerToken: string, accountId: string): Promise<Purchase>;
  activeSubscriptions(): Promise<Purchase[]>;
};

const native = requireOptionalNativeModule<NativeBilling>('DriftlessBilling');
function ready(): NativeBilling {
  if (!native) throw new Error('Google Play Billing requires an updated Android build.');
  return native;
}

/** Obtains purchase tokens only. Pro is granted by the server after it verifies the token. */
export const Billing = {
  subscriptions: (ids: string[]) => ready().getSubscriptions(ids),
  purchase: (productId: string, offerToken: string, accountId: string) =>
    ready().purchase(productId, offerToken, accountId),
  active: () => ready().activeSubscriptions(),
};
