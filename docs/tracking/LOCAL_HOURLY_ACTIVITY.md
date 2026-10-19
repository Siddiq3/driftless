# Local hourly activity filtering fix

The daily Progress chart can display locally recorded Instagram and YouTube views even when their approved-version lists are empty. Local visualization does not certify those views for cloud submission, goals, recaps, or battles.

## Root cause and event path

`Recorder` persists counted views into `SqliteStore.recordView`. That transaction inserts the event and increments the daily total only once: both `event_id` and `(session_id, seq)` are unique. The popup sums the supported apps' saved daily views without requiring an approved app version.

The hourly chart previously had two independent validation gates. `WrappedDetails.read` discarded events whose app versions failed `isValidatedVersion`, while `activityData` required a daily total from the cloud-facing `aggregateDay`. The bundled approved-version lists are empty, so eligible local views disappeared from both sides of that comparison.

## Files changed

- `modules/tracking-android/android/src/main/java/app/driftless/tracking/android/WrappedDetails.kt`: exposes a separate local-activity reader, sharing the existing bucketing/session implementation. Only that local path omits the app-version accuracy check. The existing recap reader remains validated.
- `modules/tracking-android/android/src/main/java/app/driftless/tracking/android/Platform.kt`: treats a missing approved-version list as empty. Version validation therefore continues to fail closed.
- `modules/tracking-android/android/src/main/java/app/driftless/tracking/android/TrackingModule.kt`: exposes `getLocalActivityDetails` through the native bridge.
- `modules/tracking-android/src/index.ts`: provides `Tracking.localActivityDetails`, explicitly documented for local charts only. Older binaries return unavailable rather than substituting incomplete validated data.
- `src/activity/useActivity.ts`: reads local activity details for the daily chart.
- `src/activity/model.ts`: compares daily buckets against the same supported-app local daily totals used by the popup; displays matching local per-app totals. Weekly totals and minutes retain their previous behavior. This change does not mutate cloud aggregates or validation flags.
- `modules/tracking-android/android/src/test/java/app/driftless/tracking/android/LocalActivityDetailsTest.kt`: four native regression tests.
- `test/activity.test.ts`: five additional daily chart cases, including separate Instagram/YouTube cases, and existing regression coverage retained.
- `test/sync.test.ts`: verifies syncing/restaging does not validate or duplicate the displayed local counts.

## Preserved boundaries

The native chart reader still requires a supported package, an ordinary `VIEW` event, the current detection-rule version, and a matching stored local date. Ads remain separate. Each event's existing `countedAtMs` and recorded timezone determine its hour; the stored local-date tag remains authoritative, including travel and midnight transitions.

The chart reads SQLite only. It neither merges cloud records into local events nor inserts new events. Existing recording deduplication and sync idempotency are unchanged.

`src/sync/aggregate.ts` remains unchanged and continues excluding unvalidated views/ad views from submissions. Neither `src/sync/run.ts` nor backend scoring code changed. The existing recap reader, weekly chart, goal evaluation, cloud coverage checks, leaderboard consent checks, and competitive scoring rules remain in place. Local chart results are not supplied to any of those paths.

## Executed regression checks

- Full app Jest suite: **155 passed**, including local Instagram/YouTube display without validation, per-app totals, count reconciliation, empty/missing validation metadata, event-only days, unknown/malformed hourly detail, unchanged weekly behavior, cloud exclusion, and sync replay without duplicate local counts.
- Full tracking Android unit suite: **96 passed**, including the four new tests for empty approved lists, agreement with popup totals, duplicate event/session suppression, preserved recap validation, recorded timezone/midnight/travel boundaries, date filtering, unsupported packages, ads, old-rule exclusion, and missing configuration/version metadata.
- Existing backend `social.test.ts` and `usage.test.ts`: **25 passed** against a dedicated in-memory DynamoDB Local instance on port 8064. This includes unchanged battle-score exclusion of null view counts and low-coverage days, plus existing usage-submission validation/idempotency behavior. The test service was stopped afterward. No deployed data was accessed.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `git diff --check`: passed.

- Android `:tracking-android:testDebugUnitTest :app:assembleDebug --offline`: passed; debug APK built successfully in 2m 33s. Existing dependency deprecation warnings remain.
- APK: `android/app/build/outputs/apk/debug/app-debug.apk`. Not installed or deployed by this task.
- Build log: `/private/tmp/driftless-local-hourly-native.log`.

## Limitations and intentional differences

- A native rebuild/install is required to expose the new bridge method; JavaScript-only reloads cannot add it.
- Raw events are retained for 30 days. Older daily totals can remain available after their hourly detail has expired.
- Events from older detection-rule versions remain excluded from detailed charts, as before. If their saved daily totals no longer reconcile with retained eligible hourly events, the chart keeps its existing unavailable state rather than inventing a distribution.
- Weekly charts and validated recaps may differ from the daily local chart because their existing accuracy gates are intentionally unchanged.
- No UI redesign, database migration, authentication change, permission change, production rules change, or deployment is included.
