# Protection clarity and account/billing reliability

21 October 2026. Supplements the existing audit; does not overwrite it. The checked-in
`BRAINPAL_FEATURE_AUDIT.md` predates native feed limits, daily friend comparisons and goal-ID
repair; use the current source and `FEED_LIMIT_MILESTONES.md` for those paths.

The 22 pre-existing tracked edits were retained. The baseline diff was saved locally to
`/private/tmp/driftless-before-reliability.patch` for review. No app APK rebuild/install,
production service access, purchase, deployment, credential change, commit or push occurred.

## Verified defects and focused changes

1. A new Robolectric regression reproduced stale Usage Access values with no saved goals:
   expected 120,000 ms, actual 0. `GoalNotifier.check` previously returned before refreshing
   usage, and also skipped it when notifications were disabled. It now refreshes when a saved
   goal or enabled app-minute rule needs usage, before notification-only early exits. The
   existing service check cadence remains one minute; classification catches the threshold on
   subsequent ticks. This is bounded freshness, not instantaneous OS enforcement.
2. A changed boundary regression reproduced HAPPY at the exact daily cap while feed enforcement
   starts at `count >= goal`. Native badge mood now becomes DRAINED at the same boundary; its
   accessibility text says "reached". Dashboard cap behavior was already inclusive.
3. Focus and Goals now share sampled protection readiness: saved-but-off, missing permission,
   stopped/missing service, no selected installed app, missing Pro verification, missing video
   goal, unsupported feed detection, approval required or explicitly experimental detection.
   "Protection active" describes configured readiness, not proof of current interception.
   Mixed or incomplete rules conservatively show attention. System navigation/bypasses remain.
4. Progress now links to History, which retains its Stats link. Existing data, weekly Progress,
   7/30-day Stats and free access remain intact. Expandable count explanations on Today, Progress
   and History explain why local daily views can differ from eligible goals/weekly/recap/cloud
   values. No count, approval, sync or social-score gate changed.
5. Native Pro access is cleared synchronously on sign-out/account invalidation. An in-memory
   generation rejects delayed prior-session profile/verification results. Google account owner
   markers protect cold restoration; a different/missing owner clears old access. Same-owner
   restoration preserves the existing bounded offline cache. Legacy installations lack this
   marker and conservatively require fresh verification once; tracking/goals/history are intact.
   A changed owner during silent renewal also ends the session instead of reusing its API client.
6. Empty successful Play restore clears native access; a failed/offline query preserves the
   bounded cache. Pending/unspecified purchases never grant access. Purchase and restore flows
   are serialized to avoid a foreground restore racing an interactive purchase.
7. Root-level signed-in recovery reads the profile and re-verifies Play-owned purchases on
   startup/foreground, rate-limited to one attempt per minute, and every 30 minutes while active.
   This recovers completed pending payments without launching a purchase sheet. Errors do not
   extend offline access. A restored payment still requires the existing server verification.
8. The paywall removed the unsupported paid-history/trends claim. It shows the last checked
   subscription state/end date, full returned introductory/renewal pricing phases, and an older
   binary fallback asking the user to review Google Play terms. Restore feedback reflects the
   restore result, including an empty result. The optional billing bridge fails with a readable
   error on older binaries. No fixed monthly/yearly offers or prices were invented.

## Counting investigation: no new accuracy claim

Reviewed `Classifier`, `PlayerTransition`, `ViewCounter`, service event/tick handling, existing
regressions and the retained text-free diagnostic trace. That trace has 34 frames, eight identity
changes, no scroll signals and two replacement signals; six identity changes lack either signal.
These are diagnostic frame counts, not labelled video counts or precision/recall evidence.

YouTube's caption-based identity can change without a confirmed item transition; counting every
identity change would weaken the duplicate/text-edit safeguards. The retained evidence does not
justify such a heuristic. Existing novel-identity, structural-signal, 1.5-second dwell and recent-ring
requirements remain. Instagram uses a container content-description identity; no new Instagram
capture or selectors were available. Rules/version approvals and detection behavior were unchanged.
Remaining YouTube misses and Instagram validation require labelled real-app sessions.

## Feature-gate map before any Free/Pro change

| Feature | UI/state gate | Native gate | Backend gate |
| --- | --- | --- | --- |
| Tracking, brain, local daily/history | Native support and permissions; no subscription | Disclosure/service; recognized feed for videos; Usage Access for OS minutes | No backend required |
| Basic goals/reminders | SQLite goals; notification permission | Approved video counts for goal alerts/results | Opt-in account goal backup, no Pro requirement |
| Local daily versus weekly/recaps | Daily local reader; weekly/results use eligible aggregates | Detailed recap reader retains version/rule eligibility | Client aggregate excludes unapproved views; consent/coverage for comparisons |
| Video caps and timed feed breaks | Separate opt-ins, app selection, saved enabled video goal for caps | Enabled rule, selected package, cached Pro, recognized surface and approved versions OR explicit experiment | No local enforcement request; capability flags advertise rollout eligibility |
| Minute limits/schedules | Focus settings; existing scope preserved | Cached Pro; schedule/minute decision; whole-app activity or gated feed overlay | Blocking/schedule capability defaults off |
| Friends/battles | Google session and API, sharing controls | No local candidate counts promoted to scores | Membership/consent, eligible submitted counts/coverage; device-reported totals |
| Current 30-day Stats/recaps | Free; no paid route gate | Existing data eligibility | No advanced gate on these local screens |
| Advanced analytics | Not implemented | None | Advanced flag defaults off and requires Pro |
| Purchase/restore | Signed-in, Play product/offer availability | Billing token only; native cached enforcement expires at min(expiry, verification + 3 days) | Product/account ownership verification, state mapping, RTDN and reconciliation |

Native enforcement currently reads entitlement/configuration directly; backend capability booleans
are not a native kill switch. This discrepancy is recorded, not silently changed. No safety,
subscription or rollout gate was relaxed.

## Product decisions required before gate migration

Keep basic controls and existing free 30-day statistics accessible. Do not unlock experimental
blocking for free users just by changing a badge or hiding a paywall. A future change needs a
versioned per-feature policy shared by the contract, backend capability response and native
configuration: free basic allowance/break parameters, paid custom schedule/personalization rights,
and a separate accuracy/release gate. Decide whether/how backend rollout policy is cached for
offline enforcement and how old binaries fail closed. Preserve saved whole-app/feed scope,
budgets and history through upgrade; test free-to-Pro, expiry, rollback and account switching.
Reliability evidence must pass before basic free blocking is enabled. No migration is performed.

Ads are a separate milestone: see `../ADS_INTEGRATION_DESIGN.md`. No SDK/dependency/configuration
or ad code was added. Advanced 90-day/yearly analytics and custom schedule editing remain future work.

## Files changed in this milestone

- `app/blocking.tsx`, `app/goals.tsx`; new `src/billing/ProtectionNotice.tsx` and
  `protectionStatus.ts`: shared readiness feedback from saved rules/native health.
- `app/progress.tsx`, `app/history.tsx`, `src/ui/Focus.tsx`: History navigation and
  expandable local/eligible count explanations, preserving prior spacing/copy changes.
- `.../core/BadgeState.kt`, `.../android/FloatingCountBadge.kt`,
  `.../android/GoalNotifier.kt`: exact-cap expression and independent minute refresh.
- `src/auth/session.tsx`, new `src/billing/cache.ts`, `app/settings.tsx`: account-owner
  checks, immediate cache invalidation and obsolete profile-response guards.
- `src/billing/pro.ts`, new `EntitlementRecovery.tsx`, `app/_layout.tsx`: safe restore,
  pending-state handling, serialized billing and foreground re-verification.
- `modules/billing-android/src/index.ts`, native `BillingModule.kt`, `app/pro.tsx`:
  optional bridge handling, full pricing-phase metadata and accurate subscription copy.
- Regression files: `test/billing.test.ts`, `google-session.test.tsx`, new
  `protection-status.test.ts`, `entitlement-recovery.test.tsx`, `pro-screen.test.tsx`; native `BadgeStateTest.kt`
  and new `BlockingUsageRefreshTest.kt`.
- This report and `docs/ADS_INTEGRATION_DESIGN.md`: evidence, gate map and separate ads design.

`...` above means `modules/tracking-android/android/src/main/java/app/driftless/tracking`.
The sibling backend is unchanged; its purchase authorization was inspected, not relaxed.

## Verification and remaining runtime work

- Targeted app checks: 60 tests passed across eight suites (billing, Google session,
  entitlement recovery, paywall, protection status, Settings capabilities, brain state and activity).
- Targeted native checks: 53 JVM/Robolectric tests passed across seven classes (usage refresh,
  badge boundary, block/feed policy, player transition, classifier and view counter).
- Native billing module Kotlin compilation passed using cached dependencies.
- App TypeScript, lint, changed-file Prettier checks and `git diff --check` passed.
- Before-fix native regression log: `/private/tmp/driftless-reliability-before.log` (two expected
  failures); after-fix tests/compile: `/private/tmp/driftless-reliability-after.log`.
- One combined Gradle invocation misplaced test filters after a compile task; it failed before
  running tests. The corrected invocation above passed. No full suites or backend tests were run.

No unit test constitutes Android/Google Play/device certification. No emulator was rebuilt,
installed, reset or reconfigured.

Before release: run labelled YouTube/Instagram counting sessions; cap/break/bypass and non-feed
navigation checks; lock/reboot/permission/OEM recovery; no-goals minute limits with notifications
off; real sign-out/account swap and offline same-owner restore; Play license-test pending payment,
monthly/yearly pricing, intro offers, empty restore, cancellation/expiry and RTDN. Use staging and
license-test accounts, never a real purchase for this milestone. Older installed APKs do not gain
native boundary/refresh/pricing changes from a JavaScript reload.

Backend persisted verification timestamps may age between rechecks. Foreground Play recovery
now refreshes tokens that are locally available; offline or unavailable Play still lets the bounded
cache expire. Server-side scheduling/rollout policy and token-level retry handling require a
separate backend decision. Payment recovery errors have explicit Settings/Restore retry paths;
there is no new background billing service or push delivery implementation.
