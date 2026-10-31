import * as SecureStore from 'expo-secure-store';

export const OWNER_KEY = 'driftless.google.cache-owner.v1';
const VERIFIED_KEY = 'scrollsnooze.account.verified.v1';

export type VerifiedAccount = { owner: string; userId: string; incarnation: string };

/** The account the server last confirmed for this Google user, so a returning user opens at once. */
export async function readVerifiedAccount(): Promise<VerifiedAccount | null> {
  try {
    const [raw, owner] = await Promise.all([
      SecureStore.getItemAsync(VERIFIED_KEY),
      SecureStore.getItemAsync(OWNER_KEY),
    ]);
    if (!raw || !owner) return null;
    const saved = JSON.parse(raw) as Partial<VerifiedAccount>;
    return saved.owner === owner && saved.userId && saved.incarnation
      ? { owner, userId: saved.userId, incarnation: saved.incarnation }
      : null;
  } catch {
    return null;
  }
}

export async function rememberVerifiedAccount(userId: string, incarnation: string) {
  const owner = await SecureStore.getItemAsync(OWNER_KEY);
  if (owner)
    await SecureStore.setItemAsync(VERIFIED_KEY, JSON.stringify({ owner, userId, incarnation }));
}

export const forgetVerifiedAccount = () =>
  SecureStore.deleteItemAsync(VERIFIED_KEY).catch(() => undefined);
