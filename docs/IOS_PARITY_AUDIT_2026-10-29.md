# iOS feature parity audit — 29 October 2026

The iPhone app is an initial port. Shared React Native screens exist, but most Android
background tracking and protection features have no iOS implementation yet. Installing
Xcode enables native build work; it does not enable those features automatically.

This audit inspects source, runs targeted tests, and checks the local Apple toolchain.
“Implemented” below means present in source, not verified on a physical iPhone.

## Feature inventory

| Feature | Current iOS implementation | Work required |
| --- | --- | --- |
| App shell, navigation, branding, settings | Shared Expo Router app; iOS bundle ID and icon configured | Build and inspect all screens on simulator and device |
| Guest use and onboarding | Shared illustrated setup; iPhone minute intentions; optional Screen Time access | Connect intention to actual automatic limits |
| Google account sign-in | iOS client ID and reversed URL scheme supported | Configure real iOS OAuth client and validate login/logout on device |
| Sign in with Apple | Absent | Assess App Store authentication requirements; add client and backend identity support if needed |
| Account lifecycle and local goal storage | Shared account/SQLite code; scope-isolated history restoration | Device QA for guest import, account switch, reset and deletion |
| Screen Time authorization | Native Family Controls individual authorization | Allow, deny, revoke and relaunch QA |
| Private app/category/website selection | Native FamilyActivityPicker; per-account local persistence | Validate saved selection, cancel and empty selection on device |
| Manual app blocking | Named ManagedSettings store shields chosen apps/categories/sites until resumed | Validate force quit, permission revocation, offline behavior and account changes |
| Automatic daily minute limits | Absent; tracking adapter setLimits/checkGoals are no-ops | Device Activity Monitor extension, thresholds, App Group state and reconciliation |
| Focus/bedtime schedules | Absent; shared focus settings do not enforce iPhone restrictions | Native schedules, cross-midnight handling, pause/resume and recovery |
| Temporary breaks and automatic resume | Only manual resume exists | Persist break expiry and coordinate monitor/shield state; do not rely on JS timers |
| Custom pause appearance/actions | No Shield Configuration or Shield Action extension | Implement iPhone shield experience within Apple's supported customization |
| App usage minutes and charts | No iPhone observations or Device Activity Report extension | Native report extension/view, filters and meaningful empty/error states |
| Home, progress, streaks and achievements | Shared screens; no iPhone recorder data | Adapt to private reports and verified monitor events; absent callbacks must not prove a successful day |
| Wrapped and hourly activity details | iOS adapter reports unavailable; synced account totals may be shown separately | Design private iPhone reporting without exporting restricted report data |
| Friends and challenges | Shared API/screens/invite routing | Test social flows; iPhone activity is not uploaded or used for automatic usage scores |
| Invite links | URL schemes and associated domain configured; backend can serve Apple association file | Real Apple team ID, App Store URL and association deployment/device QA; Android install referrer is not ported |
| Local reminder notifications | Shared Expo notification code exists | Device QA and iOS permission wording; distinct from usage-threshold alerts |
| Remote push notifications | Explicitly skipped on iOS; current service uses FCM tokens | APNs delivery or an iOS FCM integration plus token lifecycle and backend support |
| Subscriptions | No StoreKit module or Apple verification; billing code is Google Play specific | Only needed if subscriptions are introduced; current release sets SUBSCRIPTIONS_REQUIRED=false |
| Required update flow | Native Google Play module only | iPhone version policy and App Store destination if required |
| Home screen count widget | Explicitly unsupported by iOS adapter | WidgetKit target with a supported iPhone metric; cannot reuse Android video counts |
| Per-Reel/Short count and feed-only limits | Unsupported | No equivalent in the Screen Time APIs inspected; use whole-app minute limits |
| Floating count bubble and meme overlays above other apps | Unsupported | No equivalent general cross-app overlay API; consider in-app content or supported shield customization |

## Source evidence

- `modules/screen-time/ios/ScrollSnoozeScreenTimeModule.swift`: authorization, picker,
  scope selection, manual shields, reset. Uses standard UserDefaults, not an App Group.
- `modules/screen-time/src/index.ts`: bridge exposes only status, authorize, chooseApps,
  setPaused, selectScope and reset. No monitoring, schedules or reports.
- `modules/tracking-android/src/iosAdapter.ts`: counting/minutes/blocking support is false
  for the shared Android tracking contract. Manual iPhone shields use the separate bridge.
  Alert/limit methods are no-ops; widget, floating counter, memes and activity details are unavailable.
- `src/onboarding/SetupFlow.tsx` now runs on both platforms. iPhone uses minute goals,
  Screen Time controls and a compatible character preview. Unsupported Android widget and
  competition onboarding steps are skipped. `src/ios/ScreenTimeScreen.tsx` describes
  manual pauses and unavailable automatic limits/charts.
- `src/capabilities/model.ts`: shared capability reporting describes iOS tracking as
  unavailable and does not currently represent manual Screen Time shields.
- `src/sync/accountUsage.ts`, `src/sync/push.ts`: intentionally avoid Android account usage
  credit and FCM token registration on iOS.
- `src/auth/session.tsx`, `app.config.ts`: iOS Google client and scheme support.
- `src/config/access.ts`, `src/billing/pro.ts`: features are currently subscription-free;
  future paid mode would invoke Android billing without an Apple implementation.
- Backend `services/api/src/modules/capabilities.js`: `iosScreenTime` defaults false;
  enabling this flag alone would incorrectly imply minute tracking and schedules exist.

## Supported iPhone approach

Use Family Controls for authorization/selection, Managed Settings for whole-app shields,
Device Activity Monitor for limits/schedules, and Device Activity Report for private charts.
The app, monitor and shield extensions need coordinated state and distinct reason handling:
resuming a manual pause must not accidentally clear an active schedule or daily-limit shield.

Keep iPhone observations separate from restored Android account history. Do not turn
unavailable usage into zeroes or automatically score iPhone users against Android video counts.
Shared goals can still affect Android devices; label that behavior clearly.

Apple now documents `approvedWithDataAccess`, `FamilyActivityData` and direct
`activityData(filteredBy:using:)` access with the additional App and Website Usage entitlement.
Customer availability requires both EU device location and an EU Apple Account region.
This is not a worldwide replacement for private reporting and is not implemented here.
Any optional EU implementation needs its own availability, authorization and data-use review.

## Implementation order and acceptance criteria

1. **Establish a native build.** Finish CocoaPods installation; compile with the installed
   SDK; launch simulator for shared-screen QA; configure development signing and test a
   physical iPhone. Resolve any SDK/Expo lifecycle compatibility issue based on build evidence.
2. **Automatic protection.** Add reproducible Expo configuration for App Groups and a
   Device Activity Monitor extension. Implement daily minute rules and schedules with
   durable per-scope state, independent shield reasons, transactional selection updates,
   and safe cleanup on logout/reset/revocation. Verify thresholds, midnight, overnight
   schedules, timezone changes, force quit, reboot, offline use and account changes.
3. **Private activity reporting.** Add Device Activity Report extension and native host
   view; integrate home/progress presentation, with unavailable distinct from zero.
   Do not export report data into JS/account sync as a shortcut.
4. **Shield experience and breaks.** Add configuration/action extensions, supported
   copy/actions and durable temporary-break behavior. Prove that overlapping restrictions
   remain effective and that users can intentionally resume eligible pauses.
5. **Account and delivery completion.** Validate Google OAuth, implement Apple identity
   where required, wire remote notifications, and test installed-app invite links.
   Use a separately defined iPhone challenge/check-in model if competitive features remain.
6. **Secondary parity and release.** Consider WidgetKit, iPhone update handling, local
   reminders and in-app motivational content. Add StoreKit only if selling subscriptions.
   Obtain Family Controls distribution approval for the app and every relevant extension;
   complete physical-device QA and TestFlight validation before claiming completion.

## Validation on this Mac

- Xcode.app exists: Xcode **27.1**, build **27A9275**; iOS and simulator SDK **27.1**.
- Global `xcode-select -p` still returns `/Library/Developer/CommandLineTools`.
  Checks used `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer` without changing
  the machine's global developer directory.
- Installed the standard **iOS 26.0 (23A343)** runtime; created and booted **iPhone 16**
  (`A9F8BC52-3057-4962-A068-1AD99F900BC5`). The earlier Duo-only runtime was uninstalled.
- `npm run typecheck`: passed.
- Seven targeted Jest suites: **92 tests passed**. Native APIs in these tests are mocked.
- CocoaPods installation succeeded. After cleanup, the installed React framework was
  missing its executable. Restored the exact 0.86.3 Debug binaries from the cached
  distribution and reran `pod install` to regenerate dynamic-framework embedding rules.
- Native arm64 Debug simulator build: **BUILD SUCCEEDED**. Confirmed the final app
  contains `Frameworks/React.framework/React`; installed on iPhone 16 and visually
  verified the iPhone onboarding screen loads through Metro.
- Metro must accept IPv4 connections for the simulator URL `http://127.0.0.1:8081`.
  Used `npm run start -- --lan --port 8081 --scheme driftless` with the Xcode
  `DEVELOPER_DIR` override. The `--localhost` server bound only to IPv6 on this Mac.
- Build evidence: `/private/tmp/scrollsnooze-ios26-fixed.log`. Derived data:
  `/private/tmp/scrollsnooze-ios26-build`. Screenshot:
  `/private/tmp/scrollsnooze-ios26-current.png`. Metro log:
  `/private/tmp/scrollsnooze-ios26-metro-active.log`.
- The unsigned simulator build logs an Expo Notifications keychain entitlement error.
  Signed authentication, secure storage, notifications and physical-device Screen Time
  behavior remain unverified. Launching onboarding does not establish feature parity.

## Shared UI implementation and simulator QA

- iPhone now uses the existing illustrated setup flow rather than the separate plain setup
  screen. Questions, character, typography, goal choices and optional account UI are shared;
  iPhone goals remain minute intentions, never unsupported video counts or enforced limits.
- Added an iPhone character preview instead of loading Android's native reels video view.
  The Android accessibility guide also avoids loading its native view on iPhone.
- Screen Time bridge exposes build-time simulator detection. Simulators show physical-device
  guidance and allow setup to continue. No mock authorization or fake shield state is created.
- Corrected Today empty-state text so iPhone does not instruct users to enable video counting;
  the action says Choose apps. Corrected iPhone notification-permission settings wording.
- Native simulator build passed (`/private/tmp/scrollsnooze-parity-build.log`).
- Automated XCTest UI check passed on iPhone 16 / iOS 26.0: resume at Screen Time,
  verify simulator guidance and absence of Allow action, Continue, Go to Today,
  open Focus and app pauses, then Back to Today. This run started from the existing
  permission-step draft; it does not prove every question in a fresh first-launch flow.
- UI result: `/private/tmp/scrollsnooze-ios-ui-qa/guest-flow-retry.xcresult`.
  Exported screenshots: `/private/tmp/scrollsnooze-ios-ui-qa/screenshots/`.
- A local keychain-entitlement signing experiment was rejected by the simulator launch
  service; restored the working ordinary ad-hoc simulator signature. Expo Notifications
  still reports the missing keychain entitlement; notifications and secure storage are
  not claimed as verified. Physical-device signing remains required for those checks.
- Automatic daily limits, schedules, Screen Time reports, remote notifications, Apple
  identity and WidgetKit remain outstanding. Shared UI progress is not full feature parity.

## Physical iPhone UI build

- Connected iPhone 14 Pro Max with iOS 27.0.1; confirmed pairing and Developer Mode enabled.
- Xcode created a Personal Team Apple Development certificate and completed a signed
  arm64 device build using the UI-only overrides documented in IOS.md.
- `SCROLLSNOOZE_UI_TEST` disables native Screen Time access, selection and shields;
  no Family Controls or APNs entitlement is requested by this variant.
- Installed `com.siddiqkolimi.scrollsnooze` successfully on the phone. Initial launch required explicit developer trust on the phone. After trust, the
  device crashed in `UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`.
  Added a reproducible Expo scene-lifecycle plugin using `ExpoAppSceneDelegate` and
  `ExpoReactNativeFactoryProvider`; rebuilt, signed, installed and launched successfully.
  The user confirmed the onboarding screen is visible on the physical iPhone.
  Physical-device Screen Time enforcement remains unavailable in this UI-only build.
- Build log: `/private/tmp/scrollsnooze-iphone-ui-build.log`.
  Build: `/private/tmp/scrollsnooze-iphone-ui-build/Build/Products/Debug-iphoneos/ScrollSnooze.app`.
  Fixed build log: `/private/tmp/scrollsnooze-iphone-scenes-build.log`.
  Launch log: `/private/tmp/scrollsnooze-iphone-scenes-launch.log`.
- TypeScript and eight targeted Screen Time/tracking tests passed after adding the
  UI-only availability guard. This does not replace signed-device Screen Time testing.

## Apple references checked on 29 October 2026

- [Screen Time frameworks](https://developer.apple.com/documentation/screentimeapidocumentation)
- [Device Activity Report](https://developer.apple.com/documentation/deviceactivity/deviceactivityreport)
- [Threshold callback](https://developer.apple.com/documentation/deviceactivity/deviceactivitymonitor/eventdidreachthreshold(_:activity:))
- [Family Controls distribution entitlement](https://developer.apple.com/documentation/familycontrols/requesting-the-family-controls-entitlement)
- [Additional data authorization and EU availability](https://developer.apple.com/documentation/familycontrols/authorizationstatus/approvedwithdataaccess)
- [Direct activity data access](https://developer.apple.com/documentation/deviceactivity/deviceactivitydata/activitydata(filteredby:using:))
