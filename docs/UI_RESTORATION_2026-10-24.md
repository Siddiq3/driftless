# Earlier app UI with current mascots — 24 October 2026

Requested: restore the old application UI while keeping the new mascot characters.

The visual reference is the pre-purple design in Git (`a687844^`): dark cocoa surfaces, cream text, apricot buttons, teal widget background and the combined Focus/App Pauses page. The current product name, Google display-name flow and invitation actions remain. The Circle tab uses its earlier label/heart icon again. The new invitation sheet remains functional in the restored warm palette.

The earlier combined Focus screen now uses the current `useFocusSettings` hook, serialized saves/rollback, permission/protection status and retry handling. Custom saved focus times remain accessible and removable, and the newer App Pauses route remains available through Configure app pauses. Authentication, personal-data repository, account scopes, migration, synchronization, consent, detector approval and backend code were not changed.

Current mascot PNGs, BrainCharacter, CharacterFace, characterMotion, BrainCompanion, Illustration, Wick and native BlinkingBrainView are preserved. New fresh/drained/focused/friends/privacy/recap characters and their animations remain. Native pause/overlay/widget changes restore surrounding UI colors only; drawable references remain current.

Validation: 312 app tests pass in 36 suites; TypeScript passes. The 121 native tests pass with zero failures/errors/skips; targeted source ESLint, changed-file Prettier and git diff --check pass. Emulator visual verification was subsequently completed as recorded below. No pixel-perfect or device-ready claim is made. No commit, push, main merge or deployment was performed for this UI correction.

## UI verification retry

A fresh ARM64 debug build of the restored UI succeeded in 28 seconds (557 Gradle tasks, 30 executed). The APK is `android/app/build/outputs/apk/debug/app-debug.apk`; local Metro was started on port 8097 with the reserved `validation.invalid` backend and dummy OAuth configuration. Installation returned `INSTALL_FAILED_INSUFFICIENT_STORAGE`, even after Android trimmed disposable caches. The installed older release cannot display current Metro source, so no current rendered UI screenshots were obtained.

Starting a separate disposable emulator was not executed because automatic approval review could not complete due to its usage limit; it was not rejected as unsafe. Storage cleanup or a physical device is still required. Wiping emulator user data requires the user's explicit choice and has not been performed. All current mascot files and animation components were compared byte-for-byte with HEAD and remain unchanged. Visual status remains NOT TESTED; build success is not visual verification.

## Clean emulator verification completed

The user explicitly authorized wiping emulator data. `Medium_Phone_API_36.1` was restarted with `-wipe-data -no-snapshot`; the fresh ARM64 debug APK installed successfully. Metro on port 8098 served current source with `validation.invalid` and dummy OAuth configuration. No real account was used.

The first clean launch exposed an onboarding/account-scope startup race: setup loaded before the initial scope selection completed, producing “The local account changed.” `app/_layout.tsx` now mounts OnboardingProvider inside PersonalSessionBoundary, after session selection. Relaunch then opened onboarding normally, and the guest onboarding flow completed.

Rendered screens inspected: setup question/plan, Google sign-in prompt, permission explanation, widget preview, friend setup, Home, combined Focus/App Pauses, Circle, guest invite sign-in sheet, Progress and History. The warm cocoa/cream/apricot UI and current purple mascots render on the inspected screens. Home/Circle/Progress navigation works. Guest Invite opens its sign-in sheet. Progress and History correctly show unavailable/untracked states without tracking permissions. The floating grey gear visible in captures belongs to Expo developer tools.

Evidence is saved under `../output/ui-validation/2026-10-24/`: `05-question.png`, `07-setup.png`, `09-plan.png`, `10-signin.png`, `11-permission.png`, `12-widget.png`, `13-friends-setup.png`, `15-home.png`, `16-focus.png`, `17-circle.png`, `18-invite-guest.png`, `19-progress.png` and `20-history.png`. Earlier captures include the startup error and transitional/loading screens and are not passing evidence.

After the startup fix, all 312 JavaScript tests in 36 suites pass; TypeScript and root-layout ESLint pass. The emulator remains open on Home. Signed-in invitation sharing, Google account-name presentation, native permission-enabled counting/overlays and exact historical screenshot fidelity were not verified by this guest session. The installed debug APK uses Metro for the latest JavaScript startup fix; this is not a newly built standalone release.

## Limit-screen redesign

The feed-limit screen from the user’s screenshot is `FeedPauseOverlay`, rather than the fallback `PauseActivity`. Both now use the warm app palette, existing purple mascot artwork, a speech bubble, a playful headline and rounded actions. The feed overlay uses the drained character with blinking and a gentle float; motion respects Android’s disabled-animation setting and is cancelled on dismissal. Daily allowance, break countdown, app-limit and schedule explanations remain distinct. Existing Back/leave-feed behavior, daily bypass limits/duration and app-opening actions are retained; no detection or enforcement policy was changed.

Native regression coverage checks bypass duration and consumption, leaving without consuming a bypass, exhausted bypass availability, schedule explanations, live countdown updates, replacement callbacks and animation cleanup. This native UI requires installing a rebuilt APK; Metro reload alone does not update it. Live permission-enabled overlay visual verification remains outstanding.

## Final checks before publication

The user subsequently authorized committing and pushing the completed changes to `main`. Final JavaScript validation: 312 tests in 36 suites pass; TypeScript, changed-source ESLint, Prettier and `git diff --check` pass. Native validation: 125 tests pass with no failures/errors/skips, and the ARM64 debug APK builds successfully and installs on the test emulator. The guest Home sign-in reminder was visually verified (`21-guest-signin-banner.png`); mascot taps now request a brief 15ms vibration. Physical vibration feel and the live permission-enabled limit overlay remain device checks. Earlier statements above describe the state before this publication request.
