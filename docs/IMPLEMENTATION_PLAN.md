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

## Phase 1 — Foundations ☑

Completed 2026-10-18. Final verification: backend run 39134202260 (113 tests, synth, gitleaks), app run 39135897288 at 31abd89 (format, expo check/doctor, typecheck, lint, 37 tests, Android build).

| ID | Task | Depends | Acceptance | Status |
|---|---|---|---|---|
| P1-01 | Repo scaffold (pnpm, TS, eslint, prettier) | P0-04 | lint/typecheck/test green in CI | ☑ both repos green |
| P1-02 | Contracts: v1 zod schemas + OpenAPI | P1-01 | Contract tests for valid/invalid payloads, size limits | ☑ 33 tests passed |
| P1-03 | Domain: local-date, streaks, goals, Wick, reference view rule | P1-01 | 100% branch coverage on date/tz edge cases | ◐ 41 tests passed; branches 96.8% (lines/functions 100%) — target not yet met |
| P1-04 | CI: lint/test/synth/gitleaks + Android build | P1-01, P0-05 | All jobs run on push/PR | ☑ runs on push/PR; logs published to `ci-results` |
| P1-05 | CDK: Cognito, table+GSI1+PITR+TTL, HTTP API + JWT authorizer, alarms | P1-01 | Assertion tests + `cdk synth`; **no deploy** | ☑ 8 tests passed; synth passes (backend run 39134202260) |
| P1-06 | API: auth, validation, idempotency, problem+json, `GET/PATCH /v1/me` | P1-02, P1-05 | DynamoDB Local tests incl. cross-user denial | ☑ 31 tests passed |
| P1-07 | Expo SDK 57 app: dev client, expo-router, sign-in, design tokens | P1-01 | Android debug build on CI | ☑ APK built; typecheck/lint/doctor green |
| P1-08 | Local DB (expo-sqlite) migrations + outbox | P1-07 | Migration tests | ☑ part of 15 passing app tests |
| P1-09 | Android native module scaffold; iOS *(deferred)* | P1-07 | Android build passes | ☑ compiled in APK |
| P1-10 | Split into app + backend repos (D-016); publish contracts 0.1.0 | P1-01…09 | Both repos green; app installs published package | ☑ contracts 0.1.0 published; app consumes it |

Not yet verified end-to-end: sign-in against a real Cognito pool (nothing deployed), app running on a device.
Risks: Expo/RN native-module churn; GitHub Packages access for app CI (owner must grant the app repo read access).

## Phase 2 — Android tracking proof of concept ◐ (gate G-2 open) · iOS items deferred (D-015)
| ID | Task | Status |
|---|---|---|
| P2-01 | AccessibilityService PoC (Instagram + YouTube): classifier, engine, SQLite store, health, JS bridge, Play prominent disclosure | ◐ implemented; 39 Kotlin unit tests pass (see TEST_PLAN); APK build fix pushed; **not yet run on a device** |
| P2-02 | Labelled-session harness: event export, structure capture, label format, scorer | ☑ scorer + 10 tests pass locally; protocol in `docs/ACCURACY_PROTOCOL.md` |
| P2-03 | Accuracy report per app version (G-2) | ☐ **needs the owner's phone** — ≥ 30 labelled sessions per app |
| ⏸ P2-04 | iOS PoC | deferred |
| ⏸ P2-05 | Apple social-metric guidance | closed by D-009 |
| P2-06 | Capability matrix updated with measured results | ◐ updated with implementation status; measured accuracy pending P2-03 |
Risks: bundled selectors are unvalidated guesses (structure capture exists to correct them); Advanced Protection users cannot use counting at all; target apps change UI often.

## Phase 3 — Local-first tracking, sync, history ◐
| ID | Task | Status |
|---|---|---|
| P3-01 | Production event pipeline + transactional aggregates | ☑ (Phase 2 engine + SQLite store) |
| P3-02 | Health/coverage & gap UI | ◐ coverage from heartbeats; "Not tracked" gaps in History |
| P3-03 | iOS App Group flags | ⏸ deferred |
| P3-04 | `POST /v1/usage/sync`, `GET /v1/usage/history` (backend) | ☑ 12 integration tests, backend run green |
| P3-05 | App sync: per-day rev, frozen batches with stable Idempotency-Key, backoff, permanent-error handling | ◐ written + unit tests (54 Jest tests pass in run for 4039c75); typecheck fix pushed |
| P3-06 | History screen (local, 14 days) | ◐ written; CI pending |
| P3-07 | Minutes via Android Usage Access (works without the accessibility service) | ☑ native + 9 Kotlin tests; APK builds |
Acceptance still open: totals identical across restart/reboot/offline on a real device; end-to-end sync against a deployed backend (nothing deployed yet).

## Phase 4 — Engagement ◐
| ID | Task | Status |
|---|---|---|
| P4-01 | Goals: local-first (migration 3) + server backup `GET/PUT /v1/goals` (contracts 0.2.0) | ◐ backend ☑ (5 tests, published 0.2.0); app written, CI pending |
| P4-02 | Wick: original animated mascot (RN Animated, reduce-motion aware), 6 stages | ◐ written; CI pending |
| P4-03 | Stats: 7/30-day bars, honest gaps, goal line | ◐ written; 30-day Pro gating deferred to Phase 5 with billing |
| P4-04 | Reminders: 9 pm check-in (expo-notifications); native 80%/100% goal alerts from the service | ◐ written; LimitAlerts Kotlin tests added |
| P4-05 | Streaks & milestones from real outcomes only | ◐ written + Jest tests |
Rule: video-count goals unlock only for accuracy-validated app versions; days without data are "not tracked", never 0.

## Phase 5 — Restrictions & billing (gate G-6)
P5-01 Android pause-screen blocking + schedules · P5-02 iOS shields + schedules *(iOS — deferred)* · P5-03 Recovery (permission loss, entitlement lapse ⇒ restrictions safely cleared, tracking continues) · P5-04 Play Billing client + `/billing/play/verify` + RTDN · P5-05 StoreKit 2 + App Store Server API + notifications *(iOS — deferred)* · P5-06 Reconciliation job · P5-07 Restore purchases.
Acceptance: blocking works in airplane mode; refund/revoke removes Pro within one notification cycle.

## Phase 6 — Social
P6-01 Handles & invites · P6-02 Friend requests · P6-03 Challenges · P6-04 Leaderboard snapshot job · P6-05 Push via SNS · P6-06 Anti-abuse (rate limits, plausibility, reporting/blocking users).

## Phase 7 — Hardening & release
Security review, pen-test checklist, privacy review, device matrix, closed testing (Play internal/closed track, TestFlight), store listings, Data safety / privacy labels, accessibility declaration video, runbooks (backup restore, incident, deletion).
