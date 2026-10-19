# Reference implementation QA — 19 October 2026

Final result: pass for the adapted visual/component scope below. Native device verification remains unverified; this is not a pixel-identical reproduction or a claim of a deployed backend.

## Evidence and normalization

Source: supplied BrainPal screenshots and the 69-second local WhatsApp video. Video extracted to 23 frames; the occupation frame is `/private/tmp/driftless-onboarding-reference/frame-004.png`, 240×540 pixels. The reference and live React Native Web SetupFlow were displayed together in one Safari screenshot using `http://127.0.0.1:8771/?screen=/onboarding&setupStep=1&width=320&compare=1`. Both content regions were normalized to 320×720 CSS pixels, with the low-resolution source scaled proportionally. Safari screenshot density was 2×. Browser chrome/canvas, source OS status/navigation bars and the preview's rounded stage were excluded from fidelity judgment. These are fixture-backed components, not a native screenshot.

Additional rendered states inspected: account at 390px and 320px; privacy with lock illustration; permissions; teal widget; friend challenge; final Instagram surface at 320px. UI screenshots were returned directly by Computer Use. Source targets remain the user's attached screenshots/video. Preview is external to the repository and has no production dependencies.

## Findings and corrections

- [P2, fixed] Occupation question wrapped unnecessarily at 320px. Replaced the long heading with “What do you do?” and shortened option labels. The second combined source/implementation capture showed a single-line question and four distinct choices, with the bottom Continue fully visible after matching the stage height.
- [P2, fixed] Initial headings used system sans and lacked the source's playful heavy display treatment. Bundled OFL Lilita One and verified the loaded display face on privacy, permission, widget, challenge and launch screens. Body/control labels retain system sans for readability.
- [P2, fixed] Privacy/widget/challenge content sat too low with vertically centered whole-screen content. Aligned these bodies from the top while retaining the persistent bottom controls. Follow-up widget/challenge captures showed the intended heading–art–action order without clipped actions.
- [P2, fixed] Launch character was oversized and separate from the app panel. Reduced it to 130px and perched it over the panel with a small overlap. Post-fix capture at `?screen=/onboarding&setupStep=15&guest=1&width=320` showed the small character above the Instagram mark, one short heading and reachable bottom actions.

- [P2, fixed] The new home character made app totals fall below the initial viewport. Reduced character size to 160–190px, tightened hero spacing, and matched the near-black setup canvas. The post-fix guest home capture at 390×720 showed the main count, Instagram/YouTube totals and goal link above the persistent tabs.

No unresolved P0/P1/P2 issue was observed in the reviewed component scope.

## Fidelity surfaces

- Typography: short centered heavy headings, proper source-like wrapping, readable body captions and pill labels. Display font is bundled with a sans fallback while loading. Font scaling remains enabled; native large-text coverage is still pending.
- Layout: dark full-screen canvas, large isolated raster characters, sparse question choices, bottom pill actions, teal widget and amber challenge. 320px and 390px component widths inspected. Normalized 320×720 question comparison showed the full persistent footer. Scrollable bodies support smaller heights.
- Colors: near-black #0B0B08 setup, warm #FFE8AD→#FFB763 primary buttons, charcoal secondary actions, off-white text, teal widget and amber challenge backdrop. Checkmarks reflect fixture/native health rather than unconditional success.
- Images: original transparent PNG brain family and friend duo, not handcrafted substitutes or full-screen rasters. Character edges/crops checked in account/privacy/widget/challenge/launch captures. Official Google mark and raster Instagram icon identify the external services. Standard native-code UI icons/gradient surfaces remain live UI.
- Copy: short headings and action labels. Estimates are identified as estimates; sample “12” is labeled Widget preview. Optional technical Details preserve truthful permission explanations without paragraphs on primary screens.

Focused inspection covered question wrapping/selection, display type, character crop, external app mark and CTA readability. These were readable in the full normalized screenshots, so separate magnified crops were unnecessary.

## Expected product differences

Driftless branding and original character art are retained. No fake discounts/countdowns or invented user counts are shown. Questionnaire questions are optional and additional local fields preserve the requested personalization. Permission rows show Accessibility and Usage Access used by this app; unused overlay/background permissions are not requested. A guest challenge action opens an app invitation, while authenticated friend connections retain their existing flow. Optional account creation does not silently enable cloud sync. These are deliberate functional constraints, not proof of pixel identity to BrainPal.

## Validation limits

App TypeScript, Expo lint and all 102 Jest tests passed. Infrastructure TypeScript and all 11 CDK synth tests passed. Android tracking/widget Kotlin compilation passed. Android Hermes export passed. The additional Android unit-test run was blocked while unpacking React Native/Hermes test resources because the host disk filled; no native test pass is claimed. Disposable task build cache was removed afterward.

Google OAuth credentials/provisioning, launcher pin confirmation, Android permission-return behavior, physical-device counting/first-install/SQLite restore behavior, TalkBack and native large-font states were not verified here. No cloud deployment, message delivery, purchase or permission grant was performed.

## Implementation checklist

- [x] Reference comparison and layout/type corrections
- [x] Animated original raster assets, reduced-motion behavior
- [x] Guest local tracking and optional account path
- [x] Real native widget/provider and allowlisted external-app launch
- [x] Direct Google identity and authorizer code with tests
- [x] Clear distinction between component previews and device/live-service validation
- [ ] Device checks and credential-backed Google login

Authentication follow-up: the subsequent user request replaces Cognito federation with direct Google sign-in. Current setup/validation is documented in [GOOGLE_SIGN_IN.md](../GOOGLE_SIGN_IN.md); earlier federation QA descriptions are superseded.

## Wrapped follow-up — 19 October 2026

Final result: component-flow checks passed; exact reference/native acceptance remains **blocked/unverified**. The supplied Wrapped screenshots are available inline in the conversation but were not exposed as local image files, so a normalized combined source/implementation capture was not produced. No pixel-identical result is claimed.

Live fixture-backed React Native Web screens were inspected in Safari at 390×720 and 320×720 CSS pixels. Covered daily total, peak, session timeline, app shares, longest recorded streak, personality, own prior-period comparison, final actions, a partial weekly total, and an empty daily recap. Previous/next/pause controls and the guest ready-prompt-to-weekly navigation were exercised. The native Modal appeared in the accessibility tree and its action navigated successfully, but Safari's screenshot capture omitted the modal portal; its visual appearance remains unverified. Device testing is still required.

Corrections from the rendered screens: reduced personality artwork/type/padding so the badge fits at 390×720; grouped the leading app's icon/count/name to keep the split bar closer to the visible content; moved the moon below the header to avoid the close control; removed duplicate partial-week body copy while retaining the tracked-day qualifier in the fixed footer; hid the offscreen full-content share poster from accessibility; reset scrolling on story changes. A final personality screen was saved at `/private/tmp/driftless-wrapped-personality.png` (temporary local fixture evidence).

Visual intent follows the references' fullscreen color stories, segmented progress, cream display figures, pink brain artwork, simple timeline and share action. Product differences remain explicit: original Driftless art/branding; real recorded sessions rather than claimed app-open counts; own prior-period comparison instead of an unavailable population percentile; actual goals/app-pause destinations instead of an unsupported reel-only lock. Empty/partial data are not filled with reference sample numbers. The ready prompt is in-app, not an overlay over Instagram.

Validation: 124 app tests, 78 shared-contract tests, 104 local DynamoDB API tests, 11 CDK tests, app lint/typecheck, API/contracts typecheck, Android Kotlin statistics and view-shot Java compilation, native autolinking and Android Hermes export passed. Contract coverage instrumentation was unavailable in the temporary dependency environment. Physical-device image contents/share completion, TalkBack, native large-font rendering and real period rollover remain unverified. Rebuild the Android client and deploy the updated API before using these additions in a release; neither a release install nor cloud deployment was performed.

## Progress screen follow-up — 19 October 2026

Implemented the supplied Progress references as live native UI: cream display heading, Daily/Weekly pills, previous/next calendar controls, rounded dark activity plot with apricot gradient bars, paired Total Reels/Time spent card, amber Pro banner, and a compact Top apps list. Wrapped and daily goals remain below the requested layout. The Progress footer uses the screen's black background. The Pro link says “Block apps” because the existing native feature pauses whole apps.

Daily hourly bars reuse the local Wrapped bridge and render only when they account for the complete confirmed day count. Daily totals remain available when older binaries lack hourly data. Weekly bars use validated daily aggregates, with future/unmeasured days as gaps and partial totals labeled. Calendar navigation, zero/unknown distinctions and per-app totals have focused tests. No backend/schema changes were necessary; all data stays local and works for guests.

Validation: TypeScript, lint and 132 Jest tests pass. Rendered visual acceptance is **blocked**: automatic approval review rejected Safari binding because its current window may expose an unrelated Codex sign-in token. An isolated in-app browser was unavailable and browser-provider inventory was empty. The rejected access was not retried or bypassed. No new native screenshot, pixel-fidelity, TalkBack or device test pass is claimed. The requested screenshot remains the visual target; the native implementation needs a visual check once Safari can be accessed safely.

## Floating Reels/Shorts badge — 19 October 2026

Added a service-owned native accessibility overlay with the bundled original brain image, dark red circular backing, red live-count pill and small status label. It is an optional Counter switch, does not consume touch input, and is positioned below the status bar at the top center. Native state tests cover consent, foreground package, recognized short-video surface, screen lock/interactive state, and unverified/missing-identity labels. Native Kotlin compilation and both state tests pass; app typecheck, lint and 132 Jest tests pass.

This supersedes the earlier scope decision to omit a floating count badge. No extra draw-over-apps grant or new tracking scope is requested. An active Accessibility service is required. No live Instagram/Shorts overlay screenshot or counting-accuracy pass is claimed: current app selectors remain unvalidated, and the prior emulator UI-control session could not be connected. Rebuild the native app and enable **Counter → Floating brain counter** to try it. It only appears on detected short-video surfaces; `~` means candidate count and `—` means unidentified video.

Floating badge build follow-up: dependencies were restored after the workspace's temporary `node_modules` target had been removed, and stale generated autolinking was regenerated. The full arm64 debug APK built successfully. ADB reported no attached emulator at install time, so the badge was not installed/enabled or visually verified on a device. The new service-interruption path also hides the badge and ends the observed session.

Shorts detection follow-up: the local structure capture of YouTube 21.37.42 showed that the player root has no description while anonymous caption groups carry text. Rule-v2 scopes caption identity to the player and excludes interaction controls. The installed native fix recorded one real Shorts VIEW event (0→1). This is a single-event smoke test, not an accuracy certification or a visual pass. Today now displays local candidate counts as `~N`/Unconfirmed while goals and sync retain their validation gate. No prior missing views were fabricated/backfilled.

Floating-badge visibility follow-up: the user's emulator preference had no enabled value, so the previous default-off behavior hid the badge. The requested behavior now defaults on when counting consent/Accessibility is enabled; an explicitly saved off value is still honored. The native preference persistence test and two badge-state tests passed, along with app typecheck/lint. The rebuilt APK was installed without wiping data. Android WindowManager reported the `Driftless live count` accessibility overlay with `isVisible=true`, `isOnScreen=true`, `HAS_DRAWN`, and non-touchable/non-focusable flags while Shorts was open. This confirms window display, not a screenshot-fidelity pass. A follow-up build positions it below status-bar/camera-cutout insets. Counting remains candidate/unconfirmed; Instagram accuracy is not certified.
