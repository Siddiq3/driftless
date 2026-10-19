# Driftless UI redesign

## Audit (19 October 2026)

The working tree was clean before edits. This is an Expo 57 / React Native 0.86 Android app with Expo Router, SVG 15, built-in Animated, SQLite and custom native tracking/billing. No Reanimated, Lottie or haptics dependency is installed. Native-driver transforms and opacity require no new native configuration. The provided URL initially failed from the sandbox. An existing Chrome tab exposed an older cached preview; the current external component harness uses explicit sample data and aliases native services. It is not an Android runtime.

The home grid in `Focus.tsx` uses four bordered `FeatureTile` surfaces. Its large filled count pill competes with the mascot. `kit.tsx` adds borders/backgrounds to Card, Details, Notice and MetricPanel; VisualBanner adds another large panel. Progress has two stat cards and another enclosed hero; Stats nests a filled summary inside a card. Repeating these surfaces flattens hierarchy.

Routes: `/` redirects by session to `/home` or `/welcome`; both share Dashboard. Counter `/tracking`, companion/milestones `/progress`, `/history`, `/stats`, `/goals`, `/blocking`, `/friends`, `/challenges`, `/settings`, `/privacy`, `/disclosure`, `/pro` are retained. Disclosure requires affirmative consent before Accessibility settings. Counter supports Instagram and YouTube, per-version validation, Usage Access, exports and local deletion. Goals are local SQLite records mirrored to native limits, with notification reminders. Blocking saves app selection, per-app limits and schedules and requires native server-verified Pro. Direct Google authentication (see `docs/GOOGLE_SIGN_IN.md`), native credential management, optional consent-based aggregate sync, friends/invites/challenges, account export/deletion, and Google Play purchase/restore/management stay in their original modules.

Counts in progress are validated aggregates, with null meaning unknown. Minutes prefer UsageStats, falling back to observed time. Missing history is never zero. The UI must retain these distinctions and cannot infer active tracking from nonzero history.

## Implementation plan

1. Keep the established cocoa/cream identity, introduce apricot and sage accents, open section layouts and stronger type. Change design tokens and shared kit; keep contained warnings, inputs and independent challenge groups.
2. Add an original SVG brain (Wick), a goal allowance ring and reusable native-driver motion. Preserve Wick stage/label API for milestones. Reduced motion starts enabled until system preference resolves; pause continuous motion on blur/background.
3. Replace the home grid with integrated real counts, selected goal allowance, reliable minutes, native supported-app totals and row navigation. Use actual permission/validation status for primary action and expression. Refresh on focus, foreground and while focused.
4. Apply open sections and compact banners across existing forms, statistics, privacy, social and subscription routes. Keep handlers/business modules intact.
5. Run typecheck, lint, existing tests, bundle compilation and whatever visual/device checks are available. Document results and limitations without equating a fixture preview to native verification.

Expected files: `src/design-tokens/index.ts`, `src/ui/{kit,Focus,Wick,Bars}.tsx`, new motion/brain state helpers, `src/goals/useProgress.ts`, selected `app/*.tsx`, tests for state selection and this report. No package dependency changes planned.

## Final design

The final home follows the user's request for much less text: brand and privacy/settings, a short mood phrase, the original animated brain, a large daily count, a single compact app-total strip, a goal link (or enable-counting action), and one Focus/Pro entry. No home introduction, large contextual headline, explanatory paragraph, statistic panels, app-breakdown heading or feature-link list remains. Measured minutes and explanations live on Counter and Progress/Stats. A small account sign-in row appears only when sign-in is configured. No invented offer, countdown or discount is shown.

Bottom navigation is Today / Circle / Progress. Counter is reached by tapping an app total or Enable counting. Goals are reached by the allowance link or Progress's existing goal action. History and Stats are both accessible from Progress. Blocking, Pro, friends/challenges, privacy and settings retain their original routes and handlers.

| Area | Before | After |
| --- | --- | --- |
| Home | Four bordered tiles and a filled counter pill | Brain-led open canvas, direct counter, compact app strip |
| Character | Static PNG inside a pulsing circular background | Original scalable SVG brain, sprout, facial states and integrated allowance ring |
| Home text | Repeated feature headings/explanations | One short phrase and short labels; detail stays on dedicated screens |
| Goals/blocking | Nested cards and filled number panels | Open form sections with large inline values and existing controls |
| Statistics | Enclosed charts and nested filled summary | Open charts, readable scale/goal line and inline totals |
| Navigation | Five equally prominent destinations | Three destinations, with supporting routes retained |
| Social/privacy/Pro | Large illustrated panels and repeated cards | Compact vector introductions and open sections; independent challenges retain cards |

### Animation and real data

`Wick.tsx` preserves the existing stage API and replaces the PNG rendering with original vector artwork. Its moods are idle, tracking, completed-goal milestone, high usage (80%), limit reached and unavailable. `brainState.ts` selects the highest known ratio among enabled goals; unknown values stay unknown. Completed-day streak milestones are distinct from hitting an allowance. Counts and the ring use a restrained 420 ms opacity/translation update, and the character floats/breathes on a 4.8-second cycle. Animations use native-driver transforms/opacity; no animated bitmap sequences or new runtime libraries were added. Continuous animation stops on blur or background. Reduced motion defaults to enabled until the OS preference resolves, responds to changes, and disables idle/data/screen motion.

`useProgress` refreshes on focus and foreground. Home alone refreshes every 10 seconds while active. It caches settled raw daily samples during that focus session, refreshing history on focus/date change, and reads today's native record on each update. It uses 61 days to support a 60-completed-day milestone. Generation checks prevent late reads from replacing newer state or updating an unfocused screen. The original aggregation, goal evaluation, permissions, storage, APIs and native tracking/billing business logic remain in place.

### Files

- `src/design-tokens/index.ts`: cocoa/apricot/cream/sage palette and motion timing.
- `src/ui/kit.tsx`: open Section, compact navigation, keyboard avoidance, tactile pressed treatment, notices, accordions and inline metrics.
- `src/ui/{Focus,Wick,Bars}.tsx`: minimal dashboard, original character, chart spacing/scale/data transitions.
- `src/ui/{motion,brainState}.ts`: reusable motion lifecycle and deterministic state selection.
- `src/goals/useProgress.ts`: focused live refresh and history reuse.
- `app/{_layout,welcome,blocking,challenges,disclosure,friends,goals,history,privacy,pro,progress,settings,stats,tracking}.tsx`: shared presentation, streamlined sign-in row, screen transitions and preserved route access.
- `test/brain-state.test.ts`: unknown data, disabled engine/service, unvalidated activity, competing goals, 80% threshold, cap/milestone distinction and disabled goals.
- `package.json`: adds `@react-native/jest-preset` 0.86.3 as a test-only dependency, required by the installed RN/Jest Expo combination. No runtime dependency added.

### Verification

- `npm run typecheck`: passed.
- `npm run lint -- --no-cache`: passed.
- `npm test -- --runInBand`: 9 suites, 93 tests passed. Existing API, sync, outbox, migrations, billing, tracking-state, progress and contrast tests are included.
- `expo prebuild --platform android --no-install`: passed, generating ignored Android project files; package/config business settings unchanged.
- `expo export --platform android --output-dir /private/tmp/driftless-redesign-android`: passed, 1,638 modules and a 4.1 MB Hermes Android bundle. This is a bundle build, not a signed release APK/AAB.
- The local shared contracts package initially lacked compiled `dist`. It was compiled locally with the existing TypeScript compiler; temporary ignored dependency links use the existing UI-check installation. No backend source files were changed. The app's pre-existing `node_modules` symlink points at `/private/tmp/driftless-ui-check/node_modules`.
- Browser visual QA uses the existing external React Native Web fixture harness, clearly labelled “Component preview · sample data.” Fixtures and aliases are outside production source. The browser check is not a native tracking or purchase test.
- Visually inspected: initial home at 390px; compact disabled-counting home and goal editor at 320px; final minimal home at 390px and limit-reached home at 430px; statistics at 768px. These are preview container widths with an 844px harness height, not physical device models. Screenshots were inspected through the computer-use tool.
- Interaction checks in the fixture preview: setup action reaches Counter; goal Less changes 30 to 20 and displays its save response; simplified Progress tab reaches the companion screen with Edit goals, History and Stats still available. Error recovery at 320px exposes Try again and expandable error detail.

### Release validation still needed

Physical Android testing remains necessary for safe-area/insets, keyboard and large system text, TalkBack, reduced-motion behavior, motion frame rate/battery, actual counting accuracy and service recovery. Auth, production APIs, notification delivery, purchase/restore, subscription revocation and blocking must be exercised against configured test services/Play test accounts. No permissions were enabled, purchases made, accounts deleted or cloud services deployed during this redesign. Existing store-release requirements in `STORE_PREP.md` still apply.

Native APK validation was also attempted with Gradle 9.3.1 / Android SDK 36 (including an arm64-only attempt and the existing dependency cache). Gradle configured the Expo/native modules but was still resolving/downloading native dependencies when that optional validation was stopped. No APK was produced or claimed verified. Complete `assembleDebug` and device testing before release; the successful Hermes export does not establish native compilation success.

The final minimal 320px home was rechecked with counting disabled: a dash replaces unknown totals, the original brain is inactive, and Enable counting remains clear. Friends and Challenges now explain account-feature unavailability on their own screens when sign-in is unconfigured, so the home does not need a build-configuration paragraph.
