# ScrollSnooze for iPhone

For the current source inventory, Xcode checks and implementation sequence, see
[iOS parity audit — 29 October 2026](IOS_PARITY_AUDIT_2026-10-29.md).

The iOS app shares the Expo Router screens, branding, Google identity, backend, friends,
account lifecycle and SQLite goal storage with Android. This is an initial port, not a
feature-complete iPhone release. The generated `ios/` directory is ignored; source native
code lives in `modules/screen-time/ios/` and configuration in `app.config.ts`.

## Implemented in source

- iPhone build configuration, bundle ID `com.siddiqkolimi.scrollsnooze`, app icon and deep links.
- Shared illustrated Android/iPhone onboarding, with minute intentions on iPhone (15/30/45/60),
  optional Screen Time access and the same questions, character and account flow.
- Simulator detection explains physical-device Screen Time testing instead of offering a
  permission action that fails with a helper-application error. Guest setup can continue.
- Native Family Controls individual authorization and Apple's private activity picker.
- Manual whole-app/category/website pauses using a named Managed Settings store. Pauses
  remain enabled until explicitly resumed. Selection is stored on this phone per account
  scope. Switching accounts or signing out releases pauses. Local reset clears selections.
- Shared signed-in and guest screens. Google login requires the iOS OAuth client below.
- Scope-isolated restored account history, marked as synced account data; absent iPhone
  observations stay unavailable, rather than becoming recorded zeroes.
- The iPhone does not upload Screen Time activity, reserve Android account usage credit,
  rewrite Android account limits, or send APNs tokens to the FCM-only notification service.
  Saved goals are shared account goals and can still affect Android devices.

## Build locally

Install full Xcode and its iOS SDK/simulator from Apple, launch Xcode to complete setup,
and select its developer directory. Command Line Tools alone cannot compile the app.
Use the repository's existing dependency installation instructions first, then:

```sh
pnpm prebuild:ios
pnpm ios
# Physical iPhone (needed for meaningful Screen Time testing):
pnpm ios --device
```

The current Expo template targets iOS 16.4+. Select a development team in the generated
Xcode workspace, enable Family Controls for the bundle ID and sign the app. As of
29 October 2026, this Mac has Xcode 27.1 and an iPhone 16 simulator running iOS 26.0. The terminal still
selects Command Line Tools globally. To use Xcode for one terminal session:

```sh
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
```

An unsigned simulator build compiled and launched the iPhone onboarding screen.
A Personal Team UI-only build also launched onboarding on an iPhone 14 Pro Max
running iOS 27.0.1. Screen Time behavior still requires paid-capability signing and validation.
See the dated audit for dependency installation and build results. Use the custom dev
client, not Expo Go.

Alternatively, `eas.json` provides `development` (physical device), `simulator` (UI testing)
and `production` profiles. An EAS project, signing credentials and Apple account must be
configured before starting remote builds. No remote build, upload or release was started.

## UI testing with a free Personal Team

The Personal Team build can test layout, onboarding, local goals and navigation on a
connected iPhone. It does not include Family Controls, associated domains or APNs.
`SCROLLSNOOZE_UI_TEST` disables native Screen Time APIs and the UI hides those controls.
The `withIOSSceneLifecycle.cjs` plugin configures Expo’s scene delegate for iOS 27.
Normal builds keep Family Controls enabled; never use this variant for enforcement testing.

Connect/trust the iPhone, enable Developer Mode and confirm after restarting, then add
an Apple Account in Xcode. For the generated workspace, the local test build uses an empty
entitlements plist and these **temporary command-line overrides** (not production settings):

```sh
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
plutil -create xml1 /private/tmp/scrollsnooze-ui-only.entitlements
xcodebuild -workspace ios/ScrollSnooze.xcworkspace -scheme ScrollSnooze \
  -configuration Debug -sdk iphoneos -destination 'id=YOUR_IPHONE_UDID' \
  -derivedDataPath /private/tmp/scrollsnooze-iphone-ui-build \
  -allowProvisioningUpdates -allowProvisioningDeviceRegistration \
  DEVELOPMENT_TEAM=YOUR_TEAM_ID CODE_SIGN_STYLE=Automatic \
  CODE_SIGN_IDENTITY='Apple Development' \
  CODE_SIGN_ENTITLEMENTS=/private/tmp/scrollsnooze-ui-only.entitlements \
  'SWIFT_ACTIVE_COMPILATION_CONDITIONS=$(inherited) DEBUG SCROLLSNOOZE_UI_TEST' \
  ARCHS=arm64 ONLY_ACTIVE_ARCH=YES build
```

Run Metro with `pnpm start --lan --port 8081 --scheme driftless`. The phone and Mac must
be on the same Wi-Fi. Open the development client using the Mac's LAN address, and allow
Local Network access if iOS asks. This is a development `.app`, not a TestFlight/store IPA.

## Google sign-in

Create an iOS OAuth client for `com.siddiqkolimi.scrollsnooze` in the same Google Cloud
project as the existing Web client. Set the public build variables:

```dotenv
EXPO_PUBLIC_API_URL=https://your-api.example
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-web-client.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your-ios-client.apps.googleusercontent.com
```

The Expo config derives the reversed iOS URL scheme and passes it to Google's config
plugin. Runtime configuration supplies both client IDs, keeping ID tokens intended for
our backend's existing Web client audience. Rebuild the native app after changing the
iOS client ID. With no iOS client configured, guest mode remains available.

## Remaining before iPhone feature completion / release

1. Device Activity Monitor extension and durable app-group state for automatic daily minute
   thresholds and schedules, including timezone changes, reboot, revocation and failure recovery.
2. Device Activity Report extension and native report view for private on-device Screen Time
   charts. No API/raw usage export to our account or competitive scoring is claimed.
3. iPhone-specific home/statistics presentation for these reports. Shared screens currently
   show unavailable iPhone measurements and any restored Android account history.
4. iPhone notification delivery: APNs-aware backend or a supported FCM integration.
5. App Store authentication review: assess Sign in with Apple requirements for the existing
   Google-only account flow; implement it with backend identity support if required.
6. Apple Family Controls distribution approval for every target using that capability,
   signing, device testing, store metadata and TestFlight/App Store submission.

Per-video counts, floating overlays, Android Accessibility access and pauses limited only
to a third-party app's Reels/Shorts surface do not have an equivalent implementation using
these iOS APIs. Never advertise those as iPhone features.

## Validation performed

- Expo iOS prebuild completed and generated Family Controls entitlement.
- Expo autolinking discovered `ScrollSnoozeScreenTimeModule` and its podspec.
- Metro exported the iOS JavaScript bundle.
- TypeScript and targeted tests cover identity, account lifecycle, account credit isolation,
  restored-history isolation, absent observations, reset fences and avoiding APNs/FCM confusion.

Native device QA must exercise allow/deny/revoke, selection save/cancel, pause/resume,
empty selections, force quit/relaunch, sign-out/account switch, local reset, and offline use.

## References

- [Apple Family Controls](https://developer.apple.com/documentation/familycontrols)
- [Configuring Family Controls](https://developer.apple.com/documentation/xcode/configuring-family-controls)
- [Apple Device Activity](https://developer.apple.com/documentation/deviceactivity)
- [Expo local native modules](https://docs.expo.dev/modules/get-started/)
- [Google sign-in with Expo](https://react-native-google-signin.github.io/docs/setting-up/expo)
