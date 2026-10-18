# Decision Log

Status values: Proposed · Accepted · Superseded. All entries **Proposed** pending owner review (gate G-1).

| ID | Decision | Rationale | Status |
|---|---|---|---|
| D-001 | Working name "Driftless", mascot "Wick" (original) | Distinct identity unrelated to reference app; needs trademark/store-name search | Proposed |
| D-002 | pnpm + Turborepo monorepo | Shared contracts/domain across app and API | Proposed |
| D-003 | Cognito user pool (email + Sign in with Apple + Google) | Required AWS stack; JWT authorizer native to API Gateway HTTP API. Apple requires Sign in with Apple if other social logins are offered [ASSUMPTION — verify guideline 4.8 in Phase 1] | Proposed |
| D-004 | Expo SDK 57 / RN 0.86 for Phase 1; reassess SDK 58 (2026-10-15) after it stabilises | SDK 58 is 3 days old; iOS 27 SDK scene-lifecycle requirement handled in 58 by default — plan upgrade before store submission | Proposed |
| D-005 | Single DynamoDB table + one GSI; on-demand; PITR | Access patterns known; low cost at small scale | Proposed |
| D-006 | **iOS does not offer per-video counts**; minutes/limits/shields only | Apple APIs don't expose it (S6) | Proposed |
| D-007 | Transition = pager event + novel fingerprint vs ring buffer + dwell ≥ 1.5 s; UNIQUE event_id | Avoids debounce-only dedup | Proposed |
| D-008 | Native Kotlin store (Room) is source of truth; JS reads via module | Works with JS runtime dead | Proposed |
| D-009 | **No Screen Time–derived data leaves an iOS device** unless Apple confirms otherwise (G-5) | Apple engineer statement (S7) | Proposed |
| D-010 | 18+ only for v1; no child/parent mode | Avoids monitoring-of-others policies (S2) and child-data regimes | Proposed |
| D-011 | Leaderboards are friends-only and prize-free | Scores are not tamper-proof | Proposed |
| D-012 | No third-party analytics SDKs in v1 | Data minimisation | Proposed |
| D-013 | Android blocking uses the app's own dismissible pause screen, never system overlays | Play deceptive-behaviour risk; user control | Proposed |
| D-014 | Push via Amazon SNS platform endpoints (FCM + APNs) | Stays on AWS; avoids extra vendor | Proposed |
