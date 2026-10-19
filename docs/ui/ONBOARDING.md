# First-launch setup

Implemented from the user’s 19 October 2026 video reference using Driftless’s original illustrated brain character and visual identity. The 69-second video was inspected as 23 frames at three-second intervals. Its flow: intro → occupation → apps → priorities → scrolling time of day → feelings → daily duration → income → estimate → daily limit → promotional sequence.

Driftless now uses intro → seven optional habit questions → personal estimate → daily allowance → optional account → privacy illustration → permission setup → native widget → friend invitation → app launch. No proprietary artwork, media, claims about other users, invented prices, discounts, or countdowns were copied.

## Behavior

- Setup appears on first launch through the root route and a navigator redirect. The root Stack remains mounted so navigation works correctly. Privacy, prominent disclosure and tracking routes remain accessible during setup.
- Each Continue/Back saves a local SQLite draft, so relaunch resumes at the last saved step. Choice edits are committed when moving between steps. Completed setup does not automatically repeat on later launches. Android Back returns to the prior step.
- Questions are optional: Continue accepts an unanswered question; Skip questions goes directly to the plan. No login is required to complete setup, save a goal or read native daily tracking.
- The daily goal and completion marker commit in the same transaction. Existing same-metric goals retain their ID; the revision increments. Other metric goals are preserved. Android receives the persisted limits; a later home focus retries mirroring if necessary.
- Onboarding asks “Your limit from today” in reels per day, with 25, 50, 100 and 150 choices (default 50). Resumed legacy minutes drafts start with the 50-reel default; saved reels targets are retained. Guests can save this target before tracking permissions or accuracy validation. Existing goal evaluation still requires validated counts; saving a target does not certify tracking accuracy. Minutes goals remain available outside onboarding.
- Optional estimated hours use range midpoints, with 8 hours assumed for the open-ended “more than 7” choice. The income illustration uses 160 work hours/month. Both are explicitly estimates, not tracked history, measured savings or money lost. The questions never write daily count/history data.
- Setup answers are local-only in the existing settings table. They are not included in goal sync, usage sync, API calls or guest invitations. Privacy explains this; “Delete everything on this phone” clears setup answers too.
- Uninstalling or moving to a different phone loses local setup/history. Sign-in is optional; cloud sync remains its existing separate consent. No new restore guarantee was introduced.
- Invites and battles require sign-in. Circle stays visible to guests, but Invite and Battle send them to sign-in without opening sharing or creating anything. Onboarding invitations also require sign-in. No message is automatically sent. Signed-in Circle invitations share a real friend code; two-person battles share a real challenge joining code.
- Real OS permission prompts are only reached by deliberate setup actions. Accessibility retains the existing prominent disclosure. Users can continue without enabling permissions.
- Added the existing Expo-compatible `expo-font` runtime dependency for the bundled OFL Lilita One display font. Screen motion uses the existing reduced-motion-aware native-driver helper. Questions use accessible radio/checkbox roles, touch targets, a scrollable body and a persistent footer.

## Source changes

`app/onboarding.tsx`, `src/onboarding/{SetupFlow,context,FirstLaunchRedirect,model,store}`, `src/social/{invite,InviteButton}`, root layout/index, Friends and Privacy. Earlier dashboard redesign edits remain preserved.

## Checks executed

- TypeScript typecheck and Expo lint passed.
- Jest: 10 suites, 102 tests passed, including new draft persistence, atomic completion, storage failure, validation gate, schema validation, skipped answers, estimate math and guest invitation tests.
- Android Hermes export passed: 1,646 modules, 4.1 MB bundle. This does not establish native APK/device execution.
- The actual SetupFlow was rendered in the external React Native Web fixture harness at 320px wide. Walked all seven questions, selected occupation/apps/priority/time/feeling/duration, skipped income, inspected the personalized estimate, changed the minutes goal to 15, continued through permissions and reached final guest sharing/account choices. Reload resumed at the saved question. The preview uses a separate mock setup context/session storage; production uses SQLite.
- No invitations were sent, no purchases made, and no OS permissions enabled during validation.

Native Android first-install/relaunch, real SQLite persistence, OS Back/permission-return behavior, share-sheet integration, TalkBack and large-text/device testing still need on-device verification. The existing app remains configured for Android.

## Reference-screen implementation, 19 October

The final six setup stages now follow the supplied image sequence: optional Google account, privacy character holding a lock, truthful permission rows, teal count-widget preview, illustrated amber friend challenge, and the supported-app launch screen. Short headings and native-driver character motion replace explanatory paragraphs; optional Details retain technical explanations. Dashboard uses the same raster character family and a tired pose when actual goal usage is high.

Android `CountWidget` is a real AppWidgetProvider, available from the system widget picker and API 26+ launcher pin request. Counts come from the existing local native store with installed-version validation and heartbeat gating; unavailable counts show a dash. Refresh occurs from the accessibility service, dashboard reads, time/date changes, and system widget updates. No login, overlay permission, or network is required. A pin request is never presented as confirmed installation. The launcher controls confirmation and final sizing.

The final app-launch button opens only allowlisted installed packages (Instagram preferred, otherwise a supported installed app); there is also a Today fallback. Account-backed friend connections still require authentication, while app invitations use Android sharing without login. Share dismissal is not shown as invitation delivery.

Account login now uses Google's native account picker and direct Google ID tokens, with no Cognito. Configure `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` and the matching backend Google audience; see [Google sign-in setup](../GOOGLE_SIGN_IN.md). No live credentials or deployment were supplied. Cloud sync keeps its separate consent; setup answers remain local.

Final verification: app TypeScript/lint and 102 Jest tests passed; backend infrastructure typecheck and 11 synth tests passed, including Google identity provider, secret reference, scopes/domain and code-flow client. Android tracking/widget module Kotlin compilation passed. Hermes Android export passed with 1,655 modules and all font/brand/illustration assets included. These checks do not establish successful Google login, installed widget, permission-return behavior or physical-device execution.

Visual component preview used controlled fixtures rather than live device data. Walked account skip → privacy → permissions → widget skip → challenge skip → final app-launch screen at 320px width; source video frame and revised questionnaire were shown together at normalized 320×720. See `design-qa.md` for review scope and accepted product differences.

The subsequent Android unit-test run could not complete: resource extraction exhausted host disk space. This is an infrastructure limitation, not a passing native test result. The task's disposable temporary Gradle cache was removed after the failure; no user project data was deleted.

## Live count mood

The native floating counter uses the combined daily Reels and Shorts count and the enabled reels goal. It stays happy through the allowance (100 is happy for a 100-reel limit), then uses the drained illustration above the allowance (101). A new day or raised limit recomputes the mood. Missing player identity remains unavailable; unvalidated totals retain their existing label. Mood is local visual feedback and does not certify counts or affect validated goal outcomes. The face gently bobs, switches with a scale transition, and count changes pulse; Android animator-disable settings suppress motion. Hiding the overlay cancels its animations.

## Accessibility guide update, 19 October 17:27 reference

The onboarding permission step now follows the supplied video: a dark checklist with Display over other apps, Background counting, and Accessibility; an amber Allow action; and the bottom “Why should I give this permission?” pill. The first two rows are labelled “Included with accessibility” until the service actually runs; they do not pretend that unrelated Android permissions were granted. Usage Access remains optional in Counter for time measurement.

Allow and the help pill open a four-step animated instruction card. Explicit, visible counting disclosure remains above “I agree · Got it”; Not now grants nothing. The instructions name Driftless, and the preview is labelled as a guide rather than a real Android permission screen. After agreement, Android's real Accessibility settings open. A native picture-in-picture activity follows with the small looping guide when supported, closes after enabling the service or after two minutes, and needs no SYSTEM_ALERT_WINDOW grant. Devices that disallow PiP still reach Settings. Reduced-motion settings stop automatic preview transitions. Settings labels and permission dialogs vary by Android vendor; these remain system-owned.

Checks: native consent/no-PiP fallback tests, React consent-order/decline/error tests, TypeScript, lint, and Android debug build. Physical-device PiP behavior and screenshot fidelity remain unverified because the emulator is not exposed through the available computer-use surfaces. See project-root design-qa.md.

### Floating guide launch correction

Android logs from the user's failed run showed Settings being launched without NEW_TASK into the guide's task during the PiP transition. The guide now requests PiP only when resumed, waits for the PiP callback before opening Settings, and launches Settings in its own task. Reopening the guide clears only its dedicated tutorial task, preventing the old Settings screen from being restored instead. An already-enabled service no longer closes the help window immediately; only a new enablement during this guide session closes it. A watchdog retains the no-PiP fallback. Four native regression tests cover consent, task separation/PiP callback ordering, no duplicate Settings launch, existing-grant behavior, delayed-callback fallback, and closing after a new grant. Live UI confirmation remains separate from these tests.

### Reference-footage tutorial

The text-only instructional slides have been replaced by an actual bundled silent H.264 tutorial loop, cropped from the user-supplied 17:27:28 recording to the tutorial panel only (8–14.7 seconds, with a final-step hold). This preserves the pointer, amber highlights, and four step labels. Recorded status/navigation bars and the surrounding app are excluded; app labels in the footage are adapted to Driftless. The same local TextureView/MediaPlayer component appears in the rounded popup and native PiP activity, at the video's 640:592 aspect ratio. Four compact numbered instructions sit below the popup video. First-time disclosure remains visible before agreement; users who previously agreed see the shorter Got it review. Playback is muted, loops offline, pauses in inactive React screens, respects the Android animator setting, and releases the decoder/surface when detached. No new dependency or network permission is required. Media asset frames were inspected; the full rendered popup and PiP still need live visual verification.

## Get started reference, 19 October 18:13

The first onboarding screen now follows the supplied 14.7-second reference's main view: warm Driftless wordmark at top left, English UI-language indicator at top right, a large blurred short-video phone hero, floating brain/count demonstration, “See your reels count”, Instagram/YouTube icons, and one persistent Get Started action. Get Started opens the existing first question and preserves resumable local setup. Skip remains available on questionnaire steps; the opening screen no longer adds a second CTA. Unsupported Snapchat/Facebook icons are omitted. No launch delay or artificial splash hold was added.

`GetStartedScreen.tsx` uses a project-local generated phone asset at `assets/illustrations/get-started-phone.png`; the counter/character are live UI elements. Preview cycles 12–15 only while the screen is focused and app active, respects reduced motion, and never writes counts or history. The footer reuses the corrected measured gradient button. Compact screens scroll the hero content while the CTA remains fixed. The reference was inspected in eight frames, with the main layout visible from around 5 seconds onward. Actual full-screen visual capture remains unavailable through the current emulator computer-use surface, so no pixel-identical verification is claimed.

### Approved continuous reels MP4

Get Started now embeds the user-approved 23.4-second MP4 from `output/reels-video/brainpal-reels-continuous.mp4` as a local Android raw resource. It replaces the scrolling-still experiment. The native player exposes an allowlisted source selector (`reels` or `accessibility`) so both onboarding and the Settings guide share the same playback/lifecycle code without mixing their media. The reels preview keeps its native 9:16 ratio, loops silently offline, pauses when unfocused/backgrounded, and shows its own poster with reduced motion. Its recorded counts/creator captions remain demonstration media and never enter local tracking, goals, or sync. APK size increases by approximately 14 MB. Tests cover source selection, focused/background/reduced-motion playback props, and existing accessibility guide regressions. Source credits accompany the standalone video under `output/reels-video/sources.md`.

### Income question removed

Onboarding now has six habit questions. The optional income question and yearly money-value calculation/display are removed. The summary shows estimated weekly scrolling hours only. Existing persisted step IDs remain stable: forward/back navigation skips retired step 7, and a saved draft on that question resumes at the time summary. Legacy income fields are ignored/stripped by the answers schema and are not used or written on subsequent saves. No backend change is needed; these answers were always local-only.
