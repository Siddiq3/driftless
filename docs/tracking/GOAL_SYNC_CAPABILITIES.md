# Goal-sync compatibility and capability reporting milestone

Completed source changes on 20 October 2026 against `BRAINPAL_FEATURE_AUDIT.md` findings F1/F6. No commits, deployment, production-data changes, approval-list changes, or physical-device verification were performed. The existing audit report remains untouched.

## Root causes and resulting behavior

Onboarding created `setup-views` and `setup-minutes`, but the strict cloud contract requires UUID goal IDs. Settings discarded goal-sync failures, so a successful usage sync could conceal a failed goal backup. Pull-before-push also used only revision ordering, which could overwrite offline edits, and replacing the complete remote goal set had no snapshot precondition.

New onboarding goals use UUIDs and reuse an existing goal of the chosen metric. Startup repairs invalid stored IDs in an exclusive transaction, retaining the exact metric, limit, enabled state and revision. A persistent alias maps old handles to their new UUIDs. Repeated repair is a no-op; failed repair rolls back and database initialization can retry. Ordinary saves validate the same single-goal constraints as the server and increment revisions atomically. The editor keeps a stable ID, prevents overlapping saves, reports storage failures and distinguishes a saved goal from unavailable native alerts.

Additive SQLite schema version 4 adds `goal_id_aliases` and `goal_sync_state`. No goals or tracking history are deleted by migration. Synced revisions distinguish acknowledged cloud data from unsent local edits. Unsynced local values win conflicting remote values and are rebased above the remote revision. Distinct remote goals are preserved. Writes made during an upload are acknowledged only when their saved revision still matches; backup drains further edits with bounded retries. Network failures leave the local goal data intact. Unchanged sets do not generate writes.

The API adds whole-set ETags and conditional `If-Match` writes. A separate `GOALSET#META` item is updated atomically with the goal transaction. Snapshot reads check the metadata revision before and after the query. Stale snapshots fail with 412; concurrent transactions fail with 409; the client re-pulls and retries up to three attempts. Existing UUID, limit, duplicate and per-goal revision validation remains unchanged. The OpenAPI source documents both headers.

Settings reports goal backup separately from usage backup and provides an explicit retry. Focus, foreground and periodic backend refresh re-evaluate availability. Obsolete profile responses cannot overwrite a newer result. Consent/session lifecycle changes cancel subsequent goal-sync operations, including checks after waiting for credentials. Requests already sent to the server cannot be recalled.

Backend capability flags are rollout eligibility, not observations of device health. Settings now combines real platform support, native-method availability, current permissions, service state, installed/approved app versions, backend response, sharing consent and native entitlement validity. Local Usage Access minutes remain available during a backend outage. Unapproved app versions are described as unverified local counting. Unsupported platforms and advanced analytics remain unavailable. Blocking/schedules describe configurability, never active enforcement; reel-count blocking remains explicitly unimplemented. Native health exposes the same entitlement predicate used by enforcement, without changing expiry policy. Older binaries lacking that field fail closed for Pro capability reporting.

## Changed files

App behavior/storage:

- `src/onboarding/store.ts`
- `src/db/index.ts`, `src/db/migrations.ts`
- `src/goals/store.ts`, `src/goals/sync.ts`
- `src/api/client.ts`
- `src/capabilities/model.ts`
- `app/goals.tsx`, `app/settings.tsx`, `app/privacy.tsx`
- `modules/tracking-android/src/index.ts`
- `modules/tracking-android/android/src/main/java/app/driftless/tracking/android/TrackingModule.kt`
- `modules/tracking-android/android/src/main/java/app/driftless/tracking/core/BlockPolicy.kt`

App regression coverage:

- `test/onboarding.test.ts`, `test/api-client.test.ts`
- `test/goals-sync.test.ts`, `test/capabilities.test.ts`, `test/db-retry.test.ts`
- `test/settings-capabilities.test.tsx`, `test/tracking-support.test.ts`
- `test/helpers/sqlite.ts` (real in-memory SQLite adapter)
- `modules/tracking-android/android/src/test/java/app/driftless/tracking/core/BlockPolicyTest.kt`

Sibling backend:

- `services/api/src/modules/goals.ts`, `services/api/src/modules/capabilities.ts`
- `services/api/test/goals.test.ts`
- `packages/contracts/src/openapi.ts`, `packages/contracts/test/contracts.test.ts`

The privacy change clears the newly added metadata only through the existing explicit local-data wipe, with app-side deletes in one transaction. No wipe was executed.

## Executed validation

| Check | Actual result | Log |
|---|---|---|
| Full app Jest suite | 197 passed, 24 suites | `/private/tmp/driftless-goal-capabilities-jest.log` |
| App TypeScript | Passed | `/private/tmp/driftless-goal-types.log` |
| App lint | Passed | `/private/tmp/driftless-goal-lint.log` |
| Tracking Android unit suite | 97 tests, zero failures/errors/skips; Gradle success | `/private/tmp/driftless-goal-native.log` |
| API goals/me/unit regression tests | 31 passed, 3 files, disposable in-memory DynamoDB on port 8064 | `/private/tmp/driftless-goal-api-tests.log` |
| Full contract suite | 85 passed, 5 files | `/private/tmp/driftless-goal-contracts.log` |
| API TypeScript and lint | Passed | `/private/tmp/driftless-goal-backend-types.log`, `/private/tmp/driftless-goal-api-lint.log` |
| Contracts TypeScript and lint | Passed | `/private/tmp/driftless-goal-contract-types.log`, `/private/tmp/driftless-goal-contract-lint.log` |
| Diff inspection and whitespace checks | Reviewed both repositories; passed | `git diff --check` |

Coverage includes legacy seed rejection, v3 upgrade preservation, stable repair, repair rollback, stale editor aliases, onboarding reuse, invalid limits, offline/lost-response retries, unsent edits, concurrent snapshot conflicts, edits during uploads, account ownership, cancellation after credential waits, over-limit merged sets without truncation, unsupported/older native binaries, revoked permissions, unverified app versions, expired native entitlement, independent backup errors, manual retry, stale profile responses and backend outages.

Initial tooling attempts failed on an npm workspace invocation (this repository uses pnpm workspaces), sandbox access to the Gradle cache/local DynamoDB, and two Settings tests using the default iOS fixture. Corrected invocations/fixtures passed. npm configuration, Node SQLite experimental and existing Gradle deprecation warnings remain. The interrupted attempted full API suite did not run; only the targeted 31 API tests are claimed. No APK build/install was run for this milestone.

## Compatibility and remaining risks

- Roll out the compatible backend before the new client. The new client refuses goal uploads if GET returns no ETag and explains that goals remain local. Legacy clients may omit `If-Match`; they retain their previous replacement behavior and cannot gain full stale-snapshot protection until upgraded. Concurrent transactions on the updated backend are still guarded.
- DynamoDB requires no table migration: metadata is created lazily in the existing user partition. Existing goal records remain intact. Do not deploy an older goal writer alongside the new writer: older code would not advance snapshot metadata.
- SQLite v4 is forward-only; older app builds reject the newer database. Validate an upgrade in place, without uninstalling/clearing storage. The native health addition requires a rebuilt Android binary.
- First backup binds the existing local goal dataset to that account. Later accounts are refused backup with an explicit message; goals remain locally available. This prevents new cross-account backup but cannot infer historical ownership of data created before ownership metadata existed. Automatic account transfer or per-account local goal workspaces are not implemented.
- Conflict policy favors an unsent local edit. It preserves values but does not offer an interactive conflict picker. Goals removed on a different device may be retained/re-uploaded locally: automatic remote-deletion propagation is intentionally not inferred from absence. A goal set exceeding the cloud maximum is preserved locally and backup reports a validation error rather than truncating data.
- Retry is bounded and driven by Settings focus/foreground, refresh and the retry button. No background scheduler or network-reconnect service was added. A pending server request may complete after cancellation; subsequent local merges/writes are stopped.
- Live readiness is sampled (native health every five seconds while Settings is focused; backend every thirty seconds while active). It does not prove counting accuracy, OEM persistence, notification delivery or active blocking. Backend verification/rollout gates remain off where previously off. No approved-version list or scoring behavior changed.
- Untracked native-module `.gradle` cache directories were observed after interruption and left intact; they are not source deliverables. No unrelated user changes were removed.

## Exact physical-device validation steps

1. Use an isolated staging backend built from this API revision and test accounts. Ensure its HTTPS endpoint and Google OAuth configuration match the signed test build. Confirm GET `/v1/goals` returns an ETag and a stale `If-Match` produces 412. Do not use production data.
2. Build a signed Android test APK containing the updated native module. Record its commit/build identifier, signature, Android/OEM version and Instagram/YouTube versions. Install with `adb -s DEVICE_SERIAL install -r PATH_TO_APK` over a matching-signature existing test installation. Do not uninstall or clear storage; if installation fails, record the exact error and resolve signing/version compatibility first.
3. Before upgrade, retain a test installation with legacy onboarding goals and record each metric, limit, enabled state and revision. After upgrade, confirm those values, completion state, counts and history are unchanged; IDs alone become valid UUIDs. Restart twice and confirm IDs remain stable.
4. On a separate clean test installation, complete onboarding offline for both reel and minute plans. Edit limits repeatedly, restart and verify one stable goal per editor and persisted values. Sign in, enable backup and verify the expected goal payload and visible goal-backup result using sanitized staging logs.
5. With airplane mode enabled, edit a goal and reopen Settings: local values must remain, and backup must report failure. Restore connectivity, foreground Settings or press Retry backup, and confirm one logical goal with the final values. Simulate a lost response and repeat retry; verify no duplicate goal.
6. On a second device using the same test account, add a distinct goal while the first device has an offline edit. Synchronize both: distinct goals must survive and the unsent edit must use the documented conflict policy. Repeat concurrent writes and inspect 409/412 retries. Change a local goal while upload is deliberately delayed and confirm the latest revision is eventually backed up or a retry message is shown.
7. Turn cloud consent off and sign out during a delayed goal GET. Confirm no subsequent goal PUT starts. Sign into another test account: backup must explicitly refuse transfer and preserve local goals; the second account must receive no first-account goal upload. Sign back into the original account and verify retry.
8. In Settings, revoke/regrant Usage Access and Accessibility separately. Return to the app and verify capability reasons change; a service that is enabled but stopped must not be reported as running. Repeat force-stop/relaunch and reboot on the physical OEM device. Local minutes must remain independent of backend connectivity when Usage Access is granted.
9. Disconnect the staging backend and verify cloud status becomes unavailable after refresh while permitted local minutes remain accurately described. Restore it and retry. Installed unapproved Instagram/YouTube versions must remain labelled unverified; do not edit approval lists to pass this exercise.
10. Using only a controlled staging entitlement fixture or an existing licensed test account, exercise active, expired and old-binary/missing native entitlement states. Confirm capability reporting follows the native expiry boundary and never claims reel-count blocking. No paid purchase or production entitlement modification is required by this milestone.
11. Record screenshots, sanitized requests/results and observed failures. Do not claim device verification until these steps have actually been performed. Counting-accuracy certification and unrelated social/billing milestones remain separate work.
