# Isolated Android validation plan

Prepared 21 October 2026. Planning only: no device tests, builds, installs, AVD creation or launch.
Only this file and DEVICE_VALIDATION_CHECKLIST.md are created by this task.

## Read first and precedence

Reviewed RELIABILITY_AND_ENTITLEMENT_MILESTONE.md, FEED_LIMIT_MILESTONES.md,
GOAL_SYNC_CAPABILITIES.md, LOCAL_HOURLY_ACTIVITY.md, ../ADS_INTEGRATION_DESIGN.md and
../../BRAINPAL_FEATURE_AUDIT.md. The audit and goal-sync report predate feed enforcement;
current source and the later milestone take precedence over their obsolete absence claims.
Historical test reports are not new execution evidence. No gates are passed by this plan.

## Repository inventory before changes

App: `/Users/siddiqkolimi/Documents/wellbeing/driftless`, branch main,
HEAD `7ac8763271c7f6e504157ceab611c3c1cf1c3a71`: 32 modified tracked files and 10 untracked files.
Backend: sibling `driftless-backend`, main, HEAD `d325a1d95c561c0758b5209abb995de965ea8228`:
clean. No Git mutations were performed.

Exact initial app status (names only):

```text
 M app/_layout.tsx
 M app/blocking.tsx
 M app/challenges.tsx
 M app/disclosure.tsx
 M app/goals.tsx
 M app/history.tsx
 M app/pro.tsx
 M app/progress.tsx
 M app/settings.tsx
 M app/tracking.tsx
 M app/welcome.tsx
 M modules/billing-android/android/src/main/java/app/driftless/billing/BillingModule.kt
 M modules/billing-android/src/index.ts
 M modules/tracking-android/android/src/main/java/app/driftless/tracking/android/FeedPauseOverlay.kt
 M modules/tracking-android/android/src/main/java/app/driftless/tracking/android/FloatingCountBadge.kt
 M modules/tracking-android/android/src/main/java/app/driftless/tracking/android/GoalNotifier.kt
 M modules/tracking-android/android/src/main/java/app/driftless/tracking/android/MemeMilestoneCard.kt
 M modules/tracking-android/android/src/main/java/app/driftless/tracking/core/BadgeState.kt
 M modules/tracking-android/android/src/test/java/app/driftless/tracking/android/MemeCardTest.kt
 M modules/tracking-android/android/src/test/java/app/driftless/tracking/core/BadgeStateTest.kt
 M src/activity/ActivityChart.tsx
 M src/auth/session.tsx
 M src/billing/pro.ts
 M src/capabilities/model.ts
 M src/social/CircleBoard.tsx
 M src/tracking/state.ts
 M src/ui/Focus.tsx
 M src/ui/kit.tsx
 M test/billing.test.ts
 M test/capabilities.test.ts
 M test/circle-board.test.tsx
 M test/google-session.test.tsx
?? docs/ADS_INTEGRATION_DESIGN.md
?? docs/tracking/RELIABILITY_AND_ENTITLEMENT_MILESTONE.md
?? modules/tracking-android/android/src/test/java/app/driftless/tracking/android/BlockingUsageRefreshTest.kt
?? src/billing/EntitlementRecovery.tsx
?? src/billing/ProtectionNotice.tsx
?? src/billing/cache.ts
?? src/billing/protectionStatus.ts
?? test/entitlement-recovery.test.tsx
?? test/pro-screen.test.tsx
?? test/protection-status.test.ts
```

## Environment inventory and actual results

- `adb devices -l`: exactly `emulator-5554`, state device, model sdk_gphone64_arm64.
- `adb -s emulator-5554 emu avd name`: `Medium_Phone_API_36.1`, OK.
- `emulator -list-avds`: only `Medium_Phone_API_36.1`. No separate test AVD exists.
- SDK root: `/Users/siddiqkolimi/Library/Android/sdk`; ADB 36.0.0 available.
- Installed platforms: API 34, 35, 36. Build tools: 34.0.0, 35.0.0, 36.0.0, 36.1.0.
- Existing system image: android-36.1/google_apis_playstore/arm64-v8a.
- React Native version catalog: minSdk 24, compile/targetSdk 36, buildTools 36.0.0,
  NDK 27.1.12297006. That NDK, CMake directory and Gradle wrapper 9.3.1 are present.
- Android Studio bundled Java: OpenJDK 21.0.7. Node v24.8.0; pnpm executable available.
- App node_modules includes tsc, Jest, ESLint, Expo, React Native and built contracts.
  Presence does not prove a complete dependency cache or successful compilation.
- Both EXPO_PUBLIC_API_URL and EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID are unset in this
  inspection shell. No app .env file exists other than .env.example (not runtime config).
  IDE/Metro/installed-build injected values are not established. No env values were printed.

### Existing artifact: inspect only, do not install

`android/app/build/outputs/apk/debug/app-debug.apk`: 107,069,424 bytes;
local filesystem mtime 21 October 2026 13:15:16; package com.siddiqkolimi.driftless,
versionName 0.1.0/versionCode 1; minSdk 24, target/compileSdk 36; Android Debug certificate.
SHA-256: `93cb3cf367ccf65490a9632a225f64a626bf4cad42b1e605c5dae68d8c0164e7`.
It predates the reliability milestone's native changes: do not label it a current test build.
AAPT metadata also exposes SYSTEM_ALERT_WINDOW; the existing debug manifest adds that
permission and cleartext networking for development, unlike intended release configuration.
Do not use this artifact to certify release permission/signing configuration.
Signature inspection exposed public certificate metadata only, no signing keys or passwords.

## Approved product direction for future planning

Free: validated supported-app tracking, brain/count, Today/Yesterday, seven-day history,
basic goals/reminders, validated basic daily limits/feed breaks, and account/consent-dependent
friends/challenges. Preserve existing basic 30-day Stats access. Pro: meaningful advanced
30/90-day/yearly analysis, trends, custom schedules/limits, advanced goals/personalization,
and ad-free operation once ads actually exist. Do not advertise absent analytics.

No gates change here. Native protection still requires cached Pro; feed detection additionally
needs approved app versions OR the explicit experimental setting. All approval lists are empty.
The approved free policy is therefore a future contract/native/backend migration, not a current
runtime entitlement. Backend capability flags default off and are not a native enforcement switch.

The approved ads direction supersedes the older design's proposed four-per-day/two-per-session
and five-minute grace defaults: interstitials only, fewer than three daily, no first-session ads,
no banners, no ads during onboarding, protection/breaks, permissions, sign-in, purchase/restore,
consent, export or deletion. Pro is ad-free. A conservative exact cap needs approval before
implementation; none is chosen or coded here. Defer all SDK work until counting/protection pass.
The earlier design file is intentionally preserved, not edited by this task.

## Create a separate AVD manually — approval required before doing these steps

No AVD is created or launched by this plan. After explicit approval:

1. Android Studio → Tools → Device Manager → Virtual tab → + → Create Virtual Device.
2. Choose a separate Medium Phone or Pixel phone profile. Select the locally available
   Android 16 / API 36.1 Google Play ARM64 image on this Apple Silicon host. It is above
   minSdk 24 and exercises the target-36 app on a recent system. Verify the displayed image
   and ABI; do not select/duplicate/wipe the existing AVD. An API-35 physical/OEM pass and
   supported older-Android testing are additional release coverage, not replaced by this AVD.
3. Name it exactly `Driftless_Isolated_Validation_API_36_1`, finish, and verify both distinct
   entries exist. Do not edit `Medium_Phone_API_36.1` settings or snapshots.
4. Launch only the new named AVD with its Play button. Do not stop/restart the existing AVD.
5. Run adb devices -l. Discover the new serial; never assume emulator-5556. Run the read-only
   `adb -s NEW_SERIAL emu avd name` and compare with the new name and Device Manager window.
6. Use a disposable test Google account only after staging/OAuth isolation is confirmed.
   Install Instagram/YouTube from official Play listings manually with separate approval;
   record exact versions. Their presence is not assumed. No account/purchase in this task.

### Fail-closed preflight for every future mutation

The following is a future manual template, NOT executed. It performs read-only checks and
aborts on missing, duplicated, original or mismatched identity. Keep the existing AVD name
blocked even if the original emulator restarts under a different serial.

```bash
#!/bin/bash
set -eu
ADB=/Users/siddiqkolimi/Library/Android/sdk/platform-tools/adb
PROTECTED_SERIAL=emulator-5554
PROTECTED_AVD=Medium_Phone_API_36.1
EXPECTED_AVD=Driftless_Isolated_Validation_API_36_1
: "${TEST_SERIAL:?Set the new serial only after verifying Device Manager}"
[ "$TEST_SERIAL" != "$PROTECTED_SERIAL" ] || { echo 'ABORT: protected serial'; exit 1; }
case "$TEST_SERIAL" in emulator-[0-9]*) ;; *) echo 'ABORT: not a verified emulator'; exit 1;; esac
MATCHES=$("$ADB" devices | awk -v s="$TEST_SERIAL" '$1 == s && $2 == "device" {n++} END {print n+0}')
[ "$MATCHES" = 1 ] || { echo 'ABORT: target not uniquely online'; exit 1; }
AVD_REPLY=$("$ADB" -s "$TEST_SERIAL" emu avd name | tr -d '\r')
ACTUAL_AVD=$(printf '%s\n' "$AVD_REPLY" | sed '/^OK$/d; /^$/d')
[ "$ACTUAL_AVD" != "$PROTECTED_AVD" ] || { echo 'ABORT: protected AVD'; exit 1; }
[ "$ACTUAL_AVD" = "$EXPECTED_AVD" ] || { echo 'ABORT: AVD identity mismatch'; exit 1; }
printf 'Verified isolated target: %s (%s)\n' "$TEST_SERIAL" "$ACTUAL_AVD"
# Put any approved command immediately below these checks, always using -s "$TEST_SERIAL".
```

Repeat checks after disconnect/reconnect and before each install, launch, permission change,
clock change or collection session. Stop if the mapping is unclear. Never use unqualified adb,
`adb -e`, default Expo device selection, bulk emu kill commands or an automatic device picker.
Do not connect Metro to the protected emulator: live JS reloads can change its behavior too.

## Build-only versus device mutation

No tests or compilation are necessary for documentation preparation, and none ran in this task.
Appropriate future host-only checks after reviewing scripts:

- `npm run typecheck`: tsc --noEmit.
- `npm run lint`: Expo lint (may write a local lint cache).
- `npx prettier --check PATHS`: check specified files, not --write/format.
- `npm test -- --runInBand test/protection-status.test.ts test/billing.test.ts
  test/google-session.test.tsx test/entitlement-recovery.test.tsx test/pro-screen.test.tsx`.
- Gradle `:tracking-android:testDebugUnitTest` with targeted --tests filters for
  BlockingUsageRefreshTest, BadgeStateTest, BlockPolicyTest, FeedLimitPolicyTest,
  ClassifierTest, PlayerTransitionTest and ViewCounterTest; `:billing-android:compileDebugKotlin`
  is compile-only. Put --tests immediately after the test task, not after compilation.
- Backend tests require separate disposable/local infrastructure; do not run this milestone.

For any future APK build, first approve an isolated source snapshot/worktree and unique output
location, for example `/private/tmp/driftless-validation-<unique-id>/`. Preserve both repositories'
tracked and untracked changes; an ordinary HEAD checkout omits the changes under test. Review
copy exclusions for credentials and record the copied source manifest/hashes before building.
Do not run assembleDebug in the original tree: it overwrites the inspected APK. A copy of the
old APK renamed to a new directory is NOT a rebuilt milestone artifact. Build in the isolated
snapshot only, hash/package/version/signature-check its result, and record the exact source state.
No snapshot/build command is authorized or executed here.

`npm run android` invokes expo run:android and installs/launches; do NOT treat it as build-only.
`prebuild:android` regenerates native configuration and is not appropriate here. Do not run
`expo start` attached to the old emulator. A debug dev-client needs an explicitly isolated Metro
session; a standalone release candidate needs a separately reviewed bundle/signing procedure.

After build/staging/target approval, future mutation syntax is ONLY:

```bash
# Run preflight immediately first; NEW_APK must be the verified isolated build.
"$ADB" -s "$TEST_SERIAL" install -r "$NEW_APK"
"$ADB" -s "$TEST_SERIAL" shell am start -a android.intent.action.VIEW -d driftless:///welcome
```

Do not execute these now. Never clear/uninstall either existing app to solve a signature or
storage error. On the new AVD, clearing data/uninstalling also requires separate explicit approval;
prefer test-case UI setup, and label destructive test cases before execution. Snapshots of the
new AVD may be useful only after approval; never snapshot/restore the protected AVD.

## Prerequisites and blockers

| Classification | Prerequisite or limitation | Consequence |
| --- | --- | --- |
| Ready for a test | Source, JS tools, SDK/JDK and existing unit suites present | Host tests can be proposed; not an execution pass |
| Requires configuration | Separate approved AVD and current isolated native build | All device cases currently blocked |
| Requires configuration | Disclosure + Accessibility, Usage Access for OS minutes, notifications for reminders | Enable manually on isolated device only; overlay is service-owned, no generic overlay grant needed |
| Requires configuration | HTTPS staging API and matching Google Web/Android OAuth clients/signature | Both public app settings unset here; no production fallback |
| Requires deployed staging service | Auth, friends, consent/sync, verification, restore and entitlement refresh | Source/CDK is not deployment evidence; staging unavailable/unverified |
| Requires human/device test | Official Instagram/YouTube installs, exact app versions and labelled sessions | No selector invention or approval by fixture |
| Known failure/unresolved | Remaining YouTube transition misses; Instagram not validated; empty approved lists | Counting/blocking reliability gates remain open |
| Known limitation | Facebook/Snapchat/Moj/ShareChat app minutes only; Lite variants absent | Do not use them as reel-count acceptance targets |
| Requires configuration | Current cached Pro for native intervention | Free policy not yet migrated; no legitimate test entitlement demonstrated |
| Separate proposal, not enabled | Explicit experimental feed toggle and controlled staging entitlement | Only after approval; never edit production entitlement or approved versions |
| Known limitation | Media/audio continues; fail-open unknown screens; Back/Home/disable paths | Record honest interruption scope, not tamper-proof blocking |
| Known limitation | Daily local values differ from approved weekly/recap/cloud values | Dashes are not zero; use labelled-source evidence |

No purchase initiation is included even with a test account. Pending-payment/restore cases need
prearranged approved staging/test evidence or a separately approved synthetic harness. Test-only
fixtures cannot certify Google billing or real-app detection. Do not modify gates to pass a case.

## Evidence and data preservation

Collect only from the verified new serial. Record test ID, source/build hash, Android/API/ABI,
app versions, locale/timezone, permissions, saved goal/rules, readiness, start/end counters and
monotonic/wall-clock timing. Use controlled public/test videos and test accounts. Record no
messages, credentials or identifying feed text. Counts need manual ground truth with ≥1.5 s dwell.

If approved later, filtered read-only collection may use `adb -s "$TEST_SERIAL" logcat -d`
with the Driftless process filter; never clear logcat and never collect all devices. Store local
logs in a fresh restrictive directory (umask 077), review/redact before sharing, and discard
Authorization/cookies/tokens/IDs and private content. Do not assume process filtering removes
secrets. Capture screenshots/recordings only with consent using test content; the same rules
apply to private debug exports. No diagnostic exports were executed in this preparation task.
Do not include raw .env, shared preferences, SDK account state or purchases in reports.

## Objective release gates — NONE passed here

1. Reliable-blocking advertising: follow existing ACCURACY_PROTOCOL per app/version: precision
   ≥95%, recall ≥90%, duplicate rate ≤1%; record ad errors separately and meet its full protocol.
   Complete labelled sessions and physical-device/OEM checks, including non-feed screens with
   zero unintended interception in the documented acceptance cases. Resolve known misses or
   explicitly exclude affected versions; never claim universal support from one emulator.
2. Free blocking rollout: gate 1 plus approved versioned Free/Pro contract/native/backend policy,
   upgrade preservation, expiry/account/offline tests and a tested rollback/kill-switch design.
   Basic user data stays accessible; no UI-only unlock. Experimental fixture tests do not pass it.
3. Ads work: counting/protection validation completed; approve vendor/CMP, eligibility/age/region,
   exact conservative cap fewer than three daily and no first session, placements and privacy.
   No SDK until separately authorized. Existing older ad-design defaults are superseded above.
4. Release candidate: all critical checklist cases pass on supported physical devices and isolated
   emulator; approved skips/exclusions documented; no unresolved release-blocking defects;
   staging OAuth/social/billing recovery evidence without a real purchase; clean source/build
   provenance, production signing/manifest/network review, upgrade preservation, privacy/store
   disclosures and release approvals. Debug APK and unit-test success alone are insufficient.

## Command record and task boundary

Executed only read-only commands: git branch --show-current, git rev-parse HEAD,
git status --short --untracked-files=all; cat/head/rg of the six requested reports, package scripts,
SDK/build configuration and relevant source; adb devices -l; adb -s emulator-5554 emu avd name;
emulator -list-avds; aapt dump badging of the existing APK; apksigner verify --print-certs of
that APK; Java -version; node --version; command -v pnpm; Python filesystem/dependency checks,
set/unset-only configuration inspection, SHA-256 inventories and baseline comparison.
Exact Android inventory commands:

```text
/Users/siddiqkolimi/Library/Android/sdk/platform-tools/adb devices -l
/Users/siddiqkolimi/Library/Android/sdk/platform-tools/adb -s emulator-5554 emu avd name
/Users/siddiqkolimi/Library/Android/sdk/emulator/emulator -list-avds
/Users/siddiqkolimi/Library/Android/sdk/build-tools/36.1.0/aapt dump badging android/app/build/outputs/apk/debug/app-debug.apk
JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' /Users/siddiqkolimi/Library/Android/sdk/build-tools/36.1.0/apksigner verify --print-certs android/app/build/outputs/apk/debug/app-debug.apk
'/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/java' -version
```

Initial sandbox ADB inventory failed with local socket permission errors, and emulator-list
emitted a crashpad sandbox error while listing its name. The same read-only inventory rerun
outside the sandbox succeeded. No emulator launch or guest modification occurred. Host ADB
server/tool logs and a temporary hash inventory may be written by inspection tools; no APK or
protected device data was written. Only documentation formatting/whitespace checks ran; no app tests, TypeScript/lint execution, build, install, purchase,
production API, deployment, commit, push or ad integration occurred. Only two requested docs
were added; original file contents and Git states are checked against the hash baseline.

Stop here. Next action is user approval for creation/launch of the separate named AVD and a
separate isolated build/configuration phase, not automatic installation or gate modification.

### Final verification

Executed `npx prettier --check docs/tracking/DEVICE_VALIDATION_PLAN.md
docs/tracking/DEVICE_VALIDATION_CHECKLIST.md`: both passed. `git -C driftless diff --check`
passed. A Python SHA-256 comparison of every initial modified/untracked file found zero
content changes. Status comparison found exactly the two new requested untracked docs;
no initial status entry was removed. App after: 32 tracked modifications and 12 untracked
files (the original 10 plus these two). Backend after: clean, unchanged HEAD/branch.
No automated feature tests or builds ran; older results remain historical only.

## Execution addendum — user-authorized isolated run, 21 October 2026

The later request "run the emulator and test the changes" authorized the isolated AVD/build
phase. Earlier planning-only statements describe that earlier milestone, not this later run.
Existing `Medium_Phone_API_36.1` / emulator-5554 remained protected: no mutating command,
launch/install/reverse/clear/uninstall/setting operation was addressed to it.

A fresh AVD was created under `/private/tmp/driftless-isolated-validation-20261021/avds`:
`Driftless_Isolated_Validation_API_36_1`, emulator-5556, Google Play API 36.1 ARM64.
Only the hardware config was used as a template; no existing userdata/snapshots/accounts were
copied. Fresh data partition 2 GiB; no SD card. It was started with -no-snapshot and port 5556.
The Android command-line AVD manager was absent, so the fresh config and name locator were
written under the temporary AVD home without altering the standard AVD directory.

Source including uncommitted/untracked changes was copied to the temporary `app` directory,
excluding .git, environment files, build outputs/caches and dependencies. Dependencies were
symlinked to the existing installation; Gradle reused dependency caches, while the app/native
project outputs and APK were built in the copy. No credentials were copied or configured.
The copy's Metro runs on port 8097; only emulator-5556 received its adb reverse.

Build: `JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' ./gradlew
:app:assembleDebug -PreactNativeArchitectures=arm64-v8a --offline --console=plain`
from the copy's android directory: BUILD SUCCESSFUL in 1m18s (471 tasks, 439 executed).
This is a debug acceptance artifact, not release-certified or signed for production.
APK SHA-256: `76f33570778f7d6db98d5ac0b007c00691514250dfde0d80468da05d9e104776`.
Guarded `adb -s emulator-5556 install -r COPY_APK`: Success. Developer-client URI used
127.0.0.1:8097 exclusively. No feature unit suites were rerun in this device session.

Local runtime checks: Progress → History → Stats; free 30-day selection; missing history shown
as Not tracked / eligible views as dash; minute goal 30→45 save, route revisit and app restart
persistence; inactive readiness feedback (App pauses off, selection needed and permission/service
unavailable); Goals at font scale 1.5; Circle five invites and guest sign-in sheet/error handling.
Text scale restored to 1.0. Expo developer menu appeared on initial/restarted dev-client sessions;
that development-only notice is not an app feature pass. Some immediate post-navigation images
preceded final UI state; final captures and XML, rather than transient screenshots, support results.

No Google account, real/test purchase, staging entitlement, production API or approval-list change.
Missing staging/OAuth and current legitimate Pro prerequisites block billing/enforcement cases;
Instagram is not installed in this fresh image. YouTube counting misses remain unresolved and
no counting accuracy or physical-device pass is claimed. No gate was disabled to obtain a pass.

Artifacts: emulator.log, build.log, metro.log, source-manifest.json, screenshots/XML and guarded
`check.py` under `/private/tmp/driftless-isolated-validation-20261021`. Helper asserts the exact
AVD name before every operation, always uses emulator-5556, and stores only test UI evidence.
The original APK still hashes to `93cb3cf367ccf65490a9632a225f64a626bf4cad42b1e605c5dae68d8c0164e7`.
Original source hash comparison before documenting results found zero changes. Backend remains
clean. Only these validation documents receive additive result notes; no source fix, commit,
push, deployment or ads work occurs in this run. New emulator and isolated Metro are left running.
