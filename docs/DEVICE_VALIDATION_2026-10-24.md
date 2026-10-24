# Device validation — 24 October 2026

Status: **Not release-ready. Required authenticated device checks are not tested.**

## Scope and preservation

Reviewed `feature/automatic-account-backup`, HEAD `41326b8b361b67c6489d0301bb0ed1a04f20afdb`, including the existing modified/untracked files and architecture, migration, Google sign-in, privacy/retention and social-comparison documentation. The current architecture report supersedes historical single-owner migration drafts and earlier APK/test statements in those documents. No architecture rewrite or new sync engine was introduced. The original tracked diff and untracked-file inventory were saved under `/private/tmp/driftless-device-validation-*`. A changed-file SHA-256 manifest is retained alongside the new artifact. Existing changes are preserved.

No production endpoint or account was used. The user confirmed no isolated backend or two dedicated test accounts are available. Emulator JavaScript uses `EXPO_NO_DOTENV=1`, `EXPO_PUBLIC_API_URL=https://validation.invalid`, dummy public Google client ID `validation.apps.googleusercontent.com`, `EXPO_OFFLINE=1`, and local Metro port 8097. These values intentionally cannot validate live Google authentication. Tokens and private tracking payloads are not recorded.

## Fresh build

**PASSED.** Built from the current native source and installed offline dependencies, with Gradle caches only:

```sh
JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' \
EXPO_NO_DOTENV=1 EXPO_PUBLIC_API_URL=https://validation.invalid \
./gradlew :app:assembleDebug --offline --no-daemon --max-workers=2 \
  --console=plain -PreactNativeArchitectures=arm64-v8a
```

- Result: `BUILD SUCCESSFUL in 1m 54s`; 557 tasks, 48 executed, 509 up-to-date.
- Application ID: `com.siddiqkolimi.scrollsnooze`; debug variant, debug signing; versionName `0.1.0`, versionCode `1`; ARM64; minimum SDK 24, target/compile SDK 36.
- Artifact: `../../output/device-validation/2026-10-24/driftless-architecture-debug-arm64.apk` (125,615,796 bytes).
- SHA-256: `f7345f60ad7b87df6714ed7576b421ae5e31f884b78b82429570d79bb2aff58d`.
- This is a development-client APK: current JavaScript is served by the isolated local Metro session. It is not a standalone bundled release or a release-signing validation. No APK from before this architecture revision was used.
- Existing native/C++ and Gradle deprecation warnings remain; they did not fail the build.

## Environment and failures

The only connected Android target is an Android 16 Google Play ARM64 emulator, `emulator-5554` (`sdk_gphone64_arm64`); no physical Android device is connected. Created Android user 10 (`DriftlessValidation`) to avoid using existing app/account data.

Enabling airplane mode triggered an Android **system-process** crash in `BluetoothManagerService.handleAirplaneModeChanged` before the newly built APK was installed. This is an environment failure, not an observed app crash. Rebooting and switching the fresh user left installation/UI operations stalled. The existing AVD data partition was 94% full (369 MiB free). Stopped the stalled instance without wiping its data and attempted a separate disposable AVD; the installed Google Play image required 7,372.8 MiB to create its data partition while the host had only about 4.5 GiB available, so that clean launch failed. A requested smaller data partition was normalized back to 6 GiB by the emulator. Cold-started the original AVD with snapshots disabled and retried offline installation using non-streamed transfer. No original AVD data was wiped.

## Automated checks during this validation

| Check | Status | Evidence |
|---|---|---|
| App suite | PASSED | 305/305 tests, 35/35 suites; `/private/tmp/driftless-device-validation-jest.log` |
| TypeScript | PASSED | `node_modules/.bin/tsc --noEmit`, exit 0 |
| Native suite | PASSED | Offline Gradle test task succeeds; 121 tests in retained XML results, zero failures/errors/skips; task up-to-date in this rerun |
| Whitespace | PASSED | `git diff --check` |
| Backend source unchanged | PASSED | Clean backend working tree; no deployment or backend mutation |
| 400-day retention | PASSED (source + automated evidence) | Existing `AGGREGATE_RETENTION_DAYS=400`, `MAX_HISTORY_DAYS=400`, date-derived TTL and client retained-range tests unchanged; no real-time TTL-expiry test |
| Friend-sharing separation | PASSED (source + automated evidence) | Backup enables `cloudSync` only; friend endpoint still requires separate `shareWithFriends`; no signed-in device test |

Automated tests use SQLite/Robolectric and controlled SDK/network inputs; they do not establish real device authentication, production isolation or restoration.

## Device scenario results

| Check | Status | Observation / blocker |
|---|---|---|
| Install fresh APK on emulator | FAILED — environment | Non-streamed install returned `ParcelableException` / `IOException: Requested internal only, but not enough space`; the 120 MiB APK transfer itself succeeded. No successful installation or launch of this revision. |
| Guest offline tracking and zero backup requests | NOT TESTED on device | Current APK could not be installed; automated guest tests pass, but no runtime request trace was obtained. |
| Guest goals/history migration and duplicate prevention | NOT TESTED on device | Installation blocked; no isolated backend or dedicated Google test account. Automated migration/replay coverage is separate evidence. |
| Same-account reopen / server-backed restoration | NOT TESTED on device | Installation blocked; isolated backend/account unavailable. |
| Sign-out cancellation and local preservation | NOT TESTED on device | No authenticated test session. |
| Account A pending uploads cannot reach B | NOT TESTED on device | No two-account authenticated test environment. Automated JS/native scope tests pass. |
| Offline edits survive process restart and reconnect sync | NOT TESTED on device | Installation blocked; restart/reopen automated storage tests do not substitute for an Android process-death test. |
| Home / History / Stats / Recap / personal War agreement | NOT TESTED on device | No fresh-binary UI observation or synthetic fixture was executed. Shared measurement tests pass. |
| Experimental counts remain local/noncompetitive | PASSED in source/automated tests; NOT TESTED on device | Upload aggregation retains null unvalidated counts, and server competition/sharing gates are unchanged. No runtime upload or ranking observation. |
| Navigation avoids redundant full-history downloads | NOT TESTED on device | Deduplication tests pass; no fresh-app network/navigation trace. |
| Interrupted migration and partial sync failures | NOT TESTED on device | Automated journal/replay/partial-response tests pass; Android/native bridge process-kill interleaving and live failures remain unexecuted. |
| Logs: account leakage / duplicate uploads / unexpected requests / app crashes | NOT TESTED for this app revision | Reviewed Android system-crash diagnostics, build and Metro startup logs. No current-app runtime was obtained, so no claim of clean app logs, zero requests or zero leaks. |
| Physical-device scenarios | NOT TESTED | No physical device connected. |

The emulator failure occurred before successful installation. It is not a failed app-level migration/isolation assertion. The dummy backend and OAuth values are suitable for isolated guest validation only and cannot establish actual Google login. No credentials, real user fixtures or production mutations were used.

## Release blockers and follow-up

Required signed-in device scenarios must pass against an isolated backend with two dedicated accounts: guest upload/replay, sign-out cancellation, A-to-B pending isolation, same-account/new-device restore, offline restart/reconnection, interrupted migration and partial failures. Physical-device detector accuracy and OEM service behavior remain untested. Ambiguous legacy recovery still needs the deliberate recovery flow documented in the architecture report. Full historical invalidation has no server delta token, and unvalidated raw counts remain local under the existing product policy.

No commit, merge, push, deployment or release is authorized or performed.

## Final state

No application or backend source fix was made: no concrete application defect could be reproduced in this blocked device session. SHA-256 verification confirms all **67 pre-existing changed/untracked files** match their content at the start of this validation. The only added repository file is this validation report. The app remains on `feature/automatic-account-backup` with its existing uncommitted modifications/untracked additions; backend remains on `main`, clean. Full file-level final status is retained beside the APK as `git-status-final.txt`.

The temporary Metro server was stopped. The empty Android test user 10 created for this task was removed successfully. The original emulator was cold-started on user 0; its data was not wiped. Emulator Wi-Fi and mobile data were left disabled. No storage thresholds or authorization rules were changed. The abandoned disposable AVD configuration contains no account or app data. Source baseline manifests and this APK remain available for a retry after sufficient host/emulator disk space and an isolated authenticated test environment are available.

**Release readiness: NOT ESTABLISHED.** Building and automated tests passed; installation failed due to environment capacity, and all required device scenarios remain not tested.
