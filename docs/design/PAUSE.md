# Native pause surfaces

`PauseActivity.kt` (whole-app/account allowance pause) and `FeedPauseOverlay.kt`
(recognized short-video feed pause) share `PauseSurface.kt`. Presentation is native Android;
it does not depend on the Expo runtime being open.

The visual direction follows the website: violet → indigo → midnight canvas, soft lilac
primary action, blue secondary surfaces, cool white text and the exact transparent
meditation character from `scrollsnooze-web/public/assets/meditating.png`.

The layout is an understated wordmark, character, meaningful reason badge, short heading,
reason-specific summary and clear actions. Long operational copy lives in an expandable
Pause details section. The account-credit state says Allowance needs a refresh rather than
incorrectly announcing that a daily video limit has been reached. It still explains exhausted
or unverifiable credit, reserved credit on other devices, the fixed account timezone and
ongoing recording. The break countdown remains live, rounded up to whole seconds.

No enforcement, storage, scope/date guards, bypass allowances or navigation behavior changed.
The activity's Leave feed action still goes Home; the feed overlay's action invokes Android
Back only on an explicit tap. The overlay stays until classification confirms the feed was
left. Open ScrollSnooze remains available. Disabled bypasses remain disabled. Account-credit
pauses never gain a bypass button. System navigation remains available.

All body copy is at least 13sp, action labels 16sp, with dynamic font scaling and scrollable
content. Controls are at least 48dp (main actions 56dp). The view replaces system insets on
changes rather than accumulating padding. There are no looping decorative animations or
button shadows. Expanded details survive timer updates. Color and geometry tokens are in
PauseStyle; no changes were made to the website or the rest of the app theme.

Native regression tests cover scope/date transitions, snooze behavior, exhausted bypasses,
account-credit recovery, safe insets, countdown updates, latest callbacks and expanding details.
Visual checks use an emulator fixture with the real shared native view and representative
copy; it does not simulate a real account allowance. Temporary preview activity/manifest
entries are removed before delivery. Physical-device interception is not revalidated here.

Validation: all 216 native tracking tests pass across 30 suites, and the Android debug APK
build succeeds. Emulator checks cover daily limit, account allowance refresh and timed break,
plus 320dp phone width and 200% font size. Display/font settings are restored. The temporary
visual fixture is absent from the final source and final rebuilt debug APK. Screenshot
evidence is in `../output/pause-redesign-20261029/`.
