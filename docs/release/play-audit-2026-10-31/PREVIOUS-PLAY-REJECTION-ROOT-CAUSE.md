# Previous Google Play rejection: root-cause report

**Status: UNVERIFIED. The original notice is not available.** Audit date 2026-10-31. Read-only.

## Exact original wording and cited policy

| Item | Status |
|---|---|
| Rejection email / Policy status page | NOT FOUND in the three repositories, `output/`, or `~/Downloads`, `~/Desktop`, `~/Documents` (3 levels, filename search) |
| Wording held | Only as relayed by the developer: "Insufficient data use declaration in the prominent disclosure", and a reference to "Diagnostics". Not confirmed against the source |
| Exact policy section, reviewer feedback, other issues | UNVERIFIED |

The developer must supply the notice. Nothing below can be treated as the confirmed cause until then.

## Policy requirement in force (fetched 2026-10-31)

AccessibilityService API (https://support.google.com/googleplay/android-developer/answer/10964491):
disclosure must be in the app, in normal usage, "describe the data accessed or collected through the
API", explain how it is "used and/or shared", and require affirmative action.

The non-tool declaration form asks whether personal or sensitive data is collected or shared through the
API, and which types. **The listed types include "Crash logs", "Diagnostics" and "Other app performance data".**

Data safety (https://support.google.com/googleplay/android-developer/answer/10787469) defines Diagnostics as
"Information about the performance of your app. For example battery life, loading time, latency, framerate,
or any technical diagnostics."

## Root-cause analysis

**Most likely mechanism (hypothesis, not proven):** the disclosure and the declaration disagreed. Either
Diagnostics was selected in the Accessibility declaration or Data safety, or the reviewer saw diagnostic use,
while the disclosure the user read never described it. Evidence for the mismatch:

- Disclosure at commit `5f97ae0` (`git show HEAD:app/disclosure.tsx`) covers minutes, video detection,
  counts, backup and pauses. It never mentions heartbeats, tracking coverage or any measurement-quality data.
- The app at that commit did collect them: service heartbeats, and a daily `coverage` value uploaded in
  `POST /v1/usage/sync`.
- `docs/release/DATA_SAFETY_RECOMMENDATION.md:47,58` recommended declaring coverage as "Diagnostics: collected,
  not ephemeral". Whether that was what was entered in Play Console is UNVERIFIED.

**Other possible causes, not excluded:** the disclosure was too short or mixed with a walkthrough, did not
explain use or sharing, or the video did not show it fully. Only the notice can separate these.

## Diagnostics data-flow investigation

| Source | What exists now | Leaves device? | Evidence | Status |
|---|---|---|---|---|
| Heartbeats | Removed. Table dropped at schema v7 | No | `SqliteStore.kt:83` `removeDiagnostics` | PASS (code) |
| `coverage` upload | No longer sent by the app (no match in `src/sync/aggregate.ts`). Backend accepts it from old clients and clears it on new uploads | Old clients only | `driftless-backend` `usage.js`, commit `d7d0eb3` | PASS (code); live UNVERIFIED |
| Service-health history | In memory only | No | prior removal work | PASS (code) |
| Native logs | `Log.d` of a salted key, debug builds only | No | `DriftlessAccessibilityService.kt:227` | PASS (code) |
| Guide logs | `Log.i/w` with no user data, in release | No (logcat only) | `AccessibilityGuideActivity.kt:60,80,82` | PASS |
| Debug exports, structure capture | `FLAG_DEBUGGABLE` gated; sharing is manual | Only if a developer shares | `DebugTrackingExports.kt`, service `captureStructure` | PASS (code) |
| Backend request logs | route, status, duration, request ID, error type; 30 days | **Yes** | `services/api/src/lib/log.js`, `serverless.yml:15` | Live retention UNVERIFIED |
| API Gateway access logs | None configured in `serverless.yml` | - | no match for accessLogs | PASS (config) |
| Crash or analytics SDK | None in the release dependency graph | No | Gradle `releaseRuntimeClasspath` | PASS (graph); final AAB UNVERIFIED |
| Firebase Installations / Messaging / DataTransport | Present through expo-notifications. No `google-services.json`, no Firebase config in `app.config.ts`, so expected inert | UNVERIFIED | dependency graph | Needs AAB and network test |
| Play services, Google Sign-In | Google's own processing at sign-in | Yes, to Google | dependency graph | Provider terms UNVERIFIED |

**Conclusion:** diagnostics derived from Accessibility were removed in code. What remains is server request
logging, which is technical diagnostics but is not collected through the Accessibility API.

## Previous vs current disclosure

| Requirement | Previous (`5f97ae0`) | Current (`PermissionScreen.tsx`, `accessibilityDisclosure.ts`) |
|---|---|---|
| Data accessed | Partial ("limited player labels") | Yes: events, visible text, descriptions, structure |
| Use | Partial | Yes |
| Off-device data | Totals and goals only | Totals, per-app totals, goals, timezone, device ID, request logs |
| Diagnostics | Silent | Request logs named; collection through the API removed |
| Contradiction | - | **NEEDS FIX:** "Only your daily totals are backed up" (line 19) conflicts with line 15 (finding A-04) |

## Video and Play Console assessment

- Previous video: NOT FOUND. UNVERIFIED.
- Previous Accessibility declaration and Data safety answers: not available. UNVERIFIED.
- `docs/STORE_PREP.md` contains stale draft text (six apps, Pro, Cognito). If it was the source of a past
  submission, the declaration was inaccurate (finding A-11).

## Remaining risks and resolution status

**NOT RESOLVED.** The code removes the suspected data, but the cause is unconfirmed, the declaration has not
been re-checked, the disclosure has a contradiction, and no new video exists.

Do not simply add the word "Diagnostics". Decide what the form should say after the notice is read: on current
code the honest answer for the Accessibility declaration is that Diagnostics is not collected through the API,
while server logs belong in Data safety if the developer's reading of the definition includes them.
