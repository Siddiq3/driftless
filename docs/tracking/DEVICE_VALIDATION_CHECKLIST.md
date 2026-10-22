# Isolated-device manual acceptance checklist

Prepared 21 October 2026. **Not executed.** Read DEVICE_VALIDATION_PLAN.md first.
All cases currently BLOCKED: no separately approved AVD/current isolated build exists.
Actual-result cells intentionally blank. Replace BLOCKED with PASS/FAIL only after execution;
retain BLOCKED with a reason when configuration/test services or approvals are missing.
Emulator success is separate from physical-device evidence and never certifies supported versions.

## Run header (complete before execution)

- Operator/date; approved scope and account aliases (no identifiers/tokens):
- Verified new AVD name/serial; protected AVD name and serial rechecked:
- Source snapshot/hash; APK SHA-256/package/version/signing; native engine/rules:
- Android/API/ABI/device/OEM; Instagram/YouTube versions; locale/timezone:
- Disclosure/Accessibility/Usage Access/notification state; readiness status:
- Goals, selected packages, scope, experiment approval, Pro/staging evidence:
- Original new-device time settings and restoration record (only for approved time tests):
- Evidence directory and redaction review:

For counting, log each intended transition with anonymized item ordinal, ordinary/ad,
dwell, transition time, expected count time (dwell >=1.5s), actual count time/delta,
miss/duplicate/false-positive/delay. No copyrighted/private captions/messages needed.
Rapidly skipped items are not automatically missed qualifying views. Track ordinary/ad
errors separately; record all late counts and the actual delay, not just total agreement.

## Cases

| ID | Preconditions | Steps | Expected result | Actual result | Status | Required evidence |
| --- | --- | --- | --- | --- | --- | --- |
| ENV-01 | Approval for new AVD/build; no execution yet | Verify new serial/name with plan preflight before every action | Abort protected serial/name, offline or ambiguous device; use only isolated target | | BLOCKED | Device Manager + sanitized serial/name output |
| ENV-02 | Current isolated native APK available | Record source hash, APK hash/signature/package/version, API and app versions | Artifact includes latest native fixes; no existing artifact overwritten | | BLOCKED | Build manifest; metadata |
| CNT-IG-01 | Instagram installed; disclosure/service on; test content | Watch 20 distinct Reels at ≥4 s dwell; log count times | One ordinary count per qualifying novel view; record every miss/duplicate/delay | | BLOCKED | Time-labelled ground truth; before/after count |
| CNT-YT-01 | YouTube installed; same setup | Repeat 20 distinct Shorts at ≥4 s dwell | Same rule; known YouTube misses must be recorded as failures, not waived | | BLOCKED | Ground truth and sanitized count event timing |
| CNT-02 | Run independently for IG and YT | Swipe ten videos under 1.5 s, settle on a novel item ≥4 s | Fast skips do not promise counts; settled qualifying item counts once | | BLOCKED | Per-item dwell/expected/actual ledger |
| CNT-03 | Same app/version, known recent item | Remain stationary 15 s; revisit recent video; switch away/back; restart Driftless | No callback duplicates; recent eight-identity/30-min ring behavior observed; pending identity does not invent views | | BLOCKED | Timeline; ring-window scenario; actual deltas |
| CNT-04 | Ads naturally available; no ad purchase | Watch ordinary/ad/ordinary sequence with qualifying dwell | Ads separate from ordinary counts/cap; no ad-to-video miss; label unavailable ad case blocked | | BLOCKED | Ad/ordinary labels without content; count deltas |
| CNT-05 | Both test apps available | Alternate Reels/Shorts, Home and return; verify popup on recognized feed only | Combined daily count persists, no duplicate on returning; badge hidden elsewhere | | BLOCKED | Cross-app timeline |
| CNT-06 | YouTube normal screens | Use Search, subscriptions, regular video, comments and channel/profile; return to Shorts | No false ordinary video counts outside feed; document whether comments are classified as feed | | BLOCKED | Per-screen count deltas and classification |
| CNT-07 | Instagram normal screens | Use messages with empty test inbox, profiles, posts, Search and comments; return to Reels | No false counts on non-feed surfaces; no private content captured | | BLOCKED | Screen-name ledger, deltas |
| CNT-08 | Usage Access on; both metrics visible | Spend two minutes on regular screens, then watch qualifying feed items | OS app minutes and video-count units remain distinct; unsupported apps not claimed as counters | | BLOCKED | Start/end minutes/views; OS comparison |
| LIM-01 | Approved staging Pro + detection path; enabled goal N above current total | Observe N−1, watch Nth ≥1.5 s, try next item | No pause below N; at >=N pause on event/tick; badge cap boundary aligned; log visible N+1/delay | | BLOCKED | Precise dwell/overlay timeline; readiness/config |
| LIM-02 | LIM-01 setup | Save goal but turn off enforcement, then App pauses; re-enable separately | Saved goal alone never claims intervention; inactive status truthful | | BLOCKED | Status + actual interaction |
| LIM-03 | Two installed selected apps | Deselect current app; switch to it, then selected app | Deselected app unaffected; selected app follows rules; selection persists | | BLOCKED | Config and per-app outcomes |
| LIM-04 | Daily cap reached | Leave feed; use YT Home/Search/subscriptions/regular videos and IG posts/messages/profiles/Search; re-enter | Non-feed features usable; feed pause returns; no whole-app interception in feed scope | | BLOCKED | Each surface outcome; false-interception count |
| LIM-05 | Cap active; test content/audio | Try Back, Home, Open Driftless, app reopening and explicit bypass | Escape routes work; re-entry follows cap; log playback/audio continuing underneath | | BLOCKED | Audio yes/no; bypass budget; timing |
| LIM-06 | Saved active limit | Restart app; lock/unlock; reopen feed; restart isolated device only after approval | Counts/rules/budget persist; no duplicate; protection recovers or reports unavailable | | BLOCKED | Before/after prefs through UI; service status |
| LIM-07 | Active protection on isolated AVD | Revoke Accessibility manually; return; restore permission through setup | No false active status while off; fail-open; truthful recovery after consent | | BLOCKED | Status transitions and count gaps |
| LIM-08 | Unapproved version; experiment off | Open Focus/Goals with limit saved; then propose experiment test separately | Gate remains closed; status explains inactive protection; no gate automatically changed | | BLOCKED | Saved rule and status |
| LIM-09 | Separate approval for experimental toggle + legitimate staging entitlement | Enable explicit experiment via isolated UI; test same cap scenarios | Warnings remain; scores not promoted; fixture result never certifies accuracy | | BLOCKED | Experiment recorded; local/cloud eligibility |
| BRK-01 | Breaks enabled; chosen milestone and duration; legitimate prerequisites | Cross milestone; remain in feed through expiry | Break once per milestone; persisted deadline; expires after configured time | | BLOCKED | Wall/monotonic deadline and interaction timeline |
| BRK-02 | Active break | Leave feed for part/all duration; return before/after expiry | Time away counts; no extra break at same milestone; daily cap still applies | | BLOCKED | Remaining timer before/after |
| BRK-03 | Active break | Restart Driftless then return to feed | Same absolute deadline and consumed milestone retained | | BLOCKED | Deadline/remaining time evidence |
| BRK-04 | Bypass budget set to zero then separate case budget one | Attempt bypass; consume one; restart; wait expiry; attempt again | Zero disabled; one shared across apps; expiry restores cap; budget survives restart | | BLOCKED | Budget counts and expiry |
| BRK-05 | Whole-app scope; minute/schedule rule and Pro; separate case | Use five-minute snoozes; repeat until third exhausted | Three daily snoozes, separately tracked from configurable feed bypass budget | | BLOCKED | Snooze durations/counts and re-entry |
| TIME-01 | New AVD only; safe clock-change approval OR natural midnight | Cross midnight with dwell crossing just before/after; flush after boundary | View attributed to dwell threshold date; new allowance/bypass day; no lost/duplicated events | | BLOCKED | Timezone, date, dwell/flush ledger |
| TIME-02 | New AVD only; no live billing session; explicit time-change approval | Change timezone then wall clock backward/forward; restore original settings | Record reset/deadline behavior; no crash or invented measurements; clock bypasses logged as limitations | | BLOCKED | Old/new settings, deadline/budget/count changes |
| MIN-01 | Usage Access granted; enabled minute rule; NO goals; notifications denied | Keep Driftless closed; use supported app beyond minute limit; inspect after >60 s plus event/tick | Usage refresh independent of goals/notifications; intervention uses refreshed minutes; record lag | | BLOCKED | OS time and sampled usage/overlay times |
| MIN-02 | Usage Access denied; Accessibility running | Repeat minute test; grant Usage Access via UI and reopen | Status explains feed-observed fallback; complete app minutes not claimed; grant refreshes OS values | | BLOCKED | Permission/status and units |
| MIN-03 | Usage Access on; no goals; rule saved | Close/reopen app, switch apps, re-enter feed/whole-app rule | Stored minutes refresh rather than accumulating duplicates; correct rule scope | | BLOCKED | Before/after OS and Driftless totals |
| ACC-01 | Staging API/OAuth, test account, no billing production connection | Cancel picker; login; sign out; relaunch | Cancellation guest; sign-out invalidates native Pro and stale responses; local history retained | | BLOCKED | Sanitized state only; no tokens |
| ACC-02 | Two test accounts; staging verification; same-owner baseline | Cold restore same account offline; switch account; delayed old request completes | Same-owner bounded cache preserved; different owner clears old access; no stale regrant | | BLOCKED | Account aliases A/B; cache/status timeline |
| ACC-03 | Approved staged/test purchase history already prepared; NO purchase initiation | Use Restore with completed test token, then separate empty-result and failed-query cases | Verified result only grants; successful empty restore clears; failed query does not extend bounded cache | | BLOCKED | Sanitized staging request outcomes; plan/status |
| ACC-04 | Approved prearranged pending-payment harness/evidence; no purchase initiation | Transition supplied test pending state to completed; foreground app after rate-limit window | Pending grants nothing; foreground recovery verifies completed token; no interactive purchase | | BLOCKED | Staging fake/test provenance; state timeline |
| ACC-05 | Approved staging expiry/hold/grace/cancelled fixtures | Exercise states and cache boundary; test profile outage | Active/cancelled-paid access until bounded expiry; hold/expired no access; no extension offline | | BLOCKED | State mapping and actual native behavior |
| ACC-06 | Staging account/sharing consent; eligible data only | Toggle backup/sharing, compare two accounts, withdraw consent | No local candidate promotion; no shared count without consent; failure not zero | | BLOCKED | Redacted API outcome + UI |
| NAV-01 | New build; no login needed | Progress → History and stats → Explore your stats; select 7/30 days; Back | Routes reachable; local data preserved; no new paywall on basic 30-day Stats | | BLOCKED | Navigation screenshots with test data |
| NAV-02 | Daily local values; unapproved eligible values | Inspect Today, daily/weekly Progress, History, Stats, wrap and details | Local-versus-eligible differences explained; unavailable dash not zero; hourly sum reconciles | | BLOCKED | Source/metric/date ledger |
| A11Y-01 | New AVD; human accessibility testing | Largest text, small-screen profile if separately approved, TalkBack; tap all primary actions | No clipped essential controls; scrollable overlays; readable order/names; >=48dp targets where designed | | BLOCKED | Screenshots and narrated focus/order notes |
| ERR-01 | New AVD; isolated offline/configuration cases | Exercise empty data, offline API, permission denied, service stopped, older bridge where available | No false success/active state; loading ends or actionable error; data preserved | | BLOCKED | State, expected notice, retry outcome |

## Physical-device repetition and release decisions

Repeat all counting, cap, non-feed, break, permission/recovery and account cases on real
supported Android/OEM devices with current app versions. Record physical and emulator
outcomes separately. OEM reboot/battery restrictions, real Accessibility structure, background
activity restrictions and timing are not proven by Robolectric or an AVD. Ads are absent:
verify no new ad flow/SDK, but do not add test ads. No real or test purchase is initiated here.
Staging entitlement/restore outcomes remain BLOCKED without verifiable isolated evidence.

Required result summary after execution:

| Measure | Instagram | YouTube |
| --- | --- | --- |
| Exact app version / device build | | |
| Qualifying labelled ordinary views | | |
| True positives / misses / duplicates / false positives | | |
| Ad errors | | |
| Count delay median / maximum | | |
| Precision / recall / duplicate rate | | |
| Non-feed unintended interceptions | | |
| Limit-intervention delay / next video briefly visible | | |
| Physical-device verdict and evidence | | |

Use ACCURACY_PROTOCOL.md gates (P >=95%, R >=90%, duplicates <=1%) per app/version;
additional boundary/non-feed/lifecycle cases must pass. Do not fill approval lists or mark
gates passed using synthetic fixtures. Confirm unresolved failure disposition and explicit
release decisions in DEVICE_VALIDATION_PLAN.md. No new functionality is approved by this checklist.

## Execution addendum — isolated emulator-5556, 21 October 2026

The table above remains the full protocol; the limited executed subcases below supersede
its initial all-blocked preparation state only for the scope stated. Original app/device unchanged.
API36.1 ARM64; current source-copy APK hash `76f33570778f7d6db98d5ac0b007c00691514250dfde0d80468da05d9e104776`.
Evidence directory: `/private/tmp/driftless-isolated-validation-20261021`.

| Case/subcase | Actual result | Status | Evidence |
| --- | --- | --- | --- |
| ENV-01 isolated identity | Name verified as Driftless_Isolated_Validation_API_36_1 on emulator-5556 before each action; old emulator excluded | PASS | guarded check.py, emulator.log |
| ENV-02 isolated build/install | Current copied source assembled offline ARM64 and installed successfully on new AVD | PASS for debug setup; not RC certification | build.log, source-manifest.json, APK hash |
| NAV-01 route + 30-day subcases | Progress button opened History; Stats link opened 7-day view; 30-day button displayed 30-day data without paywall | PASS for navigation | progress/history/stats/stats-30 XML and PNG |
| ERR-01 empty-history subset | History rows Not tracked; Stats video totals dash; no fabricated historical views | PASS for this subset | history.xml, stats-30.xml |
| LIM-02 saved-but-inactive subset | Goal saved 45 min; Focus/Goals showed inactive/readiness reason instead of active enforcement | PASS for feedback only | goal-saved.xml, focus-off.xml, focus-gate.xml, goals-large-final.xml |
| Local goal save/restart | 45-minute value persisted after route revisit and explicit force-stop/relaunch of test app | PASS | goal-saved.xml, goal-reopened.xml, goals-large-final.xml |
| A11Y-01 Goals large-text subset | At font_scale=1.5, protection notice and goal controls readable, vertical scrolling available; normal scale restored | PASS for visible Goals layout only | goals-large-final.png/xml |
| Circle invite count and revisit | Exactly five invite prompts; leaving to Today and returning reshuffled all five in this sample | PASS | circle-final.xml/png, circle-revisit.xml/png |
| Guest invite / configuration error | Invite opens sheet; Continue with Google shows unavailable-build message; close dismisses; no account selected | PASS for unconfigured error path | invite-sheet.xml/png, invite-unconfigured.xml/png |
| CNT-IG/YT, LIM-01/04, BRK/TIME/MIN runtime enforcement | No labelled external-app sessions or current valid staging Pro; no fixtures/gate changes | BLOCKED / NOT EXECUTED | No new accuracy/enforcement claim |
| ACC-01 authenticated, ACC-02..06 | Staging/API/OAuth and test entitlement/purchase evidence unavailable; no purchase initiated | BLOCKED | No external account/API execution |
| A11Y-01 TalkBack/small-screen and complete ERR-01 | Not exercised | NOT EXECUTED | No claim |

Historical unit and earlier fixture results do not fill these remaining actual-result cells.
