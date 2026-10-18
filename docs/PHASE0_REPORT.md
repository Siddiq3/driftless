# Phase 0 Report — Repository Audit, Feasibility & Architecture

Working product name: **Driftless** (placeholder; trademark and store-name search pending — see `DECISIONS.md` D-001).
Review date for every external source in this document set: **2026-10-18**.

Legend used across all docs:
- **[VERIFIED]** — observed directly in this environment or read on an official source on the review date.
- **[ASSUMPTION]** — believed true, not yet confirmed.
- **[PROPOSED]** — a design choice awaiting review.
- **[SECONDARY]** — from a developer forum or third-party article, not official documentation.

---

## 1. Repository and environment audit

### 1.1 Repository
| Item | Finding |
|---|---|
| Existing repository | **None.** `/home/claude` was not a git repository; no project files, branches, or uncommitted changes existed. [VERIFIED] |
| Reusable prior work | None found. |
| GitHub remote | **Not created.** The session's `gh` CLI reports the `GH_TOKEN` as invalid (`gh auth status` → "The token in GH_TOKEN is invalid"). No repository could be created or pushed. [VERIFIED] |
| Local repository | Initialised at `driftless/` on branch `main`, containing only `docs/`. |
| Secrets / `.env` | None present; none opened or printed. |
| CI configuration | None (to be created in Phase 1). |
| Dependencies / scripts | None yet. |

### 1.2 Baseline status
| Check | Result |
|---|---|
| Build | **Not applicable** — no source code exists. No build was run. |
| Tests | **Not applicable** — no tests exist. **No test was executed or reported as passing.** |
| Security findings | No code to scan. Environment-level finding: the GitHub credential in this session is invalid, so repository creation must be done by the owner (see §10). |
| Structure | `docs/` only (this document set). |

### 1.3 Environment toolchain [VERIFIED]
| Tool | Available | Consequence |
|---|---|---|
| Node.js 22.22.0, npm 10.9.4, pnpm, yarn | Yes | TypeScript backend, shared packages, unit tests can run here. |
| Java (JDK) + Gradle 8.14.3 | Yes | Pure-Kotlin/JVM unit tests may run; **no Android SDK** (`ANDROID_HOME` unset). |
| Android SDK / emulator | **No** | Android app builds and instrumented tests need CI (GitHub Actions) or a developer machine. |
| Xcode / macOS | **No** (Linux) | All iOS builds, Swift tests, and Screen Time prototyping require macOS + physical iPhone. Screen Time APIs do not function in the simulator for authorization flows [ASSUMPTION — to verify in Phase 2]. |
| AWS CLI / CDK / SAM | Not installed | CDK can be installed via npm; **no AWS credentials** — nothing will be deployed (as instructed). |
| Docker | Present | DynamoDB Local for integration tests is feasible. |

---

## 2. Architecture recommendation (summary)
Full detail and diagrams: `ARCHITECTURE.md`.

- **Monorepo** (pnpm workspaces + Turborepo): `apps/mobile` (Expo custom dev build), `packages/contracts` (zod schemas → TS types), `packages/domain` (pure TS: view rules, streaks, brain progression), `services/api` (Lambda handlers, one modular API), `infra` (AWS CDK).
- **Local-first:** native engines (Kotlin service on Android, Swift extensions on iOS) are the source of truth for counts and restrictions; they write to on-device stores and operate with the JS app closed and the network off.
- **Backend:** one HTTP API (API Gateway HTTP API + Cognito JWT authorizer) fronting a small number of Lambda functions grouped by module; **single-table DynamoDB**; EventBridge Scheduler for leaderboard snapshots, entitlement reconciliation, and deletion sweeps.
- **Expo SDK 57** pinned for Phase 1 (released 2026-06-30, RN 0.86). SDK 58 (RN 0.88) shipped 2026-10-15 — three days before this review — and is deferred until it stabilises (D-004).

---

## 3. Feasibility matrix (headline)
Full matrix: `PLATFORM_CAPABILITIES.md`.

| Capability | Android | iOS |
|---|---|---|
| Per-Reel/Short view counting | **Possibly**, via AccessibilityService heuristics; unproven, version-fragile → Phase 2 PoC gate | **Not available.** Apple APIs expose app/category/domain time only, through opaque tokens. |
| Per-app usage time | **Yes** — `UsageStatsManager` (Usage Access) | **Yes, but only displayable** inside a DeviceActivityReport extension; the app cannot read numbers out |
| Time-threshold events (e.g. "15 min in selected apps") | Yes (own computation) | **Yes** — DeviceActivity events fire into the monitor extension |
| Blocking selected apps | Yes — accessibility-driven redirect/overlay of own app, user-removable | **Yes** — ManagedSettings shields |
| Friends leaderboard built from usage data | Yes (aggregates the user consents to share) | **High risk / likely unsupported** — an Apple engineer stated Screen Time data cannot be exported and a leaderboard "is not supported today" [SECONDARY, Nov 2024] |
| Works offline | Yes | Yes |

**Consequence:** "Reels/Shorts count" is an **Android-only, accuracy-gated** feature. iOS gets a different, honest feature set: time-based limits, shields, schedules, and in-extension reports. Social features on iOS must be built on data that is *not* exported Screen Time data (see §8 go/no-go G-5).

---

## 4. Official platform-policy findings
Full list with links: `PLATFORM_CAPABILITIES.md` §4.

1. **Google Play — AccessibilityService** ([policy](https://support.google.com/googleplay/android-developer/answer/10964491?hl=en)): a monitoring/wellbeing app is **not** an accessibility tool and must not set `isAccessibilityTool`. It must show an in-app **prominent disclosure with affirmative consent** (separate from the privacy policy), complete the **Play Console accessibility declaration**, and submit a **demo video** covering the consent and non-consent flows. API use for autonomous planning/action is prohibited for non-tools. [VERIFIED]
2. **Google Play — isMonitoringTool** ([article](https://support.google.com/googleplay/android-developer/answer/12955211?hl=en)): applies to apps monitoring *another individual*. A self-monitoring app is not clearly in scope; the page does not say. → Uncertain; do not declare monitoring of others; do not ship any parent/child mode without re-review. [VERIFIED page content; scope ASSUMPTION]
3. **Apple — Family Controls entitlement** ([config](https://developer.apple.com/documentation/xcode/configuring-family-controls), [framework](https://developer.apple.com/documentation/familycontrols)): development entitlement is self-serve; **distribution (TestFlight/App Store) requires a request to Apple** via the [Family Controls distribution form](https://developer.apple.com/contact/request/family-controls-distribution), **submitted separately for the app and each Screen Time extension**. Individual authorization requires device-owner approval with biometrics. [VERIFIED]
4. **Apple — DeviceActivity** ([framework](https://developer.apple.com/documentation/deviceactivity)): schedule- and threshold-based monitoring in an extension; reports rendered by a DeviceActivityReport extension "in a privacy-preserving way". Nothing exposes in-app content (individual videos). [VERIFIED]
5. **Apple — extension memory**: developers report a ~**6 MB** memory ceiling on DeviceActivityMonitor extensions, with an open Feedback and no Apple confirmation (Apr–Jun 2026) [SECONDARY]. Design rule: extensions are stateless and tiny.
6. **Billing**: Play subscriptions must be verified server-side and `linkedPurchaseToken` invalidated on upgrade/downgrade; RTDN informs state changes ([Google guide](https://developers.google.com/chromeos/app-development/publish/play-billing-backend)). StoreKit 2 verification via App Store Server API + Server Notifications V2 [ASSUMPTION on exact endpoints — to verify against Apple docs in Phase 5].

---

## 5. Threat model & privacy risks (headline)
Full: `THREAT_MODEL.md`, `PRIVACY_AND_DATA_RETENTION.md`.
Top risks: (1) accessibility data over-collection → mitigated by in-process classification that keeps only a counter-grade event (package, surface class, item fingerprint hash), never text/trees; (2) cross-user access → owner-scoped keys derived from JWT `sub` only; (3) subscription forgery → server-verified entitlements only; (4) leaderboard score inflation → server-side plausibility caps, "unverified" labels, and friends-only scope; (5) incomplete deletion → tombstone + sweep job + deletion test.

## 6. DynamoDB access patterns & API contracts
See `ARCHITECTURE.md` §5–6.

## 7. Implementation plan
See `IMPLEMENTATION_PLAN.md` (dependency-ordered checklist, acceptance criteria, risks per phase).

## 8. Acceptance criteria and go/no-go decisions
| Gate | Decision point | Go condition | No-go fallback |
|---|---|---|---|
| **G-1** | End of Phase 0 | Owner approves architecture and the iOS scope reduction | Revise docs |
| **G-2** | Android accessibility PoC (Phase 2) | ≥ 95% precision and ≥ 90% recall on a labelled session set for each supported app version, duplicate rate ≤ 1% | Drop per-video counts for that app; ship "time in short-video surface" or app-level time only, labelled honestly |
| **G-3** | Play policy fit | Disclosure + declaration drafted; core use explainable in the demo video | Ship Android without AccessibilityService (UsageStats time + app-level limits via own blocking screen only) |
| **G-4** | Apple Family Controls distribution entitlement | Approved for app and all extensions | iOS ships tracking-free shell or is delayed; no TestFlight with Screen Time features |
| **G-5** | iOS social data source | Written confirmation path (DTS/App Review) that the chosen shared metric is permissible | iOS users join challenges only with **self-reported** check-ins or Android-only competitive leaderboards; never upload Screen Time data |
| **G-6** | Billing | Server verification + lifecycle tests pass in sandbox | Pro hidden; free tier only |

## 9. Files to be created or modified in Phase 1
```
package.json, pnpm-workspace.yaml, turbo.json, tsconfig.base.json, .nvmrc, .editorconfig,
.gitignore, .gitattributes, .npmrc, eslint.config.mjs, .prettierrc, LICENSE (owner to choose),
README.md, SECURITY.md, CODEOWNERS
.github/workflows/ci.yml            # lint, typecheck, unit tests, CDK synth, gitleaks
.github/workflows/android.yml       # Gradle unit tests + debug build (Android SDK on runner)
.github/workflows/ios.yml           # macOS runner: xcodebuild build + Swift tests (dev entitlement)
.github/dependabot.yml
packages/contracts/{package.json,src/index.ts,src/v1/*.ts,test/*.test.ts}
packages/domain/{package.json,src/{dates,view-rules,streaks,brain}.ts,test/*}
packages/design-tokens/{package.json,src/tokens.ts}
apps/mobile/{app.config.ts,eas.json,package.json,index.ts,tsconfig.json}
apps/mobile/src/{app/,ui/,features/onboarding,features/auth,db/,api/,i18n/}
apps/mobile/src/db/{schema.ts,migrations/0001_init.sql,repository.ts}
apps/mobile/modules/tracking-android/   # Expo module scaffold only (no tracking logic until Phase 2)
apps/mobile/modules/screentime-ios/     # Expo module scaffold only
apps/mobile/plugins/withIosScreenTimeTargets.ts  # config plugin for extension targets (skeleton)
services/api/{package.json,src/{handlers,modules,lib}/*,test/*}
services/api/src/lib/{auth.ts,ddb.ts,idempotency.ts,errors.ts,validation.ts}
infra/{package.json,bin/app.ts,lib/{api-stack,data-stack,auth-stack,ops-stack}.ts,test/*}
docs/*  (updated: DECISIONS, IMPLEMENTATION_PLAN checklist, TEST_PLAN results)
```

## 10. Summary

**Verified**
- No existing repository or prior work; local repo created; GitHub creation blocked by an invalid session token.
- Toolchain: Node/Java/Docker present; no Android SDK, no Xcode, no AWS credentials.
- Google Play accessibility rules (disclosure, declaration, video, non-tool status).
- Apple Family Controls distribution entitlement process, including per-extension requests.
- Apple DeviceActivity exposes time/threshold/schedule data only; no per-video data.
- Expo SDK 57 (2026-06-30) and SDK 58 (2026-10-15) release facts.

**Uncertain**
- Whether AccessibilityService can classify Reels/Shorts reliably on current Instagram/YouTube builds (Phase 2 PoC).
- Whether Play reviewers accept accessibility use for counting + blocking in this app (G-3; approval never guaranteed).
- Whether any iOS-derived metric may be shared socially (G-5); current evidence says Screen Time data cannot be exported.
- Real DeviceActivityMonitor memory limit and threshold-event reliability (forum reports only).
- Apple entitlement approval timeline.

**Exact next step (after your review)**
1. Create the GitHub repository yourself (or reconnect GitHub so I can): e.g. `gh repo create driftless --private`, then I push `main`.
2. Approve or amend D-001…D-012 in `DECISIONS.md`, especially the iOS scope reduction (D-006) and the social-data rule (D-009).
3. Submit the Apple Family Controls distribution request early — it gates iOS TestFlight.
4. Phase 1 begins with the monorepo scaffold and `packages/contracts` (items P1-01 → P1-04 in `IMPLEMENTATION_PLAN.md`).
