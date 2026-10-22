# Subscription-free release

As of 22 October 2026, all implemented features are included, including local Focus controls for guests and offline use. No subscription or Google Play purchase is required.

The release policy is explicit in three places:

- Mobile: `src/config/access.ts` (`SUBSCRIPTIONS_REQUIRED = false`).
- Native: `modules/tracking-android/android/src/main/java/app/driftless/tracking/core/FeatureAccess.kt`.
- API: `driftless-backend/services/api/src/modules/capabilities.ts`.

Native minute limits, schedules, video caps, timed breaks and bypasses use this policy. Real billing records and cached purchase expiry remain separate; no fake Pro entitlement is created. Signing out or receiving a free/expired entitlement does not remove included access. Focus still requires explicit enabled settings, selected apps and applicable permissions. Feed rules still require approved detection or the user's existing experimental option. Cloud consent and account ownership rules are unchanged.

Home, Progress, Focus and Settings no longer advertise paid access. Old `/pro` links redirect to Focus, new purchases are rejected by the mobile purchase helper, offer loading is disabled, and automatic purchase recovery is not mounted in the root layout. Existing billing code is retained for real purchase history and a possible future paid release.

This requires a new native APK; a JavaScript reload cannot unlock an older native build. New native health reports `subscriptionRequired: false`. The UI reports that an update is needed for older binaries rather than claiming their native subscription gate is gone. API capability changes must be deployed separately; they remove only subscription requirements and preserve rollout/accuracy flags. Unimplemented features do not become implemented through this policy.

Before subscriptions are reintroduced, review all three policy locations, the UI copy and purchase entry points together, and rerun free/guest, expired-account, offline, permission and native enforcement regression checks. Changing one flag alone is not a complete paid-release migration.
