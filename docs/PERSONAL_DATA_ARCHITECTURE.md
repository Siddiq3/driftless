# Personal data architecture — 24 October 2026

## Audit and plan (recorded before implementation)

Existing uncommitted automatic-backup, cancellation, invitation and native-view fixes are the baseline and must be preserved. No commit, main merge, deployment or release is authorized by this task.

- Native daily/events/rings/heartbeats and JS goals/usage queues are installation-wide. The current backup owner marker refuses another owner but does not isolate cached screens or native background writes.
- Home (`useProgress`), Activity (`useActivity`), History, Stats (`progress`), Recap (`readPhoneWrap`/`useWrap`), War (`CircleBoard`), the widget and floating counter read or calculate counts independently. Some personal screens apply competitive validation while others show recorded counts.
- `AccountBackupProvider` owns an upload worker, but scans history every minute and does not hydrate history. Goal GET/merge works, whereas `usageHistory` has no consumers. Recap independently fetches a server wrap. Settings and Friends make additional profile reads. UI timers independently refresh native UsageStats.
- The existing usage engine already freezes bounded batches with stable request keys, uses revisions, and supports retry backoff. It should be retained. Existing goals use conditional writes and preserve unsynced edits.
- Server routes derive ownership from the verified caller. Competition requires approved detector versions, coverage and sharing. Unvalidated counts must remain local; personal presentation must not change competitive eligibility.

Plan: forward-only scope migrations in the existing SQLite stores; durable guest-to-account binding; captured-scope native recorder writes and scoped JS operations; one personal measurement/read repository for screens and floating count; shared/in-flight-deduplicated account hydration using existing history/goals routes; incremental upload/acknowledgement and lifecycle cancellation; focused guest, migration, restoration, request-deduplication, partial-failure and isolation tests followed by broader suites. Preserve ambiguous legacy records locally. Keep existing 400-day server retention and competitive rules.

Implementation and validation results will be appended after the changes are exercised. Device scenarios must not be claimed from mocked tests.

## Resulting architecture

```text
Native recorder / Android UsageStats
    -> existing scoped native SQLite (raw personal measurements)
    -> shared personal repository and native personal snapshot
    -> Home / Activity / History / Stats / Recap / your War row / floating counter / widget

Authenticated lifecycle -> server /me resolves account -> durable scope/import journal
    -> existing goal merge + frozen usage queue -> existing account-authorized endpoints
    -> shared history hydration -> scoped JS daily_cache + native synced_daily cache

Friend rankings -> existing server competitive endpoint (approval + coverage + explicit sharing)
```

Guests stay entirely local. Native and JS scopes are selected before exposing an authenticated/guest UI. A new guest interval gets a new dataset identity; the same account can import later guest periods once. Pending authenticated data has a distinct scope while backend identity resolution is offline. Source records are preserved in the JS store; a native import transaction transfers records under a durable one-owner binding, so repeated import is a no-op. An old recorder remains bound to its original owner, including callbacks finishing after a scope switch. UsageStats refreshes are restricted to owned time intervals, avoiding a full-device refresh repopulating another account’s history.

The local read repository combines native observations with clean synchronized summaries per source device. A local source-device row takes precedence over its own uploaded summary to avoid double-counting. Other-device supported summaries restore into a revision-upserted cache. Local dirty goals retain their stable IDs and are reconciled using the existing conditional server writes. Guest migration completion is recorded after goal synchronization, acknowledged usage, and account-cache hydration. Failures preserve source rows, journals and pending payloads.

Personal displays preserve experimental observations; validated-goal outcomes can still be unknown. Friend comparisons and challenges now prefer recorded personal totals after the user’s subsequent challenge-fix request; sharing consent remains required, and legacy rows retain their coverage fallback. The subsequent personal-count backup fix adds `personalViews` for recorded personal reel totals under the existing sign-in backup consent. These totals restore to personal screens and, when shared, feed comparisons independently of the legacy approved `views` field. Raw events and hourly session detail remain local. Account backup remains included in sign-in; friend sharing remains separate. Existing server authorization and 400-day aggregate retention are unchanged.

## Request ownership, refresh and duplicate prevention

- Shared credential-getter/base-URL/query keys coalesce simultaneous GETs, including separate API-client wrappers for one session. Different credential getters do not share results. Retired credentials and cancelled callbacks cannot apply late responses.
- A per-account/scope hydration promise coalesces history reads. Personal screens do not request account history or server wraps directly. Initial hydration reads at most the existing 400-date API range; subsequent foreground hydration reads recent dates after its freshness interval. Explicit full invalidation is available to the coordinator. Timers only retry pending work/check local revisions; they do not redownload complete history.
- One serialized upload coordinator reuses the existing goal and usage engines. Native data revisions and JS invalidations determine whether work is needed. Existing exponential backoff with jitter and bounded 31-date batches remain. Raw native tracking is independent of network availability.
- Usage retry bodies and idempotency keys remain frozen, and successful acknowledgements never cover newer edits. A partial response retains the original batch/key; replay uses the existing duplicate-safe server upserts. Native imported totals are transactionally journalled; JS goal collisions merge once with stable identity and a revision above both inputs.
- There is no second background uploader; native tracking only persists locally. A foreground worker and manual refresh cannot independently drain the same queue.

## Validation

Final JavaScript results: **305 tests passed in 35 suites**. Native results: **121 tests passed**, no failures/errors/skips. Unchanged backend results: **130 tests passed in 14 files**. TypeScript, targeted-source ESLint, changed-file Prettier and `git diff --check` pass. Tests use real SQLite adapters and Robolectric with controlled network/SDK inputs. Backend tests use a **new in-memory DynamoDB Local on port 8079** with table `driftless-architecture-regression-20261024`, never a shared endpoint or real account. No provider, production mutation or private payload logging was required.

Covered: local guest operation; guest goals/history upload using existing engine tests; idempotent import and repeated login; interrupted native/JS journal progress; same-account/new-account transitions; native delayed callback isolation; persisted native scope across reopen; file-backed JS queue reopen; shared request/hydration deduplication; absence of history calls from personal screen selection; bounded multi-batch/partial-response retries; no experimental promotion; 400-date retention; same-device deduplication during restore; and revision-preserving cache merges.

## Remaining validation and limits

- Physical-device counting accuracy, actual Google SDK account switching, a live backend new-device restore, connectivity/reboot/process-kill boundaries, Android OEM background behavior and visual QA across restored-history screens still need device execution. Robolectric/file reopen tests are not those device scenarios.
- Ambiguous legacy records remain under `legacy`, without automatic reassignment to an arbitrary new account. Exact prior backend-owner evidence can bind them; unresolved legacy data needs a deliberate recovery UI before broad rollout.
- Raw events, per-app breakdowns, hourly detail and setup answers are not added to the cloud contract. Recorded daily personal totals are included by the subsequent backup fix. A restored server total may therefore have no corresponding local per-app/hour breakdown. Older mixed-timezone legacy aggregates cannot reconstruct metadata that was never saved.
- Native schema v3 and JS v5 require a rebuilt app. The APK produced earlier in the conversation predates this architecture work and must not be used to claim validation of these changes.
- Full history has no server incremental-change token. Foreground incremental reads cover recent dates; a remote edit/backfill to an older date requires an explicit full hydration. No polling loop downloads all historical dates.
- Existing account-deletion/concurrent-backend-write audit issues are not reclassified by this architecture change. No production safety or detector-accuracy certification is claimed.

## Changed files and reasons

This inventory includes the retained uncommitted automatic-backup, onboarding and invitation changes that existed before this task, as well as the architecture additions. The original baseline patch was saved outside the repository before editing. Backend source is unchanged.

| File | Reason |
|---|---|
| `app/_layout.tsx` | Mount shared synchronization and prevent personal screens from rendering before safe session selection. |
| `app/disclosure.tsx` | Preserve the sign-in backup disclosure; separate personal data from friend sharing. |
| `app/friends.tsx` | Preserve handle setup guidance and discard stale account loads. |
| `app/history.tsx` | Read canonical measurements and observe scope/cache updates instead of calculating independent totals. |
| `app/privacy.tsx` | Preserve prior pause-before-deletion behavior and explain automatic backup. |
| `app/settings.tsx` | Remove the separate backup switch and duplicate sync worker/profile polling; show shared worker status. |
| `app/stats.tsx` | Explain experimental personal measurements without changing competition rules. |
| `app/tracking.tsx` | Read diagnostic raw observations through the shared repository and coalesce UsageStats refreshes. |
| `app/welcome.tsx` | Preserve pre-sign-in notice that supported history backs up automatically. |
| `docs/GOOGLE_SIGN_IN.md` | Document the current flow, preserve prior design context and distinguish tested behavior from remaining device validation. |
| `docs/GUEST_DATA_MIGRATION.md` | Document the current flow, preserve prior design context and distinguish tested behavior from remaining device validation. |
| `docs/PERSONAL_DATA_ARCHITECTURE.md` | Document the current flow, preserve prior design context and distinguish tested behavior from remaining device validation. |
| `docs/PRIVACY_AND_DATA_RETENTION.md` | Document the current flow, preserve prior design context and distinguish tested behavior from remaining device validation. |
| `docs/SOCIAL_COMPARISONS.md` | Document the current flow, preserve prior design context and distinguish tested behavior from remaining device validation. |
| `modules/tracking-android/android/src/main/java/app/driftless/tracking/android/CountWidget.kt` | Read the canonical native personal measurement instead of applying an independent count gate. |
| `modules/tracking-android/android/src/main/java/app/driftless/tracking/android/DriftlessAccessibilityService.kt` | Flush/restart recorder at scope changes and use the same personal count for the floating counter. |
| `modules/tracking-android/android/src/main/java/app/driftless/tracking/android/SqliteStore.kt` | Native v3 scope migration, captured recorder owners, idempotent guest import, clipped usage ownership intervals, revisioned remote cache and canonical measurement read. |
| `modules/tracking-android/android/src/main/java/app/driftless/tracking/android/TrackingModule.kt` | Bridge scope transitions, retained dates, measurement metadata and restored personal summaries. |
| `modules/tracking-android/android/src/main/java/app/driftless/tracking/android/UsageReader.kt` | Refresh only usage intervals owned by the selected scope and serialize against scope changes. |
| `modules/tracking-android/android/src/test/java/app/driftless/tracking/android/AccountScopeTest.kt` | Exercise native account isolation, late callbacks, guest replay, cache upserts and database reopen. |
| `modules/tracking-android/android/src/test/java/app/driftless/tracking/android/AndroidLayerTest.kt` | Create the full legacy native schema when testing v1 upgrade preservation. |
| `modules/tracking-android/android/src/test/java/app/driftless/tracking/android/BlockingUsageRefreshTest.kt` | Give synthetic usage a matching test ownership interval. |
| `modules/tracking-android/android/src/test/java/app/driftless/tracking/android/StoredDatesTest.kt` | Preserve retained-date enumeration regression coverage. |
| `modules/tracking-android/src/index.ts` | Expose scoped session, snapshot, revision, retained-date and restored-cache bridge capabilities. |
| `src/activity/model.ts` | Use shared personal measurement definitions for daily and weekly totals. |
| `src/activity/useActivity.ts` | Read the repository and coalesce native refreshes. |
| `src/api/client.ts` | Share in-flight GETs by credential getter/base URL/query; add cancellation to history/profile requests; reject retired session responses. |
| `src/auth/InviteSignInSheet.tsx` | Preserve automatic-backup disclosure before the invite sign-in action. |
| `src/auth/session.tsx` | Select a safe local guest/account scope on restoration, sign-in and sign-out. |
| `src/data/hydration.ts` | Deduplicate account restoration, merge revisions into existing caches, retain 400 dates, and read incrementally after hydration. |
| `src/data/measurement.ts` | Define one personal measurement rule independent of competitive approval. |
| `src/data/personal.ts` | Cache canonical local/native snapshots and coalesce UsageStats refreshes across personal screens. |
| `src/data/session.ts` | Coordinate native/JS scope transitions, durable guest bindings, resumable import and completion acknowledgements. |
| `src/db/index.ts` | Separate the raw database coordinator from scoped handles used by application operations. |
| `src/db/migrations.ts` | Forward-only schema v5 adds composite scope identities, account metadata and guest import journals; preserves legacy data. |
| `src/db/scope.ts` | Capture scope in DB handles, reject stale handles, and publish repository invalidations. |
| `src/goals/progress.ts` | Display canonical personal measurements while preserving conservative validated-goal decisions. |
| `src/goals/store.ts` | Scope goal identities, aliases, tombstones and acknowledgements; preserve local edits and cancellation checks. |
| `src/goals/sync.ts` | Preserve conditional merge/write engine and fence late merges and acknowledgements. |
| `src/goals/useProgress.ts` | Read shared snapshots and refresh on account/cache invalidations. |
| `src/onboarding/SetupFlow.tsx` | Preserve automatic continuation after Google login and explain automatic backup. |
| `src/social/CircleBoard.tsx` | Use repository personal totals, retain competitive friend fetching, and open handle setup before invitations. |
| `src/sync/AccountBackupProvider.tsx` | Own lifecycle retries; avoid redundant work using revisions and backoff, with no full-history download timer. |
| `src/sync/accountBackup.ts` | Reuse serialized worker; resolve ownership, upload through existing engines, hydrate local history and acknowledge imports. |
| `src/sync/aggregate.ts` | Keep unvalidated counts out of uploads and preserve captured timezone/measurement status. |
| `src/sync/engine.ts` | Keep frozen batch/key on partial responses and acknowledge successful rows without losing missing results. |
| `src/sync/ownership.ts` | Retain legacy-owner safeguards and validate resolved account scopes. |
| `src/sync/run.ts` | Stage changed scoped observations in bounded batches, excluding restored other-device rows. |
| `src/sync/sqliteRepo.ts` | Scope retry/day records and fence local writes/acknowledgements transactionally. |
| `src/tracking/candidateCount.ts` | Keep personal per-app values consistent with retained recorded counts, including after heartbeat expiry. |
| `src/ui/Focus.tsx` | Show experimental measurement status alongside the canonical personal count. |
| `src/wrapped/model.ts` | Build recaps from shared saved measurements; keep raw detail local. |
| `src/wrapped/useWrap.ts` | Remove screen-owned server fallback; observe the shared account cache. |
| `test/account-backup-provider.test.tsx` | Regression coverage/adapters updated for scoped schemas, shared personal measurements, cancellation, migration, restoration and unchanged competitive rules. |
| `test/account-backup.test.ts` | Regression coverage/adapters updated for scoped schemas, shared personal measurements, cancellation, migration, restoration and unchanged competitive rules. |
| `test/activity.test.ts` | Regression coverage/adapters updated for scoped schemas, shared personal measurements, cancellation, migration, restoration and unchanged competitive rules. |
| `test/api-client.test.ts` | Regression coverage/adapters updated for scoped schemas, shared personal measurements, cancellation, migration, restoration and unchanged competitive rules. |
| `test/candidate-count.test.ts` | Regression coverage/adapters updated for scoped schemas, shared personal measurements, cancellation, migration, restoration and unchanged competitive rules. |
| `test/circle-board.test.tsx` | Regression coverage/adapters updated for scoped schemas, shared personal measurements, cancellation, migration, restoration and unchanged competitive rules. |
| `test/db-retry.test.ts` | Regression coverage/adapters updated for scoped schemas, shared personal measurements, cancellation, migration, restoration and unchanged competitive rules. |
| `test/goals-sync.test.ts` | Regression coverage/adapters updated for scoped schemas, shared personal measurements, cancellation, migration, restoration and unchanged competitive rules. |
| `test/google-session.test.tsx` | Regression coverage/adapters updated for scoped schemas, shared personal measurements, cancellation, migration, restoration and unchanged competitive rules. |
| `test/helpers/sqlite.ts` | Regression coverage/adapters updated for scoped schemas, shared personal measurements, cancellation, migration, restoration and unchanged competitive rules. |
| `test/personal-architecture.test.ts` | Regression coverage/adapters updated for scoped schemas, shared personal measurements, cancellation, migration, restoration and unchanged competitive rules. |
| `test/settings-capabilities.test.tsx` | Regression coverage/adapters updated for scoped schemas, shared personal measurements, cancellation, migration, restoration and unchanged competitive rules. |
| `test/setup-sign-in.test.tsx` | Regression coverage/adapters updated for scoped schemas, shared personal measurements, cancellation, migration, restoration and unchanged competitive rules. |
| `test/sync.test.ts` | Regression coverage/adapters updated for scoped schemas, shared personal measurements, cancellation, migration, restoration and unchanged competitive rules. |


## Reproduction commands and observed failures

- App: `node_modules/.bin/jest --runInBand --silent` — 305/305 tests, 35/35 suites.
- App types: `node_modules/.bin/tsc --noEmit` — exit 0.
- App lint: `node_modules/.bin/eslint src/data src/db src/auth/session.tsx src/goals src/sync src/wrapped src/activity app/history.tsx app/stats.tsx app/_layout.tsx app/friends.tsx app/settings.tsx app/tracking.tsx src/ui/Focus.tsx src/social/CircleBoard.tsx src/api/client.ts modules/tracking-android/src/index.ts` — exit 0.
- Native, from `android/`: `./gradlew :tracking-android:testDebugUnitTest --offline --no-daemon --max-workers=2 --console=plain` — 121/121 tests. Existing Kotlin/platform deprecation warnings remain.
- Backend, from sibling `services/api/`: `DDB_ENDPOINT=http://127.0.0.1:8079 TABLE_NAME=driftless-architecture-regression-20261024 pnpm exec vitest run --config vitest.config.js` — 130/130 tests, 14/14 files. The disposable in-memory DynamoDB process was stopped after the suite.
- Formatting: Prettier `--check` over every changed `.ts`, `.tsx` and `.md`; plus `git diff --check`.

Intermediate failures were not ignored: legacy positional SQL fixtures were updated for composite-scope schemas; the native v1 fixture now creates the full original schema; synthetic UsageStats tests now declare a matching ownership interval; the old War test expected a competitive replacement and now asserts a stable personal row; the retained-heartbeat Home test now expects recorded historical values; the new later-guest-import test exposed a missing journal entry for an already-known account, which was fixed and rerun. No test was removed to obtain these results. Test-only adapter mocks isolate SDK/network behavior; separate native and real-SQLite tests exercise actual scope and migration storage behavior.

## Git and artifact state

Branch: `feature/automatic-account-backup`. Changes remain **uncommitted**. Backend branch: `main`, clean and unchanged. All pre-existing uncommitted app work was retained and integrated. No commit, merge, push, deployment or release was performed. No new APK was built for this architecture revision; earlier APK links are stale for this source.

## Personal reel-count backup fix — 24 October 2026

User-reported reproduction: uninstall/reinstall and sign in to the same account restored minutes but reel totals restarted at zero. The previous upload deliberately omitted local recorded totals when detector versions had no accuracy approval; reinstall removed the only copy. The user authorized backing up their recorded personal counts.

`personalViews` is an optional, bounded integer (0–100,000) on an existing device-day aggregate. It remains a separate field from legacy approved `views`; the subsequent challenge fix also uses it for comparisons after explicit sharing. The existing scope-bound queue, frozen retries, revision acknowledgements, authenticated ownership, cloud-sync consent and 400-day retention apply. Local days still present on the phone are restaged once because their fingerprint now includes the personal total, including positive counts whose historical heartbeats have expired. Restored summaries are not restaged as new local observations.

The app requests `includePersonal=true` for account history and maps personal totals into the existing personal-only JS/native presentation caches. Legacy rows fall back to their existing approved count. No database schema change is required. Old clients receive the previous history response shape unless they opt in, and conditional server updates preserve personal totals when an old client omits the field. The subsequent challenge fix, authorized by the user, lets shared friend/challenge comparisons prefer `personalViews`; membership and explicit sharing remain required.

Rollout: deploy the updated API (including its locally built contracts) before distributing the updated app. The app includes a compatible schema extension over published contracts 0.4, so publishing a new contracts package is not required for the app build. No production deployment, commit or push was performed for this fix. A production account/reinstall restoration has not been exercised. Counts erased before they were ever uploaded cannot be recreated from usage minutes; this fix protects recorded totals that remain available to sync and future counts.

Regression coverage includes empty-install restore through the real queue/API parser/SQLite cache with controlled transport; retained historical backfill; server retries, revision ordering, owner isolation and old-client compatibility; friend rankings with a distinct personal total; and real native cache restoration with new local observations and account isolation. Final validation: 316 app tests in 36 suites, 126 native tests, 132 API tests in 14 files, and 88 contract tests in 5 files pass. TypeScript, targeted lint, changed-file formatting, backend build and `git diff --check` pass. API tests used only a new in-memory DynamoDB Local on port 8083 with table `driftless-personal-count-regression-20261024`, which was removed afterward.

## Recorded-count challenge fix — 24 October 2026

The user subsequently authorized using recorded counts in challenges as well. A shared server helper selects `personalViews` when known (including zero), otherwise a legacy non-null `views` value with at least 80% coverage. Friend and challenge routes apply their existing explicit consent and access checks before returning any count. Multiple source-device rows are combined once per date, with incomplete video days left unknown; the same source-device/date remains duplicate-safe under the existing revision writes. Video challenge scores retain their existing daily-average scoring rule. Minute and minute-goal scoring are unchanged. This supersedes the earlier personal-only restriction; no detector approval list was falsified or certification claimed. Live deployment/reinstall/challenge verification remains outstanding.

## Publication authorization for count fixes

The user subsequently authorized committing and pushing the personal-count backup and recorded-count challenge fixes to `main` in both repositories. Final combined checks: 316 app tests, 126 native tests, 135 API tests and 88 contract tests pass; TypeScript, targeted lint, formatting and backend build pass. The challenge suite used a separate disposable DynamoDB Local on port 8084 and table `driftless-challenge-count-regression-20261024`, removed after the suite. Earlier no-commit statements record the state before this authorization. This push does not itself establish a deployed backend or a released app; live restore and challenge verification remain outstanding.
