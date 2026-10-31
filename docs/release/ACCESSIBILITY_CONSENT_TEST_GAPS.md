# Accessibility V3 consent concurrency and lifecycle test coverage

Date: 2026-10-30. Follow-up to ACCESSIBILITY_V3_CORRECTIONS.md.
Existing uncommitted V3 changes were preserved. No website or backend files were edited in
this task. No production AAB, deployment, Console update, commit or push was performed.

## Changes in this task

- `modules/tracking-android/android/src/main/java/app/driftless/tracking/android/Platform.kt`:
  extracted the existing dispatch/wait implementation into internal `updateDisclosureConsent`.
  The property setter uses it with the same production five-second CountDownLatch await.
  Tests can inject only the wait boundary; preference writes and the real service discard
  still run on the main looper. A rejected Handler.post is now an immediate explicit failure.
  Timeout text explicitly says the change is not confirmed and may still be pending.
- `modules/tracking-android/android/src/test/java/app/driftless/tracking/android/AccessibilityConsentTest.kt`:
  replaced the combined lifecycle scenario with independent scenarios, and added background,
  in-flight-accounting and deterministic timeout tests. The clock-refresh test asserts that
  the engine instance changes while the same scope remains selected. Shutdown and unbind
  tests assert a live bound instance before the operation.
- `test/accessibility-setup.test.tsx`: tests that consent transition failure cannot open the
  guide, navigate back or be presented as completed setup.
- `docs/release/ACCESSIBILITY_CONSENT_TEST_GAPS.md`: this report.

No service accounting algorithm, consent checks, ViewCounter threshold, selector, SQLite schema,
authentication/billing, backup or account lifecycle logic was changed in this task.

## Timeout and ordering semantics

Success means main has performed both the preference change and the service cutoff/discard;
the background caller cannot return success while the completion latch is pending.
The cutoff remains the applied main-thread transition, not background request invocation.
A callback already executing on main finishes under the preceding consent before that
transition executes. The new in-flight test blocks within a real Engine-to-TrackingStore
addTime call, has a second thread queue revocation, and verifies consent stays valid throughout
the callback, the caller remains blocked, and no unfinished activity is credited after cutoff.

In production a background caller waits up to five seconds. If main has not finished, the
caller receives IllegalStateException with:

> Consent transition timed out; the requested change is not confirmed and may still be pending

The operation remains queued and may apply later. It does not silently report successful
revocation or cancel a requested privacy cutoff. Until it applies, previous consent remains
in effect and queued valid work can run. The deterministic test substitutes an expired timed
await result (`done.await(0, SECONDS)`) at exactly this wait boundary, rather than sleeping five
seconds. It verifies failure and unchanged consent before application, then advances the clock
past dwell and executes the real queued change: pending dwell is discarded without flush.
This tests timeout handling, not five seconds of real scheduling latency.

Caller inspection: the native module delegates without catching errors; the TS Tracking wrapper
also delegates without suppressing errors. The only app-screen caller is `app/disclosure.tsx`,
which calls acceptance (`true`), catches failure, keeps the screen open, and does not open the
guide or navigate away. There is no production in-app `false` caller in the reviewed source;
users are directed to Android Accessibility settings to revoke the service. Tests/native clients
can request `false`. Therefore no revocation UI was found that interprets timeout as success.
The existing acceptance error is generic (asks the user to retry); it does not claim consent
was rolled back. A queued acceptance can still apply after a timeout, as before.

## Exact added/replacement native test names and results

All of the following passed:

- `AccessibilityConsentTest.revokedScreenOffCannotCreditPendingActivity` — PASS
- `AccessibilityConsentTest.revokedInterruptionCannotCreditPendingActivity` — PASS
- `AccessibilityConsentTest.revokedClockRefreshExecutesItsBodyWithoutCreditingPendingActivity` — PASS
- `AccessibilityConsentTest.revokedScopeChangeDiscardsWithoutCreditingEitherScope` — PASS
- `AccessibilityConsentTest.revokedShutdownWhileBoundCannotCreditPendingActivity` — PASS
- `AccessibilityConsentTest.revokedUnbindWhileBoundCannotCreditPendingActivity` — PASS
- `AccessibilityConsentTest.delayedClassificationAlreadyCapturedBeforeRevocationCannotCreditActivity` — PASS
- `AccessibilityConsentTest.delayedTickAlreadyCapturedBeforeRevocationCannotCreditActivity` — PASS
- `AccessibilityConsentTest.queuedOverlayRefreshAfterRevocationCannotCreditActivity` — PASS
- `AccessibilityConsentTest.backgroundRevocationReturnsOnlyAfterMainAppliesConsentAndDiscardsSession` — PASS
- `AccessibilityConsentTest.inFlightAccountingFinishesBeforeAppliedRevocationAndCannotOverlapIt` — PASS
- `AccessibilityConsentTest.timeoutReportsUnconfirmedChangeThenQueuedRevocationDiscardsWithoutFlush` — PASS

Each lifecycle scenario verifies no additional count/time or heartbeat, with the old scope
queried explicitly when scope changes. Delayed tests retain the original Runnable then post it
after revocation, proving execution guards independently of cancellation. The background and
in-flight tests use bounded latch handshakes rather than Thread.sleep. Scheduled pre-cutoff
sampling is paused in the test fixture to isolate the transition; legitimate pre-cutoff writes
are not evidence of a failure and are preserved in the in-flight addTime case.

## Executed checks

| Command | Result |
| --- | --- |
| `./gradlew :tracking-android:testDebugUnitTest --offline --tests '*AccessibilityConsentTest'` | 20 tests passed |
| `./gradlew :tracking-android:testDebugUnitTest --offline` | 256 tests passed; 0 failures/errors/skipped |
| `npm test -- --runInBand test/accessibility-setup.test.tsx` | 6 tests passed, including consent-timeout caller test |
| `npm run typecheck` | Passed |
| `git diff --check` (app and website) | Passed |

The first focused attempt failed three assertions because the fixture allowed earlier scheduled
sampling to run ahead of the queued cutoff, including a legitimate heartbeat. The fixtures were
corrected to isolate the handoff using the service's own Handler; the final focused and full
native runs passed. No consent guards or valid-consent behavior were weakened.

Logs:
- `/private/tmp/scrollsnooze-consent-gaps-focused.log`
- `/private/tmp/scrollsnooze-consent-gaps-native.log`
- `/private/tmp/scrollsnooze-consent-gaps-jest.log`
- `/private/tmp/scrollsnooze-consent-gaps-types.log`

## Limits and repository state

These are deterministic Robolectric tests with real Java threads and a controlled main looper,
not physical-device or signed-release verification. Real ANR/OS scheduling, process death,
service permission removal and long-running storage latency remain device-test concerns.
The production five-second default is source-verified; the test drives its timeout outcome
through the injectable wait boundary and does not spend five wall-clock seconds waiting.

Git status was inspected in all three repositories. The website retains its prior
`src/pages/Privacy.jsx` modification; no new website edits were made. Backend remains clean.
The app retains earlier V3 work plus this task's three code/test edits and report. No staged
changes were created. Diff checks pass; no claim of Play approval is made.
