import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Shared Android and iOS app. Custom dev client, never Expo Go.
 * Public runtime config comes from EXPO_PUBLIC_* env vars at build time — no secrets here.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'ScrollSnooze',
  slug: 'scrollsnooze',
  scheme: ['scrollsnooze', 'driftless'],
  version: '1.0.1',
  icon: './assets/branding/app-icon.png',
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  platforms: ['android', 'ios'],
  ios: {
    ...(process.env.EXPO_PUBLIC_JOIN_BASE_URL || 'https://scrollsnooze.vercel.app'
      ? {
          associatedDomains: [
            `applinks:${new URL(process.env.EXPO_PUBLIC_JOIN_BASE_URL || 'https://scrollsnooze.vercel.app').hostname}`,
          ],
        }
      : {}),
    bundleIdentifier: 'com.siddiqkolimi.scrollsnooze',
    supportsTablet: false,
    entitlements: { 'com.apple.developer.family-controls': true },
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: {
    ...(process.env.EXPO_PUBLIC_JOIN_BASE_URL || 'https://scrollsnooze.vercel.app'
      ? {
          intentFilters: [
            {
              action: 'VIEW',
              autoVerify: true,
              category: ['BROWSABLE', 'DEFAULT'],
              data: [
                {
                  scheme: 'https',
                  host: new URL(
                    process.env.EXPO_PUBLIC_JOIN_BASE_URL || 'https://scrollsnooze.vercel.app',
                  ).hostname,
                  pathPrefix: '/join/',
                },
              ],
            },
          ],
        }
      : {}),
    package: 'com.siddiqkolimi.scrollsnooze',
    versionCode: 3,
    adaptiveIcon: {
      foregroundImage: './assets/branding/adaptive-foreground.png',
      backgroundColor: '#2A0E02',
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
      // Added by libraries but unused: no purchases are offered; secure storage never asks
      // for biometrics. Remove BILLING from this list before selling a subscription.
      'com.android.vending.BILLING',
      'android.permission.USE_BIOMETRIC',
      'android.permission.USE_FINGERPRINT',
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
    './plugins/withAndroidRelease.cjs',
    './plugins/withIOSSceneLifecycle.cjs',
    ['expo-build-properties', { android: { usesCleartextTraffic: false } }],
  ],
  experiments: { typedRoutes: true },
  extra: {
    eas: {
      projectId: 'd3efe889-842f-451c-b322-ee9827f61767',
    },
    joinBaseUrl: process.env.EXPO_PUBLIC_JOIN_BASE_URL || 'https://scrollsnooze.vercel.app',
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? null,
    websiteUrl: process.env.EXPO_PUBLIC_WEBSITE_URL || 'https://scrollsnooze.vercel.app',
    ...(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
      ? { googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID }
      : {}),
    googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? null,
  },
});
