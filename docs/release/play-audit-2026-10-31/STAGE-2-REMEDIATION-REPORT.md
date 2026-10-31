# ScrollSnooze: Stage 2 Remediation Report

Date: 2026-10-31. **Overall result: source changes are done, but the app is not yet shown to be compliant.** Nothing was built for release, deployed, committed, pushed or changed in Play Console. No test ran on a phone, because no device was connected.

## 1. Original rejection analysis

Google's reason: the prominent disclosure did not cover all data collected through the AccessibilityService API, and "Diagnostics" was the type it could not find.

- **What the submitted wording lacked:** it mentioned counts, times and labels, but said nothing about status or diagnostic data.
- **What is not known:** Google does not say what triggered the finding. It could be the disclosure alone, or a mismatch with the Accessibility declaration in Play Console, where "Diagnostics" is a selectable data type. I cannot see those Console answers.
- **Older builds:** heartbeat and coverage reporting existed in earlier code and has since been removed. See `PREVIOUS-PLAY-REJECTION-ROOT-CAUSE.md`. Whether the current code differs from the rejected build needs the rejected build's version to confirm.

## 2. Accessibility data inventory

| Data type | Source | Purpose | Local storage | Backend transmission | Third-party sharing | Disclosure required |
|---|---|---|---|---|---|---|
| App and window events, package name | Accessibility | Know when a supported app is in front | Not stored raw | No | No | Yes (done) |
| Scroll events, resource IDs, classes, visibility, structure | Accessibility | Recognise players, detect item changes and ads | Not stored | No | No | Yes (done) |
| Visible text and content descriptions on detected Reels and Shorts screens | Accessibility | Detect item changes, ads and meme language | Memory only, as salted IDs | No | No | Yes (done) |
| Video and ad counts, viewing time | Derived from Accessibility | Show counts, goals, alerts | SQLite `daily` | Yes, after sign-in | Friends see daily video totals if sharing is on; battle members see the score | Yes (done) |
| Viewing events (random IDs, app, ad flag, time, date, timezone) | Derived from Accessibility | Hourly activity, daily recap | SQLite `events`, 30 days | No | No | Yes (done) |
| **Service running, item recognised, count experimental (`status`, `health()`)** | **Derived from Accessibility** | **Correct status and counts** | **Local** | **No separate report; only whether a verified `views` value is present** | **No** | **Yes (done). This is the honest Diagnostics item** |
| Foreground minutes | Usage Access, not Accessibility | Show minutes | SQLite | Yes, after sign-in | Battle members see a minutes-battle score; friends do not see minutes | Yes, A-06 |
| Date, timezone, random device ID, app version, platform | App-generated | Backup and account requests | Local | Yes, after sign-in | No | Yes (done) |
| Push token | App and OS, if notifications are allowed and a token exists | Device registration | Local | Yes, after sign-in | No sender found in the backend | Data safety review |
| Server request logs (route, status, duration, request ID, error type) | Backend, not Accessibility | Operate the service, 30 days | No | Server-side | AWS as host | Stated, and marked as not Accessibility data |
| Debug event export and structure capture | Debug builds only (`FLAG_DEBUGGABLE` gate) | Accuracy testing | Local | Only by explicit share | No | Not in release builds; device check still wanted |
| Firebase Messaging, Installations, DataTransport (via expo-notifications) | Third-party SDK, not Accessibility | Push plumbing | SDK-managed | **Runtime traffic unverified**; no `google-services.json` | Possibly Google | Needs device traffic check |
| Crash, analytics or performance SDK | None found in `package.json` or the release dependency tree | n/a | n/a | n/a | n/a | No |

## 3. Diagnostics explanation

The app has no crash, performance or analytics reporting through Accessibility. It does derive status from Accessibility events: whether the service runs, whether an item was recognised, and whether a day's count is experimental. These results are used on the phone. Backup reflects them only as whether a verified count is present.

The disclosure now says exactly this. It does not claim a diagnostics upload that does not exist. Server logs are stated separately because the server generates them, not Accessibility.

## 4. Disclosure wording, before and after

**Before (submitted):** "ScrollSnooze can track app minutes in Instagram, YouTube, Facebook, Snapchat, Moj and ShareChat. Experimental short-video detection covers Instagram and YouTube only; ... Where a video rule is active, limited player labels become one-way codes and only counts and times are saved on this phone. Meme breaks can use the script of visible player labels ... No messages, passwords or screenshots. Signing in backs up daily totals and goals automatically; guest progress stays on this phone."

**Before (Stage 1 working copy), lock card:** "Including messages and passwords. Only your daily totals are backed up after you sign in, so you can share your score with friends. No screenshots are taken."

**After (consent sheet, `accessibilityDisclosure.ts`):**
- **What it reads:** "Only in Instagram and YouTube: app and scroll events and screen structure. On Reels and Shorts screens it also reads visible text and content descriptions. This is used to count the Reels and Shorts you watch, measure your time on them, show your count, goal alerts and meme breaks, and apply pauses you set. This runs even when ScrollSnooze is closed."
- **Diagnostics and detection status:** "From these events the service works out, on this phone, whether it is running, whether a Reel or Short was recognised, and whether a day's count is experimental. This keeps your status and counts correct. No crash or performance reports are collected through Accessibility."
- **Stored on this phone:** "Video and ad counts, viewing time and dates, plus timestamped viewing events kept for about 30 days."
- **After you sign in:** "Daily and per-app video counts, ad counts, minutes and goals are backed up automatically, with the date, your timezone and a random device ID. Experimental counts are kept apart from verified counts. Our servers keep request logs for 30 days (route, status, duration, request ID and error type). Sharing totals with friends or in battles is a separate choice. If you don't sign in, this data stays on this phone."
- **Screen content never leaves your phone:** "Including messages and passwords. No screenshots are taken."
- **Your choice:** "Turn this off anytime in Android Settings > Accessibility."

The full disclosure, `strings.xml` service description, privacy screen and website policy were aligned to this.

## 5. Evidence that the disclosure describes actual collection

| Claim | Evidence |
|---|---|
| Text only on player screens | `Classifier.kt` two-phase read; `screensWithoutAPlayerAreNeverReadAsText` |
| Events about 30 days | `SqliteStore.kt:251` |
| Upload fields | `DailyAggregate` contract; `src/sync/aggregate.ts` sends no `coverage` |
| Friends get video totals, not minutes | `friends.js:119-181` returns `views` |
| Battle minutes score is shared | `challenges.js:576-582` (`fewest_minutes`) |
| Sharing needs separate consent | `friends.js:134,164` `consent.shareWithFriends` |
| Log fields and retention | `lib/log.js` allowlist; `serverless.yml:15` |
| No crash or analytics SDK | `package.json` and `releaseRuntimeClasspath` search |

## 6. Status of each finding

| ID | Status | Result |
|---|---|---|
| Diagnostics | FIXED — DEVICE VERIFICATION REQUIRED | Wording is done; on-device display and Console match are pending |
| A-03 Icon | FIXED — DEVICE VERIFICATION REQUIRED | All mipmaps and adaptive assets regenerated from clean `purple/icon-master.png`, checked by eye. Launcher appearance not seen on a phone |
| A-04 Backup wording | FIXED AND VERIFIED | Source matches fields; the live website is not updated until deployed |
| A-05 UGC | INVESTIGATION COMPLETE — APPROVAL REQUIRED | Section 7; nothing changed |
| A-06 Usage Access | FIXED — DEVICE VERIFICATION REQUIRED | Section 8 |
| A-07 Pro text | FIXED AND VERIFIED | The visible sentence is removed. Dormant strings remain at `model.ts:74,76` and `protectionStatus.ts:28` behind `SUBSCRIPTIONS_REQUIRED = false`, with no Pro UI |
| A-08 Media | FIXED — DEVICE VERIFICATION REQUIRED | Both videos, both posters and three demo images are now generated from code by `scripts/render-onboarding-media.swift`. Same names, sizes and players. Frames were viewed but not played on a phone |
| A-09 Uncommitted work | INVESTIGATION COMPLETE — APPROVAL REQUIRED | 151 app paths and 3 web paths uncommitted, all preserved. **Version code must go above 2 (name 1.0.1) for the next upload; not changed** |
| A-10 API URL | NEEDS EVIDENCE | `/health` returned 200 today, and `eas.json` and `.env` use that URL. The deploy-output URL match is still unconfirmed |
| A-12 Deletion | NEEDS EVIDENCE | Code reviewed; test plan in section 12; not run |
| A-13 Testing requirement | NEEDS EVIDENCE | Account type and creation date are needed; the 12-tester, 14-day rule applies only to personal accounts created after 13 Nov 2023 |
| A-14 Re-consent | FIXED — DEVICE VERIFICATION REQUIRED | Version 3→4. Tests confirm a version 3 consent cannot track until the new one is accepted. No data reset code was added |
| A-15 Text minimisation | FIXED — DEVICE VERIFICATION REQUIRED | Section 13. **Visible text access is reduced, not eliminated** |
| A-17 Policy HTML | FIXED — DEVICE VERIFICATION REQUIRED | Verified in the local build only: 1,637 words in the initial HTML. **Live URL is unchanged until deployed** |
| A-18 Guest access | FIXED — DEVICE VERIFICATION REQUIRED | Guest row "Your data & privacy" opens `/privacy`. Account actions are gated on `api`, from code reading |

## 7. A-05 assessment: Friends and Battles against the UGC policy

Policy: https://support.google.com/googleplay/android-developer/answer/9876937. No Friends or Battles code was changed.

The policy defines UGC as "content that users contribute to an app, and which is visible to or accessible by at least a subset of the app's users". It lists no exclusions and does not mention usernames or profiles.

| Feature | Assessment |
|---|---|
| Automatic totals and scores | Measured, not authored. Not obviously UGC |
| Handle, display name, battle title | User-supplied text visible to others, so these plausibly meet the definition. `PATCH /v1/me` and contract fields accept them, but no text input was found in the social screens. **How they are set in the UI still needs confirming** |
| Invites between friends | Not messaging. No chat, posts or media were found |

**Mandatory if the UGC policy applies:** accepting terms before creating UGC, ongoing moderation, in-app reporting of content and users, and blocking where there is 1:1 interaction. Also, answer the content rating questionnaire's UGC question accurately, which applies either way.

**Recommended, not stated as mandatory:** report and block controls if names are confirmed as free text only because of low exposure. An alternative is to generate names and battle titles from fixed lists, which removes the user-written text. This changes behaviour, so it needs your approval.

**Your decision:** whether names and titles are free text, and how to answer the UGC question in Console. Google can make the final call. The policy text alone does not settle it.

## 8. A-06 changes

New `src/permissions/usageAccess.ts`, used by both Usage Access buttons (`app/tracking.tsx:270`, `app/privacy.tsx:164`). If access is not yet granted, it shows "Allow Usage Access?" with Cancel and Continue:

> ScrollSnooze reads Android's app-usage information to measure your time in Instagram and YouTube, and shows it as your minutes and statistics. It keeps this on your phone. If you sign in, daily and per-app minutes are backed up to your account. Friends don't see your minutes, but if you join a minutes battle, its members see your score. You can turn this off anytime in Android settings.

If access is already granted, the button goes straight to Settings so the user can turn it off. Tracking logic and the Accessibility flow are unchanged.

## 9. Files changed and why

**App**
- `src/permissions/accessibilityDisclosure.ts`, `res/values/strings.xml`, `app/privacy.tsx`: disclosure and backup wording, Pro sentence removed.
- `core/Classifier.kt`: A-15.
- `android/Platform.kt`: A-14 version bump.
- `src/permissions/usageAccess.ts`, `app/tracking.tsx`, `app/privacy.tsx`: A-06.
- `app/profile.tsx`: A-18.
- `src/capabilities/model.ts`, `src/billing/protectionStatus.ts`: subscription wording.
- `scripts/generate-brand-icons.cjs`, `app.config.ts`, generated icons, `android/.../brand_colors.xml`, new `purple/play-store-icon-512.png`: A-03.
- `scripts/render-onboarding-media.swift`, `onboarding_reels.mp4`, `accessibility_guide.mp4`, posters, `demo-reel-*`: A-08.
- Tests: `ClassifierTest.kt`, `AccessibilityConsentTest.kt`, `test/profile.test.tsx`, new `test/usage-access.test.ts`, `test/accessibility-disclosure.test.ts`.

**Website, not deployed**
- `src/pages/Privacy.jsx`: policy wording and date. It also removes the "version numbers" claim, because new events store none.
- `scripts/prerender-privacy.mjs`, `package.json`: A-17.

Old media copies: `/private/tmp/claude-501/-Users-siddiqkolimi-Documents-wellbeing/d9318617-b45f-4408-8b79-9d043db2c326/scratchpad/a08-originals`. This is temporary storage.

## 10. Tests executed

| Check | Result |
|---|---|
| Jest | 65 of 65 suites, 554 of 554 tests passed |
| Native (`:tracking-android:testDebugUnitTest`) | 248 tests, 0 failures, BUILD SUCCESSFUL |
| TypeScript (`tsc --noEmit`) | Exit 0 |
| ESLint on `app src test` | 5 errors, 236 warnings. All 5 errors are in `test/account-backup-provider`, `test/google-session` and `test/home-swr`, which I did not change. Spot-checked changed files have 0 errors |
| Android resources (`:app:processDebugResources`) | BUILD SUCCESSFUL |
| Website build | Success |
| Privacy initial HTML (`dist/privacy/index.html`, scripts removed) | 1,637 words; key policy phrases found |
| Icons | Visually checked app icon, launcher, foreground, round and store icon; no third-party logos |
| Dependency review | No crash or analytics SDK; Firebase Messaging, Installations, DataTransport and measurement connector on the release classpath |
| `/health` | HTTP 200 |

## 11. Tests not executed, and why

- **All phone tests:** no device connected. This covers live counting on Reels and Shorts, consent screens, permission flows, video playback and guest navigation.
- **Release APK or AAB, and the release manifest:** release builds were not authorised. The manifest was not rechecked in Stage 2.
- **Account deletion and backend regression:** no production deletion is allowed, and the backend was not changed.
- **Live privacy URL:** not deployed.
- **Signed-in hiding of the guest row:** the test's session mock covers guests only; from code reading, the row depends on `!signedIn`.

## 12. Remaining risks and blockers

1. **Blocker:** website changes must be deployed before submission, because the in-app legal screen and the Console policy link show the live page.
2. **Blocker:** Play Console Accessibility and Data safety answers must match this inventory. I cannot see them.
3. **Blocker:** a new video must show the current build, and the current listing must describe Accessibility use.
4. **Blocker:** A-05 decision, A-13 evidence and version code bump.
5. **Risk:** detection could regress on real apps, and Firebase traffic is unverified.
6. **Risk:** do not upload `mascot/play-store-icon-512.png`; the mascot icon source has third-party logos. Use `purple/play-store-icon-512.png`. Check that the listed feature graphic is one you want, since it has the older brown look.
7. **Risk:** the new onboarding video is simple placeholder art and may look plainer than before.

**A-12 test plan, on a test account only:** create a test account, add a friend and join a battle, delete in the app, then confirm the status moves through deleting to deleted. Next confirm that the handle, friendships on both sides and memberships are gone, the member count dropped, and a retry is safe. Then test the web `/delete-account/` route. Disclosed backup recovery (35 days) remains.

## 13. Live behaviour needing device verification

Use the test copy (`.v3test`). Check `mCurrentFocus` before any tap.

- **Counting:** Reels and Shorts counts, ads, duplicates, and meme breaks on detected players (A-15).
- **Non-player screens:** Instagram chats and profiles, YouTube home. No counts or misdetections should appear. Text read is limited to detected player screens, and may include text overlaid on a player.
- **Consent:** fresh install, accept and decline; upgrade from version 3 prompts again; history survives.
- **Usage Access:** Cancel stays in the app; Continue opens Settings.
- **Guest flow:** row visible, export and delete hidden, nothing reset.
- **Media and icons:** both videos, picture-in-picture, launcher on light and dark wallpapers.
- **Network:** capture any Firebase traffic.

## 14. Play Console information still required

- Accessibility declaration: data types, including Diagnostics, and the reason given.
- Data safety answers, reconciled with section 2.
- Developer account type and creation date (A-13).
- Content rating answers on UGC (A-05).
- Listing text about Accessibility, plus the new video link.
- Target API status, per https://support.google.com/googleplay/android-developer/answer/11926878.

## 15. Readiness recommendation

**Not ready for submission.** Ready for a separate final audit once you approve the next steps: device verification, the A-05 decision, the Console evidence, and then deployment of the website.
