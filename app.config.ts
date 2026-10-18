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
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  platforms: ['android'],
  android: {
    package: 'com.siddiqkolimi.driftless',
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
    ['expo-build-properties', { android: { usesCleartextTraffic: false } }],
  ],
  experiments: { typedRoutes: true },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? null,
    cognitoDomain: process.env.EXPO_PUBLIC_COGNITO_DOMAIN ?? null,
    cognitoClientId: process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID ?? null,
  },
});
