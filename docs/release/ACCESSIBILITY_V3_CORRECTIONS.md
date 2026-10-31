# Accessibility V3: consent cutoff and language-history corrections

Date: 2026-10-30. This correction preserves the pre-existing V3 worktree changes.
No production AAB, website deployment, Console update, commit or push was performed.

## Consent withdrawal

`Engine.discard()` drops the active session without invoking ViewCounter, advancing the clock,
recording dwell/time/counts, or rewriting rings. Completed SQLite records and deduplication
state already saved during valid consent remain intact. ViewCounter, its 1.5-second threshold,
selectors and ordinary valid-consent `Engine.onLeave()` behavior are unchanged.

The native consent setter performs its preference write and service transition together on
Android's main thread. Calls from other threads wait for the transition (with a five-second
failure timeout), so successful withdrawal returns only after accounting is cut off. Work already
completed on main before that transition was under the previous valid consent. Withdrawal does
not flush the time since the last recorded checkpoint, even when enough wall time has passed
to cross the pending dwell threshold.

Withdrawal sets `isOperational=false`, cancels classification/tick callbacks, discards the
session and transient transition/trace state, and hides overlays. No-consent classification,
tick and overlay-refresh paths use discard. Screen-off, interruption, scope changes, clock
refresh and stop use a consent-aware departure helper: ordinary flush with valid consent,
discard otherwise. Delayed structure capture retains its execution-time consent/debug guards.
Reacceptance starts the existing classification/tick loop with a new active session.

## Minimum pre-consent status metadata

A bound instance reference and process-local `lastConnectedMs` remain available for the local
health screen to distinguish binding/reconnection from disabled or suspended operation. This
timestamp is recorded at connection regardless of consent. `isOperational` remains false until
current consent is accepted. No periodic classification/tick loop is scheduled before consent;
no viewing event, heartbeat, window content, fingerprint or content-derived diagnostic trace
is recorded then. Existing SQLite initialization/retention housekeeping is retained. Do not
claim that every service-status diagnostic waits for consent.

## Exact revised language wording

The in-app temporary-processing section now reads:

The service reads supported-app and foreground-window activity, accessibility events for window changes and scrolling, and relevant visible interface text and content descriptions. It also reads resource IDs, view classes, visibility and interface structure to recognize players, detect item changes and identify ads. Text is processed in memory for detection and converted into salted one-way identifiers to avoid counting the same item twice. Meme breaks can use the script of visible labels to choose a language on this phone. Raw text, captions and the raw content-language hint are not saved. Language-specific meme reaction and selection history, including reaction IDs and caption indices, may be stored locally to manage which reactions are shown. This history is not included in normal account backup.

The website uses the same retention statements, following its existing explanation of the
optional on-device script hint. Local history is used for reaction rotation; raw text and the
raw language hint are not persisted. History can reveal the selected language pool.

Source verification: MemeMilestoneCard chooses `poolLanguage` and calls rememberMemeReaction;
TrackingPrefs writes language-scoped reaction sets, last reaction ID and caption indices to
native SharedPreferences. Normal account backup uses explicit daily aggregate/account-usage,
goal and device payloads, not a preference export. The history is absent from these payloads.
No sync implementation was changed. A new payload test exercises aggregation, staging and flush
with extra local selection fields and verifies those fields do not reach the client payload.

## Executed tests

All tests below passed in the final runs:

- AccessibilityConsentTest.revocationBeforeDwellDiscardsUnfinishedCountAndTimeImmediately
- AccessibilityConsentTest.revocationJustBeforeThresholdKeepsOnlyPreviouslyRecordedTime
- AccessibilityConsentTest.revokedLifecycleAndDelayedCallbacksCannotFlushOrHeartbeat
- AccessibilityConsentTest.completedRecordsSurviveRevocationAndReacceptanceCountsANewItem
- AccessibilityConsentTest.preConsentConnectionKeepsOnlyBindingStatusWithoutViewingDiagnostics
- EngineTest.discardNeverAdvancesPendingDwellButOrdinaryLeaveStillDoes
- EngineTest.discardPreservesCommittedRecordsAndStartsNewDwellOnNextObservation
- MemeCardTest.selectedMemeLanguageHistoryPersistsWithoutSavingRawHintOrText
- accessibility-setup: discloses local language-specific history separately from the transient raw hint
- sync: daily backup does not serialize language-derived selection history from local inputs

Full command results:

| Command | Result |
| --- | --- |
| `npm test -- --runInBand` (app) | 63 suites / 540 tests passed |
| `./gradlew :tracking-android:testDebugUnitTest --offline` (app/android) | 245 tests passed; zero failures/errors/skipped |
| `npm run typecheck` (app) | Passed |
| `npm run build` (website) | Passed |
| `git diff --check` (both repositories) | Passed |

Logs: `/private/tmp/scrollsnooze-revocation-jest.log` and
`/private/tmp/scrollsnooze-revocation-native.log`.

## Files changed by this correction

- `driftless/modules/tracking-android/android/src/main/java/app/driftless/tracking/core/Engine.kt`
- `driftless/modules/tracking-android/android/src/main/java/app/driftless/tracking/android/DriftlessAccessibilityService.kt`
- `driftless/modules/tracking-android/android/src/main/java/app/driftless/tracking/android/Platform.kt`
- `driftless/modules/tracking-android/android/src/main/java/app/driftless/tracking/android/TrackingModule.kt`
- `driftless/modules/tracking-android/android/src/test/java/app/driftless/tracking/core/EngineTest.kt`
- `driftless/modules/tracking-android/android/src/test/java/app/driftless/tracking/android/AccessibilityConsentTest.kt`
- `driftless/modules/tracking-android/android/src/test/java/app/driftless/tracking/android/MemeCardTest.kt`
- `driftless/src/permissions/accessibilityDisclosure.ts`
- `driftless/test/accessibility-setup.test.tsx`
- `driftless/test/sync.test.ts`
- `driftless/docs/PRIVACY_AND_DATA_RETENTION.md`
- `driftless/docs/release/DATA_SAFETY_RECOMMENDATION.md`
- `driftless/docs/release/ACCESSIBILITY_DISCLOSURE_V3_IMPLEMENTATION.md`
- `driftless/docs/release/ACCESSIBILITY_V3_CORRECTIONS.md`
- `scrollsnooze-web/src/pages/Privacy.jsx`

## Limits and remaining checks

No live-device or signed-release behavior was verified. Native tests use Robolectric and mocked
accessibility trees. The actual Play artifact, release SDK configuration, deployed policy URL,
Console answers and reviewer video still need verification. The setter's cross-thread handoff
uses the existing main-thread lifecycle model and a bounded wait; a stalled main thread can
cause an explicit transition-timeout error. The app must not interpret that error as success.
Source ordering prevents simultaneous main-thread classification/accounting and consent writes;
no real-device thread-scheduling stress test was performed.

No authentication, billing, backend API, SQLite schema, tracking selector/threshold, or sync
behavior was changed. Normal valid-consent departure remains covered by both existing tests
and the new comparison test. The website change has not been deployed.

## Final repository checks

`git status --short` was run in both repositories. The app has 16 modified tracked files and
7 untracked files (including pre-existing V3 work and this correction). The website has only
`src/pages/Privacy.jsx` modified. No staged changes were present. `git diff --check` exits 0
for each repository. The backend worktree is clean. The file list above is the correction-only
list, not a claim that all current worktree changes originated in this turn.
