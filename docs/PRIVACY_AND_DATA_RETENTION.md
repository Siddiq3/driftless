# Privacy & Data Retention

Status: [PROPOSED] · 2026-10-18

## 1. Data inventory

| Data | Where | Leaves device? | Retention | Purpose |
|---|---|---|---|---|
| Accessibility node data | Service memory only | **Never** | Retained only for temporary detection processing | Classification |
| Item fingerprints (salted hash) | Native DB `rings` table, last 8 per app | Never | Overwritten continuously; ignored after 30 min; daily salt | Dedup across service restarts |
| Count events | Native DB | Not in normal backup; explicit debug export only | Older than 30 days purged on service connection | Recompute aggregates, debugging (local) |
| Debug exports (event ids/times; structure captures with view ids, classes, hierarchy and state flags; no raw text/descriptions) | App cache, shared only by the developer's explicit action | Only if the developer shares the file | Until app cache is cleared | Accuracy study (native export/capture execution restricted to debug builds) |
| Usage Access minutes (foreground time of the six supported apps) | Native DB `daily.usage_ms` | Only as part of daily aggregates, with consent | Daily rows until wiped | Minutes even without the accessibility service |
| Daily aggregates | Native DB + DynamoDB if sync on | With sign-in backup consent; `personalViews` records private daily totals, while competitive `views` remains accuracy-gated | Device: until wiped; cloud: 400 days (DynamoDB TTL) | History, multi-device, challenges |
| Meme selection history (language-specific reaction IDs and caption indices) | Native driftless_tracking SharedPreferences | Not in normal account backup | Until cleared/reset | Avoid repeated meme reactions; raw content-language hint is transient |
| iOS Screen Time data | Apple's report sandbox | **Never** | Apple-controlled | Display |
| Profile (handle, display name, tz) | DynamoDB | Yes (account) | Until deletion | Social |
| Email (Cognito) | Cognito | Yes | Until deletion | Sign-in |
| Push tokens | DynamoDB (hash) + SNS endpoint | Yes | 180 days idle | Notifications |
| Purchase tokens | DynamoDB (hash + encrypted raw) | Yes | Subscription life + 2 years (tax/refund) [ASSUMPTION — legal review] | Entitlement |
| Logs | CloudWatch | — | 30 days, PII-redacted | Operations |

## 2. Consent model
1. **Accessibility disclosure** (Android): dedicated full-screen disclosure before the system Settings intent, version 3 states supported apps, temporary interface/event processing, local viewing records and diagnostics, and signed-in backup including daily coverage; buttons "Agree" / "Not now". "Not now" leaves the app usable with time-only tracking.
2. **Account backup** is included when the user signs in, with disclosure on the sign-in screen. Guests remain local. Signing out stops automatic account backup; there is no separate backup switch. **Sharing with friends/challenges** remains a separate choice.
3. No app-managed accessibility crash-report upload was found. Firebase Messaging and other SDK practices require release-specific verification; do not infer analytics or crash collection from library presence alone.

## 3. User rights
Export (JSON) · delete account (server: ≤ 30 days including sweeper; Cognito immediate) · wipe local data · revoke accessibility / Screen Time at any time with in-app instructions.

## 4. Backups
PITR keeps deleted items recoverable for up to 35 days — disclosed in the privacy policy. On-demand backups expire after 90 days; deletion requests honoured on restore via a `DELETED_USERS` replay list.

## 5. Store forms (prepare in Phase 7)
Google Play Data safety form; Accessibility declaration; App Store privacy nutrition labels; Family Controls entitlement justification; privacy manifest (`PrivacyInfo.xcprivacy`) incl. required-reason API codes (e.g. UserDefaults CA92.1).

## Accessibility diagnostics clarification — 2026-10-30

Heartbeats, tracking coverage, stored item identifiers and per-event version fields were removed.
Disclosure version 3 covers temporary interface/event processing, local activity records and
signed-in daily totals. See [Data Safety recommendation](release/DATA_SAFETY_RECOMMENDATION.md)
for the verified field inventory and remaining release-specific checks. The earlier proposed
account/provider retention entries above are not evidence of deployed infrastructure.
