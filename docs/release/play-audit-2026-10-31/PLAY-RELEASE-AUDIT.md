# ScrollSnooze: Play release audit (Stage 1)

**Overall status: BLOCKED. Not release-ready.** Audit date 2026-10-31. No source, Play Console or deployment
changes were made. Scope: app `driftless` at `5f97ae0` plus **133 uncommitted paths**; backend `d7d0eb3`;
website `8bfdb58`. Automated tests today: Jest 63 suites, 548 tests pass (with last native run 247 pass before
later JS-only work). Tests are not evidence of real-device compliance.

## Context statements that do not match the current code

| Brief says | Actually |
|---|---|
| Two-step Accessibility onboarding | Replaced at the owner's request by one animated screen, a consent sheet and a "Not sure" sheet |
| Old videos and native guide intended to be removed | Removed, then restored at the owner's request. Both MP4s ship and the guide is used |
| Other social apps may provide app time | Removed at the owner's request. Service and rules cover Instagram and YouTube only |
| Weekly wrap | Removed. Daily wrap restored |
| Play Billing removed | Confirmed in app dependencies; dormant entitlement code and backend billing remain (A-07) |

## Finding format

Each finding: ID, severity, status, policy and URL, evidence, observed, expected, risk, action, verification.

## CRITICAL

### A-01 Original rejection notice unavailable: CRITICAL, UNVERIFIED
- Policy: https://support.google.com/googleplay/android-developer/answer/10964491
- Evidence: filename and text search found no notice. See PREVIOUS-PLAY-REJECTION-ROOT-CAUSE.md.
- Observed: only the relayed wording. Expected: exact notice on file.
- Risk: fixing the wrong cause and a repeat rejection, on a developer account.
- Action: developer supplies the email and Policy status screenshots. Verification: compare notice to the report.

### A-02 Play Console declarations and previous video not available: CRITICAL, UNVERIFIED
- Policy: answer/10964491; https://support.google.com/googleplay/android-developer/answer/10787469
- Evidence: no access to Play Console; no video file found.
- Expected: declaration, Data safety and video all match the final binary. Risk: mismatch is a stated rejection path.
- Action: export or screenshot current answers. Verification: field-by-field against DATA-FLOW-INVENTORY.md.

### A-03 Launcher icon shows six third-party logos: CRITICAL, NEEDS FIX
- Policy: Intellectual Property https://support.google.com/googleplay/android-developer/answer/9888072 ("Don't use
  another party's trademarks, such as logos or brand names without permission"); Deceptive Behavior
  https://support.google.com/googleplay/android-developer/answer/9888077 (accurate metadata).
- Evidence: `assets/branding/app-icon.png` (`app.config.ts`) shows Instagram, YouTube, Facebook, Snapchat, Moj and
  ShareChat logos. The prepared `output/play-store/scrollsnooze/scrollsnooze-icon-v3-512.png` has none and differs.
- Observed: the installed app icon carries the logos, four for apps no longer supported.
- Risk: trademark complaint and misrepresentation; suggests affiliation and unsupported functionality.
- Action: use a logo-free icon as launcher and adaptive icon. Verification: inspect icon resources in the AAB.

## HIGH

### A-04 Consent sheet contradicts itself on what is uploaded: HIGH, NEEDS FIX
- Policy: answer/10964491, User Data https://support.google.com/googleplay/android-developer/answer/10144311
- Evidence: `src/permissions/accessibilityDisclosure.ts:19` "Only your daily totals are backed up" vs line 15 "Daily and
  per-app totals and goals ... timezone and a random device ID".
- Expected: complete, consistent data use. Risk: this is the suspected rejection category.
- Action: reword line 19 without "Only". Verification: test plus wording-to-code table.

### A-05 Friend and battle features have no report or block: HIGH, NEEDS FIX (applicability is the owner's call)
- Policy: User Generated Content https://support.google.com/googleplay/android-developer/answer/9876937 ("in-app system
  for reporting and blocking")
- Evidence: handles and display names are stored and shown to other users (`friends.js:53-72`,
  `me.js:104-105`, `src/social/FriendsList.tsx:60`, join page shows inviter name). No report or block route in
  `router.js`, no such UI in `src/social`. Only removal exists.
- Risk: names and handles fit the UGC definition, so moderation controls may be required.
- Action: add report and block, and terms acceptance, or remove user-set text. Verification: device test and review of policy fit.

### A-06 Usage Access has no prominent disclosure immediately before it: HIGH, NEEDS FIX
- Policy: User Data, answer/10144311 (consent and runtime permission "must be immediately preceded by an in-app
  disclosure", where outside reasonable expectation)
- Evidence: `app/tracking.tsx:263-269` one line then opens settings; `app/privacy.tsx:163`. Minutes are backed up after sign-in.
- Risk: Usage Access is sensitive and its data leaves the device. Whether Google applies this requirement here is
  UNVERIFIED (PACKAGE_USAGE_STATS not found in the portion of answer/9888170 read verbatim).
- Action: short disclosure with explicit continue. Verification: test and video.

### A-07 Stale subscription text and dormant billing: HIGH (text), MEDIUM (dormant), NEEDS FIX
- Policy: Deceptive Behavior answer/9888077 ("don't include any hidden, dormant, or undocumented features")
- Evidence: `app/privacy.tsx:50` "Cancel any Pro subscription" shown in the deletion dialog; `src/capabilities/model.ts:74,76`;
  `FeatureAccess.kt:5`; `SUBSCRIPTIONS_REQUIRED`; backend `router.js:70`, `/webhooks/play-rtdn`, `serverless.yml` `PLAY_SA_SECRET_ARN`.
- Observed: no purchase UI or Billing library, but user-visible text mentions Pro and purchase code paths exist server-side.
- Action: remove the text now; plan removal of the dormant gate and endpoints. Verification: string search of the bundle and API test.

### A-08 Onboarding video and guide assets need provenance review: HIGH, UNVERIFIED
- Policy: IP answer/9888072; Deceptive Behavior ("must not attempt to mimic ... other apps")
- Evidence: `output/reels-video/sources.md` lists Mixkit stock clips and "Reference interaction: user-supplied BrainPal screen
  recordings"; output file `brainpal-reels-continuous.mp4`; poster shows an Instagram-like Reels screen with a pink
  brain counter pill (`res/drawable/onboarding_reels_poster.jpg`). `accessibility_guide.mp4` is captured device footage.
- Risk: competitor resemblance and third-party UI mimicry. Mixkit licence terms not checked.
- Action: owner confirms rights, or replace with an original neutral version. Verification: frame review.

### A-09 No signed release; source not committed: HIGH, BLOCKED
- Evidence: 133 uncommitted paths; only `app-debug.apk` exists. Play-installed `1.0.1` (code 2) cannot match this source, and
  the same version code is still configured (`app.config.ts`), so a new upload needs a bump.
- Action: commit, bump, EAS production AAB, inspect it. Verification: `aapt2`/bundletool permissions, SDK, 16 KB.

### A-10 Live backend version not confirmed end to end: HIGH, UNVERIFIED
- Evidence: deploy run succeeded and `/health` 200, `/v1/me` 401. `eas.json` targets `pwi8tdewmb...us-east-1`, the docs
  example is `ap-south-1`; the deployed URL is on the authenticated run page. No signed-in upload tested on the new build.
- Action: compare URL and test a signed-in sync with a test account.

### A-11 Stale compliance drafts: HIGH if reused, NEEDS FIX
- Evidence: `docs/STORE_PREP.md` (Driftless name, six apps, Pro, Cognito, "nothing leaves the phone"); `DATA_SAFETY_RECOMMENDATION.md`
  partly superseded; `PLAY_CONSOLE_PREPARATION.md:4` says 1.0.0 (1); `docs/PRIVACY_POLICY_DRAFT.md`.
- Risk: pasting them creates false declarations. Action: mark superseded and use the new matrix.

### A-12 Account deletion not verified live: HIGH, UNVERIFIED
- Policy: https://support.google.com/googleplay/android-developer/answer/13327111
- Code PASS: `app/privacy.tsx:194`, `account.js:129,281` (friends, memberships, handle, retry-safe state). Web path `/delete-account/` returns 200.
- Not verified: live deletion, remaining records, 35-day PITR behaviour, Data safety deletion answers.
- Action: delete a test account in production and inspect the result. No live account was deleted in this audit.

### A-13 New-account testing requirement: HIGH, UNVERIFIED
- Policy: https://support.google.com/googleplay/android-developer/answer/14151465 (personal accounts after 13 Nov 2023:
  12 testers, 14 continuous days). Evidence: account type and history unavailable. Action: developer confirms.

## MEDIUM

| ID | Status | Policy/URL | Evidence | Observed → expected | Action / verification |
|---|---|---|---|---|---|
| A-14 | NEEDS FIX | answer/10144311 | `Platform.kt:300` version 3 | Text changed after V3 existed (apps, memes, wrap) but anyone who accepted earlier V3 text is not re-asked → re-consent on change | Bump to 4; upgrade test |
| A-15 | NEEDS FIX | answer/10144311 (limit to needed) | `Classifier.kt:111` | Reads text or description of each visible node in Instagram/YouTube incl. DMs, in memory, before knowing it's a player → read only on player surface | Reorder; tests + DM test |
| A-16 | UNVERIFIED | Device and Network Abuse https://support.google.com/googleplay/android-developer/answer/9888379 ("Don't block or interfere with another app displaying ads") | `FeedPauseOverlay.kt`, ad detection | User-set pause covers feeds that contain ads → policy fit unclear | Keep user-set and disclosed; review by owner |
| A-17 | NEEDS FIX | answer/10144311 (public URL) | `/privacy/` HTML about 1 KB, text in JS | Tools without JS see an empty page → static HTML | Pre-render; curl test |
| A-18 | NEEDS FIX | answer/10144311 | `app/profile.tsx`, Legal | Guests can no longer reach reset, disclosure re-read or Usage link from Profile → reachable | Add guest route; test |
| A-19 | UNVERIFIED | Accessibility requirements generally | `PermissionScreen.tsx` | TalkBack, large fonts, small screens not tested on device | Device tests |
| A-20 | UNVERIFIED | answer/9888077 | rules `validatedVersions` empty | Pauses on untested versions may hit wrong screens; only partly exercised | Device matrix |
| A-21 | UNVERIFIED | answer/10787469 | SDK graph | Data safety answers need Firebase/Play network check | Traffic check on AAB |
| A-22 | UNVERIFIED | https://support.google.com/googleplay/android-developer/answer/9893335 | Policy text says "not designed specifically for children" | Target audience and age statement not set in Terms | Owner declares audience |

## LOW

| ID | Status | Evidence | Action |
|---|---|---|---|
| A-23 | NEEDS FIX | Release manifest has `exp+scrollsnooze` dev scheme and legacy `driftless` scheme | Remove if unneeded |
| A-24 | NEEDS FIX | ShortcutBadger adds about 20 launcher permissions, including READ/WRITE_SETTINGS and INSTALL_SHORTCUT | Block or drop badges |
| A-25 | UNVERIFIED | Old rows for removed apps may remain in `account_totals` | Upgrade test |
| A-26 | UNVERIFIED | `minifyEnabled` off by default | Decide with size and crash review |
| A-27 | UNVERIFIED | `/join/test` returns 401; a badly formatted test code may explain it | Test a real invite link |
| A-28 | UNVERIFIED | `assetlinks.json` has one fingerprint | Compare with Play app-signing SHA-256 |

## PASS (directly verified in code or artifact)

- `isAccessibilityTool` absent; permitted as a disclosed non-tool use; not autonomous (rule-based). `driftless_accessibility.xml`.
- Package limit, no gestures (`driftless_accessibility.xml:12,15`). Only action is Back on a tap (`FeedPauseOverlay.kt:23`).
- Non-player apps: only package name read (`DriftlessAccessibilityService.kt:189-200,329,391`).
- No screen-capture APIs. Consent gate on events (`:147`) and classification. Consent saved before guide. Back and Deny do not grant.
- Target API 36, min 24 in merged release manifest. Deadline text: answer/11926878. Cleartext off, `allowBackup=false`.
- No overlay, battery-exemption, billing, biometric, advertising ID, location, contacts, storage, camera or mic permission in the merged release manifest. No FGS. PendingIntents immutable (`GoalNotifier.kt:70`, `CountWidget.kt:40`). Service not exported.
- No ad SDK. Store icon v3 and feature graphic are logo-free. Website HTTPS, developer identity and contact present.

## Assessments

| Area | Result |
|---|---|
| Accessibility eligibility | Eligible as non-tool with disclosure; do not set `isAccessibilityTool` |
| Disclosure and consent | Structure PASS; content NEEDS FIX (A-04, A-14); device UNVERIFIED |
| Video | Not created; required content in PLAY-CONSOLE-EVIDENCE-REQUIRED.md |
| Diagnostics | Accessibility-derived removed; server logs remain |
| Data Safety | UNVERIFIED; draft matrix in DATA-FLOW-INVENTORY.md |
| Privacy policy | Mostly accurate; A-17, A-18; must re-check after fixes |
| Target API | PASS in manifest; AAB UNVERIFIED |
| Store listing | UNVERIFIED; live listing not accessible |
| Account deletion | Code and web path PASS; live UNVERIFIED |

## Prioritised next actions

1. Developer supplies evidence (PLAY-CONSOLE-EVIDENCE-REQUIRED.md).
2. Approve Stage 2 for A-03, A-04, A-06, A-07, A-14, A-15, A-17, A-18, A-23, A-24.
3. Decide A-05 (report and block) and A-08 (video).
4. Commit, bump version, build AAB, inspect it.
5. Run RELEASE-TEST-MATRIX.md on the Play-installed build. Record the video on that build.
