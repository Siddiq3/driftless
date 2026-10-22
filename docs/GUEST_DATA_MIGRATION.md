# Guest data migration and account isolation

Inspection: 22 October 2026. Status: implementation design; migration is not implemented or release-certified.

## Required behavior

- Guests can track and edit goals offline.
- Login performs one resumable, account-scoped import of the guest dataset. This does not turn on ongoing Cloud sync or friend sharing.
- Resolve the authenticated backend account and persist ownership before any upload. A failed request, logout, reinstall recovery, or different account must never redirect a pending import.
- Cloud sync off stops subsequent automatic uploads and downloads. Retrying the original frozen login import is a separate operation, not permission to upload new records.
- Preserve local records through upgrades, failures and account switches. Signing out changes the visible storage scope; it does not delete or reclassify account data as guest data.

## Existing implementation and gaps

| Area | Evidence | Required change |
| --- | --- | --- |
| Login | `src/auth/session.tsx` stores Google session preference and a Google owner marker; it does not import guest data. The backend maps Google subject to a different UUID in `services/api/src/lib/auth.ts`. | After login, resolve `/v1/me.userId`; do not use email, the Google subject or a caller-supplied user ID as the backend owner. Offline login leaves migration pending without guessing ownership. |
| JavaScript storage | `src/db/migrations.ts` has installation-wide goals, daily cache, sync days, sync batch and outbox tables. | Add owner scopes and migration journal using forward-only SQL. Scope every query, unique key, retry and acknowledgement. |
| Native storage | `modules/tracking-android/android/src/main/java/app/driftless/tracking/android/SqliteStore.kt` stores counts, events, rings and heartbeats without owner scope. The service writes while JS is closed. | Add native scope-aware reads and writes and a crash-safe scope transition shared with JS. Isolating the JS cache alone is insufficient. |
| History coverage | `src/sync/run.ts` stages seven dates. Native daily aggregates survive until wipe; raw events and heartbeats expire after 30 days. `UsageReader.kt` recomputes at most seven days. | Add a paginated native stored-date/snapshot API. Enumerate existing totals rather than recomputing a fixed window. Preserve unknown historical coverage as unknown; do not fabricate historical eligibility from today's health. |
| Goals | `src/goals/store.ts` claims `goal_backup_owner`; `src/goals/sync.ts` conditionally merges and writes. A second owner is refused, but local goal reads are global. | Reuse revision safety within the resolved scope. Preserve existing owner markers. Import into existing cloud goals without replacing unrelated goals. Handle the cloud limit of ten goals explicitly without deleting local overflow. |
| Usage retries | `src/sync/engine.ts` freezes one retry batch; `src/sync/sqliteRepo.ts` has no account key. | Freeze an owner-bound migration snapshot and reuse exact chunk bodies/keys. Serialize local outbox writes across all API-client instances. Separate migration receipts from ongoing sync revisions. |
| Backend write authorization | `services/api/src/modules/usage.ts` rejects usage sync with Cloud sync off. Goals GET/PUT do not check that preference. | Introduce a dedicated migration operation with a sealed manifest; do not bypass normal sync by toggling the preference temporarily. Guard automatic-sync endpoints consistently. |
| Backend read authorization | Wrapped checks Cloud sync. Usage history and goal reads do not. | Gate ongoing automatic downloads on both client and server. Keep explicit data export available. A migration receipt must not download account history. |
| Backup lifecycle | `app/settings.tsx` starts usage and goal backup after loading consent. `src/social/CircleBoard.tsx` has another upload entry point. | Route all automatic sync through one account- and preference-scoped coordinator. Start the login import from the root authenticated lifecycle, independently of Settings and ongoing sync. |
| Cloud sync switch | Settings patches the profile and cancels its own goal task on effect cleanup; usage sync has no equivalent lifecycle cancellation. | Stop new local work immediately on switch-off, persist a pending preference update if offline, abort requests where possible, and ignore late responses/merges. Resume only after explicit enablement and server confirmation. |
| Sign-out/account switch | Sign-out invalidates credentials and entitlement, but leaves device history, goals and retry state accessible. UI hooks read the native device store directly. | Cancel work first, change the native write scope atomically, reset UI state, and select a fresh guest scope. Never show or upload account A's cache as B's or as a new guest's history. |
| Deletion | `app/privacy.tsx` wipes native and JS stores separately. `services/api/src/modules/account.ts` deletes user-partition data, but idempotency uses separate keys. | Pause all workers before deletion. Include migration journals, receipts and ownership in explicit cleanup; prevent queued work from restoring deleted data. Resume only in the intended surviving scope. |

## Proposed migration protocol

1. Upgrade storage without dropping tables or rewriting native counts. Preserve an identifiable legacy account owner. Keep ambiguous legacy records local and excluded from automatic import until ownership is resolved; absence of a usage-owner marker does not prove the data is guest-owned.
2. Give each fresh guest scope a stable random ID. Once `/v1/me` resolves an account, journal a durable binding of that guest scope to the backend account before staging any network mutation. Restart must resume that same binding.
3. Seal the guest dataset at login, including a native write boundary. Continue new tracking under the account scope. Create immutable, versioned chunks containing only permitted daily aggregates and goals; raw events, item identities, session details and onboarding answers remain local.
4. Add a dedicated authenticated migration API, for example `POST /v1/guest-migrations` with chunk and completion/status routes. The server derives the destination from the verified caller. A sealed manifest binds migration ID, source scope, payload version, chunk count and hashes. It cannot be extended with later activity while Cloud sync is off.
5. Persist durable receipts for `(account, migration, chunk)`. Validate the payload hash and apply each chunk with its receipt atomically; acknowledge only committed data. Replaying an identical chunk is a no-op, while reusing its identity for different content is rejected. Existing generic idempotency records expire after 24 hours and are insufficient as the only import ledger.
6. Merge goals without whole-set replacement or silent overflow. Preserve per-device aggregate identity: importing a previously synced device-day must update that source, not add a duplicate device. Resolve existing migration/sync identities before choosing new IDs. Handle same-day guest/account segments without double-counting device-wide Android usage intervals.
7. Keep local rows and the frozen journal after offline failures, timeouts or lost responses. Retry network errors, throttling and server errors with backoff using unchanged chunks. Pause on authorization failure; report validation/ownership conflicts without deleting or silently rebasing the snapshot.
8. Mark migration complete locally only after the server confirms every chunk. A crash between server completion and local acknowledgement safely replays the same receipts. Completion does not enable Cloud sync or sharing and does not delete local history.

The cloud currently expires daily aggregates 400 days after their local date. Specify how older retained local dates are reported as outside cloud retention; preserve them locally and avoid reporting that every historical date was backed up. Historical records with expired heartbeats also need an explicit unknown/ineligible coverage representation.

## Cancellation and preferences

Use independent identities for session generation, active local scope, migration operation and ongoing-sync preference generation. Check them before staging, after token refresh, before sending, and before applying responses or acknowledging local rows. An old API client must stay invalid after another login.

Switching Cloud sync off cancels ongoing sync immediately and does not restart or expand a completed login import. A still-pending original import may resume only its sealed snapshot for its original owner. New edits remain local while sync is off. Sign-out cancels both flows and suspends the journal; a different account cannot claim or resume it. Turning sync back on must revalidate account and server preference before draining only that account's backlog.

Cancellation cannot undo a write already committed by the server. Define the acknowledged server preference update as the boundary after which further ongoing writes must fail. Use transactional preference revision checks with writes to close the current read-consent-then-write race. Discard responses that arrive after local cancellation; do not import them into the newly selected scope.

## Files to change

Mobile: `src/auth/session.tsx`, `app/_layout.tsx`, `src/db/migrations.ts`, `src/db/index.ts`, `src/db/outbox.ts`, `src/sync/{run,engine,sqliteRepo}.ts`, `src/goals/{store,sync,useProgress}.ts`, `src/activity/useActivity.ts`, `src/wrapped/useWrap.ts`, `src/social/CircleBoard.tsx`, and `app/{settings,privacy,history}.tsx`. Add a migration store/runner and shared account-scope coordinator. Audit remaining direct `Tracking` consumers for scope changes and cached results.

Native: `SqliteStore.kt`, `TrackingModule.kt`, `UsageReader.kt`, `DriftlessAccessibilityService.kt`, the tracking-store interface and recorder lifecycle, plus the TypeScript native bridge. Prevent full-device usage refresh from repopulating another scope's history after a switch.

Backend: shared contracts `src/v1/index.ts`, route registry/OpenAPI, API `src/router.ts`, a new migration handler, `modules/{usage,goals,me,account}.ts`, and DynamoDB key helpers. Update infrastructure routes if needed, tests, package publication/version and mobile dependency lockfile together. `domain/view-rules.ts` counting logic does not need changing for this feature.

## Release verification

Required scenarios: fresh guest offline; guest-to-existing-account import; duplicate login; lost reply; retry after more than 24 hours; process death at every journal/receipt transition; partial chunks; disk/transaction failure; simultaneous devices; account A to guest to account B; offline account switch; sign-out during token refresh/upload/download; Cloud sync off while requests are pending; pending original import with sync off; new edits after the sealed snapshot; date/time-zone changes; old native schemas; ambiguous legacy ownership; overflow goals; explicit deletion with pending work. Verify native background writes and all history/goal/social/recap screens, not only upload payloads.

This inspection retained two small fixes with regression tests: previous-session API getters cannot obtain credentials after a later login, and cancellable API requests discard responses after cancellation while reading the body. The draft broad automatic-backup/ownership changes were removed; the migration and storage scoping described above are not yet implemented.

Local checks on 22 October: mobile typecheck/lint and 236 tests passed; backend workspace typecheck/lint passed; contracts 87 tests and infrastructure 11 tests passed. API integration tests could not run because DynamoDB Local was not configured and Docker was unavailable. Mobile dependencies were restored into the existing temporary dependency symlink using the sibling contracts package; a clean frozen-lockfile release install remains required.

Production release remains blocked on implementing and validating this migration, storage isolation and cancellation model, the API integration suite, signed release-build checks and the physical-device accuracy gates already documented in `tracking/FEED_LIMIT_MILESTONES.md` and `SOCIAL_COMPARISONS.md`. No cloud data, local application database, deployment or package publication was changed by this inspection.
