# Responsive UI audit

Baseline: Expo 57, React Native 0.86.3, safe-area-context 5.7. Existing `app.config.ts` modification is outside this UI change. Preserve tracking, authentication, billing, and persistence behavior.

## Inventory and findings before implementation

| Routes / surfaces | Existing behavior and problems | Treatment |
| --- | --- | --- |
| `/`, `/home`, `/welcome` | Dashboard uses safe-area Screen; hero sizes against full window rather than remaining space; excessive vertical padding; brand row and counters compete horizontally | Measure scroll viewport; compact decorative art and spacing; wrapping brand and stats |
| `/tracking` | Shared scrolling permission/status/detail sections | Retain safe-area Screen; shared text shrinking and width bounds |
| `/blocking`, `/app-pauses` | Scrollable controls and wrapping presets; narrow two-column cards and header badges can compete | Wrap group headers, preserve natural card height and touch targets |
| `/progress` | Two fixed metric columns, narrow date navigation, plot numbers above narrow bars | Stack metrics at narrow/large-font sizes; horizontally scroll charts with readable columns |
| `/history`, `/stats` | Scrollable history, wrapping metric groups, Bars scales bar widths | Preserve scroll and data; shared typography wrapping |
| `/friends` | CircleBoard has custom header, rank/name/count rows; invitation dialog lacks keyboard/safe-area/scroll bounds | Adaptive rows/header and bounded keyboard-aware dialog |
| `/friend-list` | Scrollable list; removal sheet cannot scroll | Bounded scrolling safe-area sheet |
| `/battle-invite`, `/join/[code]` | Acceptance and invalid-link states use Screen; legacy `/challenges` redirects | Preserve behavior; shared container improvements |
| `/goals` | Scrollable goal editors/reminders; paired action buttons | Preserve controls; shared button labels wrap |
| `/settings` | Scrollable account, backup, capability, deletion and sign-in controls | Preserve behavior; shared field and text containment |
| `/pro` | Scrollable billing and recovery controls | Preserve billing; shared layout improvements |
| `/privacy` | Scrollable legal copy | Retain existing layout |
| `/disclosure` | Separate safe-area scroll with bounded width | Retain intentional system-guide appearance |
| `/onboarding` | SetupFlow steps 0–15 (inactive steps skipped); fixed footer can consume small landscape/large-font viewport; art sized by window height | Put footer in content flow with automatic spacing; bounded art and responsive spacing |
| `/wrapped` | Safe-area story viewer; bottom inset applied twice; footer can overflow; oversized story numbers | One bottom inset; wrapping controls, bounded story width and art |
| Startup / account loading | Startup lacks safe area before provider is mounted | Safe-area provider during startup; inset scroll container |
| InviteSignInSheet | Bounded ScrollView already present; translucent system bars but only bottom inset applied | Add top/side bounds and flexible scroll viewport |
| FriendInviteSheet / friend removal / invitation code / Wrapped ready | Inconsistent or absent bounded scrolling, safe areas and keyboard support | Shared modal content surface |
| BrainCompanion / BrainCharacter / Wick / illustrations | Original art preserved; square height can disagree with maxWidth; bubble constrained to 300 | Aspect ratio on art; constrained bubble, readable wrapping |
| PermissionChecklist / CountingPermissionBanner / AccessibilityWalkthrough | Banner outside ScrollView can consume entire viewport with large fonts; guide uses aspect ratio correctly | Banner scrolls in same content space; retain guide and native system banner |
| Native floating badge / feed pause / milestone / widget | Badge already clamps to system-bar/cutout-free window, repositions on configuration change; feed pause and milestone scroll; badge service suppresses app overlays | Inspect existing behavior; no tracking/service behavior changes |

## Validation scope

Component tests can verify measured sizing, inset ownership, scroll bounds, wrapping and navigation structure, but React Test Renderer does not run Yoga or rasterize Android. Device/visual acceptance remains a separate check. The user subsequently authorized starting an emulator and running the app; the device-validation section below records that follow-up.

## Root causes resolved

1. Screen and decorative-art sizing mixed full-window dimensions with the smaller content viewport. `Screen` now publishes its measured scroll viewport after safe areas and navigation; Today uses that measurement for art and spacing. Native `PauseActivity` now owns its own system-bar/cutout insets.
2. Custom text sizes inherited smaller line heights from their original type role. `T` now derives a proportional line height when only font size is overridden, permits wrapping/shrinking, and keeps system font scaling enabled with the existing 2× maximum. Decorative avatar initials alone do not scale inside their fixed circular artwork; adjacent names retain accessible scaling.
3. Short windows and large fonts exposed fixed footer and sheet assumptions. Modal content has bounded scrolling; onboarding actions participate in scroll flow with an automatic top margin when space permits. Main Android screens use existing `adjustResize` behavior rather than a second height adjustment. Transparent modal windows get their own keyboard-avoidance padding after emulator testing showed they do not resize with the activity.
4. Inline statistics, badges and headers competed for width. Rows wrap where appropriate, Progress stacks metrics for narrow/large-font contexts, and charts have scrollable horizontal room for readable labels. Exact chart values remain accessible; dense hourly labels are conveyed by the axis and each bar's accessibility label.
5. Wrapped owned the bottom inset in two places. Only its bottom controls now own that inset; controls can wrap and all story content remains scrollable. Square mascot containers preserve aspect ratio when constrained by width.
6. Native milestone headers forced scaled text into 48dp. The pill now has a 48dp minimum with natural height and bounded, wrapping count text.

## Files and responsibilities

| Files | Change |
| --- | --- |
| `src/ui/responsive.tsx` (new) | Pure sizing policies and a hook reacting to window dimensions, font scale, safe areas and measured content. Uses existing spacing tokens; no physical-pixel or device-model scaling. |
| `src/ui/kit.tsx` | Text sizing/line-height ownership, measured Screen context, adaptive spacing, scrollable in-app banner, navigation kept outside scrolling content, reusable bounded `ModalContent`, Android keyboard resize ownership. |
| `src/ui/Focus.tsx` | Responsive Today art and spacing, bounded counters, shrinkable brand row, compact bottom navigation padding. Tracking values and handlers unchanged. |
| `src/ui/BrainCharacter.tsx`, `src/ui/Wick.tsx` | Preserve square aspect ratio when parent width constrains artwork. |
| `src/ui/StartupScreen.tsx`, `app/_layout.tsx` | Safe-area ownership during cold start and flexible loading content. |
| `app/blocking.tsx`, `app/history.tsx`, `app/welcome.tsx` | Wrapping group/header/history/sign-in rows. |
| `app/progress.tsx`, `src/activity/ActivityChart.tsx` | Adaptive totals, full available date row, bounded readable chart labels with horizontal overflow inside the chart. |
| `src/onboarding/GetStartedScreen.tsx`, `src/onboarding/SetupFlow.tsx`, `src/onboarding/Visuals.tsx` | Bounded demonstration/art sizes, flexible brand header, reachable footer actions, natural widget-preview text/art flow instead of clipping scaled copy inside a fixed-height panel. |
| `src/permissions/CountingPermissionBanner.tsx` | Wrap reminder text and action without competing for width. This is the app's own reminder; Android's system permission banner is untouched. |
| `src/auth/InviteSignInSheet.tsx`, `src/auth/account.tsx` | Top/side system insets and flexible sign-in scroll region; labeled, branded timezone Field with existing value/handler semantics. |
| `src/social/CircleBoard.tsx`, `src/social/FriendInviteSheet.tsx`, `src/social/FriendsList.tsx`, `src/social/battleVisuals.tsx` | Bounded invitation/removal/code dialogs, wrapping War header, bounded rank/count fields, appropriate avatar scaling and 48dp controls. |
| `src/wrapped/Entry.tsx`, `src/wrapped/Stories.tsx` | Safe-area ready dialog, one bottom inset, bounded story content/art and wrapping controls. |
| `modules/tracking-android/android/src/main/java/app/driftless/tracking/android/PauseActivity.kt` | Explicit system-bar and cutout padding on its scrolling root; replaces rather than accumulates insets. |
| `modules/tracking-android/android/src/main/java/app/driftless/tracking/android/MemeMilestoneCard.kt` | Natural-height count pill with a minimum touch-sized header and bounded text. |
| `test/responsive-layout.test.tsx` (new) | Viewports, font scaling, density independence, measured resize behavior, inset ownership, typography, Today navigation, dialog overflow and accessible chart values. |
| `test/account-lifecycle.test.tsx`, `test/circle-board.test.tsx`, `test/friends-list.test.tsx`, `test/setup-sign-in.test.tsx` | Update component mocks for shared Field/ModalContent and inset hook; preserve existing behavioral assertions. |
| `modules/tracking-android/android/src/test/java/app/driftless/tracking/android/PauseActivityTest.kt` | Regression for changing system insets without accumulating padding. |
| `docs/responsive-ui-audit.md` (new) | Screen inventory, evidence, changed-file map, validation and limits. |

`app.config.ts` was already modified before this work and was not edited by this task. No dependencies, backend code, schemas, API calls, permission decisions, billing or tracking logic were changed.

## Design skill installation and application

Installed globally under `~/.codex/skills` using the built-in skill-installer, pinned to the reviewed revisions:

| Skill | Repository | Revision |
| --- | --- | --- |
| Impeccable | `pbakaus/impeccable`, `.agents/skills/impeccable` | `0dd67516c6387706e7b7e7f47f1c715efe6947c6` |
| UI/UX Pro Max | `nextlevelbuilder/ui-ux-pro-max-skill`, `.claude/skills/ui-ux-pro-max` | `28b3b8dee8c976df4fa3e94aed4e092ad43fcb03` |
| Frontend Design | `anthropics/skills`, `skills/frontend-design` | `dbd4588f9e1033efb41dad4bef2f7947c8993d44` |
| daisyUI | `saadeghi/daisyui`, `skills/daisyui` | `bf3bac3a397b543e55641ecb2d60a2ed961f09ec` |
| UI Skills Root / Improve UI | `ibelick/ui-skills`, `skills/ui-skills-root`, `skills/improve-ui` | `59193a75432e5f41c6980f53b9e6a7bd56919947` |

The requested `nextlevelbuilder/ui-ux-pro-max-skill02` returns HTTP 404; the maintained repository above was used. Reviewed every installed SKILL.md. Queried UI Skills categories and the React Native category; its result is performance-focused, so the layout work uses the requested Impeccable native adaptation guidance, UI/UX Pro Max's React Native sizing guidance and professional UI checklist, and Frontend Design's preservation/restraint guidance. Improve UI contributes evidence-based review methodology; its audit-only scope does not replace the user's authorized implementation. daisyUI is installed for future Tailwind work and was not introduced into this native app.

Impeccable's optional context launcher could not create its external engine cache inside the sandbox. Followed its documented fallback by reading existing project context and its Android, native adaptation and craft references directly. Existing implementation and the user's brief govern identity; the older `docs/PRODUCT_SPEC.md` and `docs/ui/REDESIGN.md` contain superseded product details and were not used to change feature behavior.

## Checks and remaining validation

- `npm run typecheck`: passed.
- `npm run lint`: passed, zero lint errors/warnings. npm emits existing unsupported pnpm-config notices.
- `npm test -- --runInBand`: 51 suites, 421 tests passed, including 15 responsive regressions.
- `JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' ./gradlew :app:assembleDebug :tracking-android:testDebugUnitTest --offline --console=plain -PreactNativeArchitectures=arm64-v8a`: passed. Kotlin results: 27 suites, 192 tests, zero failures/errors/skips. Gradle/dependency deprecation notices remain.
- `expo export --platform android --output-dir /private/tmp/scrollsnooze-responsive-export`: passed; Android Hermes bundle generated. This separately compiles JavaScript, which the Metro-dependent debug APK does not embed.
- `git diff --check`: passed.
- Representative logical viewports exercised by policy/component tests: 320×640, 360×720, 393×850, 440×950, 360×800 at 2× fonts, 800×1280 and 720×360; measured content resize and pixel-density independence covered.
- Initially no device was connected. Following explicit user authorization, created an isolated Android 16 / API 36.1 arm64 emulator `ScrollSnooze_Responsive_QA` at port 5580, installed the debug APK and ran the current app through local Metro. Guest mode was used with backend/sign-in configuration disabled. Existing emulator data and production resources were not modified.

## Android emulator verification (follow-up)

Selected final screenshots are committed under [`responsive-ui-validation/`](responsive-ui-validation/README.md). The complete local screenshot/contact-sheet run remains outside this repository.

Local screenshots and contact sheets: `../../output/responsive-ui-20261027/` relative to this document; `output/responsive-ui-20261027/` from the wellbeing workspace root. Screenshots are actual Android emulator captures, not browser mocks. The full capture run includes earlier captures that motivated fixes; files prefixed `final-` show the rechecked affected surfaces.

- Android 16/API 36.1 emulator, arm64, isolated user data under `/private/tmp/scrollsnooze-responsive-device/`. No physical hardware used.
- Tested logical viewport configurations using Android `wm size` / `wm density`: 320×640, 393×850, 440×950, 360×800 at system font scale 2.0, and 800×1280. The portrait lock was preserved.
- Captured Today at every configuration; captured Focus, App Pauses, Progress, Goals, War, Counter, History, Stats, Privacy, disclosure and the `/pro` redirect at small and 2× font settings, including scrolled states. `/pro` currently redirects to Focus because all features are included; no separate purchase flow was visually exercised.
- Completed onboarding through actual taps, skipping optional questions, sign-in, widget addition and accessibility permission. Reviewed the plan, permission and Today captures. Only temporary guest goals/setup were saved.
- Opened invitation-code and Google sign-in sheets; captured their small/large-font layouts. No sign-in, account creation, friend invite, purchase or cloud mutation was performed.
- Opened Wrapped with genuine empty local data, reviewed both initial and scrolled content at small and 2× font sizes. Unknown values remain dashes.
- Verified gesture and three-button navigation via Android overlays; captured Today and its bottom navigation. Expanded/dismissed the notification shade and captured the app after return. Android's system permission-banner appearance itself was not reproduced, and no permission was silently granted.
- Enabled Android's reduced-motion settings for stable automated inspection; native component and existing motion lifecycle tests also pass.
- Visually reviewed raw captures and contact sheets. Emulator review found additional word-breaking in Focus/War headers and Weekly wrap; corrected minimum text-group width and stacked wrap actions. Rechecked `final-large-font-focus.png`, `final-large-font-war.png`, and `final-large-font-wrap-buttons.png` after these changes. Reduced decorative art on typical content windows so Today can expose Focus above navigation (`final-typical-today.png`).
- Hardware-keyboard emulation initially prevented meaningful software-keyboard screenshots. The test enabled `show_ime_with_hard_keyboard` and targeted the native EditText. `verified-keyboard-small.png` exposed covered dialog actions, so `ModalContent` now applies keyboard-avoidance padding on Android as well as iOS. `final-keyboard-small-scrolled.png` confirms Open invitation and Cancel are fully visible above the open Gboard keyboard after scrolling; captures without a visible keyboard do not establish IME-resize correctness.
- Final JavaScript checks: 51 suites / 421 tests pass; typecheck and lint pass. Final Hermes export succeeded at `/private/tmp/scrollsnooze-responsive-export-final` after emulator-driven refinements. The native APK/Kotlin checks above remain applicable because these final refinements change JavaScript presentation only.

### Remaining release checks

Physical-device acceptance is still required for OEM fonts/display scaling, cutouts, actual system permission banners, TalkBack, software keyboard variants, native overlays over real feeds, launcher widgets and PiP. Signed-in Settings/account-management states, populated friend/removal/invite sheets and populated charts were source-audited and covered by component/business tests; they were not exercised against a real account in this guest-only emulator run. Billing and service tracking accuracy were not retested against external services. No claim of complete physical-device QA is made.

### Host resource handling

The first emulator launch failed with only ~336 MB free disk. With explicit sandbox approvals, removed generated app intermediates while preserving the APK/test reports and older regenerable Gradle transform caches for 8.13, 8.14.3 and 9.2.0. Kept the active 9.3.1 cache, dependency downloads and existing AVD data. No source or personal app data was removed. Metro and the isolated emulator were started only for this verification.


## Final emulator refinements

- Focus and War titles have a minimum readable group width, allowing the INCLUDED/Friends controls to flow to another row at 2× text sizes instead of breaking title words.
- Daily/Weekly wrap actions stack at narrow or large-font sizes.
- Compact art applies below 740dp of actual scrolling viewport height, including typical phones after navigation/system insets; this exposes Today’s Focus action in the normal viewport while retaining scrolling for short windows.
- The app-owned permission reminder keeps its action beside text when normal-size narrow layouts permit it, with wrapping available for larger text.
- `ModalContent` uses keyboard avoidance on both platforms; its internal form scrolling retains the keyboard (`keyboardDismissMode="none"`), while ordinary screens retain drag-to-dismiss behavior. The native IME test uses `test` in an unsubmitted invitation field and no real invite/account request.

The final validation pass retained 51 passing Jest suites / 421 tests, including the 15 responsive regressions. After the final modal scrolling adjustment, the 15 focused responsive tests, typecheck, lint and Hermes export were run again successfully. Native Kotlin/APK code has not changed since its successful build and 192-test run.
