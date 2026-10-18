# Privacy & Data Retention

Status: [PROPOSED] · 2026-10-18

## 1. Data inventory

| Data | Where | Leaves device? | Retention | Purpose |
|---|---|---|---|---|
| Accessibility node data | Service memory only | **Never** | Discarded within the callback | Classification |
| Item fingerprints (salted hash) | Native DB | Never | 30 days, salt rotated daily | Dedup |
| Count events | Native DB | Never | 30 days | Recompute aggregates, debugging (local) |
| Coverage/heartbeat intervals | Native DB | Never (only coverage ratio) | 30 days | Data quality |
| Daily aggregates | Native DB + DynamoDB if sync on | With consent | Device: until wiped; cloud: 400 days default | History, multi-device, challenges |
| iOS Screen Time data | Apple's report sandbox | **Never** | Apple-controlled | Display |
| Profile (handle, display name, tz) | DynamoDB | Yes (account) | Until deletion | Social |
| Email (Cognito) | Cognito | Yes | Until deletion | Sign-in |
| Push tokens | DynamoDB (hash) + SNS endpoint | Yes | 180 days idle | Notifications |
| Purchase tokens | DynamoDB (hash + encrypted raw) | Yes | Subscription life + 2 years (tax/refund) [ASSUMPTION — legal review] | Entitlement |
| Logs | CloudWatch | — | 30 days, PII-redacted | Operations |

## 2. Consent model
1. **Accessibility disclosure** (Android): dedicated full-screen disclosure before the system Settings intent, stating: which apps are read, that only counts are kept, that nothing leaves the device unless sync is on; buttons "Agree" / "Not now". "Not now" leaves the app usable with time-only tracking.
2. **Cloud sync** off until the user creates an account and enables it. Separate toggle for **sharing with friends/challenges**.
3. Analytics SDKs: none in v1 (D-012). Crash reporting opt-in, scrubbed.

## 3. User rights
Export (JSON) · delete account (server: ≤ 30 days including sweeper; Cognito immediate) · wipe local data · revoke accessibility / Screen Time at any time with in-app instructions.

## 4. Backups
PITR keeps deleted items recoverable for up to 35 days — disclosed in the privacy policy. On-demand backups expire after 90 days; deletion requests honoured on restore via a `DELETED_USERS` replay list.

## 5. Store forms (prepare in Phase 7)
Google Play Data safety form; Accessibility declaration; App Store privacy nutrition labels; Family Controls entitlement justification; privacy manifest (`PrivacyInfo.xcprivacy`) incl. required-reason API codes (e.g. UserDefaults CA92.1).
