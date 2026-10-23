# Privacy & Data Retention

Status: [PROPOSED] · source corrections 2026-10-23. This is an implementation inventory and proposed policy, not a legal or production certification.

## 1. Data inventory

| Data | Where | Leaves device? | Retention | Purpose |
|---|---|---|---|---|
| Accessibility node data | Service memory only | **Never** | Discarded within the callback | Classification |
| Item fingerprints (salted hash) | Native DB `rings` table, last 8 per app | Never | Overwritten continuously; ignored after 30 min; daily salt | Dedup across service restarts |
| Count events | Native DB | Never | 30 days | Recompute aggregates, debugging (local) |
| Coverage heartbeats (one row per active minute) | Native DB | Never (only coverage ratio) | 30 days | Data quality |
| Event exports (ids, package, timestamps) and structure captures (view ids/classes, no text) | App cache; explicit share action | Only if shared | Until app cache is cleared | Accuracy study; structure capture is debug-gated, event export is not restricted by that gate |
| Usage Access minutes (foreground time of Instagram/YouTube only) | Native DB `daily.usage_ms` | Only as part of daily aggregates, with consent | Daily rows until wiped | Minutes even without the accessibility service |
| Daily aggregates | Native DB + DynamoDB if sync on | With consent; `views` only for accuracy-validated app versions, else null | Device: until wiped; cloud: 400 days (DynamoDB TTL) | History, multi-device, challenges |
| iOS Screen Time data | Apple's report sandbox | **Never** | Apple-controlled | Display |
| Profile (handle, display name, tz) | DynamoDB | Yes (account) | Until deletion | Social |
| Google sign-in identity | Google SDK; backend derives UUID from verified subject | Google ID token goes to API Gateway; backend profile does not store email | Google identity is controlled by Google; app preference/owner markers use SecureStore | Sign-in; no current Cognito identity pool |
| Push tokens | DynamoDB raw delivery token plus SHA-256 hash; no SNS endpoint creation in current handler | Yes | 180-day idle TTL; physical TTL deletion is asynchronous | Notifications |
| Purchase tokens | DynamoDB hashed key + raw token, encrypted at rest by the table | Yes | No purchase TTL currently implemented. Proposed subscription life + 2 years requires policy review and cleanup implementation | Entitlement/refunds |
| Logs | CloudWatch | — | 30 days, PII-redacted | Operations |

## 2. Consent model
1. **Accessibility disclosure** (Android): dedicated full-screen disclosure before the system Settings intent, stating: which apps are read, that only counts are kept, that nothing leaves the device unless sync is on; buttons "Agree" / "Not now". "Not now" leaves the app usable with time-only tracking.
2. **Cloud sync** off until the user creates an account and enables it. Separate toggle for **sharing with friends/challenges**.
3. Analytics SDKs: none in v1 (D-012). Crash reporting opt-in, scrubbed.

## 3. User rights
Export (JSON) · request account deletion · wipe local data · revoke accessibility permissions. Current Google disconnect revokes this app's grant and signs out; it does not delete the user's Google account. The current release configuration enables Android only.

Deletion runs in the API request; there is no deletion sweeper in the current scheduled handler. The audit patch refuses completion when batch deletes remain unprocessed and leaves the job retryable by the client. Full deletion under concurrent writes, historical purchase owner cleanup, invite cleanup and account-scoped device storage remain unverified or unimplemented. Do not advertise a verified deletion deadline or account-isolation guarantee until these release blockers are resolved. See `GUEST_DATA_MIGRATION.md` and the security/API audit report.

## 4. Backups
The source template enables DynamoDB PITR. Deleted items can remain recoverable in its recovery window; deployed settings and the actual window have not been checked by this audit. A 90-day on-demand backup lifecycle and `DELETED_USERS` restore replay are proposed controls, not implemented in the current template/handlers. Restore deletion enforcement needs a tested operator runbook before it is promised.

## 5. Store forms (prepare in Phase 7)
Google Play Data safety form; Accessibility declaration; App Store privacy nutrition labels; Family Controls entitlement justification; privacy manifest (`PrivacyInfo.xcprivacy`) incl. required-reason API codes (e.g. UserDefaults CA92.1).
