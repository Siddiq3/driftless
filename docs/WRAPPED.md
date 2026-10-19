# Daily and weekly Wrapped

Open **Daily wrap** or **Weekly wrap** on Today or Progress. Daily covers yesterday in the phone's local time zone; weekly covers the last completed Monday–Sunday week. Measured periods also show an in-app “Your day/week in reels is ready” prompt, remembered per period in SQLite. The prompt does not appear over other apps. Wiping phone data removes these markers.

Every daily and weekly wrap contains at least **six slides**: total, peak, recorded sessions, app split, longest streak, and goals/focus. Missing metrics retain their illustrated chapter with a short unavailable state. Personality and previous-period comparison add up to **eight slides** when measurements support them.

Story cards use original brain artwork, a night illustration, warm/teal/purple/berry gradients, large display numbers, segmented progress, previous/next controls, hold/pause, and optional image sharing. Automatic playback stops for reduced motion, screen readers, app backgrounding, navigation away, holding and sharing. Long content scrolls; shares capture a separate full-content poster so large text does not crop its lower half.

## Real measurements

- Counts/minutes use the existing validated native daily aggregates. Guests need no account. Unknown days are not zero; partial weeks state their measured-day count.
- Peak hours require timestamped events accounting for the entire displayed count. Two-hour windows never join opposite ends of one local day.
- Recorded sessions split the existing native session log after gaps longer than 90 seconds. These are observed streaks, not instrumented app-open events. Longest streak measures first item start to last count, not uninterrupted foreground duration. Quick returns use a positive gap of at most five minutes.
- App shares appear only when their sum equals the displayed count. Personality is playful copy derived from recorded behavior.
- Comparison is against the user's own preceding complete day/week, only when both periods are measured and the baseline is nonzero. There is no population percentile dataset.
- The final actions open the existing daily goals and Pro app-pause screens. App pauses affect whole supported apps, not only their short-video sections.

Raw native event retention remains 30 days. No new raw event storage, tracking scope, overlay permissions or server uploads were introduced.

## Backend and consent

`GET /v1/wrapped?period=daily|weekly&end=YYYY-MM-DD` uses the existing authenticated user partition and existing synced day aggregates. It requires cloud-sync consent and a completed end date, and returns current/previous totals, tracked-day counts and a nullable comparison. Multi-device rows add once per device/day; a device with an unknown metric makes that day unknown for that metric. Missing dates never contribute synthetic zeros.

The app prefers phone data. If there are no local measurements, a signed-in user with cloud sync enabled can read synced totals using their profile time zone. Synced totals are labeled and do not claim local hourly/session/app details. Offline/API failures keep local mode available. Raw timestamps and sessions remain on the phone.

The shared contracts package is now **0.4.0**. Publish or link that local package before installing the app's matching dependency. Deploy the updated API for synced recap fallback; no new DynamoDB table or migration is needed. No deployment was performed during implementation.

## Build and verify

Install dependencies, then rebuild the Android development/release client: `react-native-view-shot` 5.1.0 and the native `getWrappedDetails` bridge require a new binary. An older client retains aggregate recaps and text sharing. Native image sharing exports a temporary PNG, opens Android's share sheet only on a tap, and releases the temporary capture afterward.

Verified: app TypeScript/lint, 124 Jest tests, 78 contract tests, 104 local DynamoDB API tests, 11 CDK tests, Android tracking Kotlin + view-shot Java compilation/autolinking, and Android Hermes export. Fixture-backed React Native Web previews were inspected in Safari; they are not a physical-device result. Contract coverage instrumentation was unavailable in the temporary test environment (`@vitest/coverage-v8` missing); contract tests ran without instrumentation.

Remaining device checks: fresh install and day/week rollover with real counts, TalkBack/font scaling, Android share-sheet completion and image contents, and permission-return behavior. Google credential provisioning and cloud deployment remain separate setup steps.

## Floating counter over Reels and Shorts

Counter now has an optional **Floating brain counter** switch, on by default once Accessibility counting is enabled. After accepting the counting disclosure and enabling Android's Accessibility counter, a small brain appears with the **current app's daily video count** at the top center of a recognized short-video player. It uses the existing connected service's `TYPE_ACCESSIBILITY_OVERLAY`; no `SYSTEM_ALERT_WINDOW` permission, extra foreground service, login, or backend is added. Touches pass through the badge, so it does not block scrolling or app controls. Disable it in Counter at any time.

The badge refreshes on native observations/ticks and hides on leaving the player/app, screen lock/off, disclosure withdrawal and service teardown. Wiping local counts disables it too. Candidate counts carry `~` and **Unconfirmed** for app versions that have not passed the accuracy gate. If the current video cannot be identified, it shows **— / Not detected** instead of inventing a count. Ads remain separate from the video count. A recognized surface is required; unsupported layouts do not show a badge. The current rules still have no validated Instagram/YouTube versions; this feature does not certify their counting accuracy.

A native Android rebuild is required. Older development clients keep counting without this optional badge and show a rebuild hint. The floating badge is a native view using the bundled original brain artwork; it is not an image embedded into Instagram or YouTube.
