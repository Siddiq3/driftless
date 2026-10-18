# Test Plan

Status: planned · **No tests have been executed yet** (no code exists as of 2026-10-18).

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
| — | — | — | — | Nothing executed yet |
