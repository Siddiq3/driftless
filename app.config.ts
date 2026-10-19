import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Android-first (D-015). Custom dev client, never Expo Go.
 * Public runtime config comes from EXPO_PUBLIC_* env vars at build time — no secrets here.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Driftless',
  slug: 'driftless',
  scheme: 'driftless',
  version: '0.1.0',
  icon: './assets/branding/app-icon.png',
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  platforms: ['android'],
  android: {
    package: 'com.siddiqkolimi.driftless',
    adaptiveIcon: {
      foregroundImage: './assets/branding/adaptive-foreground.png',
      backgroundColor: '#FFE6AD',
    },
    // Local usage data must not leave the device via cloud backup (THREAT_MODEL T4).
    allowBackup: false,
    // Phase 1 requests no dangerous permissions. Accessibility / Usage Access arrive in Phase 2
    // behind the prominent-disclosure screen required by Google Play (PLATFORM_CAPABILITIES S1).
    blockedPermissions: [
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.RECORD_AUDIO',
    ],
  },
  plugins: [
    'expo-router',
    'expo-sqlite',
    'expo-secure-store',
    'expo-localization',
    'expo-system-ui',
    'expo-notifications',
    './plugins/withDriftlessBrand.cjs',
    ['expo-build-properties', { android: { usesCleartextTraffic: false } }],
  ],
  experiments: { typedRoutes: true },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? null,
    googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? null,
  },
});
