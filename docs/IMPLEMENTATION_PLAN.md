# Implementation Plan & Checklist

Dependency-ordered. `→` = depends on. Each phase ends with: run tests, builds, static checks, diff review, record results in `TEST_PLAN.md`, update this file. Status: ☐ todo · ◐ in progress · ☑ done.

## Phase 0 — Audit, feasibility, architecture ☑ (gate G-1 passed 2026-10-18)

> **Scope (D-015):** Android + backend first. Items marked *(iOS — deferred)* are parked until the owner resumes iOS.
- ☑ P0-01 Repository/environment audit
- ☑ P0-02 Official policy research (S1–S11)
- ☑ P0-03 Docs set
- ☑ P0-04 Owner review & approval of DECISIONS.md (2026-10-18)
- ◐ P0-05 GitHub repository — session cannot create repos (HTTP 403); owner to create `Siddiq3/driftless` (empty), then push
- ⏸ P0-06 Apple Family Controls distribution request *(iOS — deferred)* — draft kept in APPLE_FAMILY_CONTROLS_REQUEST.md

## Phase 1 — Foundations ◐

Status from CI run 39133222400 (commit e5fb168, single repo, 2026-10-18); re-verified after the split (P1-10).

| ID | Task | Depends | Acceptance | Status |
|---|---|---|---|---|
| P1-01 | Repo scaffold (pnpm, TS, eslint, prettier) | P0-04 | lint/typecheck/test green in CI | ◐ backend green (run 39134202260); app re-verification pending |
| P1-02 | Contracts: v1 zod schemas + OpenAPI | P1-01 | Contract tests for valid/invalid payloads, size limits | ☑ 33 tests passed |
| P1-03 | Domain: local-date, streaks, goals, Wick, reference view rule | P1-01 | 100% branch coverage on date/tz edge cases | ◐ 41 tests passed; branches 96.8% (lines/functions 100%) — target not yet met |
| P1-04 | CI: lint/test/synth/gitleaks + Android build | P1-01, P0-05 | All jobs run on push/PR | ◐ runs; logs published to `ci-results` |
| P1-05 | CDK: Cognito, table+GSI1+PITR+TTL, HTTP API + JWT authorizer, alarms | P1-01 | Assertion tests + `cdk synth`; **no deploy** | ☑ 8 tests passed; synth passes (backend run 39134202260) |
| P1-06 | API: auth, validation, idempotency, problem+json, `GET/PATCH /v1/me` | P1-02, P1-05 | DynamoDB Local tests incl. cross-user denial | ☑ 31 tests passed |
| P1-07 | Expo SDK 57 app: dev client, expo-router, sign-in, design tokens | P1-01 | Android debug build on CI | ◐ APK built (93.8 MB); dep versions, typecheck, lint being fixed |
| P1-08 | Local DB (expo-sqlite) migrations + outbox | P1-07 | Migration tests | ☑ part of 15 passing app tests |
| P1-09 | Android native module scaffold; iOS *(deferred)* | P1-07 | Android build passes | ☑ compiled in APK |
| P1-10 | Split into app + backend repos (D-016); publish contracts 0.1.0 | P1-01…09 | Both repos green; app installs published package | ◐ backend done, contracts 0.1.0 published; app push pending |

Not yet verified end-to-end: sign-in against a real Cognito pool (nothing deployed), app running on a device.
Risks: Expo/RN native-module churn; GitHub Packages access for app CI (owner must grant the app repo read access).

## Phase 2 — Native proofs of concept (gates G-2, G-3, G-5)
| ID | Task | Depends | Acceptance |
|---|---|---|---|
| P2-01 | Android AccessibilityService PoC, Instagram + YouTube, classifier in memory | P1-09 | Runs on ≥ 3 devices / 2 Android versions |
| P2-02 | Labelled session harness: screen-record ground truth (developer device only, never shipped) vs engine log | P2-01 | ≥ 30 labelled sessions/app incl. all fixture scenarios |
| P2-03 | Accuracy report: precision/recall/duplicate rate per app version | P2-02 | Meets G-2 or scope revised |
| ⏸ P2-04 | iOS PoC: auth, picker, schedule, threshold event, shield, report ext | P1-09 | Working on physical iPhone; memory measured in Instruments |
| ⏸ P2-05 | Apple guidance on social metric (DTS/App Review) | P0-06 | Decision recorded for G-5 |
| P2-06 | Capability matrix updated with measured results | P2-03, P2-04 | Docs reflect evidence only |
Risks: **highest risk phase** — reliability may be insufficient; plan time for scope revision.

## Phase 3 — Local-first tracking & sync
P3-01 Production event pipeline + transactional aggregates (→ P2-03) · P3-02 Health/coverage & gap UI (→ P3-01) · P3-03 iOS App Group status flags *(iOS — deferred)* · P3-04 `POST /v1/usage/sync` with rev + idempotency (→ P1-06) · P3-05 Outbox retry/backoff (→ P3-04) · P3-06 History API & screens (→ P3-04).
Acceptance: totals identical before/after restart, reboot, offline week, duplicate sync.

## Phase 4 — Engagement
P4-01 Goals UI/API · P4-02 Wick progression (original Lottie/Reanimated assets) · P4-03 Statistics · P4-04 Local reminders · P4-05 Streaks/achievements. All driven by real aggregates (→ Phase 3).

## Phase 5 — Restrictions & billing (gate G-6)
P5-01 Android pause-screen blocking + schedules · P5-02 iOS shields + schedules *(iOS — deferred)* · P5-03 Recovery (permission loss, entitlement lapse ⇒ restrictions safely cleared, tracking continues) · P5-04 Play Billing client + `/billing/play/verify` + RTDN · P5-05 StoreKit 2 + App Store Server API + notifications *(iOS — deferred)* · P5-06 Reconciliation job · P5-07 Restore purchases.
Acceptance: blocking works in airplane mode; refund/revoke removes Pro within one notification cycle.

## Phase 6 — Social
P6-01 Handles & invites · P6-02 Friend requests · P6-03 Challenges · P6-04 Leaderboard snapshot job · P6-05 Push via SNS · P6-06 Anti-abuse (rate limits, plausibility, reporting/blocking users).

## Phase 7 — Hardening & release
Security review, pen-test checklist, privacy review, device matrix, closed testing (Play internal/closed track, TestFlight), store listings, Data safety / privacy labels, accessibility declaration video, runbooks (backup restore, incident, deletion).
