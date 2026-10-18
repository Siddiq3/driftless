# Threat Model — Driftless

Method: STRIDE per asset/flow. Status: [PROPOSED] · 2026-10-18

## Assets
A1 on-device observations & events · A2 daily aggregates (local + cloud) · A3 identity tokens · A4 entitlements & purchase tokens · A5 social graph & challenge scores · A6 push tokens · A7 AWS infrastructure & secrets (store API keys, signing keys).

## Trust boundaries
Device ↔ API Gateway · API ↔ DynamoDB · Store servers ↔ webhooks · App ↔ iOS extensions (App Group) · Accessibility service ↔ third-party app UI.

## Threats and mitigations

| ID | Threat | STRIDE | Mitigation | Verification |
|---|---|---|---|---|
| T1 | Cross-user data access (IDOR) | I/E | Owner key derived only from JWT `sub`; no client-supplied user IDs on private routes; challenge/friend reads check membership/relationship in the same query | Authorization test suite: every route × foreign user → 403/404 |
| T2 | Token theft / leakage | S/I | Cognito short-lived access tokens (≤ 60 min), refresh token in Keychain / Android Keystore-backed EncryptedSharedPreferences via `expo-secure-store`; never logged; TLS only; log redaction middleware | Log scan test; static grep in CI |
| T3 | Replay / duplicate requests | T | `Idempotency-Key` + request hash; aggregate `rev` monotonic with conditional writes | Contract tests replaying requests |
| T4 | Local data exposure (rooted device, backups) | I | Native DB excluded from cloud backup (`android:allowBackup=false` / `dataExtractionRules`; iOS file protection `completeUntilFirstUserAuthentication`); only hashes for item fingerprints | Manual + config tests |
| T5 | Subscription manipulation | T/E | Pro only from server-verified store state; `linkedPurchaseToken` invalidation; webhook signature verification (Play OIDC push token, App Store JWS chain); periodic reconciliation | Billing lifecycle tests with sandbox fixtures |
| T6 | Challenge score inflation | T | Scores derived from synced aggregates only; plausibility caps; coverage required ≥ 0.8 to rank; scores from tracking-unavailable days excluded; "verified by device engine" vs self-reported labels; friends-only challenges in v1 | Abuse tests |
| T7 | Excessive data collection | I | Accessibility service filtered to supported packages; in-memory node inspection only; no text, screenshots, trees persisted or transmitted; privacy review gate each phase | Code review checklist + test asserting DB schema lacks text columns |
| T8 | Notification token abuse / spam | D | Push tokens hashed for lookup; per-user device cap (10); rate-limited social actions; no user-generated free text in push payloads | Rate limit tests |
| T9 | Incomplete account deletion | I | Deletion job enumerates `USER#sub`, GSI1 memberships, purchases, handle, devices/SNS endpoints, Cognito user; idempotent sweeper via EventBridge; backups expire by PITR window (documented) | Deletion integration test asserts zero residual items |
| T10 | Malicious App Group / extension input | T | Validate decodes; never overwrite a non-empty blocklist with an empty decode result | Swift unit test |
| T11 | Accessibility misuse perception / policy breach | Repudiation/Compliance | Prominent disclosure + consent; scope documented in Play declaration; no automation beyond deterministic pause screen | Store-prep checklist |
| T12 | Abuse of friend discovery (enumeration) | I | Handle search exact-match only, rate-limited; invite codes random 10+ chars, expiring | Tests |
| T13 | Secrets in repo/CI | I | gitleaks in CI; AWS via GitHub OIDC role, no long-lived keys; store keys in Secrets Manager | CI check |
| T14 | Lockout (user can't use device) | Safety | Blocking always dismissible via OS (disable service / revoke Screen Time); in-app "emergency unlock"; restrictions cleared on uninstall/revoke | Device tests |

## Residual risks
- Play/App Review rejection (business risk, not mitigable by code).
- Rooted/jailbroken users can fake aggregates → leaderboards are social, not prize-bearing (no cash/prizes, D-011).
