# Accessibility compliance audit

| Check | Evidence | Result |
|---|---|---|
| Purpose: count Reels/Shorts, time, overlays, user-set pauses | Service, disclosure | Non-tool use; no flag. PASS |
| Metadata | `driftless_accessibility.xml`: window state, content, scroll; `flagReportViewIds`; retrieve content; no gestures | PASS; necessity of content access justified by detection |
| Package limit | line 15 | PASS for events |
| Other apps' windows | Root obtained, package read only (`:189-200,329,391`) | PASS in code. Technically the API could read more, so wording must stay "doesn't look inside" |
| Node traversal | Bounded (`maxNodes`, `maxDepth`); text read for ad labels on all visible nodes (`Classifier.kt:111`) | NEEDS FIX A-15 |
| Sensitive text | No password or EditText exclusion in classifier now; text not stored; DMs in Instagram are reachable in memory | Disclosed; reduce with A-15; device check UNVERIFIED |
| Autonomous action | Back only on tap (`FeedPauseOverlay.kt:23`) | PASS |
| Security features | No FLAG_SECURE workaround, no capture API | PASS (code) |
| Overlays | Badge, meme card, feed pause: `TYPE_ACCESSIBILITY_OVERLAY` | Disclosed; A-16 UNVERIFIED |
| Consent gate | `:147` and classification check, native version check | PASS (tests); device partly |
| Revocation | Android setting; prior device doc passes for an older build | Re-test |
| Persistence | Counts, events; no text fields in `ViewEvent` | PASS |
| Network | Totals only | PASS (code); traffic capture UNVERIFIED |
| Logging | Debug-gated key log | PASS |

## Disclosure and consent

| Requirement | Result |
|---|---|
| In the app, normal usage, before Settings | PASS (onboarding, banner) |
| Data accessed and purpose | PASS |
| Use, sharing, retention | NEEDS FIX line 19 |
| Experimental limits | PASS |
| Affirmative action; Back, Deny not consent | PASS (tests) |
| Separate from unrelated disclosures | Likely PASS |
| Re-consent | NEEDS FIX A-14 |
| Device: full sheet, TalkBack, large fonts | UNVERIFIED |

## Declaration draft

Non-tool. Reason: App functionality. Personal data via API: answer from final matrix (App activity: other actions, app
interactions). Diagnostics: not collected through the API on current code. Final answer waits for A-01.

## Video

See PLAY-CONSOLE-EVIDENCE-REQUIRED.md. No previous video was available. Existing `output/` images are UI tests, not review footage.
