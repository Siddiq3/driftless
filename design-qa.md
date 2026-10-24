# Invitation sheet visual QA

final result: blocked

Source visual truth: user-provided BrainPal invite bottom-sheet screenshot in the 24 October 2026 request. Target state: signed-in user taps Invite, dimmed board with a rounded bottom sheet, heading, rounded link/copy row and WhatsApp / Instagram / More actions. Existing ScrollSnooze app theme and typography are retained.

Implementation: `src/social/FriendInviteSheet.tsx`. Implementation screenshot: unavailable. Viewport / density-normalized implementation dimensions: not measured. No rendered comparison or focused-region comparison was performed.

## Findings

- [P1, validation blocker] The available Android emulator cannot install the current architecture debug binary because its internal data partition is almost full. No physical device is connected. No current rendered invitation sheet capture exists. The screenshot-to-implementation comparison must remain blocked; component tests and source checks do not establish visual fidelity.
- Installed-app links are used because no public join domain/deferred-install link service is configured. Instagram requires the user to paste the copied link; it does not accept an automatic prefilled text DM in this flow.

## Required fidelity surfaces

- Fonts / typography: Lilita One title and current app text styles implemented; actual wrapping and font scaling not visually verified.
- Spacing / layout: rounded bottom sheet, handle, pill and three large targets implemented; actual viewport/keyboard/safe-area behavior not visually verified.
- Colors / tokens: current purple ScrollSnooze palette retained while following the supplied sheet structure. Rendered contrast not measured.
- Asset fidelity: existing Instagram asset, downloaded WhatsApp brand asset and Lucide Copy/Share icons used. No invented brand artwork. Runtime asset sizing not visually verified.
- Copy: requested heading and distinct Copy / WhatsApp / Instagram / More controls implemented; errors/loading and copy confirmation covered by component code/tests. No visual comparison is claimed.

## Implementation checklist

1. Free emulator storage or connect an Android device, without deleting needed application data.
2. Run current source through the debug client and capture the signed-in invitation sheet at the reference viewport/state using dedicated test data.
3. Compare full sheet and title/link/action regions together against the supplied screenshot; fix visible P0/P1/P2 differences and recapture.
4. Exercise Android clipboard, WhatsApp, Instagram, system sharing, back/dismiss, large fonts and safe areas. Authentication/invite round trips need isolated test accounts/backend.

No visual pass or device readiness is claimed. No browser prototype or website was created; this is a change to the existing native application.

---

## Earlier QA record (before this invitation change)

# Circle screen design QA

final result: blocked

The native screen is implemented and inspected on the Android emulator. Strict source-to-render comparison remains blocked: the source is a 716 × 1600 chat attachment, with no local attachment file exposed for the required normalized, side-by-side image comparison. Do not treat the implementation as a pixel-exact recreation.

## Evidence

- Source: user-provided Circle / Scroll Battle screenshot in this conversation.
- Initial capture: `/private/tmp/driftless-circle-screen.png`, 1080 × 2400.
- Revised capture: `/private/tmp/driftless-circle-final.png`, 1080 × 2400.
- Runtime: existing React Native Android app, `/friends`; native system chrome and existing app navigation retained.

## Implemented and inspected

- Cocoa header, cream display title, Friends pill, centered date navigation, highlighted own-count row, four numbered invitations, apricot invite controls, near-black background.
- Initial inspection identified a generic title font and undersized invite touch targets. Revised capture uses the existing Lilita One font and 48 dp invite targets.
- Existing brand avatar and icon family retained. No fake friend scores or invented leaderboard data.
- A two-player battle action is added below the invite list. Existing Today / Circle / Progress tab names remain.
- Both captures contain development overlays near the header; these are outside the Circle component.

## Functional validation

- ESLint and TypeScript pass.
- 149 app tests pass, including four new Circle tests: guest invite and battle gates, authenticated invite sharing, two-member battle creation, and date navigation without authentication.
- Authenticated network operations and native sharing are mocked in tests. No live invitation or battle was created during verification.
- Sharing sends nothing automatically; the native share sheet requires the user's recipient/action choice.

## Remaining visual work

Create a normalized source/render comparison when the original attachment file is available. Compare typography, spacing, colors, image quality, and copy at the same native viewport before recording a visual QA pass. A solid cocoa header and existing brand icons are adaptations rather than exact source assets.
