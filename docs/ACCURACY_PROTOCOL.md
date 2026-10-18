# Accuracy Protocol — Gate G-2 (Android Reels & Shorts counting)

Purpose: decide, per app and app version, whether Driftless may show video counts as accurate.
Status: **not yet run.** It requires a real Android phone; it cannot be done in CI.

G-2 thresholds (TEST_PLAN §3), per app × app version, pooled over sessions:

| Metric | Threshold |
|---|---|
| Precision (counted views that were real watched videos) | ≥ 95% |
| Recall (watched videos that were counted) | ≥ 90% |
| Duplicate rate (extra counts for an already-counted video) | ≤ 1% |

Outcome per app version: **PASS** → add the version prefix to `validatedVersions` in
`modules/tracking-android/android/src/main/assets/driftless_rules.json`. **FAIL** → fix rules and
re-test, or drop video counts for that app (time only), per DECISIONS / PRODUCT_SPEC.

Only the developer's own phone and own sessions are used. Screen recordings stay on that phone or
the developer's computer and are never committed to the repository.

---

## 1. Install the debug build

1. Download the debug APK produced by CI (or build locally with `pnpm android`).
2. Prefer installing with `adb install app-debug.apk` from a computer.
3. If you install the APK file directly on the phone instead, Android 13+ blocks accessibility for
   sideloaded apps ("restricted setting"). To allow it: **Settings › Apps › Driftless › ⋮ (top
   right) › Allow restricted settings**, then continue. (Menu wording varies by manufacturer.)
4. Note: if **Advanced Protection** is on (Android 16/17), Android blocks this service entirely for
   non-accessibility-tool apps. Turn Advanced Protection off on the test phone, and record that
   this limitation applies to real users too.

## 2. Turn counting on

1. Open Driftless › **Reels & Shorts counter** › **How counting works** › **I agree, open Settings**.
2. In Accessibility settings enable **Driftless Reels & Shorts counter**.
3. Back in Driftless the status should read "Counting (accuracy not yet confirmed)". Note the
   Instagram / YouTube versions shown under **Supported apps**.

## 3. Check that the rules see the right screen (do this first)

The bundled selectors are unvalidated guesses. Before labelling sessions, confirm they match:

1. Tap **Capture screen structure in 8 s**, switch to Instagram Reels (or YouTube Shorts), wait.
2. Return to Driftless › **Share last capture**. The file holds only view ids and class names.
3. Check that one of `surfaceViewIds` and every `itemParts.viewId` from the rules file appear in the
   capture, and that the item node has `"hasDesc": true` (or `hasText` for `field: text`).
4. If not, edit the rules file with ids from the capture, rebuild, and repeat. Bump `"version"`.

A quick sanity check: scroll 10 videos slowly, then look at **Today on this phone**. It should say
about 10. If it stays at 0, the surface or item ids are wrong.

## 4. Record labelled sessions

For each app, record **at least 30 sessions of 2–5 minutes**, covering every scenario:

| Scenario | How |
|---|---|
| Normal watching | Watch each video ≥ 3 s |
| Fast scrolling | Several flicks < 1 s apart |
| Going back | Scroll back up to a previous video |
| Comments / profile | Open comments or the creator's profile, then return |
| Ads | Keep scrolling until ads appear |
| App switching | Leave to another app and come back mid-video |
| Screen off | Lock the phone mid-video, unlock, continue |
| Service restart | Toggle the service off/on in Settings mid-session |

For each session:

1. Start Android's screen recorder. Note the exact start time (use a clock app with seconds in the
   first frame, or read the recording's file timestamp).
2. Use the app normally for the scenario.
3. Stop the recording.

## 5. Label each recording

Create `labels/<app>-<nn>.csv` (kept outside the repository):

```
# package=com.instagram.android
# app_version=400.0.0.0
# recording_start_ms=1760787000000
offset_s,kind
0.0,view
6.0,skip
6.8,view
14.0,ad
```

* `offset_s` — seconds into the recording when a **new** video appears.
* `kind` — `view` if it stayed on screen ≥ 1.5 s, `skip` if shorter, `ad` for adverts.
* Returning to an earlier video is **not** a new row.

## 6. Export and score

1. Driftless › **Export counted events** (contains event ids and times only).
2. On a computer with Python 3:

```sh
python3 scripts/accuracy/score.py driftless-events-*.jsonl labels/instagram-*.csv --align
python3 scripts/accuracy/score.py driftless-events-*.jsonl labels/youtube-*.csv --align
```

`--align` corrects small clock differences between the phone and the recording (±10 s).
The script prints precision, recall, duplicate rate and a PASS/FAIL per session and pooled.

## 7. Record the result

Add a row to `docs/TEST_PLAN.md` §5 and update `docs/PLATFORM_CAPABILITIES.md`:

| Date | App | Version | Sessions | Precision | Recall | Dup | Verdict | Device / Android |
|---|---|---|---|---|---|---|---|---|

Then set `validatedVersions` for passing versions and bump the rules `version`.
