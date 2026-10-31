# Accessibility V3: wireless-device development-build verification

Date: 2026-10-30 (Asia/Kolkata). Device: OnePlus CPH2569, Android 15 / API 35.
Package: com.siddiqkolimi.scrollsnooze. Development build 1.0.1 (versionCode 2), debuggable.
Installed update time reported by Android: 2026-10-30 15:32:09.

## Build and installation

Executed `./gradlew :app:assembleDebug --offline -PreactNativeArchitectures=arm64-v8a`.
Build passed. Installed using `adb install -r` over wireless debugging: Success.
Existing app data, account session and history were preserved. No uninstall or data-clear.
Metro on port 8099 serves the current V3 JavaScript; ADB reverse connects the device to it.

APK: `android/app/build/outputs/apk/debug/app-debug.apk`
SHA256: `1c6f82fc489d341f3d99fff935a244878d7216d987dd0aaa4cb6fba6cb0c4078`
Build log: `/private/tmp/scrollsnooze-v3-device-build.log`.
No production AAB or signed-release verification was performed.

## Requested checks

| Check | Observed result |
| --- | --- |
| 1. First launch displays complete disclosure | PARTIAL: this was an in-place upgrade of an account with completed onboarding, not a pristine first install. The observed launch showed Home with the counting-permission banner; the disclosure was reached using Allow. All five disclosure headings, current diagnostics/coverage wording, language-history wording and both action controls were captured by scrolling. Automatic presentation on a pristine first install was not tested. Do not report automatic upgrade disclosure as passed. |
| 2. Not now does not start tracking | PASS: tapped Not now. Native consent remained false; serviceRunning false even though the Android service remained enabled from the prior install. Opening real YouTube Shorts left local counts, player time and heartbeat rows unchanged. |
| 3. Accept V3 opens Android Accessibility settings | PASS: tapped Got it · I agree. Android Accessibility settings opened. Saved native preferences show a11y_disclosure_version=3, a11y_disclosure_accepted=true and an acceptance timestamp. |
| 4. Enable service starts tracking | PASS: exercised the Android ScrollSnooze service controls, then verified serviceEnabled=true, serviceRunning=true and a new heartbeat. Other accessibility services were preserved. |
| 5. Completed Reels or Shorts view counted | PASS for YouTube Shorts 21.40.162: local native Shorts views increased 5 → 6 after a completed foreground view. These are local recorder totals, not the cached combined account badge. Instagram Reels was not separately exercised in this run. |
| 6. Revoke while pending: no new count | PASS in two distinct tests described below: native consent withdrawal kept Shorts views at 6, and Android permission withdrawal kept views at 8. |
| 7. Reacceptance resumes tracking | PASS: reopened the complete disclosure and accepted through the actual UI. After the guide's delayed Settings handoff finished, returned to Shorts and displayed fresh items; local Shorts views increased 6 → 8, with consent and service operational. |

## Pending-item tests: exact boundaries

No mocked player or changed detector thresholds were used. Existing development-build
DriftlessTracking log messages supplied the new-item signal; the log contains salted item keys,
not video titles. No uiautomator tree dump was used while measuring active Shorts counting,
because Android UI automation can interrupt accessibility services.

### Native V3 consent withdrawal

A debugger script swiped to a real new Short, waited for the existing new-short detection log,
and invoked the existing `Tracking.setDisclosureAccepted(false)` native API while YouTube
remained foreground. This is developer-driven invocation of the production consent setter,
not a new in-app revocation button and not Android permission removal.

- Before: local Shorts views 6; service operational; consent true.
- Native withdrawal result: views 6; consent false; serviceRunning false.
- Host detection-receipt-to-withdrawal-result round trip: approximately 1190 ms.
- After cutoff: surfaceMs 78720, unknownMs 3107, heartbeatMinutes 42.
- After another 2.2 seconds (past the dwell threshold): identical values and views still 6.
- Additional time before the cutoff was recorded under valid consent; this test does not claim
  no time was recorded between the initial baseline and the applied transition.

Evidence: `/private/tmp/scrollsnooze-v3-device/pending-native-consent.json`.

### Actual Android accessibility permission withdrawal

After UI reacceptance and successful resumed counting, a device-local log watcher removed only
the ScrollSnooze component from Android's enabled_accessibility_services at a new-short
signal, leaving Link to Windows enabled. This executes the actual OS service-disable path,
not the app's consent setter. V3 in-app acceptance correctly remains true while the OS service
is disabled.

- Before: local Shorts views 8; serviceEnabled=true; serviceRunning=true.
- After disable: views 8; serviceEnabled=false; serviceRunning=false.
- After another 2.2 seconds: views still 8 and time/heartbeat values unchanged from the
  post-disable snapshot (surfaceMs 102114, unknownMs 4172, heartbeatMinutes 43).
- The host's approximately 978 ms response interval begins after the device reported disabling;
  it is not a measured detection-to-disable latency. No precise device cutoff timing is claimed.
- A first attempt was inconclusive because the native guide's delayed handoff had returned the
  foreground to Settings. That attempt was not counted as a pass; the test was rerun with
  Shorts confirmed in the foreground.

Evidence: `/private/tmp/scrollsnooze-v3-device/pending-system-permission.json`.

System permission removal and in-app consent withdrawal remain separate mechanisms. This OS
sample establishes no new pending count in this run; it does not prove all system teardown
timings, and does not establish discard-only accounting for every OS permission-removal case.

## End state and limitations

Returned to ScrollSnooze and restored the original enabled accessibility-service list.
Final verified state: saved V3 acceptance true, version 3, serviceEnabled=true,
serviceRunning=true; local Shorts views 8. Existing history/account data was not reset.
The development server remains running for the installed development build.

A pristine first-install flow remains unverified, and the automatic upgrade-renewal presentation
was not observed on this launch. Complete disclosure content itself was verified through the
real permission entry point. The Android system service-description text still contains older
wording; the new in-app disclosure does not automatically replace that resource. No changes to
application source were made during this device-verification task.

This is a development-build test, not Play-installed/signed-release, all-version detector
validation, authentication/billing testing, or a guarantee of Play policy approval. Existing
experimental detection/version caveats remain. Normal signed-in app behavior may synchronize
usage recorded during testing; no backend APIs or account records were manually edited.

Disclosure screenshots/XML and pending snapshots are under `/private/tmp/scrollsnooze-v3-device/`.
They are local verification evidence; no files were uploaded or shared externally.
`git diff --check` passed for app and website. Website/backend source was not changed by this task.
