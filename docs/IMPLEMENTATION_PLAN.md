# Implementation Plan & Checklist

Dependency-ordered. `→` = depends on. Each phase ends with: run tests, builds, static checks, diff review, record results in `TEST_PLAN.md`, update this file. Status: ☐ todo · ◐ in progress · ☑ done.

## Phase 0 — Audit, feasibility, architecture ☑ (awaiting review — gate G-1)
- ☑ P0-01 Repository/environment audit
- ☑ P0-02 Official policy research (S1–S11)
- ☑ P0-03 Docs set
- ☐ P0-04 Owner review & approval of DECISIONS.md
- ◐ P0-05 GitHub repository — session cannot create repos (HTTP 403); owner to create `Siddiq3/driftless` (empty), then push
- ◐ P0-06 Apple Family Controls distribution request — draft ready in APPLE_FAMILY_CONTROLS_REQUEST.md; owner to submit

## Phase 1 — Foundations
| ID | Task | Depends | Acceptance |
|---|---|---|---|
| P1-01 | Monorepo scaffold (pnpm, turbo, TS, eslint, prettier) | P0-04 | `pnpm lint typecheck test` green in CI |
| P1-02 | `packages/contracts` v1 zod schemas + OpenAPI generation | P1-01 | Contract unit tests for valid/invalid payloads, size limits |
| P1-03 | `packages/domain`: local-date, streak, goal eval | P1-01 | 100% branch coverage on date/tz edge cases |
| P1-04 | CI: lint/test/synth/gitleaks + Android & iOS build jobs | P1-01, P0-05 | All jobs run on PR |
| P1-05 | CDK stacks: auth (Cognito), data (table+GSI1+PITR+TTL), api (HTTP API + JWT authorizer), ops (alarms) | P1-01 | `cdk synth` + snapshot/assertion tests; **no deploy** |
| P1-06 | API skeleton: auth middleware, validation, idempotency, problem+json, `GET/PATCH /v1/me` | P1-02, P1-05 | Integration tests on DynamoDB Local incl. cross-user denial |
| P1-07 | Expo app (SDK 57) with dev client, expo-router, design tokens, sign-in screens | P1-01 | Dev build compiles on CI for both platforms |
| P1-08 | Mobile local DB (expo-sqlite) + migration framework + sync outbox table | P1-07 | Migration tests |
| P1-09 | Native module scaffolds (no logic) + iOS extension targets via config plugin | P1-07 | Builds with dev entitlement on macOS runner |
Risks: Expo/RN native-module churn; config-plugin complexity for 4 iOS extension targets.

## Phase 2 — Native proofs of concept (gates G-2, G-3, G-5)
| ID | Task | Depends | Acceptance |
|---|---|---|---|
| P2-01 | Android AccessibilityService PoC, Instagram + YouTube, classifier in memory | P1-09 | Runs on ≥ 3 devices / 2 Android versions |
| P2-02 | Labelled session harness: screen-record ground truth (developer device only, never shipped) vs engine log | P2-01 | ≥ 30 labelled sessions/app incl. all fixture scenarios |
| P2-03 | Accuracy report: precision/recall/duplicate rate per app version | P2-02 | Meets G-2 or scope revised |
| P2-04 | iOS PoC: auth, picker, schedule, threshold event, shield, report ext | P1-09 | Working on physical iPhone; memory measured in Instruments |
| P2-05 | Apple guidance on social metric (DTS/App Review) | P0-06 | Decision recorded for G-5 |
| P2-06 | Capability matrix updated with measured results | P2-03, P2-04 | Docs reflect evidence only |
Risks: **highest risk phase** — reliability may be insufficient; plan time for scope revision.

## Phase 3 — Local-first tracking & sync
P3-01 Production event pipeline + transactional aggregates (→ P2-03) · P3-02 Health/coverage & gap UI (→ P3-01) · P3-03 iOS App Group status flags (→ P2-04) · P3-04 `POST /v1/usage/sync` with rev + idempotency (→ P1-06) · P3-05 Outbox retry/backoff (→ P3-04) · P3-06 History API & screens (→ P3-04).
Acceptance: totals identical before/after restart, reboot, offline week, duplicate sync.

## Phase 4 — Engagement
P4-01 Goals UI/API · P4-02 Wick progression (original Lottie/Reanimated assets) · P4-03 Statistics · P4-04 Local reminders · P4-05 Streaks/achievements. All driven by real aggregates (→ Phase 3).

## Phase 5 — Restrictions & billing (gate G-6)
P5-01 Android pause-screen blocking + schedules · P5-02 iOS shields + schedules · P5-03 Recovery (permission loss, entitlement lapse ⇒ restrictions safely cleared, tracking continues) · P5-04 Play Billing client + `/billing/play/verify` + RTDN · P5-05 StoreKit 2 + App Store Server API + notifications · P5-06 Reconciliation job · P5-07 Restore purchases.
Acceptance: blocking works in airplane mode; refund/revoke removes Pro within one notification cycle.

## Phase 6 — Social
P6-01 Handles & invites · P6-02 Friend requests · P6-03 Challenges · P6-04 Leaderboard snapshot job · P6-05 Push via SNS · P6-06 Anti-abuse (rate limits, plausibility, reporting/blocking users).

## Phase 7 — Hardening & release
Security review, pen-test checklist, privacy review, device matrix, closed testing (Play internal/closed track, TestFlight), store listings, Data safety / privacy labels, accessibility declaration video, runbooks (backup restore, incident, deletion).
