import { requireNativeModule } from 'expo';

export type Offer = { offerToken: string; basePlanId: string; price: string; period: string };
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

const native = requireNativeModule<NativeBilling>('DriftlessBilling');

/** Obtains purchase tokens only. Pro is granted by the server after it verifies the token. */
export const Billing = {
  subscriptions: (ids: string[]) => native.getSubscriptions(ids),
  purchase: (productId: string, offerToken: string, accountId: string) =>
    native.purchase(productId, offerToken, accountId),
  active: () => native.activeSubscriptions(),
};
