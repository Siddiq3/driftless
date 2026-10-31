# ScrollSnooze: Play Console Submission Pack

Prepared 2026-10-31 from the current code and Google's published forms. I have not seen your current Console answers, so compare them line by line before changing anything. This supersedes the Friends, name and sharing wording in `STAGE-2-REMEDIATION-REPORT.md`.

**Status: not ready to submit.** Section 6 lists what is left.

## 1. Accessibility declaration

Path: App content > Accessibility API. The app is not an accessibility tool, and `isAccessibilityTool` is deliberately absent from its config.

| Question | Answer |
|---|---|
| Why does your app need the API? | **App functionality** only |
| Do you collect and/or share personal or sensitive data using the accessibility capabilities? | **Yes** |
| What data? | **App interactions** (App activity), for the video counts and viewing time that leave the phone after sign-in. This is the option name on the live form |
| Diagnostics | **Do not select** (see below) |
| Crash logs, Installed apps, Device or other identifiers, Name, Email | **Do not select.** None of these come from Accessibility |
| Video link | New video, section 4 |

**Suggested description, if the form offers a text box:**

> ScrollSnooze uses the AccessibilityService API only in Instagram and YouTube, to count the Reels and Shorts a user watches, measure time on them, show the count, goal alerts and meme breaks, and apply pauses the user sets. Text is read only while a Reels or Shorts player is detected and is processed in memory. It is never saved or uploaded. After sign-in, only daily counts and time are backed up.

### The Diagnostics decision

Google's form uses "collect" to mean sending data off the device. Its definition of Diagnostics is "Information about the performance of your app. For example battery life, loading time, latency, framerate, or any technical diagnostics."

- **Accessibility status stays on the phone:** whether the service is running, whether an item was recognised, and whether a count is experimental.
- **One indirect trace leaves the phone:** backup shows whether a verified count exists. I treat that as a count quality marker, not app performance.
- **So the accurate answer is not to select it.**

**What I can't confirm:** why Google flagged Diagnostics. The likeliest cause is that Diagnostics is ticked in your current declaration while the old disclosure never mentioned it, but I need to see your form. If it is ticked, untick it. Older builds did have heartbeat and coverage reporting, so it may have been accurate then.

The new disclosure states this status and says no crash or performance reports are collected through Accessibility, so it stays accurate either way. If a reviewer still objects, the fallback is to select Diagnostics with the same explanation. Don't select it just to satisfy the wording.

## 2. Data safety

Global answers:

| Question | Answer |
|---|---|
| Collects or shares required data types? | **Yes** |
| Encrypted in transit? | **Yes** (HTTPS API) |
| Users can request deletion? | **Yes**: in-app delete, and `https://scrollsnooze.vercel.app/delete-account/` |
| Data sold or used for ads? | **No** |

Data types, listed as collected. All collection is optional because guests can use the app without an account.

| Type | Answer | Why | Purpose |
|---|---|---|---|
| Name | **Collected** | Google display name stored and shown to accepted friends | App functionality, Account management |
| Email address | **Check, section 5** | Comes inside the Google sign-in token. The backend reads only the `sub` and issue-time claims and does not store email | If declared: Account management, ephemeral |
| User IDs | **Collected** | Account UUID | App functionality, Account management |
| App interactions | **Collected** | Daily and per-app video counts, ad counts, minutes, goals | App functionality |
| Device or other IDs | **Collected** | Random device ID; push token if notifications are allowed; possibly a Firebase installation ID | App functionality |
| Diagnostics | **Collected** | Server request logs: route, status, duration, request ID, error type, kept 30 days. These are not from Accessibility | App functionality |
| Crash logs | **Not collected** | No crash SDK | |
| Installed apps | **Not collected** | Installed status is checked only on the phone | |
| Location, contacts, photos, messages, financial, health | **Not collected** | | |

**Sharing: declare none.** AWS is a service provider. Google's form exempts transfers to service providers, and transfers based on a user-initiated action with prominent disclosure and consent. Friends seeing a name and daily count falls under accepting an invitation. This is my reading of the form, not a confirmed Google ruling.

Selecting Diagnostics here but not in section 1 is correct and not a contradiction: section 1 covers Accessibility only, and this section covers the whole app.

## 3. Store listing text

Add this to the full description. Google's rejection reminder requires Accessibility use to be documented in the listing.

> **Why ScrollSnooze asks for Accessibility permission**
> ScrollSnooze uses Android's AccessibilityService API to count the Instagram Reels and YouTube Shorts you watch, measure your time on them, and show your count, goal alerts, meme breaks and the pauses you set. It works only in Instagram and YouTube. Text on screen is read only while a Reels or Shorts player is detected, is processed on your phone and is never saved or uploaded. ScrollSnooze takes no screenshots and doesn't read your messages or passwords. You choose whether to allow it, and you can turn it off anytime in Android settings.
>
> **Your data**
> Without an account, your progress stays on your phone. If you sign in with Google, daily counts, minutes and goals are backed up. If you and a friend accept an invitation, each of you can see the other's Google account name and daily Reels and Shorts count.

Also check that the listing uses `mascot/play-store-icon-512.png` (regenerated 2026-10-31 from the supplied logo without app icons), and that it doesn't promise battles, winners or apps other than Instagram and YouTube.

## 4. Review video

Google requires these five parts, recorded from the final build:

1. **Open the app** on the device.
2. **Reach the disclosure screen.** Show all of it, scrolling slowly so every line is readable.
3. **Consent:** tap accept and grant the Accessibility permission in Android settings.
4. **Decline:** decline, then show the disclosure appearing again when triggered.
5. **Core feature:** open a Reel and a Short and show the count rising. Add captions if needed.

Use a test account, keep private messages off screen, and upload it as an unlisted link.

## 5. Other Console items

| Item | What to do |
|---|---|
| Email address | Google sign-in here uses an ID token, and those tokens normally include email. Declaring it as collected and processed ephemerally is the cautious answer, because Google's form says ephemeral data must still be included in the response. Confirm that the Console's ephemeral option applies |
| Content rating | Answer the user-generated content question from the real form. The accurate facts are: no messaging, posting or uploads; friends connect by invitation and see Google names |
| UGC policy | Unresolved. Google could treat visible Google names as user-generated content. Report and block has not been added |
| App access | Guest mode works without an account. Friends needs Google sign-in, so give reviewers instructions, or a test account if the form asks for one |
| Ads | No ads |
| Target API | Release manifest shows target 36 and minimum 24, which meets the API 36 requirement |
| Privacy policy URL | `https://scrollsnooze.vercel.app/privacy/`. The new wording is live only after the website deploys |
| Testing requirement | Personal accounts created after 13 November 2023 need 12 testers opted in for 14 days. Check your account type |
| Version | Code must go above 2 for the next upload; currently 2 and 1.0.1 |

## 6. Remaining before submission

| # | Task | Needs |
|---|---|---|
| 1 | Compare section 1 to 3 against current Console answers | Your Console answers |
| 2 | Device checks: consent, Usage Access, counting, onboarding media, labels, icon | Phone, debug build approval |
| 3 | Firebase traffic capture, to settle Device IDs | Phone, debug build |
| 4 | Deploy backend, then website | Your approval |
| 5 | Two-phone Friends test | Steps 2 and 4 |
| 6 | Account deletion test on a dedicated test account | Step 4 |
| 7 | Website check: homepage app icons, mobile width | Website review |
| 8 | Version bump, commit, signed release build | Your approval; you hold the signing credentials |
| 9 | Record the video, update Console, submit | You, using the final build |

Passing source tests does not make the app compliant. Google makes the final decision.

## 7. Comparison with the exported Data safety form

Checked against `data_safety_export.csv`, supplied 2026-10-31. Where this section differs from section 2, this section applies.

| Item | Current answer | Change to | Why |
|---|---|---|---|
| Installed apps | Selected | **Remove** | Installed status is checked only on the phone and no installed-app list is uploaded |
| Email address, processed ephemerally | No | **Yes**, if the sign-in token includes email | The backend reads only the `sub` and issue-time claims and does not store email |
| Request data deletion | No | **Depends on the question wording** | Keep No if it means deleting data without deleting the account, because cloud data is removed only through account deletion. Choose Yes if it means any deletion request |

Keep unchanged: data collection Yes, encrypted Yes, OAuth, deletion URL, Name, User IDs, App interactions, Other actions (goals), Device or other IDs, Diagnostics, Crash logs not selected, no data shared, all types optional. Diagnostics stays selected here because of server request logs.

### Accessibility declaration, checked against pasted Console text

Confirmed by screenshots on 2026-10-31: **Diagnostics is selected and must be unselected.** App functionality, sensitive data Yes and App interactions are correct. The other App activity options and the crash and other-performance options are unselected, which is correct. Other sections showed 0 selected in the pasted text.

The video link is a Drive file from before these corrections. Replace it with a new recording of the final build (section 4), and make sure anyone with the link can view it.

Content ratings are 3+ and Everyone. The rating alone does not show how the user-generated content question was answered.

Still not supplied: content rating question answers. The Console summary shows only the 3+ result.

## 8. Replacement store description

Replaces the current description, which promises six apps, weekly wraps and scroll challenges. This text replaces section 3.

> Opened your phone for one video? How many did that turn into?
>
> Meet ScrollSnooze, your scroll counter with a little personality. Count the Instagram Reels and YouTube Shorts you watch, check your daily totals, and see where your scrolling time goes.
>
> YOUR SCROLL HAS RECEIPTS
> See your recorded Reels and Shorts counts. Turn on the floating brain counter to keep your daily count visible while you watch.
>
> SET YOUR OWN LIMIT
> Pick daily goals and set pauses for study, work, or whatever deserves your attention. You choose when it's time for a break.
>
> GET THE RECAP
> Explore your history and your daily wrap to see your totals, patterns and progress.
>
> BRING YOUR FRIENDS
> Invite a friend and compare daily Reels and Shorts counts on the Friends Leaderboard. Sharing starts only when an invitation is accepted. You can each then see the other's Google account name and daily count, and you can delete a friend anytime to stop sharing. Sign-in is required.
>
> START AS A GUEST
> No account is needed for counting and controls on your phone. Guest progress stays on your phone. Sign in with Google to automatically back up daily counts, minutes and goals.
>
> A NOTE ABOUT COUNTING
> ScrollSnooze supports Instagram and YouTube only. Counting depends on app versions and layouts, so counts may be incomplete or inaccurate.
>
> WHY SCROLLSNOOZE ASKS FOR ACCESSIBILITY PERMISSION
> ScrollSnooze uses Android's AccessibilityService API to count the Reels and Shorts you watch, measure your time on them, and show your count, goal alerts, meme breaks and the pauses you set. It works only in Instagram and YouTube. Visible text is read only while a Reels or Shorts player is detected, is processed on your phone, and is never saved or uploaded. ScrollSnooze takes no screenshots. The Leave feed button performs Android Back only when you tap it. You choose whether to allow this, and you can turn it off anytime in Android settings.
>
> USAGE ACCESS
> ScrollSnooze uses Android Usage Access to measure your time in Instagram and YouTube.
>
> Know your count. Choose your next scroll.

## 9. Reviewer sign-in details

The Console entry is "Username / phone number, password, instructions", and the app signs in only through Google. The account must be a dedicated Google test account that works without 2-step verification or a phone prompt. Do not use a personal account. Suggested instructions:

> ScrollSnooze works as a guest, so you can test counting, goals and pauses without signing in. To test account features, tap Profile, then Log in or create an account, and choose Continue with Google using the test account above. To see Friends, tap the Friends tab and tap Invite to create an invitation. Accepting one requires a second account.

**Production draft warning:** the pasted Console summary lists a Production "initial release" and "Start full rollout". Do not send this for review with the current build. The next upload must be a new build with a version code above 2.
