import Constants from 'expo-constants';

/** Google Play listing; matches android.package in app.config.ts. */
export const PLAY_STORE_ID = 'com.siddiqkolimi.scrollsnooze';

/** Play listing link; `source` lands in the install referrer so shared links can be measured. */
export function playStoreUrl(source?: string) {
  const base = `https://play.google.com/store/apps/details?id=${PLAY_STORE_ID}`;
  return source
    ? `${base}&referrer=${encodeURIComponent(`utm_source=${source}&utm_medium=share`)}`
    : base;
}

/** Same address as the website's support page. */
export const SUPPORT_EMAIL = 'siddiqkolimi.dev@gmail.com';

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
