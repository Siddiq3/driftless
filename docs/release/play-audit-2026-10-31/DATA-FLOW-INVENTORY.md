# Data-flow inventory and Data safety evidence matrix

"Collect" means sent off device, per /answer/10787469. **Draft for the developer: not final Play answers.**

| Data | How obtained | Purpose | Local | Off device | Shared | Retention | Deletion, control | Draft Data safety |
|---|---|---|---|---|---|---|---|---|
| Google ID (opaque), token claims | Google Sign-In | Account | Session | Yes, AWS | No | Until deletion | In-app, web | Personal info: User IDs; optional |
| Display name / email-derived fallback | Google claims per policy; exact use of email UNVERIFIED | Presentation | Cache | Yes | Friends, invite page | Until deletion | Same | Name; Email UNVERIFIED |
| Handle | User | Friends | Cache | Yes | Friends | Until deletion | Same | Other user-generated content or IDs (owner's call) |
| Random device ID | Generated | Keep phone totals apart | Yes | After sign-in | No | With account | Same | Device or other IDs |
| Timezone | Device | Local day | Yes | After sign-in | No | With account | Same | App activity or other (classify) |
| Daily and per-app counts, minutes | Accessibility, Usage Access | Backup, limits | Yes | After sign-in | Friends if enabled | Up to 400 days | Same | App activity: App interactions |
| Goals | User | Limits | Yes | After sign-in | No | With account | Same | App activity |
| Timestamped viewing events | Accessibility | Hourly chart, wrap | About 30 days | **No** | No | Purged on service connect | Reset | Not collected |
| Raw text, descriptions, view IDs | Accessibility | Detection, in memory | **No** | **No** | No | In memory | Disable service | Not collected (on-device) |
| Salted item codes | Derived | Duplicate check | In memory | No | No | In memory | - | Not collected |
| Setup answers | User | Onboarding | Yes | No | No | Until reset | Reset | Not collected |
| Meme history | App | Rotation | Yes | No | No | Until reset | Reset | Not collected |
| Push token | Expo/FCM if available | Registered from `accountBackup.ts:62`; expected to fail without Firebase | No | UNVERIFIED | No | Device record | Deletion | UNVERIFIED |
| Friend and battle data | User | Social | Cache | Yes | Participants | Until removal | Deletion | App activity / other |
| Server request logs | Lambda | Operation | - | Yes | AWS (provider) | 30 days (config) | Expiry | App info: Diagnostics (owner's call) |
| IP address | Network, AWS, Vercel | Transport | - | Provider handling; app log excludes | Providers | Provider terms UNVERIFIED | - | UNVERIFIED |
| Crash data | None in app | - | - | No SDK | - | - | - | Not collected (confirm on AAB) |
| Support email | User sends | Support | - | User's mail app | - | As needed | Request | User-initiated; decide |
| Install referrer | Play, on device | Open invite | Secure storage | Invite code on join | No | Until used | Reset | Decide |

## Providers

Amazon Web Services (API, DynamoDB, logs), Google (Sign-In, Play), Vercel (website). Service-provider exception needs the owner's review of terms.

## Unverified Data safety fields

Encryption in transit (HTTPS by code; confirm), email collection, push token, IP handling, Firebase behaviour on the final AAB, sharing classification for friend scores, deletion-practice questions.
