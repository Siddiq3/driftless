# Google Play Store Preparation (Android) — Draft

Status: **draft for owner review.** Nothing has been submitted. Store approval is never guaranteed.
Sources: PLATFORM_CAPABILITIES S1 (AccessibilityService policy), S2 (isMonitoringTool). Re-verify every
policy page on the day of submission.

## 1. Accessibility API declaration (Play Console › App content › Accessibility API)

- **Is the app an accessibility tool?** No. (`isAccessibilityTool` is not set; a test enforces this.)
- **Why the app uses the AccessibilityService API** — App functionality.
- **Description to paste:**

  > Driftless helps people reduce how much time they spend scrolling short videos. Its accessibility
  > service receives events only from Instagram, YouTube, Facebook, Snapchat, Moj and ShareChat
  > (declared with `packageNames`). It reads video player layouts only in Instagram and YouTube;
  > those candidate rules are not accuracy-validated. Facebook, Snapchat, Moj and ShareChat currently
  > provide app-minute tracking only, with no video counts. It detects which app is in front so it
  > knows when the user leaves. Labels are
  > turned into an irreversible code in memory and are never stored or transmitted. With the user's
  > Pro subscription it can also show Driftless's own pause screen when a limit the user set is
  > reached. It performs no gestures or actions in other apps and never collects messages,
  > credentials or screenshots. Counts are kept on the device; with the user's opt-in, daily totals
  > are backed up to the user's account.

- **Personal or sensitive data collected/shared via the API:** App activity — "Other actions" (counts
  of videos watched in two apps), kept on device; daily totals shared with our server only with
  opt-in. No messages, contacts, credentials, photos or browsing history.
- **Prominent disclosure:** `app/disclosure.tsx` — in-app, before the system setting, separate from the
  privacy policy, affirmative "I agree" required, "Not now" keeps the app usable.

### Demo video script (required)
1. Open Driftless from the launcher. Show the Welcome screen.
2. Tap **Reels & Shorts counter** › **How counting works**. Scroll slowly through the whole disclosure.
3. **Non-consent path:** tap **Not now** → back on the counter screen showing "Counting is off". Tap
   **How counting works** again to show the disclosure is shown again.
4. **Consent path:** tap **I agree, open Settings** → Accessibility settings → enable
   "Driftless Reels & Shorts counter" → system dialog → allow.
5. Return to Driftless: status "Counting (accuracy not yet confirmed)".
6. Open Instagram Reels, scroll 5 videos; return to Driftless: today's count increases.
7. (Pro) Show the pause screen appearing at a limit, and dismiss it with "Close Instagram".
Captions narrate what is read and that nothing leaves the phone.

## 2. Data safety form (Play Console › App content › Data safety)

| Data type | Collected? | Shared? | Optional? | Purpose | Notes |
|---|---|---|---|---|---|
| App activity › App interactions (daily minutes/video counts in Instagram/YouTube) | Yes, if cloud backup on | No | Yes (opt-in) | App functionality | Raw data stays on device |
| App activity › Other user-generated content (handle, display name) | Yes, with an account | Shared with friends you add | Yes | App functionality | |
| Personal info › Email address | Yes, with an account | No | Yes (account optional) | Account management | Cognito |
| Device or other IDs (random install id, push token) | Yes, with an account | No | Yes | App functionality (sync, notifications) | Not hardware ids |
| Financial info › Purchase history | Yes, if Pro | No | Yes | App functionality (entitlement) | Via Google Play; we never see card details |

- **Encrypted in transit:** Yes (HTTPS only; cleartext disabled).
- **Users can request deletion:** Yes — in-app (Privacy & data › Delete my account) and by email.
- **Independent security review:** No.

## 3. Other Play Console items
- **Target audience:** 18+ only (D-010). Not designed for children.
- **Ads:** none. **Analytics SDKs:** none (D-012).
- **Content rating:** questionnaire — no user-generated public content (friends-only handles).
- **Monitoring apps:** not a monitoring app for others; do **not** declare `isMonitoringTool`. Re-check
  S2 before submission.
- **Permissions to justify:** `PACKAGE_USAGE_STATS` (Usage Access, user-granted special access for
  minutes), `POST_NOTIFICATIONS` (goal reminders), Accessibility service (above).
- **Subscriptions:** product id `driftless_pro` with a monthly base plan; description must match the Pro
  screen; link to manage subscription is in-app.

## 4. Things only the owner can do

| # | Task | Where |
|---|---|---|
| 1 | Create the Play Console app `com.siddiqkolimi.scrollsnooze`, closed testing track | Play Console |
| 2 | Create subscription `driftless_pro` (monthly base plan) | Play Console › Monetize |
| 3 | Create a Google Cloud service account with Play Developer API access; paste its JSON into the `PlayServiceAccount` secret after deploy | Play Console › API access, AWS Secrets Manager |
| 4 | Create a Pub/Sub topic for RTDN, a push subscription to `https://<api>/webhooks/play-rtdn` with OIDC auth; set `rtdnAudience`/`rtdnServiceAccount` in the CDK app | Google Cloud, `infra/bin/app.ts` |
| 5 | Firebase project + `google-services.json` for push tokens | Firebase console |
| 6 | Deploy the backend (`cdk deploy Driftless-dev`) — **explicit decision required** | AWS |
| 7 | Run the accuracy protocol (G-2) | Your phone, `docs/ACCURACY_PROTOCOL.md` |
| 8 | Host the privacy policy (`docs/PRIVACY_POLICY_DRAFT.md`, after legal review) | Website |
| 9 | Record the accessibility demo video (§1) | Phone screen recorder |
| 10 | Trademark / store-name search for "Driftless" (D-001) | |
