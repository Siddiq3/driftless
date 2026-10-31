# Play Console preparation — first Android release

App: ScrollSnooze · package `com.siddiqkolimi.scrollsnooze` · support `siddiqkolimi.dev@gmail.com`.
Version 1.0.0 (1). No subscription purchase required by this release.

## Suggested listing

Short description (under 80 characters):

> Build better scrolling habits with daily goals and mindful app pauses.

Draft full-description outline: explain supported app-minute tracking, goals, local guest
use, optional Google sign-in with automatic backup, separate friend sharing and configured
pauses. Disclose that short-video counting varies by supported app/version and permission.
Do not claim clinical benefits, universal app support, certified accuracy or iPhone parity.
Do not include the feature-branch War/link invitation flow in first-release screenshots.

Graphics needed: 512×512 store icon, 1024×500 feature graphic, real screenshots from the
release build and an accessibility declaration demonstration video. Do not publish debug
menus, fake scores or isolated UI-fixture data as evidence of live product behavior.

## Data safety worksheet — verify final answers against the actual release and deployment

| Data/process | Evidence to review |
| --- | --- |
| Identity and name | Google ID token/opaque user ID; display name and email-derived name fallback |
| App activity | Backed-up daily minutes, private video counts, eligible scores, goals and quality fields |
| Device identifiers | Random install/device IDs and configured notification token |
| Friends | Relationship data, invitations and explicitly shared aggregate scores |
| Diagnostics | Operational request logs only (no tracking coverage or heartbeats); debug-only local exports. See DATA_SAFETY_RECOMMENDATION.md |
| Local-only input | Setup answers, interface-node processing and raw recorder events do not enter ordinary account backup |

Do not answer "no data collected" for the entire app. Cloud backup follows sign-in.
Determine Google's collection/sharing categories and service-provider exceptions from the
final processing inventory; this worksheet does not pre-fill unverified legal declarations.
General friend sharing and scoped battle consent are separate. Keep their revocation controls.

## Accessibility declaration evidence

- The app's primary purpose is self-directed digital wellbeing, not disability assistance.
- Keep `isAccessibilityTool=false` unless the actual product purpose qualifies otherwise.
- Demonstrate the disclosure, affirmative consent, refusal, Android settings, relevant
  function and revocation. A privacy policy alone is not prominent in-app disclosure.
- Explain supported apps, interface processing, local recording, backup and pause behavior.
- Verify the recording demonstrates the exact binary submitted and actual permissions.

## Reviewer access and testing

Document guest access plus complete Google sign-in/account review access in Console.
Do not provide personal account credentials or add an insecure reviewer authentication bypass.
Internal testing must cover Play-installed Google login, backup, deletion and access revocation.
Follow the account's closed-testing requirement if Console applies one.

## Remaining external release gates

1. Owner creates EAS upload credentials and links the actual Expo project.
2. Verify production public build values in `eas.json`; contracts install from `vendor/` without a GitHub token.
3. Obtain a signed production AAB and inspect its SDK/permissions/16 KB compatibility.
4. Configure Play app-signing SHA-1 in Google OAuth, then test the Play-installed build.
5. Complete physical-device accuracy gate G-2; bundled version ranges remain unvalidated.
6. Review and host public privacy/deletion documents with confirmed retention timings.
7. Supply real store assets, reviewer instructions and truthful policy declarations.
8. Resolve actual release-device findings and Console pre-launch warnings.

Sources: https://support.google.com/googleplay/android-developer/answer/16558241
https://support.google.com/googleplay/android-developer/answer/13327111
https://support.google.com/googleplay/android-developer/answer/9866151
