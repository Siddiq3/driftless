# Focus and App Pauses redesign

## Implementation

The existing React Native / Expo Router Focus entry at `/blocking` remains in place. It now shows the real schedule overview, three compact preset switches and a link to `/app-pauses`. The new page contains app selection, daily minutes, feed scope and advanced controls. There was no schedule time/day editor in the original screen; the existing fixed presets and any previously saved custom schedules are preserved.

Both pages use the existing central dark theme through `useTheme()`, with 24 dp page margins, 8/16/24 dp spacing, 16 dp surface corners and at least 48 dp control targets. Text scales and wraps, radio and checkbox selections include visible checks, and screens reuse the existing safe-area-aware scrolling shell. No new dependencies or tracking-engine changes were introduced.

### Files

- `app/blocking.tsx`: Focus overview, preset schedules and App Pauses navigation.
- `app/app-pauses.tsx`: selected-app rows, daily allowance presets, feed scope and all advanced/bypass controls.
- `src/focus/components.tsx`: page shell, sections, status, switches, radio presets and text actions. Reuses `Screen`, `T`, `Toggle`, `Details`, `LoadingState`, `Button`, `Icon` and `AppIcon`.
- `src/focus/useFocusSettings.ts`: shared load/save lifecycle; queued writes; health refresh on foreground and while visible; goal checks; save error handling and retry. Navigation waits for queued saves before loading the next page. If SQLite succeeds but the native mirror fails, restoration is attempted in both layers; a failed restoration is reported as uncertain rather than successful.
- `src/focus/schedules.ts`: native-compatible overnight/day-of-week matching, readable schedule labels and next local start.
- `test/focus-screen.test.tsx` and `test/focus-schedules.test.ts`: interactions, persistence, rapid edits, failures, status and schedule boundaries.

## Behavior preserved

The existing SQLite `blocking_config`, native `Tracking.setBlocking`, permissions/disclosure route, selected apps, daily allowance values and local daily reset, preset schedules, legacy whole-app mode, video goal navigation, timed breaks, bypass counts/durations and experimental detection setting remain connected. Unknown/custom saved selections and schedules are retained. App selection is independent of other settings. Feed enforcement still depends on supported Android detection and approval; the UI does not claim otherwise.

Status reuses the existing `protectionStatus` policy. A scheduled focus window is distinguished from protection readiness: permission failures, unavailable service, missing app selection, missing rules/goals, unapproved detection and uncertain saves cannot produce a ready/active claim. Even a ready rule remains subject to the native engine's conditions and bypasses.

## Validation executed

- `pnpm exec tsc --noEmit`: passed.
- `pnpm exec expo lint`: passed.
- Prettier checks on the changed source and tests: passed.
- `pnpm exec jest --runInBand`: **270 tests passed across 31 suites**, including 15 Focus/App Pauses tests.
- `pnpm exec expo export --platform android --output-dir /private/tmp/scrollsnooze-focus-export-final`: passed; production Hermes bundle and assets exported. This is a production JS export, not a signed release APK/AAB.
- Real Android emulator: inspected both screens at 1080×2400 / 420 dpi (about 411 dp wide), and 720×1280 / 360 dpi (320 dp wide) with 130% system font scaling. Verified wrapping, scrolling and system insets.
- Exercised app selection, 30→45 minute allowance, master switch, feed/whole-app mode, timed break switch and an overnight preset. Verified saved app/allowance summary and enabled schedule after app process restart. Restored the emulator's original configuration and display/font settings afterward.
- Inactive and permission-required UI were inspected on the emulator. Ready, unavailable, save/load error and retry states were exercised by automated tests. Existing protection-policy tests cover incomplete configurations.

## Screenshots

These are actual emulator captures, not mockups. The floating gear is the development client's Tools overlay, not an app settings action.

- [Focus](focus.png)
- [App Pauses](app-pauses.png)
- [Feed modes and advanced controls](app-pauses-advanced.png)
- [Focus at 320 dp / 130% text](focus-small-text-130.png)
- [App Pauses at 320 dp / 130% text](app-pauses-small-text-130.png)

## Remaining validation limits

No iOS simulator/device run was performed. Native accessibility enforcement remains Android-only. The Android emulator lacked counting permissions, so actual live interception under an active schedule was not re-tested; its tracking engine was not modified. App icons reuse the existing branded `AppIcon` component because the native health API does not expose installed-app icon bitmaps. No signed store build, deployment or release certification was performed.
