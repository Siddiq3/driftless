# Counting, daily limits and feed pauses

Implementation and emulator work: 21 October 2026. These milestones are **not release-certified**.
No physical phone, Instagram session, staging entitlement, or real purchase was tested.

| Milestone | Current result |
| --- | --- |
| M1 — Reliable counting | Improved YouTube transition detection and midnight attribution; live misses remain. No app versions approved. |
| M2 — Daily limits and breaks | Implemented saved video-goal enforcement, configurable periodic breaks and daily bypass budget. Policy, persistence and overlay tests pass; emulator fixture exercises local enforcement. |
| M3 — Feed-only blocking | Implemented native feed overlay and user-requested Leave feed action. YouTube emulator cap/leave/re-entry/bypass checked. Physical-device and Instagram validation pending. |

## Behavior

- Enable App pauses, select apps and hold a current cached Pro entitlement. Video goal enforcement
  and periodic breaks are separate opt-in settings. Existing whole-app configurations retain their
  original scope; new configurations default to feed-only scope.
- The enabled `views` goal supplies a combined daily allowance across supported video apps. If
  several enabled video goals exist, the lowest positive allowance wins. At `count >= allowance`,
  pause the recognized feed on the next event/tick. Dwell-qualified ordinary views count; ads do not.
  This can interrupt the Nth video after 1.5 seconds of qualifying dwell; it does not promise that
  video N+1 can never appear briefly before classification/intervention.
- Daily allowance resets by the phone's local date. A view is attributed to the instant its dwell
  crossed the counting threshold, even if the flush tick arrives after midnight.
- Periodic breaks use configurable video milestones and a persisted absolute deadline. Time away
  from the feed counts toward the break. On first enabling, an already-crossed milestone can trigger
  a break. Changing the interval uses the saved numeric milestone; it does not clear today's budget.
- Feed bypass duration and daily count are configurable. Zero bypasses is supported. The budget is
  shared across Reels and Shorts and persists across process restarts. Bypasses temporarily suppress
  feed interventions, not existing whole-app pause rules. A daily cap remains after a break expires.
- The feed overlay intercepts feed touches only while classification recognizes a short-video
  surface. Leave feed invokes Android Back only after a button press. Home, Back, Open Driftless,
  disabling protection and revoking Accessibility remain escape routes. Playback/audio underneath
  is not paused by Driftless. Unknown or unsupported screens fail open.
- Feed scope also applies to minute/schedule rules when enabled. Their usage threshold remains
  whole-app minutes; only the intervention is feed-scoped.
- Approved counting versions are required by default. **Use unverified local detection** is an
  explicit, off-by-default experiment. It never changes approval lists, goal-result eligibility,
  cloud sync eligibility or social scores. All approval lists remain empty.

## Counting findings and changes

YouTube 21.37.42 on emulator-5554 changes player identity without `TYPE_VIEW_SCROLLED`. Initial
three normal swipes with four-second dwell added zero views despite visibly different videos.
The text-free trace showed the caption/control subtree disappearing and returning. `PlayerTransition`
uses that structural replacement as a transition signal. Caption edits alone do not authorize a
count; novel identity, dwell and the recent-item ring still apply. Event handling now samples
immediately and after 100 ms, rather than waiting only 300 ms. Foreground classification refreshes
on the two-second tick to recover feed re-entry without an event. Rules version is 5; engine is 2.

The intermediate detector counted two of three transitions. The next sampled run advanced today's
ordinary views from 3 to 4 and ads from 0 to 1 for three swipes; one transition remained missed.
Five seconds of stationary playback added no counts. Four rapid swipes followed by four-second
dwell advanced ordinary views from 4 to 5. This small run is diagnostic evidence, not precision/recall
certification. Ad-to-video transitions and cases with no observed structural replacement remain
unresolved. Instagram is absent from the emulator and was not installed during this work.

## Verification

- 111 native JVM/Robolectric tests passed, including transition/dedup/dwell regressions, midnight
  attribution, exact cap boundary, break expiry, daily rollover, bypass exhaustion/expiry, gating,
  persisted settings/state and overlay lifecycle. See `PlayerTransitionTest`, `FeedLimitPolicyTest`,
  `FeedPauseTest`, `ClassifierTest` and `EngineTest`.
- 205 app tests passed before final native-only guards; app TypeScript and lint passed.
- Arm64 debug APK built and installed with `adb install -r`; existing app data retained. An initial
  multi-architecture update failed for emulator storage; the smaller arm64 build installed.
- The updated native disclosure was accepted in the emulator before tracking tests.
- A temporary offline emulator-only Pro entitlement/configuration fixture tested a one-minute
  break overlay and daily cap. This is not billing verification. Screenshots confirmed cap, Leave
  feed → YouTube Home, re-entry → cap, bypass → Shorts. After expiry the cap returned and the bypass
  button was disabled with zero remaining. Persisted state recorded one consumed bypass.
- YouTube Search was accessible without the feed overlay. Regular videos, subscriptions, profiles,
  Instagram messages/posts/search, OEM lifecycle and physical-device behavior remain unverified.
- Service restarts, duplicate events and daily reset have automated coverage; no live midnight
  clock change or full physical-device restart protocol was performed.

Local diagnostic artifacts are under `/private/tmp/driftless-m1-*`,
`/private/tmp/driftless-cap-*.png`, and `/private/tmp/driftless-milestone-native.log`.
The original emulator tracking preferences were restored after the local fixture tests. The updated
disclosure acceptance and the real counts accumulated during testing are retained. No backend
entitlement was modified.

## Release gates

1. Resolve the remaining YouTube transition misses; run labelled current-version sessions for both
   Instagram and YouTube, including ads, fast skips, comments, profiles, app switching and restarts.
2. Prove on physical devices that non-feed functions remain usable and that overlay timing,
   lock/unlock, permission loss, reboot and service recovery behave as documented.
3. Verify countdown expiry, bypass exhaustion, account/entitlement changes and midnight/time-zone
   transitions end to end on a signed test build. Do not approve versions using fixtures.
4. Keep feed enforcement experimental until those gates pass. No deployment or publication was done.
