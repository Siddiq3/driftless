# Interstitial ads: proposed integration, no SDK enabled

Status: design only, 21 October 2026. No ad code, dependency, ad unit, consent SDK,
configuration change or network request is included in this milestone.

## Eligibility

Default to no ads. Require an enabled build flag AND a fresh, supported remote policy,
completed onboarding, foreground app, an explicitly eligible free account, and the
chosen consent/age policy satisfied. Unknown, expired/stale entitlement information,
offline verification, pending purchase, account transition or unresolved restore means
no ad. Pro (including grace and cancelled-but-paid access) must never request, preload
or show an ad. Do not infer ad eligibility just because the local Pro cache expired.
Guests require a separately approved eligibility/age policy; keep guest ads off initially.

The current app has no ads, so do not advertise a new ad-free paid benefit until this
integration is actually enabled. Do not alter tracking or existing free history to create
an ad breakpoint.

## Candidate breakpoints and hard exclusions

Consider only a deliberate exit from a completed Wrapped recap to its in-app summary,
or an explicit return from an optional analytics detail to Progress. These are candidates,
not permission to add placements now. A user action must complete successfully first.
Show at most one ad per eligible transition; never trigger from polling, automatic
navigation, restored routes, Back gestures or timers alone.

Never show on launch/resume; onboarding; permission/disclosure screens; sign-in;
account deletion/export; purchase/restore; notifications; the floating brain or widget;
while any pause/break/blocking overlay is active; when leaving a blocked feed; or in a
third-party social app. Do not tie bypasses, protection, goal saves or break expiry to
watching an ad. No banners or overlay ads.

## Frequency policy (proposed defaults, requires approval)

- At least 15 minutes between impressions.
- Maximum two per app session and four per local calendar day.
- No impression in the first five minutes after app launch.
- Persist daily count and last impression time across process restarts.
- A backward clock/timezone change must not replenish the budget; enforce a rolling
  24-hour ceiling as well as the local-day ceiling. Clock uncertainty disables ads.
- Remote configuration may lower caps or disable ads immediately; increasing limits
  beyond build-time ceilings requires an app update/product review.

Count an impression only on the SDK's impression callback. Reserve a placement while
showing so duplicate callbacks or simultaneous navigation cannot launch a second ad.
Deduplicate callbacks by a placement instance ID; failed/no-fill loads consume no impression.

## Navigation and failures

Use a central coordinator with states disabled/ineligible/idle/loading/ready/showing.
Navigation never waits for a load. If no valid preloaded ad is ready at an eligible
breakpoint, continue immediately. Loading errors, timeouts, offline state, no-fill,
SDK initialization failures, dismissal and display failures must preserve the destination
and must not reopen the ad. Once a show is initiated, use completion/failure and foreground
reconciliation to release the reservation; never stack another navigation or ad.

Recheck eligibility immediately before show. Discard cached ads and cancel pending
placements on Pro activation, sign-out/account change, consent withdrawal, a kill switch,
backgrounding or entry into an excluded flow. Once the SDK is displaying, never cover it
with another app modal; queue only the user's intended navigation until dismissal.

## Consent, privacy and configuration

Choose a vendor/CMP and review its current policy and age requirements before implementation.
Do not request personalized ads without the applicable consent; refusal must preserve
all free app functionality. Where required consent is unavailable, skip ads rather than
blocking navigation. Consent reset/review belongs in Privacy. Do not send reel identities,
accessibility labels, content, friend relationships or raw usage events to the ad SDK.
Keep ad telemetry minimal: placement ID, outcome, policy version and aggregated frequency.
Do not log advertising identifiers or tokens. Update privacy/data-safety disclosures before
release, including vendor collection, retention, consent withdrawal and deletion behavior.

Use a local off-by-default build flag and a remote fail-closed kill switch with expiry.
Stale, malformed or missing remote policy disables ads. Keep test ad units confined to
test builds; production units require separate review. A kill switch must also prevent SDK
initialization/preloading, not merely hide the final display button.

## Acceptance tests before enabling

Test every exclusion above, including deep links and restored navigation. Test Pro activation
between preload and show; pending purchases; account swaps; expired/stale entitlement;
consent denial/withdrawal; no-fill; SDK failure; duplicate callbacks; repeated taps; background
and process death; rotation; clock/timezone changes; offline use and remote kill-switch expiry.
Assert navigation always reaches the intended destination, and free tracking/protection
never depends on an ad. Use vendor test units and staging accounts only.

## Decisions needed first

Approve vendor/CMP and age/region policy; exact placement(s); initial caps; guest eligibility;
server entitlement-freshness contract and remote-policy ownership; privacy disclosures;
and the rollout/rollback criteria. None of these decisions has been implemented here.
