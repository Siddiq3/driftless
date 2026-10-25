# Curated milestone meme popups

The milestone card now appears at count **1**, then **50, 100, 150…**, and uses an offline mixed-language collection instead of its two static artwork choices. Recorded milestones still suppress restart duplicates; first-count greetings replace high-count roasts at count 1. The opt-out, close/continue/break controls, tracking, quotas and lifecycle behavior are retained. Reels/Shorts context comes from the foreground package; no reel audio, captions, topic or language is classified or uploaded.

## Selection and copy

- Nineteen of the twenty supplied Tenor links are bundled as small animated GIFs (6,048,550 bytes total). Source/media URLs and SHA-256 hashes are in `MEME-ASSETS.json`.
- `https://tenor.com/view/lol-gif-2220434` returned HTTP 404. Its catalog entry is retained for a future replacement, but missing assets are excluded from the available pool. No substitute was silently invented.
- Memes are sampled without replacement. After every available meme has appeared, a new random cycle begins; the previous cycle's final meme cannot immediately repeat. This history survives service recreation and is scoped to the current native dataset/incarnation.
- Selection is independent of milestone number: 50 is not tied to one particular meme. A finite collection will eventually repeat, but not before its pool is exhausted.
- Every reaction has three original caption variants. When that reaction returns, its previous caption variant is excluded. Count and Reels/Shorts wording are inserted at display time.
- Telugu, Hindi, Tamil and Malayalam reactions use their native scripts; general reactions use English. The user requested a combined pool, so the displayed caption follows the selected meme, not inferred reel language. Action buttons keep the existing device-language behavior.
- GIFs play locally with no sound, WebView, Tenor JavaScript/API key, network fetching, new permission or tracking SDK. “GIF via Tenor” attribution is visible. Android's disabled-animation setting freezes playback on API 26+.

This implements count/platform/meme-mood matching. It does **not** detect that the current reel is Telugu, Hindi, Malayalam or about any particular topic. Native-speaker copy review and physical-device animation/readability testing remain outstanding.

## Changes

`MemeCollection.kt`: curated catalog, native-script copy, random no-repeat selection and caption rotation.

`MemeGifView.kt`: bounded-size bundled GIF playback, aspect-ratio preservation and reduced-motion handling.

`MemeMilestoneCard.kt`: animated artwork, contextual caption, attribution and successful-display history recording.

`Platform.kt`: incarnation-scoped reaction/caption history and wipe cleanup. `DriftlessAccessibilityService.kt`: passes the active Reels/Shorts platform into the card.

`MemeCollectionTest.kt` and `MemeCardTest.kt`: deterministic selection/copy, persisted rotation, incarnation isolation, GIF availability/header and existing card behavior regressions. Existing images are left in place for other uses; there is no unrelated resource removal.

## Validation

The first Gradle attempt could not access the Gradle cache lock under the default filesystem sandbox; no tests ran in that attempt. The offline rerun with cache access passed.

Full native suite executed with:

```sh
EXPO_NO_DOTENV=1 EXPO_NO_TELEMETRY=1 JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' ./gradlew :tracking-android:testDebugUnitTest --offline --console=plain
```

Working directory: `android`. Result: **171 tests, 0 failures, 0 errors, 0 skipped**. Log: `/private/tmp/scrollsnooze-meme-native-full.log`.

After correcting one reaction description/copy, the focused final rerun uses the same environment with `--tests '*MemeCollectionTest' --tests '*MemeMilestoneTest' --tests '*MemeCardTest'`. Result: **12 tests, 0 failures, 0 errors, 0 skipped**. Log: `/private/tmp/scrollsnooze-meme-final-focused.log`.

All nineteen GIFs were opened locally to inspect dimensions/frame counts, and a first-frame contact sheet was visually reviewed to align reaction descriptions/copy. This is asset inspection, not a physical-device popup test. No APK installation, device settings, production API, backend source change, deployment, commit or push was performed. A native rebuild is required to include the new assets/code.

## First-count popup follow-up

Count 1 now shows a random meme with a first-view greeting. The first observation may qualify at exactly 1, including on a fresh day, but an already recorded count-1 milestone is not replayed after restart. Backwards count corrections do not retrigger it. Counts 2–49 do not add popups; existing 50-count milestones continue. Focused regressions run using the command above, with output in `/private/tmp/scrollsnooze-first-count-tests.log`; result: **14 tests passed, 0 failures/errors/skips**.
