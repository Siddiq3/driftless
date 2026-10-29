# Cold-start loading

## Findings

The previous root mounted startup work in series: Play update check (up to 8 seconds),
SQLite opening/migrations, Google silent sign-in, lifecycle discovery, profile/allowance
verification, local dataset binding, and (only for an uninitialized account) cloud restoration.
The screenshot with Sign out is the AccountBoundary loading state, so it specifically means
Google restoration has completed and account verification/first restore is still running.
It does not identify which request is slow on the user's phone.

## Changes

- Local storage and Google session restoration now prepare together inside StartupBoundary.
- Local/session preparation also runs behind the initial Play check. The navigator is still
  covered and inaccessible during that check. Its fallback budget is 1.5 seconds, down from 8;
  cached required updates block immediately and late required results still replace the app.
- Account lifecycle and profile reads overlap. The API already supports an authenticated
  unbound /me read. Its profile is used only after discovery confirms the exact active
  incarnation; a mismatched response is replaced by a bound read. Allowance verification
  starts as soon as lifecycle discovery completes, even if the profile read remains pending.
- Secure-store cleanup and the saved sign-in preference are read concurrently.
- StartupScreen now uses the existing transparent purple character, one app name and one
  real stage message. Removed giant concentric circles, duplicate slogans, oversized heading,
  status pill and immediate Sign out. Slow-start explanation and manual Sign out appear
  after 8 seconds. There is no artificial progress or startup delay.
- Stage timing diagnostics record labels and elapsed durations only. Slow stages log in
  development; no identity, URL, token or payload is logged.

## Retained behavior

Google authentication, lifecycle discovery, account incarnation fences, timezone/allowance
installation, deletion recovery, failed-load retries and first-restore verification remain.
Previously initialized accounts still skip blocking cloud backup/history hydration. This
change does not expose a cached account before verifying ownership, change API timeouts,
or promise instant startup on an unavailable network.

## Validation

Typecheck, lint and startup/account tests cover overlapping preparation, no early private
screen mount, partial restore recovery, stale profile responses, delayed credentials,
required update gates, a 1.5-second unknown-check fallback, stable child mounting and delayed
manual recovery controls. Emulator timings in a debug build include Metro and are not a
measurement of the user's signed-in release build or their connection.

The full app suite passed with 485 tests across 59 suites. TypeScript and Expo lint also
passed. Android debug APK assembled and installed successfully. Emulator cold reopen
reached guest Home; startup presentation was visually checked in a temporary local preview
(normal, delayed recovery and 200% font size). That preview route was removed and the
original emulator font size restored. Screenshots are in `../output/startup-20261029/`.

The existing emulator debug client needed rebuilding because its Worklets native module
did not match the installed JavaScript dependency. That mismatch is not evidence of a
production signed-in network delay. This emulator has no authenticated user session;
no claim is made about measured release-build or signed-in device launch time.
