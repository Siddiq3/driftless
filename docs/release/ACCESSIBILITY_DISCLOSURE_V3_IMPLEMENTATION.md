# Accessibility disclosure version 3 implementation

Date: 2026-10-30. Baseline app 5f97ae0, backend 53717a6, website 5ee1f70.
Both edited repositories were clean before implementation and matched the source audit.
No production AAB, deployment or Console submission was performed.

The subsequent [consent-cutoff and language-history corrections](ACCESSIBILITY_V3_CORRECTIONS.md)
supersede the original shutdown description and extend the test results below.

## Changes and migration

The complete explanation precedes the setup guide, uses 16-point body text in the existing
palette/layout, and remains visible after acceptance. Privacy provides a permanent link.
Native disclosure version is now 3. An accepted version 2 (or older/missing version) returns
false for current consent, so existing event handlers, classification and heartbeat paths do
not authorize tracking. Floating-count refresh now checks consent before reading foreground
window information as well.

The existing consent setter records affirmative acceptance, version 3 and its timestamp in
`driftless_tracking` SharedPreferences. A derived local `disclosureRenewalRequired` health
field lets completed-onboarding users see the revised screen once per app launch; refusal
returns to the app without a redirect loop. Privacy is not interrupted. The existing setup
and permission banner still offer the disclosure. First-install setup retains the explicit
agreement and Not now paths. Readiness requires both current consent and a running service.
Accepting opens the existing native guide and Android settings flow.

Debug safeguards run in native execution: event-export writing and last-capture URI access
require FLAG_DEBUGGABLE. Structure capture checks debug status, current bound instance and
current consent before reading a root. Scheduling checks debug/consent immediately and capture
checks them again on execution. No tracking algorithm, selector, threshold, diagnostic field,
SQLite schema, backend API, authentication/billing mechanism, package name or signing config
was changed. Account download export and deletion remain separate, unchanged flows.

The website privacy copy and in-app privacy summary now distinguish temporary processing,
local diagnostic records and signed-in backup with coverage. The separate declaration proposal
is [DATA_SAFETY_RECOMMENDATION.md](DATA_SAFETY_RECOMMENDATION.md).

## Exact disclosure text

Screen heading: **How accessibility counting uses your data**

### Why we use Android AccessibilityService

ScrollSnooze uses Android AccessibilityService to detect and count Instagram Reels and YouTube Shorts, show your count and meme breaks, and apply pauses you configure while you use other apps, even when ScrollSnooze is closed. Video detection is experimental. App-minute tracking also supports Facebook, Snapchat, Moj and ShareChat through separate Usage Access; video counting is not set up for those four apps.

### What is processed temporarily

The service reads supported-app and foreground-window activity, accessibility events for window changes and scrolling, and relevant visible interface text and content descriptions. It also reads resource IDs, view classes, visibility and interface structure to recognize players, detect item changes and identify ads. Text is processed in memory for detection and converted into salted one-way identifiers to avoid counting the same item twice. Meme breaks can use the script of visible labels to choose a language on this phone. Raw text, captions and the raw content-language hint are not saved. Language-specific meme reaction and selection history, including reaction IDs and caption indices, may be stored locally to manage which reactions are shown. This history is not included in normal account backup.

### What stays on this phone

We save viewing events, timestamps, counts, ad counts and time measurements for your activity history, plus a small recent set of salted item identifiers for duplicate detection. We also keep diagnostics: service heartbeats, tracking status, supported-app and detection-rule versions, and measurement-quality information. These show when counting was available and whether measurements are experimental or incomplete. Developer debug builds can create local diagnostic event exports and interface-structure captures for accuracy testing, shared only when explicitly requested.

### What is backed up when you sign in

Guest progress stays on this phone. Signing in automatically backs up daily usage totals and goals to your ScrollSnooze account on Amazon Web Services. Daily backup includes a tracking-coverage measurement alongside eligible usage aggregates to describe measurement completeness; private video totals can include experimental counts. Account-wide limits also sync per-app usage totals. Raw accessibility text, captions, UI trees, salted item identifiers and detailed diagnostic event records are not included in normal daily backup. Sharing aggregate scores with friends is a separate choice. Sign out to stop automatic account backup.

### Pauses and your choice

Optional feed pauses cover a detected Reels or Shorts player. The Leave feed button performs Android Back only when you press it; system navigation remains available. Choose Not now or go back to decline without enabling accessibility tracking. You can keep using the app, and app-minute tracking works if you separately allow Usage Access. To revoke access at any time, turn off ScrollSnooze in Android Accessibility settings. You can read this explanation again from Privacy.

Buttons: **Got it · I agree** on first acceptance/renewal, **Got it** on an already
accepted review visit, and **Not now**. Android setup instructions/video follow the explanation.

## Executed verification

| Check | Result |
| --- | --- |
| `npm test -- --runInBand` in driftless | 63 suites, 538 tests passed |
| `npm run typecheck` in driftless | Passed |
| `./gradlew :tracking-android:testDebugUnitTest --offline` in driftless/android | 237 tests; zero failures, errors or skipped |
| `npm run build` in scrollsnooze-web | Passed |
| Local production privacy page in Chrome at 360px and 1280px | Required diagnostic/coverage copy present; no horizontal overflow or browser page errors |
| `git diff --check` in both edited repositories | Passed |

New tests exercise first-install refusal, version-2 invalidation, version-3 acceptance/version/
timestamp, actual Instagram counting and heartbeat resumption under a deterministic clock,
revocation, native release-mode export/capture rejection, delayed consent revocation, valid
debug exports/capture, persistent disclosure visibility, automatic renewal and no decline loop.
The full existing suites also cover YouTube counting, classifier rules, dwell/ring deduplication,
coverage math, SQLite persistence, guest/account ownership transitions, sync/backup, sign-in/out,
account lifecycle/deletion/reset. The account download-export source path remains unchanged;
no live account export request was executed.

The initial Android attempt ran out of disk, leaving corrupt test results. With approval, only
the generated `/private/tmp/scrollsnooze-iphone-ui-build` directory was removed to free space;
corrupt generated Android test results were cleared. The final complete native run passed.
A new consent test initially lacked the deterministic accounting-clock setup used by existing
counting tests; that fixture was corrected before the final passing run.

Logs: `/private/tmp/scrollsnooze-policy-jest.log` and
`/private/tmp/scrollsnooze-policy-native.log`. Website screenshots:
`/private/tmp/scrollsnooze-web-audit/policy-360.png` and `policy-1280.png`.

## Remaining validation and Play steps

- No device/emulator was connected. No live Instagram/YouTube validation, native disclosure
  screenshot inspection, signed-release execution, live Google login/billing, or production
  backup/deletion request was executed. Unit/integration fixture coverage is not a live-device result.
- Release-mode native tests clear FLAG_DEBUGGABLE in Robolectric; inspect the submitted AAB
  and perform release-device validation before submission. No production AAB was created.
- Bundled detector versions remain experimental/unvalidated, as before.
- Deploy the website policy and verify the public URL; enter accurate Console declarations and
  record the exact submitted app's consent/refusal/permission/feature flows. These steps were not performed.
- Validate release SDK collection and real deployed retention/log settings. Do not infer
  accessibility transmission by Firebase or other SDKs from dependency presence alone.
- Compliance depends on the final binary, declarations, policy URL and reviewer evidence;
  this patch does not guarantee Google's approval.

## Complete modified/new source files

App repository:

- `app/disclosure.tsx`
- `app/privacy.tsx`
- `docs/PRIVACY_AND_DATA_RETENTION.md`
- `docs/release/PLAY_CONSOLE_PREPARATION.md`
- `modules/tracking-android/android/src/main/java/app/driftless/tracking/android/DriftlessAccessibilityService.kt`
- `modules/tracking-android/android/src/main/java/app/driftless/tracking/android/Platform.kt`
- `modules/tracking-android/android/src/main/java/app/driftless/tracking/android/TrackingModule.kt`
- `modules/tracking-android/src/types.ts`
- `src/onboarding/FirstLaunchRedirect.tsx`
- `src/onboarding/SetupFlow.tsx`
- `src/permissions/PermissionChecklist.tsx`
- `test/accessibility-setup.test.tsx`
- `docs/release/DATA_SAFETY_RECOMMENDATION.md`
- `modules/tracking-android/android/src/main/java/app/driftless/tracking/android/DebugTrackingExports.kt`
- `modules/tracking-android/android/src/test/java/app/driftless/tracking/android/AccessibilityConsentTest.kt`
- `src/permissions/accessibilityDisclosure.ts`
- `test/disclosure-renewal.test.tsx`
- `docs/release/ACCESSIBILITY_DISCLOSURE_V3_IMPLEMENTATION.md` (this report)

Website repository:

- `src/pages/Privacy.jsx`

Backend worktree remains unchanged. No commits were created.
