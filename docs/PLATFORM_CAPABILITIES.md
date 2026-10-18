# Platform Capabilities & Policy Findings

Review date for all sources: **2026-10-18**. Re-review before Phase 2, Phase 5, and store submission.

## 1. Android capability matrix

| Capability | Mechanism | Status | Confidence | Risk |
|---|---|---|---|---|
| Foreground app detection | AccessibilityService `TYPE_WINDOW_STATE_CHANGED` / `UsageStatsManager.queryEvents` | Known API | High | Usage Access is a special permission the user grants in Settings |
| Per-app time | `UsageStatsManager` | Known API | High | OEM variance in event fidelity |
| Short-video surface classification | Accessibility node inspection (view IDs, class names, content descriptions) inside the service, discarded immediately | **Implemented (Phase 2), unvalidated** — rule-driven, selectors are candidates | Unknown until G-2 device study | App updates rename/obfuscate IDs; Compose UIs may expose few IDs |
| Item transition detection | Pager scroll / surface entry + novel salted fingerprint + 1.5 s dwell (D-007) | **Implemented, unit-tested on recorded fixtures; unvalidated on devices** | Unknown until G-2 | Prefetch, autoplay previews, repeated callbacks |
| Ad detection | "Sponsored"/ad label nodes | Unproven | Low | Localised strings; changes often |
| Advanced Protection (Android 17) | Non-accessibility-tool services are blocked and revoked when the user enables Advanced Protection | **Platform limit** — detected as "enabled but not running", shown honestly | High | No compliant workaround; affected users get time-only (UsageStats, Phase 3) |
| Sideloaded test installs | Android 13+ "restricted settings" block accessibility for sideloaded APKs until the user allows it | Documented in ACCURACY_PROTOCOL §1 | High | Testing friction only; Play installs are not affected |
| Blocking at limit | Accessibility detects foreground → launch own full-screen "pause" activity; user can dismiss/disable at any time | Feasible | Medium | Must not be deceptive; must not trap the user |
| Survive reboot | `RECEIVE_BOOT_COMPLETED`; accessibility services are re-bound by the system if still enabled | Feasible | High | Some OEMs kill/disable services — health checks + guidance |
| Durable local store | Room/SQLite in the native module, WAL | Feasible | High | |
| Offline | Entirely local | Feasible | High | |

Supported-app registry (initial): `com.instagram.android` (Reels), `com.google.android.youtube` (Shorts). Each entry carries a **version range** validated by labelled tests; outside the range the engine reports *tracking unavailable* for counts and falls back to time.

## 2. iOS capability matrix

| Capability | Mechanism | Status | Confidence |
|---|---|---|---|
| Authorization (self) | `AuthorizationCenter.requestAuthorization(for: .individual)` | Documented | High |
| Choose apps to watch/block | `FamilyActivityPicker` → opaque `ApplicationToken`s (no bundle IDs/names exposed to app) | Documented | High |
| Per-video Reels/Shorts count | — | **Not available** | — |
| Per-app time numbers in our app/server | — | **Not available** (report data stays in the report extension) | High [SECONDARY] |
| Time display & charts | `DeviceActivityReport` extension | Documented | High |
| Threshold alerts ("15 min reached") | `DeviceActivityEvent` + `DeviceActivityMonitor.eventDidReachThreshold` | Documented | Medium — reliability reports vary [SECONDARY] |
| Schedules | `DeviceActivitySchedule` | Documented | High |
| Blocking | `ManagedSettingsStore.shield.applications` | Documented | High |
| Custom shield UI / actions | ShieldConfiguration + ShieldAction extensions | Documented | High |
| Shared state app ↔ extensions | App Group container | Documented | High |
| Extension memory budget | ~6 MB reported for DeviceActivityMonitor | Unconfirmed by Apple | [SECONDARY] |
| Distribution | Family Controls distribution entitlement per target | Request required | Approval not guaranteed |

### iOS honest-UI rule
The app states plainly: *"On iPhone, Apple lets apps see time spent in apps you choose — not individual videos. Driftless counts minutes, not Reels."*

## 3. Cross-platform parity table (what users see)

| Feature | Android | iOS |
|---|---|---|
| Headline number | Videos today (when supported) + minutes | Minutes today (in report view) |
| Goal type | Videos or minutes | Minutes |
| Streak signal | Goal kept (computed locally) | Goal kept = threshold event did **not** fire before day end (computed in extension → App Group boolean) |
| Social score | Consented daily aggregates | Self-reported check-in (pending G-5) |

## 4. Sources (official unless marked)

| # | Source | Key finding | Type |
|---|---|---|---|
| S1 | [Google Play — Use of the AccessibilityService API](https://support.google.com/googleplay/android-developer/answer/10964491?hl=en) | Non-tools: in-app prominent disclosure + affirmative consent, separate from privacy policy; Play Console declaration; demo video of consent/non-consent flows; monitoring apps ineligible for `isAccessibilityTool`; no autonomous AI-style actions | Official |
| S2 | [Google Play — isMonitoringTool](https://support.google.com/googleplay/android-developer/answer/12955211?hl=en) | Flag required for apps monitoring another individual (`child_monitoring`, `enterprise_management`, `other`); self-monitoring not addressed | Official |
| S3 | [Apple — Configuring Family Controls](https://developer.apple.com/documentation/xcode/configuring-family-controls) | Dev entitlement self-serve; distribution requires request; same request for each Screen Time extension | Official |
| S4 | [Apple — FamilyControls framework](https://developer.apple.com/documentation/familycontrols) | Individual authorization needs device-owner biometric approval; picker hides choices from the app | Official |
| S5 | [Apple — Family Controls distribution request](https://developer.apple.com/contact/request/family-controls-distribution) | Request form | Official |
| S6 | [Apple — DeviceActivity framework](https://developer.apple.com/documentation/deviceactivity) | Schedules, threshold events, privacy-preserving reports | Official |
| S7 | [Apple Forums — Family Controls Usage Data](https://developer.apple.com/forums/thread/769247) | Apple Frameworks Engineer: Screen Time data cannot be exported; leaderboard not supported (Nov 2024) | Forum (Apple staff) |
| S8 | [Apple Forums — DeviceActivityMonitor memory limit](https://developer.apple.com/forums/thread/823431) | ~6 MB limit reported; Feedback open (2026) | Forum |
| S9 | [Google — Play Billing backend integration](https://developers.google.com/chromeos/app-development/publish/play-billing-backend) | Server verification; invalidate `linkedPurchaseToken`; RTDN for state changes; avoid polling | Official (ChromeOS guide) |
| S10 | [Expo SDK 57 changelog](https://expo.dev/changelog/sdk-57) / [SDK 58](https://expo.dev/changelog/sdk-58) | 57: 2026-06-30, RN 0.86; 58: 2026-10-15, RN 0.88; iOS 27 SDK requires scene lifecycle | Official |
| S11 | [HabitDoom — FamilyControls in production](https://habitdoom.com/blog/shipping-familycontrols-ios) | Opaque tokens; validate token decode before overwriting blocklist; auth ≠ activation | Third-party (2026-06-06) |
| S12 | [Android Authority — Android 17 Advanced Protection & accessibility apps](https://www.androidauthority.com/android-17-beta-2-advanced-protection-mode-accessibility-apps-3648860) | With Advanced Protection on, non-accessibility-tool apps can't be granted the service and existing grants are revoked (2026-03-13) | Press (reviewed 2026-10-18) |
| S13 | [The Hacker News — Android 17 Advanced Protection](https://thehackernews.com/2026/10/android-17-advanced-protection-locks.html) | Google confirms Advanced Protection limits AccessibilityService to verified accessibility tools (2026-10-02); no official developer doc link found yet | Press — **verify against developer.android.com before release** |
| S14 | [9to5Google — Android 15 sideloaded app restrictions](https://9to5google.com/2024/09/12/android-15-sideloaded-apps-restrictions/) | Restricted settings: accessibility (and in 15, usage access etc.) blocked for sideloaded apps until allowed | Press |

### Still to verify (before the phase that depends on it)
- Google Play Developer API `purchases.subscriptionsv2` + RTDN Pub/Sub specifics, acknowledgement window (Phase 5).
- App Store Server API, Server Notifications V2, `appAccountToken` usage (Phase 5).
- Google Play User Data policy & Data safety form wording for usage data (Phase 7).
- App Store Review Guidelines sections covering Screen Time API data use (Phase 2, before G-5).
- Android 16/17 behaviour changes: Advanced Protection finding recorded (S12/S13, press sources) — re-verify against official Android docs before Phase 7.
