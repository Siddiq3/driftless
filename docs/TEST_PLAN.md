# Test Plan

Status: Phase 1 suites in place. Results below are from real CI runs only.

## 1. Layers
| Layer | Tooling | Runs where |
|---|---|---|
| Domain & contracts unit | Vitest | CI (Linux) |
| Backend integration | Vitest + DynamoDB Local (Docker) | CI |
| Authorization matrix | Generated: every route × {owner, other user, anonymous, expired token} | CI |
| API contract | zod schemas ↔ OpenAPI ↔ handler responses | CI |
| CDK | `aws-cdk-lib/assertions` | CI |
| Kotlin unit | JUnit5 + Robolectric for classifier/dedup with recorded event fixtures | CI (Android SDK runner) |
| Android instrumented | Espresso/UiAutomator on emulator + device lab | CI emulator + manual devices |
| Swift unit | XCTest for policy, App Group codec, date logic | macOS CI |
| iOS device | Manual + XCUITest on physical iPhone (Screen Time requires device) | Manual |
| Mobile E2E | Maestro flows on dev builds | CI emulator / local |
| Billing | Play license testers, StoreKit Testing config + App Store sandbox; webhook fixture replay | CI (fixtures) + manual |
| Accessibility (UI) | Dynamic type 200%, TalkBack/VoiceOver passes, contrast checks | Manual checklist each phase |
| Privacy | Schema test (no text columns), network capture of release build (only allowed hosts/fields) | CI + manual |

## 2. Tracking fixtures (Android, recorded event streams)
| Fixture | Expected |
|---|---|
| Repeated accessibility callbacks for same item | 1 view |
| Fast scrolling (< 1.5 s per item) | 0 views for skipped items; time counted |
| Return to previous item | not re-counted |
| Open comments / profile and back | no new view |
| Advertisement | `adViews+1`, `views+0` |
| App switch away & back to same item | not re-counted |
| Service restart mid-item | ≤ 1 view, no duplicate event_id |
| Device reboot | aggregates intact; coverage gap recorded |
| Time-zone change | day split per ARCHITECTURE §8 |
| Missing permission | `tracking_unavailable`, null counts |
| Unsupported app version | counts null, minutes present |

## 3. Accuracy measurement (gate G-2)
Ground truth: human-labelled screen recordings from the developer's own sessions only. Metrics per app × version: precision, recall, duplicate rate, ad-misclassification rate. Thresholds: P ≥ 95%, R ≥ 90%, dup ≤ 1%.

## 4. Device matrix (minimum)
Android: Pixel (stock, latest + previous major), Samsung One UI, Xiaomi/HyperOS (aggressive battery), one small-screen device. iOS: current and previous major iOS on a small and a large iPhone.

## 5. Results log
| Date | Phase | Suite | Result | Notes |
|---|---|---|---|---|
| 2026-10-18 | 1 | contracts (Vitest) | 33/33 passed | CI run 39133222400, commit e5fb168 |
| 2026-10-18 | 1 | domain (Vitest) | 41/41 passed | coverage: lines 100%, functions 100%, branches 96.8% |
| 2026-10-18 | 1 | design tokens (Vitest) | 22/22 passed | WCAG AA on all text pairs, both themes |
| 2026-10-18 | 1 | API on DynamoDB Local | 31/31 passed | auth, cross-user isolation, revisions, handle uniqueness, idempotency, payload limits |
| 2026-10-18 | 1 | CDK assertions | 8/8 passed | `cdk synth` failed (CDK v1 flag) |
| 2026-10-18 | 1 | backend repo, all suites | 113/113 passed; synth, pack, gitleaks OK | driftless-backend CI run 39134202260 (commit 100ae63) |
| 2026-10-18 | 1 | contracts 0.1.0 publish | published | run 39134435329, tag contracts-v0.1.0 |
| 2026-10-18 | 1 | app (Jest) | 15/15 passed | migrations, outbox policy, API client |
| 2026-10-18 | 1 | Android debug build | passed | `assembleDebug`, arm64-v8a, 566 s |
| 2026-10-18 | 1 | gitleaks | no leaks | 7 commits scanned |
| 2026-10-18 | 1 | app typecheck / lint / expo-doctor | failed | SDK 57 version alignment, removed `edgeToEdgeEnabled`, ESLint 10 incompatible with eslint-config-expo → fixes pending |
