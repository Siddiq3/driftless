# Driftless vs BrainPal — feature and reliability audit

Audit date: **20 October 2026, Asia/Kolkata**.

## 1. Executive summary

Driftless is a substantial Android implementation, not merely a visual prototype. It has a native accessibility-driven counter, durable local events, an interactive animated badge, local hourly statistics, account and social APIs, billing integration, and a dismissible Pro pause screen. Nevertheless, it is **not yet evidenced as an end-to-end reliable production competitor**.

The most important findings are:

1. **Real-app counting accuracy remains unverified.** Only Instagram and YouTube packages are configured, and both approved-version lists are empty. The local popup/daily chart can work, but normal client submissions exclude those reel counts from cloud/battle scoring.
2. **A reel-count cap does not block scrolling.** Reel goals affect the popup's expression; `BlockPolicy` accepts minutes and schedules only. Its intervention is a normal, dismissible Android activity. Do not describe this as tamper-proof reel blocking.
3. **Onboarding goal sync has a reproduced contract defect.** `finishSetup` produces a non-UUID goal ID; the cloud schema rejects it. The Settings caller suppresses that sync failure.
4. **Circle is not a daily friend leaderboard.** It displays the local user's number, friend identities, and invitation/battle controls. Competition is a separate challenge flow, not live friend totals on Circle.
5. **Production social/billing/recovery remain unverified.** Existing unit and integration evidence does not prove real Google login, two physical phones competing, real Play purchases, or service survival across OEM process management.
6. **Release and integration inconsistencies remain.** Backend capability flags default off; notification registration has no delivery implementation; generated local release configuration uses debug signing; several Pro marketing benefits lack corresponding route gates.

No confirmed crash or exploitable P0 was established in this audit. The scoring trust boundary warrants a P1 decision before competitive results are marketed as authoritative. “No confirmed P0” is not a security clearance.

### Status and evidence rules

The inventory uses only the requested statuses. **Implemented and verified** is restricted to the specifically described deterministic component behavior reproduced here, such as SQLite deduplication; it does not imply physical-device verification. An Android test here means Robolectric/JVM, not an instrumented Instagram/YouTube session. Most user-facing integrations are therefore **Implemented, not verified** or **Partially implemented** despite passing component tests.

Evidence labels:

- **J**: 155 Jest tests rerun in this audit.
- **N**: 96 tracking Android unit tests rerun in this audit, including Robolectric tests.
- **C**: 82 shared-contract/domain tests rerun in this audit.
- **A**: 10 accuracy-scorer tool tests rerun in this audit; these test the scorer, not actual app accuracy.
- **R**: explicit read-only reproduction described in §8.
- **S**: inspected implementation path; no new device execution.
- **H**: historical execution evidence from the earlier hourly-chart task, clearly separated from current audit results.

## 2. Repository, scope and build context

| Item | Observed context |
|---|---|
| App | `driftless`, branch `main`, commit `eb981296e88ba1cdba9afc6c04421d51557c9b56` |
| Backend/contracts/infra | sibling `../driftless-backend`, commit `488dba169fdaf22019e2c250828232851c740c95` |
| Initial tracked working trees | Clean in both repositories |
| App stack | Expo 57, React Native 0.86.3, React 19, TypeScript, local Kotlin Expo tracking and billing modules |
| App config | `app.config.ts`: Android only, portrait, package `com.siddiqkolimi.scrollsnooze`, version `0.1.0` |
| Storage | Kotlin SQLiteOpenHelper `driftless_tracking.db` for tracking; Expo SQLite `driftless.db` for settings, goals and sync bookkeeping; SharedPreferences for native settings |
| Credentials | Values of `.env`, OAuth identifiers, access tokens and private configuration were not read or printed |
| Device activity in this audit | No installation, login, permission change, reboot, service toggle, purchase, account deletion or third-party app automation |
| Read-only boundary | Only this requested report is added to the repository. No application/configuration edits, dependency installs, commits or deployments. Tests use disposable fixtures; no user's database or cloud table was opened or deleted |
| Public research | Official Play listing, website, legal pages and two public store screenshots. No original APK/source/private API inspection |

`README.md` and some phase comments lag the implementation. They were not treated as proof that a feature is absent or complete. Generated `android/` is ignored by Git, so its observed signing configuration is local build evidence, not proof of an immutable production pipeline.

## 3. Detection-to-action execution trace

### Tracking and popup

`DriftlessAccessibilityService.onAccessibilityEvent` accepts events from configured packages after disclosure consent, retains whether a scroll occurred, and schedules classification after 300 ms. `Classifier.classify` inspects a bounded accessibility tree, checks known short-video view IDs, constructs a salted content identity, and separates ads. This is UI-structure detection, not video decoding or a universal scroll counter.

`Engine.onObservation` creates a per-app session and feeds `ViewCounter.observe`. A new count requires a recognized short-video surface, a recent structural transition, a novel identity, and at least 1,500 ms dwell. Identity can settle for 1,200 ms after the transition. Periodic two-second service ticks flush dwell. Very fast swipes are intentionally not one-for-one counts; this should be explained in product copy.

`Recorder.apply` timestamps and dates each counted event in the current local timezone. `SqliteStore.recordView` inserts it and increments a daily total atomically, rejecting duplicate event IDs and duplicate session/sequence pairs. An eight-identity recent ring persists for up to 30 minutes to reduce recounts across switching/restarts; it is not permanent deduplication of every video ever watched.

`updateFloatingCount` sums ordinary daily views across supported packages. It shows the badge only over a recognized short-video surface on an interactive, unlocked foreground screen. The saved local count remains visible while identity is pending. `countBadgeMood` becomes drained only above the minimum enabled view limit. This expression change does **not** call the blocking policy.

### Local chart versus validated reporting

The daily chart uses `Tracking.localActivityDetails` → `WrappedDetails.readLocalActivity`, keeping package, kind, detection-rule-version, stored-date and timezone checks without requiring an approved app version. `activityData` reconciles the 24 buckets against saved supported-app local totals. Missing or inconsistent detail remains unavailable.

In contrast, `aggregateDay`, validated recaps, goal evaluation, widget totals and goal-count alerts retain their accuracy gates. `syncNow` submits day aggregates, not raw events. It does not turn a local chart count into a validated score. Weekly Progress still uses the validated aggregate path. These deliberate boundaries explain visible differences between screens.

### Pause/blocking path

`maybePause` reads the configured app's daily minutes, schedule, snooze and cached entitlement. `BlockPolicy.decide` can return a limit/schedule decision only with active cached Pro. The service launches `PauseActivity`, throttled by a three-second launch cooldown. The user can go Home, open Driftless, turn pausing off, or take five more minutes up to three times per local day.

This is a real interruption screen, not only a notification. It does not suspend packages, consume swipes, disable the feed, or enforce an unbypassable OS restriction. Its reliability still depends on accessibility remaining active and Android allowing the activity launch.

## 4. Implementation inventory

Paths are relative to `driftless` unless prefixed `../driftless-backend`. Native path reference links below resolve to exact files. Test names identify executable evidence rather than claiming device coverage.

### A. Tracking, counts, time and lifecycle

| Feature | Status | Evidence/file paths | Relevant functions/classes | Test evidence | Known limitations |
|---|---|---|---|---|---|
| Instagram Reels detection/counting | Implemented, not verified | [Service][n-service], [Classifier][n-classifier], [rules][n-rules] | `classifyNow`, `Classifier.classify`, `Engine.onObservation` | N `ClassifierTest`, `ViewCounterTest`, `EngineTest` | Empty approved versions; no labelled real-app accuracy run in this audit |
| YouTube Shorts detection/counting | Implemented, not verified | [Classifier][n-classifier], [rules][n-rules] | Caption-scoped identity, short-feed view IDs | N includes delayed-caption and changing-control scenarios | Changes in UI/language/captions may miss or merge identities; no device precision/recall proof |
| Facebook/Facebook Lite | Not implemented | [rules][n-rules], [accessibility config][n-a11y] | Package allowlist | N asserts exactly two supported packages | No package, selectors or event subscription |
| Snapchat/Spotlight/Snapchat Lite | Not implemented | [rules][n-rules], [accessibility config][n-a11y] | Package allowlist | Same package assertion | No package-specific detection |
| Instagram Lite/other short-video apps | Not implemented | [rules][n-rules], [manifest][n-manifest] | Package queries and rules | S | Similar names/icons do not confer support |
| Daily ordinary-view/ad separation | Implemented and verified | [Recorder][n-recorder], [SQLite store][n-store] | `recordView`, `daily` | N `AndroidLayerTest.recordViewIsIdempotentAndTransactional` | Verified storage behavior with fixtures; not ad detection accuracy in real feeds |
| Event/session deduplication and atomic totals | Implemented and verified | [SQLite store][n-store] | Event primary key, unique `(session_id, seq)`, transaction | N duplicate insert/retry tests | Content dedup is separately limited by the recent ring |
| Rapid-scroll/repeated callback logic | Implemented and verified | [ViewCounter][n-counter] | `observe`, `advance`, `remember` | N `fastScrollingBelowDwellIsNotCounted`, delayed-identity, replay and out-of-order cases | Deterministic input behavior only; skips under 1.5 seconds are intentional |
| App switching / restart session logic | Implemented and verified | [Engine][n-engine], [SQLite store][n-store] | `onLeave`, `startSession`, `saveRing`, `loadRing` | N restart, ring-age, app-switch and reopen tests | Does not prove Android restarts a killed service |
| Lock/unlock and foreground lifecycle | Implemented, not verified | [Service][n-service] | `screenOff`, `onTick`, `onInterrupt`, `stop` | Engine unit scenarios plus S receiver inspection | Scheduled classification/lock/OEM races need device tests; popup lock checks are not complete counter-lifecycle proof |
| Persistence across database reopen | Implemented and verified | [SQLite store][n-store] | WAL, `onUpgrade`, daily rows | N reopen and v1→v2 upgrade tests | Not a destructive OS process-death test; uninstall/delete-data removes data |
| Local day/timezone accounting | Implemented and verified | [Recorder][n-recorder], [UsageMath][n-usage-math], [details][n-details] | `localDate`, `splitByLocalDay`, `dayBounds`, recorded-zone hour | N midnight, travel, DST and hourly tests | Wall-clock changes and continuous feeds across midnight need device validation |
| Usage time | Implemented, not verified | [UsageReader][n-usage], [UsageMath][n-usage-math] | `refresh`, `foregroundMs` | N UsageMath tests | Usage Access measures full app foreground time, not exclusively Reels; fallback uses observed feed time |
| Historical daily totals | Implemented, not verified | `app/history.tsx`, [SQLite store][n-store] | `toRow`, `daily` | Storage tests; no route-level live history test | History shows local videos with a confirmation flag; missing data differs from zero |
| Local daily hourly chart | Implemented and verified | `src/activity/{model,useActivity}.ts`, [details][n-details] | `activityData`, `readLocalActivity` | J activity/sync tests; N `LocalActivityDetailsTest` | Aggregation/retained fixtures verified, not fresh installed bridge + live scrolls; 30-day raw retention/current-rule requirement |
| Weekly charts and trends | Partially implemented | `src/activity/model.ts`, `app/{progress,stats}.tsx` | Weekly branch; validated `aggregateDay` | J weekly boundaries/partial coverage | Empty approved lists leave view series unknown; minutes can still work |
| Raw-event retention | Implemented and verified | [SQLite store][n-store], [Service][n-service] | `purgeOlderThan` at connection | N retention test | Thirty days for raw events/heartbeats; daily totals remain. Purge is connection-triggered, not a dedicated scheduled job |
| Service recovery / battery handling | Partially implemented | [Service][n-service], [manifest][n-manifest], `src/permissions/PermissionChecklist.tsx` | Reconnect initialization; health status | J health-state tests; S | No app-owned watchdog, boot-start recovery service, or OEM battery troubleshooting workflow found; system accessibility rebinding is not guaranteed |

### B. Floating brain and interaction

| Feature | Status | Evidence/file paths | Relevant functions/classes | Test evidence | Known limitations |
|---|---|---|---|---|---|
| Overlay creation/permission | Implemented, not verified | [badge][n-badge], [manifest][n-manifest], `app.config.ts` | `show`, `TYPE_ACCESSIBILITY_OVERLAY` | N attach/show tests | Uses accessibility grant; no separate `SYSTEM_ALERT_WINDOW` grant. Silently hides on creation failure |
| Brain graphic + count only | Implemented, not verified | [badge][n-badge], `res/drawable/brain_*.png` | `show`, `updateFace` | N verifies two children and count | Actual renderer/size readability across devices not proven here |
| Blinking and reduced motion | Implemented, not verified | [blink view][n-blink], [badge][n-badge] | Eyelid drawing, animator, attach/detach cleanup | N explicit happy/drained animation-frame checks | Unit tests do not prove convincing eyelid alignment; whole character is not a full skeletal animation |
| Happy/drained expression | Implemented and verified | [badge state][n-badge-state] | `countBadgeMood`, `countBadgeValue` | N below/at/above-limit tests | Policy verified; two expression assets, not multi-stage deterioration. At limit stays happy; above becomes drained |
| Animated count changes | Implemented, not verified | [badge][n-badge] | 180 ms translate/fade/scale on text change | N stable-value/count checks, S animation code | Displays saved latest number; does not interpolate every integer in a multi-count jump |
| Tap to open app | Implemented, not verified | [badge][n-badge] | `onSingleTapUp`, `performClick`, launch intent | N `tappingCounterOpensAppAndAccessibilityClickWorks` | Launch verified with fake resolver, not a physical background-launch case |
| Long press, full-screen drag and saved position | Implemented, not verified | [badge][n-badge], [preferences][n-platform] | `enableDragging`, `place`, `savePosition`, `badgeX/Y` | N movement and preference persistence | Bounds are usable window area, not system navigation/status area; no multi-window/OEM verification |
| Size setting | Implemented, not verified | `app/tracking.tsx`, [badge][n-badge], [preferences][n-platform] | Size bridge, 40/54/72 dp UI options; clamp 40–80 | N resize/bounds/persistence | Full React Native → bridge → live service path not device-tested in audit |
| Drag-to-pause | Implemented, not verified | [badge][n-badge] | Dismiss target, hit radius, `askPause` | N drag, cancel and no-accidental-launch test | Target appears only during drag; dropping opens a choice, not immediate permanent dismissal |
| One-hour pause | Implemented, not verified | [badge][n-badge], [Service][n-service] | `pause(3_600_000)`, timestamp visibility gate | N confirms stored one-hour deadline | No actual hour-long/device-clock test; hides popup and meme cards, not counting or Pro policy |
| One-day pause and resume | Implemented, not verified | [badge][n-badge], `app/tracking.tsx`, [bridge][n-bridge] | `pause(86_400_000)`, `resumeFloatingCount` | S exact duration; N preference persistence | One day means rolling 24 hours, not next midnight; no separate one-day button/expiry test found |
| Process death/reboot popup recovery | Partially implemented | [preferences][n-platform], [Service][n-service] | Persistent positions/sizes/deadline; service-owned recreation | N preference-instance tests | Settings persist, but actual service rebind is unverified. Absolute deadlines respond to manual clock changes |
| Screen-size/Android compatibility | Unknown | [badge][n-badge], [blink view][n-blink], `app.config.ts` | Pre/post API 30 geometry branches, layout/config callbacks | Most Robolectric tests use API 35 | No physical API/OEM matrix, tablet/foldable/multi-window/TalkBack or large-font evidence |

### C. Limits, intervention and bypass resistance

| Feature | Status | Evidence/file paths | Relevant functions/classes | Test evidence | Known limitations |
|---|---|---|---|---|---|
| Daily reel goal storage | Partially implemented | `src/onboarding/{model,store}.ts`, `app/goals.tsx` | `finishSetup`, `saveGoal`, `setLimits` | J onboarding/goal tests | Local target exists; main goal editor gates enablement by approved app version; cloud seed ID defect below |
| Block at a reel-count limit | Not implemented | [block policy][n-block], [Service][n-service], `src/billing/blocking.ts` | `BlockConfig` has `dailyMinutes`, not view limit | N policy tests cover minutes/schedules | Popup draining or goal alerts do not block |
| Per-app minute thresholds | Implemented and verified | [block policy][n-block] | `decide`, `dailyMinutes`, app membership | N `BlockPolicyTest` | Same configured minute threshold applied separately to selected apps; policy tests do not prove interruption delivery |
| Work/bedtime/morning schedules | Implemented and verified | [block policy][n-block], `src/billing/blocking.ts` | `Schedule.contains`, `PRESETS` | N ordinary and overnight windows | UI provides presets; no custom schedule editor; intervention still service-dependent |
| Actual interruption screen | Implemented, not verified | [Service][n-service], [pause activity][n-pause] | `maybePause`, `startActivity`, `PauseActivity.onCreate` | S; no live pause/activity test found | A normal Activity, not package suspension or input blocking |
| Selective feed-only blocking | Not implemented | [Service][n-service] | `maybePause` checks package/time, not current feed surface | S complete policy/caller trace | Once configured threshold/schedule applies, it can interrupt non-Reels screens in a selected app |
| Five-minute override / launch cooldown | Implemented, not verified | [preferences][n-platform], [block policy][n-block], [Service][n-service] | `snooze`, three/day cap, three-second launch throttle | N policy snooze case; S activity/prefs | No proof against clock changes, timezone changes, service toggles or rapid task switching |
| Disable/revoke/kill behavior | Partially implemented | [block policy][n-block], [Service][n-service], `src/tracking/state.ts` | Fail-open `decide`; enabled vs running status | J status tests; N expired/free policy cases | No enforcement with service stopped; user always retains Settings/Home control. This is intentional, not parental/enterprise enforcement |
| Daily reset/timezone boundary | Implemented, not verified | [Service][n-service], [preferences][n-platform] | Local-date queries, schedule wall time, `snoozesToday` | N date policy/recorder tests | Counter naturally queries a new date; snooze daily cap follows local date, so not tamper-resistant |
| Free/Pro pause gate | Implemented and verified | [block policy][n-block], [bridge][n-bridge] | Cached Pro, expiry, state check | N free/expired/offline grace tests | Scope is local policy. Cache is not cryptographically verified by Kotlin; modified/rooted clients are outside this proof |

### D. Progress, motivation, accounts and social

| Feature | Status | Evidence/file paths | Relevant functions/classes | Test evidence | Known limitations |
|---|---|---|---|---|---|
| Today dashboard | Implemented, not verified | `src/ui/Focus.tsx`, `src/goals/useProgress.ts` | `FocusHero`, local candidate fallback | J brain-state/candidate tests | Overall candidate number can coexist with unavailable validated per-app chips |
| Streaks and goal outcomes | Partially implemented | `src/goals/progress.ts`; contracts `domain/{goals,streaks}.ts` | `dayResult`, `progress`, `computeStreaks` | J progress; C domain tests | Current reel goals remain unknown without approved versions; minute goals can work |
| Achievements/rewards | Partially implemented | `src/goals/achievements.ts` | `achievements` derives six awards | J achievement tests | No `app/` or `src/` caller found beyond definition; no earned-award screen/notification path. No monetary/redeemable rewards |
| Brain on home vs popup | Partially implemented | `src/ui/brainState.ts`, `src/ui/BrainCharacter.tsx`, [badge state][n-badge-state] | `brainPresentation` uses validated outcomes; badge uses local count | J brain tests; N mood tests | Home can stay idle/happy while badge drains on unvalidated usage; home image does not use native blinking view |
| 80%/100% goal alerts | Implemented, not verified | [notifier][n-notifier], [alerts][n-alerts], `app/goals.tsx` | `GoalNotifier.check`, `LimitAlerts.due` | N `LimitAlertsTest` | Count alerts require approved versions; native loop stops with service; no independent background usage-only alert worker |
| Evening reminder | Implemented, not verified | `src/goals/reminders.ts` | `setEveningReminder`, local 21:00 trigger | S | Permission, reboot/timezone delivery untested |
| Meme breaks | Implemented, not verified | [meme policy][n-meme-policy], [meme card][n-meme], [Service][n-service] | New 50-view milestone, locale resolution, card callbacks | N `MemeMilestoneTest`, `MemeCardTest` | Depends on recognized identity and badge enabled/unpaused; card is dismissible; two artwork/localization paths, not an unlimited meme feed |
| Home-screen widget | Implemented, not verified | [widget][n-widget], widget XML | Pin request, `update`, date/time receivers | S | Approved-version gate yields dash in current build; refresh periodicity/service and launcher behavior unproven |
| Daily/weekly Wrapped | Partially implemented | `src/wrapped/model.ts`, `src/wrapped/Stories.tsx`, `src/wrapped/useWrap.ts`, `app/wrapped.tsx` | Phone/synced recap, hourly/session insights, card sharing | J wrap/model/sharing tests; C wrap domain | Validated view metrics absent with current rules. Template art/copy does not prove corresponding data exists |
| Google sign-in / restore session | Implemented, not verified | `src/auth/{session.tsx,google.ts}`, `src/config/env.ts` | `googleIdentity`, generation-guarded session | J Google tests | Requires correct OAuth IDs, package/signing certificate and matching backend audience; live round trip not exercised |
| Sign-out | Implemented, not verified | `app/settings.tsx`, `src/auth/session.tsx` | `signOut` invalidates marker and token requests | J sign-out race test | Keeps local device data/settings; does not wipe server data or cancel subscription |
| Account deletion / local export and wipe | Implemented, not verified | `app/privacy.tsx`; backend `modules/account.ts` | `deleteAccount`, `wipePhone`, `deleteAccountData`, recent-auth gate | S; H account tests in earlier project docs, not rerun | No destructive request executed. Partial cleanup failures possible; not deletion of Google account or Play subscription |
| Friend handles, requests, invite code | Implemented, not verified | `app/friends.tsx`, `src/social/CircleBoard.tsx`; backend `modules/friends.ts` | `postInvite`, `postFriendRequest`, respond/remove | J Circle mocks; H API social tests | Choose a handle first. Seven-day code manually entered; code path accepts friend connection without another request-accept step |
| Install link / automatic invite joining | Not implemented | `CircleBoard.invite`, `src/social/invite.ts`, `app.config.ts` | Native `Share.share`, app scheme | S | Invite text has no app download URL, verified app-link association or deferred joining flow |
| Daily friends' scores on Circle | UI/mockup only | `src/social/CircleBoard.tsx` | Local `total`, identity rows, `date` selector | J mock-screen interactions | Rank/invite layout is not a sorted daily friend-score feed; no friend usage data query |
| Two-person seven-day battle | Partially implemented | `CircleBoard.battle`, `app/challenges.tsx`; backend `modules/challenges.ts` | Create (`maxMembers:2`), join, leave, leaderboard | J mocked creation/join code; H API tests | General shareable challenge, not recipient-bound duel; requires consent, sync, score data and manual joining |
| Scores and battle integrity | Partially implemented | `src/sync/aggregate.ts`; backend `modules/{usage,challenges}.ts` | `aggregateDay`, `postUsageSync`, `scoreMember` | J excludes unvalidated views; H null/coverage scoring tests | Normal client excludes current unapproved reel data. Backend accepts authenticated bounded device-day aggregates; no independent event/version attestation |
| Push friend/battle updates | Partially implemented | `src/sync/push.ts`; backend `modules/devices.ts`, `handlers/jobs.ts` | Token registration/storage | S | No FCM/Expo notification-sending path found; the job handles billing reconciliation, not social notifications |
| Cloud sync/history | Partially implemented | `src/sync/{run,engine,sqliteRepo}.ts`, `app/settings.tsx`; backend `modules/usage.ts` | Stage/flush, revisions, idempotency | J sync tests; H backend usage tests | Automatic invocation located in Settings effect, not a global background/focus worker; retry engine alone does not schedule background execution |
| Goal cloud sync after fresh onboarding | Broken | `src/onboarding/store.ts:36`, `src/goals/sync.ts`; contracts `src/v1/index.ts` | `setup-views` vs `Uuid` | R schema reproduction; J does not cover this boundary | Local save succeeds, cloud rejects goal payload; Settings catches and discards goal-sync error |

### E. Subscription, Pro and release readiness

| Feature | Status | Evidence/file paths | Relevant functions/classes | Test evidence | Known limitations |
|---|---|---|---|---|---|
| Subscription offers/pricing UI | Implemented, not verified | `app/pro.tsx`, [billing bridge][n-billing] | `getSubscriptions`, localized offer phases | S; J limited billing helpers | No live price observed. Missing store setup yields no offers; no invented app price |
| Purchase / pending / cancellation flow | Implemented, not verified | `src/billing/pro.ts`, [billing bridge][n-billing] | `buyPro`, pending promise, purchase callback | J helper tests; H API billing tests | No licensed Play test purchase here; server/config/network required; native purchase callback lifecycle unverified |
| Restore purchase | Implemented, not verified | `src/billing/pro.ts`, [billing bridge][n-billing] | `restorePro`, `activeSubscriptions` | S | No live restore after reinstall/account switch; pending-to-purchased recovery may require manual restore |
| Server entitlement verification | Implemented, not verified | backend `modules/billing/{index,play-api,play-state}.ts` | `postPlayVerify`, Play lookup, account binding, acknowledge | H billing tests, S | Live Play API credentials/RTDN configuration not checked; local cache is ordinary trusted-app input, not an anti-tampering guarantee |
| Expiry, cancellation, grace and on-hold mapping | Implemented, not verified | backend `modules/billing/play-state.ts`, [block policy][n-block] | `entitlementFromPlay`, `validUntil`, `decide` | N expiry/grace policy tests; H billing tests | Verified native cache policy here, server lifecycle tests historical. Offline trust capped at earlier expiry or three days after verification |
| RTDN and scheduled reconciliation | Implemented, not verified | backend `modules/billing/{index,reconcile}.ts`, `handlers/jobs.ts`, `infra/lib/driftless-stack.ts` | Authenticated webhook, `reconcilePlay` | S; H tests use fake Play API | No deployed schedule/webhook event observed; client receives new verdict when it fetches entitlement, not through live local invalidation |
| Pro-only extra history/analytics | Partially implemented | `app/{pro,stats,history,progress}.tsx`; backend `modules/capabilities.ts` | Marketing benefits vs route implementation | S | Stats/history routes do not enforce Pro; advanced capability defaults false. Do not claim the advertised differentiation is enforced |
| Server device-support capability reporting | Broken | backend `modules/capabilities.ts`, `modules/me.ts`; `app/settings.tsx` | `PHASE1_FLAGS`, default `computeCapabilities` | S exact call path | Implemented tracking/minutes/pausing still reported unavailable because current defaults stay off; no runtime flag injection found |
| Release signing and store configuration | Partially implemented | local `android/app/build.gradle`, `app.config.ts`, `docs/STORE_PREP.md` | Local release signing points to debug config | S | No release/AAB build, signing identity or Play Console verification in this audit; ignored native directory may be regenerated |
| iOS | Not implemented | `app.config.ts` | `platforms: ['android']` | S | ScreenTime/Family Controls planning is not an iOS runtime |

## 5. Original BrainPal feature catalogue

These are **officially documented claims**, not independent tests of the installed product. Confidence describes source clarity, not measured accuracy. “Unknown” means no reliable public detail was established. Source-specific facts below are intentionally compact; the comparison matrix refers to catalogue IDs rather than repeating marketing claims.

| ID / BrainPal feature | What it actually does according to available evidence | Free or Pro | Evidence/source | Confidence |
|---|---|---|---|---|
| BP01 Supported feeds | Instagram, YouTube, Facebook, Snapchat; Lite variants are documented too | Counter free; exact variant restrictions unstated | [Play](https://play.google.com/store/apps/details?id=com.brainrot.android&hl=en_IN), [privacy §2](https://brainpalapp.ai/legal/privacy-policy) | High for advertised support; accuracy untested |
| BP02 Live counter/brain | On-screen count with changing brain imagery | Free | [Website](https://brainpalapp.ai/) | High, documented; not device-tested |
| BP03 Brain progression | Five illustrated stages at 0/50/100/150/200+ | Free brain view | [Website](https://brainpalapp.ai/) | High for illustrations; exact runtime thresholds untested |
| BP04 Daily stats/history | Daily stats; account-backed history backup | Daily stats free; backup tier unspecified | [Website](https://brainpalapp.ai/), [terms §3](https://brainpalapp.ai/legal/terms-of-use) | High for documented features; hourly/weekly retention unknown |
| BP05 Battles | Daily friend count comparison; lower count wins | Free, account required | [Website](https://brainpalapp.ai/), [terms §3](https://brainpalapp.ai/legal/terms-of-use) | High for documented flow; scoring integrity untested |
| BP06 Reel-count blocking | Paid cap targets feeds while other app functions remain usable | Plus/Pro | [Website FAQ](https://brainpalapp.ai/) | High for advertised behavior; bypass resistance untested |
| BP07 Breaks / smart limits | Scrolling breaks listed; exact cooldown/override rules undisclosed | Plus on website | [Website pricing](https://brainpalapp.ai/) | Medium; “smart limits” specifics unknown |
| BP08 Floating controls/animations | Counter and milestone overlays described; store art depicts counter | Counter free; detailed controls unspecified | [Privacy §3](https://brainpalapp.ai/legal/privacy-policy), [Play screenshot](https://play-lh.googleusercontent.com/WPUbddNl5y9UAfcEeqlm3EwUJWIkR-wi6kmgVs7ZYKR3DjLt2DUs4vd9Q-Z2VENlztLlFYUQQ0YjGjhxJss8Gg=w526-h296) | High for display; drag/resize/blink/pause durations unknown |
| BP09 Invites | Link-based friend connection | Social feature; account required | [Terms §5](https://brainpalapp.ai/legal/terms-of-use) | High for documented links; deferred install behavior unknown |
| BP10 Account/privacy | Optional Google login, deletion, social sync | Account requirement separate from payment | [Privacy §§1,8,10](https://brainpalapp.ai/legal/privacy-policy) | High for policy; no transaction tested |
| BP11 Notifications | Battle updates and reminders described | Tier unspecified | [Privacy §§3–4](https://brainpalapp.ai/legal/privacy-policy) | Medium; not delivery-tested |
| BP12 Subscription | Monthly/yearly recurring plans and restoration described | Paid | [Terms §6](https://brainpalapp.ai/legal/terms-of-use), [refund policy](https://brainpalapp.ai/legal/refund-policy) | High for published terms; regional checkout untested |
| BP13 Usage-time analytics | Short-form tracking marketed; exact minutes/hourly analytics unavailable from inspected sources | Unknown | [Play listing](https://play.google.com/store/apps/details?id=com.brainrot.android&hl=en_IN) | Unknown for detailed time reporting |
| BP14 Achievements/custom schedules | No sufficiently specific official feature evidence located | Unknown | Research scope in §12 | Unknown, not proven absent |
| BP15 Onboarding/settings | Permission/account controls documented; exact onboarding sequence not established | Unknown for individual settings | [Terms §4](https://brainpalapp.ai/legal/terms-of-use) | Medium for controls; sequence unknown |

### Public pricing snapshot — observed 20 October 2026

- The [official website](https://brainpalapp.ai/) displays **INR ₹99/month** and **₹999/year**. No numeric discount is displayed there; it mentions possible in-app offers. These are advertised Indian prices, not an authenticated checkout quote.
- The [refund policy](https://brainpalapp.ai/legal/refund-policy), dated 29 July 2026, separately publishes monthly **INR 49–199** and annual **INR 199–999** promotional ranges. Trials are conditional. No current trial duration or user-specific discount was verified.
- Naming differs: website **Plus**, policy/listing **Pro**. Payment-channel descriptions also differ between official pages; do not infer every channel is offered to every user.

### Release and source consistency

The [Play listing](https://play.google.com/store/apps/details?id=com.brainrot.android&hl=en_IN) observed here reports an update on **18 October 2026**, with generic bug-fix notes; a version number/detailed release history was not exposed. Its “data never leaves” marketing wording is less qualified than the [privacy policy](https://brainpalapp.ai/legal/privacy-policy), which permits derived-stat synchronization. Prefer the detailed policy for data-flow interpretation.

The [terms](https://brainpalapp.ai/legal/terms-of-use) explicitly disclaim uninterrupted counting/blocking. Public reviews mentioning changed unlock behavior are testimonials, not proof of today's enforcement. No unrelated similarly named iOS meditation app was treated as this product.

### Store screenshot evidence

Two official images were downloaded into temporary storage and visually inspected:

- [Image 1](https://play-lh.googleusercontent.com/WPUbddNl5y9UAfcEeqlm3EwUJWIkR-wi6kmgVs7ZYKR3DjLt2DUs4vd9Q-Z2VENlztLlFYUQQ0YjGjhxJss8Gg=w526-h296): promotional reel counter artwork; local `/private/tmp/brainpal-audit-play-1.webp`.
- [Image 2](https://play-lh.googleusercontent.com/iFgHlGUxOvOluNkwYTCWiPSs8D8u_OZygmhHN-Y5MY6ZEMTPI884y9AUC1hJi_omKcAZ581v0cFCv8eAQ_bX=w526-h296): promotional brain/usage progression artwork; local `/private/tmp/brainpal-audit-play-2.webp`.

Static store art cannot prove touch interactions, background behavior, enforcement, pricing or precision/recall.

## 6. Free-versus-Pro comparison

BrainPal references below use the catalogue above; unknown tier assignments stay unknown. Driftless rows describe actual code gates, not configured commercial availability.

| Capability | BrainPal evidence | Driftless current gate | Assessment |
|---|---|---|---|
| Live counter/brain/daily local chart | BP02–04: free | No entitlement gate; accessibility/disclosure/data needed | Comparable category, not accuracy/device parity proof |
| Friend battles | BP05: free + account | Account, handle/consent, cloud data; no Pro check in challenge creation | Current version validation limits usable reel scores |
| Reel-count enforcement | BP06: paid | No such enforcement exists | Missing regardless of subscription |
| Minutes/schedule pause screen | BP07 details uncertain | Native `BlockPolicy` requires unexpired cached Pro | Exists, but not equivalent to BP06 |
| Local reminders / popup size/drag / meme cards | Detailed split not established | No Pro check found | Do not invent counterpart pricing |
| More history / advanced analytics | Not established | Advertised in `app/pro.tsx`; local routes accessible without Pro | Product promise and enforcement are inconsistent |
| Purchase/restore | BP12: paid lifecycle | Google Play offers + backend verification; login needed | No live product price/purchase confirmed |
| Sign-out/account deletion | BP10: account controls | Available for signed-in account, not a Pro gate | No destructive end-to-end audit test |

## 7. Side-by-side parity matrix

Gap categories are exactly Parity, Partial parity, Missing, Our advantage, or Unknown. No row is labelled Our advantage because public silence does not prove the original lacks a feature. No broad tracking/blocking Parity is claimed without device evidence.

| Feature | Original BrainPal | Our app | Evidence quality | Gap | Priority |
|---|---|---|---|---|---|
| Instagram/YouTube counting | BP01 | Real native pipeline, unapproved versions | Official claim vs code + fixture tests, no real-app accuracy | Partial parity | P1 |
| Facebook and Snapchat variants | BP01 | No supported packages/rules | Explicit original documentation vs exact allowlist | Missing | P2, after P1 accuracy |
| Floating count/brain | BP02/BP08 | Interactive native badge | Original docs/art vs native fixtures | Partial parity | P2 |
| Multiple brain stages | BP03 | Two badge expressions, separate home state logic | Official illustrations vs inspected assets/policies | Partial parity | P3 |
| Daily stats | BP04 | Local daily totals/hourly series; validated weekly path | Original description vs J/N aggregation | Partial parity | P1 consistency |
| Hourly time/detail retention | BP13 | Event-based hourly chart; 30-day events | Original detail unknown | Unknown | P2 |
| Reel-based feed-only cap | BP06 | Minute/schedule pause, no reel predicate | Official feature claim vs complete policy trace | Missing | P1 |
| Strong bypass prevention | BP06/BP07 exact guarantees unknown | Deliberately dismissible/fail-open | No independent original/device enforcement evidence | Unknown | P1 truthful product contract |
| Friend daily comparison | BP05 | Circle has identity rows; separate challenge scores | Official description vs component/API trace | Partial parity | P2 |
| Invite links/install handoff | BP09 | Manual code, no install URL | Official terms vs share payload/routes | Missing | P2 |
| Notification delivery | BP11 | Registration only for social push | Policy statement vs missing sender | Partial parity | P2 |
| Purchase/restore/expiry | BP12 | Native billing + server implementation | Official terms vs code/historical mocks | Partial parity | P1 launch validation |
| Custom focus schedules | BP14 unknown | Three presets | Original not established | Unknown | P3 |
| Achievements | BP14 unknown | Tested derivation, no user-facing caller | Original not established; local dead-end trace | Unknown | P3 |
| Data/account controls | BP10 | Sign-out, export, deletion paths | Official policy vs code + mocked/historical evidence | Partial parity | P1 end-to-end verification |
| Service survival/OEM compatibility | Terms disclaim interruptions | System accessibility service; no watchdog | Neither independently device-tested here | Unknown | P1 |

## 8. Confirmed defects, limitations and integrity findings

### F1 — P1: Onboarding-created goals fail cloud UUID validation

**Status: Broken.** `src/onboarding/store.ts:36` uses `existing?.goalId ?? \`setup-${record.plan.metric}\``. `src/goals/store.ts.saveGoal` stores that without contract validation. `syncGoals` sends it unchanged; backend `putGoals` parses `v1.PutGoalsRequest`, whose `Goal.goalId` must be a UUID. `app/settings.tsx` suppresses `syncGoals` errors.

Read-only reproduction against the existing built contract module:

```text
v1.Goal.safeParse({goalId:"setup-views", metric:"views", dailyLimit:50, enabled:true, rev:1})
=> success:false, path:["goalId"], message:"Invalid UUID"
```

This establishes the incompatible payload, not a live server request. Local onboarding remains usable. Fixing only future IDs would not repair already saved seed IDs; an eventual implementation must account for those records. No fix was made in this audit.

### F2 — P1: Reel goals and enforcement are disconnected

**Status: Not implemented** for reel-count enforcement. `[BlockConfig][n-block]` contains no view limit. `maybePause` only passes minutes and schedule wall time. Exceeding the onboarding reel target affects `countBadgeMood`, not `PauseActivity` decisions. This is an essential gap if the product sells a daily reel cap. Adding a stronger enforcement promise without solving lifecycle/bypass behavior would overstate the feature.

### F3 — P1: Current reel validation prevents normal-client competitive usage

**Status: Partially implemented.** Both approved lists are empty. Local daily chart/popup deliberately include saved activity; `aggregateDay` sends `views:null` for these app versions. Reel goals, widget/validated recap metrics and normal-client reel leaderboards consequently cannot claim confirmed results. The integrity gate should not be populated with fabricated approval entries merely to make screens show data.

### F4 — P1: Device-reported battle totals are not independently attested

**Status: Partially implemented.** The app's approved-version exclusion is client-side. `postUsageSync` validates identity, consent, schema, dates, revisions and idempotency, but the submitted aggregate has no event/app-version proof. `scoreMember` checks non-null views and coverage; it does not recompute the accuracy gate from native records. Thus “server validates every counted reel” or “cheat-proof scores” would be false. This is an inspected trust boundary, not a tested exploit, and no malicious request was sent.

### F5 — P1: Pro minute limits interrupt the package, not exclusively the feed

**Status: Partially implemented.** `maybePause` can run after classification and on active-package ticks without requiring `SHORT_VIDEO`. UsageStats time includes full app foreground activity. The policy therefore can affect non-feed tasks too. `PauseActivity` is real but user-controllable; service revocation/kill makes it fail open. Reopening and launch timing need device validation. Do not promise “other app functions unaffected.”

### F6 — P2: Capability responses conflict with actual native features

**Status: Broken.** `modules/me.ts.getMe` calls default `computeCapabilities`; `PHASE1_FLAGS` keeps counting, minutes, blocking, schedules and advanced analytics off. Settings renders that response as device support, even while native paths exist. No production flag override was located. This is a deterministic configuration/caller mismatch, not evidence of bad native detection.

### F7 — P2: Social display and invite onboarding are incomplete

**Status: Partially implemented.** Circle does not query/sort friend daily scores. Each friend Battle button invokes the same recipient-independent create/share function. `postInvite` requires a saved handle, but pressing Circle Invite does not first guide a newly signed-in handle-less user through handle setup; it surfaces an error. No download/deep invite link is included. These gaps increase the chance that a real friend never joins successfully.

### F8 — P2: Social push delivery and reliable background sync are absent

**Status: Partially implemented.** A push token is registered/stored but no message sender exists in the inspected source. `handlers/jobs.ts` only reconciles Play subscriptions. Sync is invoked by Settings, with exponential/idempotent retry machinery but no inspected global background scheduler. A battle score need not update merely because a user watched more reels and never opened Settings.

### F9 — P1 release gate: Published Pro promises, cached entitlement and signing need validation

**Status: Partially implemented.** Advanced history routes lack Pro checks despite the Pro benefits copy, and capability reporting disagrees. Kotlin accepts app-provided entitlement fields into preferences; it relies on honest application code and bounded expiry, not a native signature. A paid cache expires after at most three days without verification even if the paid period is longer; refresh calls are concentrated in Settings/purchase/restore paths. `modules/me.ts.loadEntitlement` returns the stored `verifiedAt` rather than performing a fresh store check; `reconcilePlay` selects expiries within its two-day horizon, not every still-active subscription each day. Consequently, simply reopening Settings does not necessarily extend the native verification deadline. Example: a 30-day subscription verified on day 0 has a native cutoff at day 3 until a fresh Play verification/qualifying webhook occurs. This cutoff follows the inspected logic and passing cache-policy tests; no real paid account was allowed to expire during this audit. The product needs a reliable refresh path before selling dependable ongoing pauses.

The generated local `android/app/build.gradle` assigns `signingConfigs.debug` to release. A production signing/Play-track plan is required; no signing secret or private certificate was read. This alone does not establish why the user's APK installation failed.

### F10 — P2: Local and validated feedback diverge

**Status: Partially implemented.** Home mood/per-app chips, widget totals, weekly Progress and Wrapped use approved totals while the popup/daily chart use local totals. The badge can drain while home remains idle. This is visible from the data paths and intended validation boundaries, but user-facing meaning is inconsistent. Raw events expire after 30 days; current-rule filtering can also prevent complete hourly reconciliation after an update.

### F11 — P3: Achievement logic is not exposed

**Status: Partially implemented.** The award function has tested derivations, but no application caller was found. Similarly, a Pro screen label or decorative invite rank is not proof of a working reward/leaderboard.

### Additional data-handling risks requiring tests

- Sign-out does not clear local goals, tracking rows, entitlement preferences, device IDs or sync bookkeeping. Local guest retention may be intentional, but `sqliteSyncRepo` is not account-namespaced. Account A → sign-out → account B → consent/sync needs an explicit ownership/privacy decision and test; no cross-account production upload was attempted.
- `wipePhone` removes tracking/app tables but does not clear every native preference, reminder or blocking setting. The code comment claiming everything is erased is broader than the traced operations. Validate a complete deletion/cleanup contract before release.
- Service `versionOf` caches installed app version for its lifetime. A supported app update without service reconnect can leave gating metadata stale until reinitialization; the real Android update/rebind sequence was not exercised.
- Native exception handlers often fail open/hide, while some async UI saves lack local error surfaces. No general crash was reproduced; add targeted lifecycle/failure tests rather than assuming all exceptions are recoverable.

## 9. Failure-scenario assessment

| Scenario | Evidence-based conclusion | Remaining proof |
|---|---|---|
| Single callback counted twice | Storage uniqueness and same-identity fixture tests pass | Actual event storms/UI node churn on devices |
| Reel missed | Under-dwell and unknown-identity inputs intentionally skip; actual precision/recall unknown | Labelled sessions per supported app/version/language |
| Wrong app counted | Only configured packages are accepted; unsupported-app fixture passes | OEM foreground/window edge cases |
| Counts lost on restart | SQLite reopen and ring restoration pass | Force-stop, process kill, reboot and update on physical devices |
| Wrong-day reset | Stored local dates, DST and timezone fixture tests pass | Manual clock change, travel, continuous midnight watching |
| Pause stops after kill/revocation | No enforcement if service unavailable; code intentionally fails open | Warning recovery, reconnect timing and setting persistence |
| Popup settings do not persist | Preference-instance tests prove saved size/position/deadline | Cold process/reboot integration and alternate window sizes |
| Pauses expire incorrectly | Absolute milliseconds implemented; one-hour button tested | Rolling 24-hour choice, time/zone edits, reboot/expiry |
| Switch/reopen bypasses limit | Rechecks exist, but not unbypassable and have launch cooldown | Physical app-switch/task/lock stress test |
| Free user reaches Pro screen/function | Config screen reachable; native policy rejects non-Pro | Root/modded client is not covered by this trust model |
| Pro lost after restart/offline | Cache persists with expiry/grace; paid lifecycle not device-tested | Real restore, expiry, grace, hold, account switching, >3 days offline |
| Misleading permission UI | Enabled-vs-running states tested; stale capabilities confirmed separately | OEM service revocation and returning to app |
| APK will not install | Unknown: exact command/APK, device and installer error not supplied in this audit request | Capture non-destructive package-manager/installer error; do not uninstall and lose data to guess |

## 10. Verification performed and evidence limits

| Check | Actual audit result | Scope / evidence |
|---|---|---|
| `npm test -- --runInBand` | **155 passed, 19 suites** | `/private/tmp/driftless-feature-audit-jest.log` |
| `npm run typecheck` | **Passed** | `/private/tmp/driftless-feature-audit-types.log` |
| `npm run lint` | **Passed** | `/private/tmp/driftless-feature-audit-lint.log` |
| Android `:tracking-android:testDebugUnitTest --offline --rerun-tasks` | **96 tests, 0 failures/errors/skips; Gradle success** | `/private/tmp/driftless-feature-audit-native.log`; XML reports under native module build/test-results |
| Existing contracts `../../node_modules/.bin/vitest run` | **82 passed, 5 files** | `/private/tmp/driftless-feature-audit-contracts.log`; no database integration setup |
| Accuracy tool unittest discovery | **10 passed** | `/private/tmp/driftless-feature-audit-scorer.log`; sample FAIL output is an intentionally failing fixture, not real-app G-2 evidence |
| Seed-goal UUID compatibility | **Reproduced rejection** | Read-only `Goal.safeParse`, F1 |
| New APK/AAB build/install | **Not run during this audit** | Avoid conflating module-test Gradle success with an installable release |
| Backend API integration suite | **Not rerun during this read-only audit** | Needs disposable DynamoDB setup; avoids table-creation/deletion operations here |
| Live original/current app comparison | **Not run** | No original APK/device session or private endpoint access |

An initial attempted contracts command combined the package's existing `--coverage` with `--coverage=false` and failed argument parsing before executing tests. The corrected direct existing Vitest command above passed; this was an audit command error, not a product defect.

Historical evidence (H), not rerun results: `docs/tracking/LOCAL_HOURLY_ACTIVITY.md` and the earlier task record 25 backend social/usage tests and a successful debug APK build for this app commit. The existing APK at `android/app/build/outputs/apk/debug/app-debug.apk` does not prove installation or release suitability. Other project documents cite earlier billing/account/infra runs; those are provenance, not fresh production verification.

## 11. Prioritized roadmap and next milestone

### P0

No P0 defect was reproduced. Do not interpret that as a completed security, Play-policy or production launch audit. If user data crosses account boundaries or a competitive exploit is reproduced during the targeted tests above, reassess severity before launch.

### P1 — essential correctness and release gates

1. **Establish measured counting accuracy** on current Instagram/YouTube versions with the existing protocol: labelled normal/fast/back/comment/ad/app-switch/lock/restart sessions, reported precision/recall/duplicates and failures. Approve only versions supported by evidence. This matters because the core promise and usable normal-client reel scores depend on it.
2. **Resolve the enforcement contract.** Implement and test a reel-count predicate if selling reel limits; separate feed-only intervention from whole-app minute schedules. State the dismissible/fail-open boundary honestly. This matters because an expression change currently does not deliver the paid blocking outcome.
3. **Repair onboarding-to-cloud goal compatibility**, existing seed-ID handling and swallowed sync errors. Verify profile/goal/consent/sync on two accounts without data crossover. This matters because a normal new-user path produces a contract-invalid goal.
4. **Define competition trust explicitly.** Keep current client validation protections, decide whether device-reported scores are acceptable, and test the score path end to end. Do not present client aggregates as independently verified events.
5. **Run licensed Play-track lifecycle tests**, entitlement refresh/recovery and production signing checks. Align paid benefits, capability reporting and actual gating. No price/plan should be sold solely because an offer button renders.
6. **Test service failure and reconnect behavior** across real Android/OEM devices. Permission revocation/kills must visibly change status without falsely claiming continued protection.

### P2 — usable retention/social product

- Add usable install/invite links and handle setup before invitation; prove first-time install → sign-in → friendship → consent → battle → score on two devices.
- Add real daily friend-score data and intended ordering to Circle; keep seven-day challenge semantics explicit.
- Implement notification delivery and an appropriate consent-aware sync scheduler, with retries and clear errors.
- Reconcile home/widget/daily/weekly/recap terminology and explain unavailable data without fabricating counts.
- Add Facebook/Snapchat/Lite variants only after their own selectors and accuracy/lifecycle validation.
- Validate data deletion, reminder cancellation, purchase retention, account switching and retention behavior.

### P3 — polish and additional differentiation

- Expose achievement logic, if wanted, with real eligible outcomes.
- Improve animation fidelity and small/large-screen accessibility; consider additional original expressions.
- Add custom schedule editing, richer settings and documentation after the core paths are reliable.
- Keep original branding/art/copy and select features from observed needs rather than promising exact feature parity.

### Recommended next milestone

**“Reliable two-app tracking and one complete two-person battle on a signed test build.”** Exit criteria: measured accuracy for explicitly supported versions; valid onboarding goals; no local/cloud score conflation; correct count-based intervention if advertised; real login/consent/invite/join/score flow; entitlement purchase/restore checks; and documented revoke/kill/reboot behavior. A Play-ready release is a subsequent decision, not a consequence of unit tests passing.

Next three concrete tasks:

1. Reproduce and plan the seed-goal sync/capability fixes with regression coverage; make no approval-list shortcuts.
2. Execute the labelled two-app device accuracy/lifecycle protocol and capture the exact APK-installation error if installation is still blocked.
3. Complete one real two-phone battle and licensed purchase/restore exercise after configuration and scoring eligibility are established.

## 12. Sources, coverage and limitations

### Official public sources

All observed on 20 October 2026; statements above cite the directly supporting page.

- [Google Play — BrainPal: Quit Scrolling](https://play.google.com/store/apps/details?id=com.brainrot.android&hl=en_IN): description, generic release note, screenshot links and support identity.
- [Official BrainPal website](https://brainpalapp.ai/), also reached from the listing's [brainrotapp.ai](https://brainrotapp.ai/): pricing, feature grouping and FAQ.
- [Privacy policy](https://brainpalapp.ai/legal/privacy-policy): supported packages, account/sync/deletion and notification/overlay descriptions.
- [Terms of use](https://brainpalapp.ai/legal/terms-of-use): account/social requirements, invite links, subscription lifecycle and limitations.
- [Refund/payment policy](https://brainpalapp.ai/legal/refund-policy): published promotional ranges and cancellation terms.
- Two public screenshot URLs in §5, downloaded only to temporary storage.

The site and its mirror are the same publisher, not independent corroboration. Public descriptions can lag implementation or vary by region/version/account. No authenticated paywall, current original app version identifier, real blocking resistance, detailed original hourly analytics, or complete original onboarding sequence was independently established. Search hits for unrelated same-name products were excluded. No original feature is claimed absent merely because it was not described.

### Local evidence and audit boundaries

Reviewed runtime execution paths across `app/`, `src/`, native modules, manifests/rules, storage, tests, build configuration, sibling backend/contracts/infra, and relevant docs. This is a feature/reliability audit, not exhaustive line-by-line formal verification, a penetration test, or a legal review. Infrastructure deployment, credentials and external consoles were not inspected. No third-party private service or protected user data was accessed.

Tests and static reasoning demonstrate bounded behavior, not Android OEM reliability, real accessibility accuracy, a real purchase, visual quality, or user outcomes. All unresolved device/integration cases remain explicitly unverified.

The requested report is the sole intended repository addition. Test logs/downloads are temporary, generated test outputs are ignored, and existing application/configuration files are preserved.

### Native source index

[n-service]: modules/tracking-android/android/src/main/java/app/driftless/tracking/android/DriftlessAccessibilityService.kt
[n-classifier]: modules/tracking-android/android/src/main/java/app/driftless/tracking/core/Classifier.kt
[n-rules]: modules/tracking-android/android/src/main/assets/driftless_rules.json
[n-a11y]: modules/tracking-android/android/src/main/res/xml/driftless_accessibility.xml
[n-manifest]: modules/tracking-android/android/src/main/AndroidManifest.xml
[n-recorder]: modules/tracking-android/android/src/main/java/app/driftless/tracking/core/Recorder.kt
[n-store]: modules/tracking-android/android/src/main/java/app/driftless/tracking/android/SqliteStore.kt
[n-engine]: modules/tracking-android/android/src/main/java/app/driftless/tracking/core/Engine.kt
[n-counter]: modules/tracking-android/android/src/main/java/app/driftless/tracking/core/ViewCounter.kt
[n-usage]: modules/tracking-android/android/src/main/java/app/driftless/tracking/android/UsageReader.kt
[n-usage-math]: modules/tracking-android/android/src/main/java/app/driftless/tracking/core/UsageMath.kt
[n-details]: modules/tracking-android/android/src/main/java/app/driftless/tracking/android/WrappedDetails.kt
[n-badge]: modules/tracking-android/android/src/main/java/app/driftless/tracking/android/FloatingCountBadge.kt
[n-blink]: modules/tracking-android/android/src/main/java/app/driftless/tracking/android/BlinkingBrainView.kt
[n-badge-state]: modules/tracking-android/android/src/main/java/app/driftless/tracking/core/BadgeState.kt
[n-platform]: modules/tracking-android/android/src/main/java/app/driftless/tracking/android/Platform.kt
[n-bridge]: modules/tracking-android/android/src/main/java/app/driftless/tracking/android/TrackingModule.kt
[n-block]: modules/tracking-android/android/src/main/java/app/driftless/tracking/core/BlockPolicy.kt
[n-pause]: modules/tracking-android/android/src/main/java/app/driftless/tracking/android/PauseActivity.kt
[n-notifier]: modules/tracking-android/android/src/main/java/app/driftless/tracking/android/GoalNotifier.kt
[n-alerts]: modules/tracking-android/android/src/main/java/app/driftless/tracking/core/LimitAlerts.kt
[n-meme-policy]: modules/tracking-android/android/src/main/java/app/driftless/tracking/core/MemeMilestone.kt
[n-meme]: modules/tracking-android/android/src/main/java/app/driftless/tracking/android/MemeMilestoneCard.kt
[n-widget]: modules/tracking-android/android/src/main/java/app/driftless/tracking/android/CountWidget.kt
[n-billing]: modules/billing-android/android/src/main/java/app/driftless/billing/BillingModule.kt
