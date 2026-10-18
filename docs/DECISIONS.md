# Decision Log

Status values: Proposed · Accepted · Superseded. Owner review completed 2026-10-18 (gate G-1 passed).

| ID | Decision | Rationale | Status |
|---|---|---|---|
| D-001 | Working name "Driftless", mascot "Wick" (original) | Distinct identity unrelated to reference app; needs trademark/store-name search | Accepted 2026-10-18 |
| D-002 | pnpm + Turborepo monorepo | Shared contracts/domain across app and API | Superseded by D-016 (2026-10-18) |
| D-003 | Cognito user pool (email + Sign in with Apple + Google) | Required AWS stack; JWT authorizer native to API Gateway HTTP API. Apple requires Sign in with Apple if other social logins are offered [ASSUMPTION — verify guideline 4.8 in Phase 1] | Accepted 2026-10-18 |
| D-004 | Expo SDK 57 / RN 0.86 for Phase 1; reassess SDK 58 (2026-10-15) after it stabilises | SDK 58 is 3 days old; iOS 27 SDK scene-lifecycle requirement handled in 58 by default — plan upgrade before store submission | Accepted 2026-10-18 |
| D-005 | Single DynamoDB table + one GSI; on-demand; PITR | Access patterns known; low cost at small scale | Accepted 2026-10-18 |
| D-006 | **iOS does not offer per-video counts**; minutes/limits/shields only — applies when iOS work resumes | Apple APIs don't expose it (S6) | Accepted 2026-10-18; iOS delivery deferred by D-015 |
| D-007 | Transition = pager event + novel fingerprint vs ring buffer + dwell ≥ 1.5 s; UNIQUE event_id | Avoids debounce-only dedup | Accepted 2026-10-18 |
| D-008 | Native Kotlin store (Room) is source of truth; JS reads via module | Works with JS runtime dead | Accepted 2026-10-18 |
| D-009 | **No Screen Time–derived data ever leaves an iOS device.** iOS users join challenges via self-reported check-ins only; G-5 closed | Apple engineer statement (S7); owner chose "never share" | Accepted 2026-10-18 |
| D-010 | 18+ only for v1; no child/parent mode | Avoids monitoring-of-others policies (S2) and child-data regimes | Accepted 2026-10-18 |
| D-011 | Leaderboards are friends-only and prize-free | Scores are not tamper-proof | Accepted 2026-10-18 |
| D-012 | No third-party analytics SDKs in v1 | Data minimisation | Accepted 2026-10-18 |
| D-013 | Android blocking uses the app's own dismissible pause screen, never system overlays | Play deceptive-behaviour risk; user control | Accepted 2026-10-18 |
| D-014 | Push via Amazon SNS platform endpoints (FCM + APNs) | Stays on AWS; avoids extra vendor | Accepted 2026-10-18 |
| D-015 | **Android first; iOS delayed.** Phases 1–7 deliver Android + backend. Shared TS code, contracts and backend stay platform-neutral (`platform` enum keeps `ios`) so iOS can be added later without schema changes. iOS native module, extension targets, StoreKit 2 and the Family Controls request are deferred | Owner decision 2026-10-18 | Accepted 2026-10-18 |
| D-016 | **Two repositories.** `Siddiq3/driftless` = Android app (Expo, Kotlin module, design tokens) + all product docs. `Siddiq3/driftless-backend` = Lambda API, CDK infra, and `@siddiq3/driftless-contracts` (zod v1 schemas + `./domain` logic), published to GitHub Packages automatically when its version is bumped on main (CI tags `contracts-v<version>`). The app pins an exact contracts version; API changes ship backend-first, then the app bumps the version | Owner preference for a frontend/backend split (SaaS-style); one package keeps cross-repo access to a single grant | Accepted 2026-10-18 |
