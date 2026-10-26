import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Shared Android and iOS app. Custom dev client, never Expo Go.
 * Public runtime config comes from EXPO_PUBLIC_* env vars at build time — no secrets here.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'ScrollSnooze',
  slug: 'driftless',
  scheme: 'driftless',
  version: '0.1.0',
  icon: './assets/branding/app-icon.png',
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  platforms: ['android', 'ios'],
  ios: {
    ...(process.env.EXPO_PUBLIC_JOIN_BASE_URL
      ? {
          associatedDomains: [
            `applinks:${new URL(process.env.EXPO_PUBLIC_JOIN_BASE_URL).hostname}`,
          ],
        }
      : {}),
    bundleIdentifier: 'com.siddiqkolimi.scrollsnooze',
    supportsTablet: false,
    entitlements: { 'com.apple.developer.family-controls': true },
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: {
    ...(process.env.EXPO_PUBLIC_JOIN_BASE_URL
      ? {
          intentFilters: [
            {
              action: 'VIEW',
              autoVerify: true,
              category: ['BROWSABLE', 'DEFAULT'],
              data: [
                {
                  scheme: 'https',
                  host: new URL(process.env.EXPO_PUBLIC_JOIN_BASE_URL).hostname,
                  pathPrefix: '/join/',
                },
              ],
            },
          ],
        }
      : {}),
    package: 'com.siddiqkolimi.scrollsnooze',
    adaptiveIcon: {
      foregroundImage: './assets/branding/adaptive-foreground.png',
      backgroundColor: '#10102B',
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
    ...(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
      ? [
          [
            '@react-native-google-signin/google-signin',
            {
              iosUrlScheme: `com.googleusercontent.apps.${process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID.replace('.apps.googleusercontent.com', '')}`,
            },
          ] as [string, { iosUrlScheme: string }],
        ]
      : []),
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
    joinBaseUrl: process.env.EXPO_PUBLIC_JOIN_BASE_URL ?? null,
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? null,
    googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? null,
    googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? null,
  },
});
