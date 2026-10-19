# Accessibility setup reference QA — 19 October 2026

final result: blocked

Source visual truth: `/Users/siddiqkolimi/Downloads/WhatsApp Video 2026-10-19 at 17.27.28.mp4` (28.8 seconds). Eight decoded frames inspected at approximately 0, 3, 7, 10, 14, 18, 21 and 25 seconds. Frames: `/private/tmp/driftless-ref-{0,3,7,10,14,18,21,25}.png`, 360 × 800 pixels. Source phone viewport includes Android-owned status and navigation bars.

Implementation screenshot: unavailable. The computer-use app inventory exposes Chrome, WhatsApp, Terminal, Code, Finder, Safari and system apps, with no Android emulator window or browser tabs. Emulator UI capture cannot be performed through the available computer-use surfaces. No ADB/UI screenshot workaround was used. Native APK install and tests do not establish visual fidelity.

Target states: onboarding permission checklist, expanded four-step guide/disclosure, Android Settings with optional PiP walkthrough, enabled return state. Intended viewport: 360 × 800 logical reference size; production uses native safe areas and responsive ScrollViews. No density normalization or full-view/focused comparison is claimed without a rendered implementation screenshot.

## Reference measurements and implementation

- Typography: source uses a heavy centered two-line heading and compact bold row labels. Existing Lilita One onboarding display font and app typography are retained. Actual wrapping needs visual verification at 320/360/393 widths and large font settings.
- Layout: source heading starts near y=160, followed by three spaced permission rows, amber Allow pill and a bottom help pill. The guide uses a dark rounded card, top animated preview, four numbered instructions, and a bottom primary action. Existing native safe areas and Android chrome are retained. Preview and consent content scroll on short screens.
- Colors: near-black app surface, charcoal card, muted gray secondary rows, warm cream/amber controls. Existing setup tokens match this family; no screenshot color comparison is claimed.
- Assets: native instructional controls and the app's existing icon system render the four-step demonstration. No proprietary recording, actor art, BrainPal branding, recreated system chrome or fake permission prompt is embedded. The preview is explicitly marked as instructional. It shows Driftless's real Android service label.
- Content: required prominent counting disclosure stays visible before explicit agreement. The first two checklist rows state that these capabilities are included with accessibility, rather than claiming unrelated Android permissions were granted. Usage Access remains optional in Counter. Android Settings and its confirmation dialog remain system-owned, so vendor-specific chrome will differ from the source.

## Functional checks

- React tests cover explicit consent before guide launch, declining without granting consent, and launch failure with retry state.
- Native tests cover rejecting an unconsented launch and opening real Accessibility Settings when PiP is unavailable.
- TypeScript, Expo lint, Jest and Android debug build were run.
- PiP uses an unexported Activity and no additional display-over-apps grant. It closes after service enablement, revoked consent or two minutes. Actual device/vendor PiP transitions are not visually verified.

## Remaining verification

1. Capture the installed checklist and guide through an emulator/phone surface exposed to computer use.
2. Compare normalized full views and the Allow/help/guide regions with the reference.
3. Verify actual Settings → service switch → Allow → return behavior and PiP dismiss/disable/reduced-motion cases.
4. Resolve any P0/P1/P2 visual findings before marking fidelity passed.

No claim of a pixel-identical match or visual QA pass is made.

## Follow-up: missing floating guide

The user reported that the floating tutorial did not appear. Android logs from 17:43:29 showed `ACCESSIBILITY_SETTINGS` opening without NEW_TASK, with Settings becoming the top activity of the tutorial task. PiP was requested in the same transition. Code now separates the Settings task, starts PiP from a resumed guide, waits for the PiP callback, and avoids dismissing a review guide merely because accessibility was already enabled at launch. A dedicated-task reset avoids restoring the old, incorrectly nested Settings task on reopening. Native regression tests cover this ordering, task flag, old/new grant distinction and delayed-callback fallback. The rebuilt APK was installed preserving user data. User confirmation of live visibility was requested; no rendered screenshot is claimed. Visual QA remains blocked until live evidence is available.

## Second visual revision: footage instead of text slides

The user rejected the text-based tutorial's appearance. The implementation now embeds the supplied recording's tutorial panel as a local 8-second 640×592 H.264 video, with its pointer motion, amber highlights, and numbered step pills. The surrounding recorded device chrome is cropped out. OCR-located app-name regions are adapted to Driftless. Four derived media frames (step 1, 3, 4 and final hold) were opened and inspected, verifying the media asset, not the rendered product. A TextureView player is shared by an Expo native view in the rounded popup and the native PiP activity. Its aspect ratio is maintained in both states. Popup uses source-like full-width video, four compact numbered rows and amber Got it action; repeat viewers do not see first-time consent copy again. Required first-time disclosure and Not now remain intentional content differences.

Source: original 17:27:28 reference; media: `modules/tracking-android/android/src/main/res/raw/accessibility_guide.mp4`, poster: `modules/tracking-android/android/src/main/res/drawable/accessibility_guide_poster.jpg`. Native player and PiP regression tests, TypeScript, lint and Jest are separate functional checks. There is still no rendered implementation screenshot from an available computer-use emulator surface. Full-view/focused visual comparison and physical-device media/PiP playback remain unverified. final result: blocked

## Get started reference revision

Source: `/Users/siddiqkolimi/Downloads/WhatsApp Video 2026-10-19 at 18.13.53.mp4` (14.7s). Inspected eight extracted 360×800 frames at approximately 0, 1, 3, 5, 7, 9, 11 and 12 seconds; main screen appears after the launch icon. The reference header, dominant phone hero with floating badge, heading, supported icons and single bottom CTA inform `src/onboarding/GetStartedScreen.tsx`. Driftless branding and two supported apps are intentional content differences. The phone asset was opened and inspected separately; this is not a rendered-screen comparison. Counter motion uses existing reduced-motion-aware helpers; preview data is labelled and isolated from measured data. Existing native safe areas are preserved, no status bar/home indicator is recreated, and no fake app startup delay is added. Typography uses the existing Lilita One face, warm cream text on near-black and existing amber gradient CTA. Full-view comparison, CTA focus-region comparison, large-text and small-viewport runtime checks remain unavailable without an exposed emulator UI capture. final result: blocked

## Approved MP4 integration

The approved six-reel MP4 is now the Get Started hero via the shared local native player, replacing still-image paging. Resource `raw/onboarding_reels.mp4` preserves the verified 720×1280, 30fps, 23.4-second continuous video and its fixed controls. Its poster comes from the encoded output. Playback focus/background/reduced-motion tests and bundled-source selection tests are separate from on-device screenshot review. User approved the standalone video and requested integration; rendered in-app media playback remains unverified through the current unavailable emulator screenshot surface. final result: blocked
