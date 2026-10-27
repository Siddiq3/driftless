import Constants from 'expo-constants';

/** Public website configuration is independent of backend/Google sign-in readiness. */
export function websiteLinks(): {
  privacy: string;
  deletion: string;
  terms: string;
  support: string;
} | null {
  const raw: unknown = Constants.expoConfig?.extra?.websiteUrl;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const url = new URL(raw);
    if (
      url.protocol !== 'https:' ||
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      url.username ||
      url.password
    )
      return null;
    return {
      privacy: `${url.origin}/privacy/`,
      deletion: `${url.origin}/delete-account/`,
      terms: `${url.origin}/terms/`,
      support: `${url.origin}/support/`,
    };
  } catch {
    return null;
  }
}
