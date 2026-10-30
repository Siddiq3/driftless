# Guest-to-account lifecycle audit and fix

## Phase 1: read-only findings

Inspected Google session transitions, account discovery/bootstrap, JS scope/import journals, the native accessibility recorder/SQLite store and bridge, personal-history upload/hydration, API schemas/handlers, account-usage ledgers, dashboard/progress/history readers, and existing migration/isolation tests.

Existing behavior: logout hides account data and creates a separate guest scope; this is intentional isolation, not account deletion. Verified account bootstrap binds the current guest source to one incarnation, imports native aggregates/events transactionally, copies goals, uploads cumulative device-day snapshots, reads them back, and only then marks the JS import journal verified. Native `scope_bindings` and captured recorder routing already protect exactly-once imports and delayed callbacks. Event package, date, timezone, timestamp, session ID, and sequence are retained by native migration. No production data was accessed.

Concrete defects/gaps:

1. `selectPersonalSession` switches the native recorder into a `pending:` scope during authentication. Only `guest:` sources are eligible for import, so videos recorded while account discovery/restore is in flight can be stranded in that temporary scope. The JS pending scope is useful for privacy, but recordings need a durable unowned guest source until ownership is verified.
2. Personal backup uploads only a combined `personalViews` total. `aggregateDay`, the shared strict API contract, backend history projection, JS history cache, and native `synced_daily` cache have no supported-app breakdown. Reinstall/restored-device history therefore cannot restore Instagram and YouTube independently. The raw native local records do preserve their package identities.
3. Dashboard/Progress app rows read local `Daily.apps` while their total reads merged `PersonalMeasurement`. Restored history can therefore appear in the total but disappear from platform-specific counters. Attribution cannot safely be inferred from a combined total.
4. Guest verification compares combined views/minutes but not platform attribution. A successful readback must verify the added breakdown as well.
5. Existing JS migration tests mock a fixed Instagram total and do not exercise the requested repeated logout/login numerical sequence. Native tests cover exactly-once import and delayed writers, but not the complete mixed-platform 80 → 115 → 130 sequence.

Implementation will preserve account discovery/incarnation checks, explicit registration behavior, original event dates/timezones, recorder deduplication, retained guest sources and journals, immutable retries, cloud-consent boundaries, and competitive validation. Cloud backup remains daily aggregates, not raw event/content uploads. Legacy combined-only cloud rows must retain unknown attribution rather than fabricate platform counts. No production deployment or data reset is authorized.

## Additional defects confirmed during implementation and regression testing

- Personal UsageStats refresh used signed-in accounting intervals for the visible daily history. After a guest import, that could overwrite personal minutes with only the signed-in portion. History now reads the imported scope intervals; allowance accounting still reads only signed-in intervals. Unavailable interval reads preserve saved values instead of overwriting them with a partial measurement.
- The native interval queries passed string-bound values into SQLite scalar `MAX`, `MIN`, and `COALESCE` expressions without numeric casts. Those expressions do not inherit the column's numeric affinity. They could clip signed-in intervals to the wrong start or exclude closed guest intervals. Both readers now explicitly cast all comparison/clipping boundaries to integers. A regression proves two minutes of personal history (one guest, one signed-in) while the accounting ledger records only one signed-in minute, across repeated refreshes.
- Account bootstrap automatically registered a fresh account for a deleted incarnation. Deleted accounts now remain behind recovery UI until the user selects **Create a new account**. This uses a fresh registration operation ID and the previous-incarnation guard; retries retain the same operation. Active-account sign-in does not register another profile. First-time Google signup and existing backend registration/lifecycle checks remain intact.

## Phase 2: final implementation

### Account transitions and ownership

`src/data/session.ts` retains a durable, unowned native guest source during authentication while JS selects a pending scope and keeps account screens hidden. The verified incarnation is selected natively before the guest snapshot is copied, so the recorder's final guest session is flushed into the source first. Existing bound native recorder callbacks route to the original target, and both native and JS import journals retain their exactly-once/one-owner behavior. Interrupted imports resume only for their assigned incarnation. A newly logged-out guest session is separate from the previous account and from already claimed guest sources.

`src/auth/account.tsx` adds the explicit deleted-account creation action. Existing startup loading/error/retry behavior still prevents partial history from being shown as a fresh zero account. `src/sync/accountBackup.ts` now verifies platform counts as well as views/minutes/revision before marking guest imports verified.

### Private platform backup and restore

The optional `personalAppViews` aggregate field maps the original supported Android package names to recorded counts. The shared backend contract rejects unsupported package keys, invalid counts, iOS video attribution, and complete known breakdowns that disagree with `personalViews`. Backend usage upserts keep the existing per-incarnation/device/day keys, monotonic revisions, and idempotency behavior. History returns the new field only with `includePersonal=true`, alongside personal totals. A newer legacy-client total without a breakdown clears outdated attribution rather than attaching it to the wrong total. No raw events or content are uploaded, and competitive views/accuracy gates are unchanged.

Native `SqliteStore.personalMeasurement` merges platform attribution per device. A cloud copy of this phone overlaps its local observations; it is never added again. Distinct devices add. Account allowance snapshots may contribute their existing package measurements, but only a reconciled breakdown matching the displayed total is exposed. Legacy combined-only history stays known as a total while unprovable platform attribution remains unavailable.

`src/data/personal.ts` attaches this private display breakdown to personal day snapshots. Dashboard app counters, Progress daily/weekly app rows, Counter app rows, and daily/weekly recaps now use that attribution. The Counter labels app minutes as **Minutes on this phone** because per-app cloud minutes are not part of this change. Native local `Daily.apps` remains the source of recorded observations for backup; restored counts are not restaged as this installation's activity. Existing observer notifications invalidate personal/history/progress caches after scope changes and hydration. Hourly charts retain actual local events and never invent hourly distributions for restored totals.

### Database/schema changes

- JS SQLite v5 → v6: nullable `daily_cache.app_views_json` column; existing daily rows remain intact.
- Android SQLite v5 → v6: nullable `synced_daily.app_views_json` column; no recorder/event schema replacement or reset.
- DynamoDB: optional attribute on existing device-day items; no table/index/infrastructure migration.
- Mobile uses the existing compatible local schema extension over contracts 0.4; no package publication, new app dependency, or vendored package replacement is required.

### Files changed

App repository:

- `src/data/session.ts`, `src/auth/account.tsx`: durable recording source, verified transition, explicit deleted-account creation.
- `src/api/personalUsage.ts`, `src/sync/aggregate.ts`, `src/sync/accountBackup.ts`: schema, platform attribution, fingerprints, readback verification.
- `src/db/migrations.ts`, `src/data/hydration.ts`: cache schema and restoration.
- `modules/tracking-android/android/src/main/java/app/driftless/tracking/android/SqliteStore.kt`, `UsageReader.kt`: native cache, per-device attribution, numeric interval boundaries, personal versus allowance time.
- `modules/tracking-android/src/types.ts`, `src/data/personal.ts`, `src/tracking/candidateCount.ts`, `src/activity/model.ts`, `src/wrapped/model.ts`, `app/tracking.tsx`: shared display data and consistent platform totals.
- Regression tests: `GuestAccountLifecycleTest.kt`, `test/guest-migration.test.ts`, `test/account-lifecycle.test.tsx`, `test/personal-architecture.test.ts`, `test/activity.test.ts`, `test/candidate-count.test.ts`, `test/migrations.test.ts`, `test/wrapped.test.ts`.

Backend repository:

- `packages/contracts/src/v1/index.ts`: optional validated package breakdown.
- `services/api/src/modules/usage.js`: persistence, private history projection, stale-attribution handling.
- `services/api/test/usage.test.js`: platform scenarios, retry/revision behavior, invalid payloads, account isolation, legacy compatibility.

## Phase 3: executed automated validation

| Check | Result |
|---|---|
| Full app Jest suite | 522 passed in 61 suites |
| Full native Android tracking suite | 225 passed; 0 failures/errors/skips |
| Full backend API integration suite | 236 passed in 20 files |
| Shared contract tests | 99 passed in 7 files |
| App TypeScript and Expo lint | Passed |
| API and shared contract lint; contract typecheck | Passed |
| Shared contract build and API bundle build | Passed |
| Changed TS/TSX/JS formatting and both repository diff checks | Passed |

Backend tests used an official DynamoDB Local runtime on port 8077 with an in-memory database. Test setup created random, isolated tables and removed them on completion; no production data or infrastructure was used. The task-owned service was stopped after tests.

Logs: `/private/tmp/scrollsnooze-guest-migration-app.log`, `/private/tmp/scrollsnooze-guest-migration-native.log`, `/private/tmp/scrollsnooze-migration-backend-full.log`, `/private/tmp/scrollsnooze-migration-contracts.log`.

## Phase 4: expected versus observed results and final audit

| Scenario | Expected Reels / Shorts / Total | Observed in automated fixtures |
|---|---|---|
| A: original Account A observations | 50 / 30 / 80 | 50 / 30 / 80 |
| B: guest after logout | 20 / 15 / 35 | 20 / 15 / 35, separate source |
| C: same-account guest import | 70 / 45 / 115 | 70 / 45 / 115 |
| D: second guest import (+10 / +5) | 80 / 50 / 130 | 80 / 50 / 130 |
| Repeat import without new observations | 80 / 50 / 130 | Unchanged after repeated imports; cloud retries unchanged |
| Instagram-only then YouTube-only guest imports | 7 / 9 / 16 | 7 / 9 / 16, matching event package counts |
| New installation: restored old-device 80 + guest 35 | 70 / 45 / 115 | 70 / 45 / 115; only local 35 restaged |
| Concurrent recording and repeated import | 10 / 10 / 20 | 10 / 10 / 20 unique events |
| Imported personal time versus allowance time | 2 personal minutes / 1 signed-in minute | Exact match across repeated refreshes |

**Retry/deduplication:** native transactions roll back a deliberately interrupted import, leaving source events recoverable. Duplicate event IDs and session/sequence pairs do not increment counts. Late captured guest callbacks resolve to their bound account once. JS tests retain copied/bound sources across upload failure, lost readback, process reopen, and missing platform readback; verification succeeds only after matching server data is returned. Backend tests exercise repeated idempotency keys, repeated equal revisions, and stale revisions without count inflation. Event records keep their original package, timestamps, timezone, local date, session ID, and sequence through import, including both sides of local midnight.

**Isolation:** logout hides Account A's data rather than deleting it. A later unowned guest source can bind to Account B under the existing first-verified-owner policy; A's private local/cloud history is not imported. Bound guest sources cannot be reassigned to B. Native tests retain A's original/merged history after B's separate import; backend API tests show no A rows through B's authenticated history. Existing account deletion/incarnation, consent, social, billing, goals, and lifecycle suites also pass.

**Release/manual requirements — NOT VERIFIED:** actual Google authentication and counting live Reels/Shorts through a physical phone's AccessibilityService; installing/upgrading the resulting app on the user's phone; visual/device validation of the adjusted Counter/recovery copy; actual uninstall/reinstall and timezone-travel flows against a deployed backend. The above observed numbers are deterministic isolated automated fixtures, not a claim about the user's current installed app.

The new API must be released before distributing the updated app because the previous strict API rejects the new optional upload field. These native/schema changes require a rebuilt Android app. Nothing was deployed, installed, committed, or pushed by this task. Combined-only old cloud history cannot regain an Instagram/YouTube split if the original local/platform records are gone, and expired raw events cannot regain hourly detail. Older ambiguous `pending:` datasets are not automatically claimed or swept into a new incarnation.

## Follow-up: restored account 50 versus War 40

Read-only inspection of the user's approved local native database copy showed an account-day snapshot with 35 Instagram and 15 YouTube observations for one prior device. The same device's older personal-history projection had a combined 40 and no breakdown. The active scope held no daily recorder rows or raw events. No identifiers or private database payloads are committed here.

The native attribution reader now accepts that device's recorded account breakdown when its account count covers the combined-only personal observation. It still verifies that the resulting per-app sum equals the displayed total; a legacy personal count larger than the known accounting count remains unattributed. This exposes the known 35/15 split without inventing events or re-uploading restored observations.

The War daily-board endpoint now reconciles each device's personal history and account usage with the larger known cumulative count, then adds distinct devices. It reads actual `used.views`, never reserved grants, ignores expired accounting items, and preserves existing sharing-consent checks and unknown personal-only measurements. Competitive challenge scoring is unchanged. Backend commit `797ff37` contains this correction.

The hourly chart now explains that a saved total can exist without hourly records on this phone. It retains unknown bars when timestamps are absent rather than distributing a restored total arbitrarily.

Validation: 523 app tests, 226 native tests, and 237 backend integration tests passed. App TypeScript/lint, backend lint/build, and diff checks passed. A fresh ARM64 debug APK built successfully. Tests explicitly cover personal 40/account 50 yielding 50 and 35/15, larger personal 80 retaining unknown attribution, other-device addition, reserved-credit exclusion, repeated reads, expired snapshots, and sharing revocation.

### Production and phone confirmation

Backend main includes `797ff37` (daily War reconciliation) and `53717a6` (same-operation concurrent battle-create receipt replay). The original concurrent test exposed a real interleaving: a retry saw the winning pair after its initial receipt read, then incorrectly returned `battle_exists`. The narrow fix rechecks the operation receipt at that boundary. A deterministic regression forces this exact interleaving. The full backend suite passed 238 tests. GitHub Actions run 41006327542 passed CI, production deployment, and live API/authentication smoke checks.

Installed the updated ARM64 debug APK with `adb install -r`, preserving existing app data. Live UI inspection then confirmed Home total 51, Instagram 36, YouTube 15; Progress total 51 and actual hourly bars for newly recorded local activity; and, after production deployment, War's accessible daily count 51. Missing old raw events remain unrecoverable. The private database copied with explicit user approval stays under `/private/tmp` and is not committed.
