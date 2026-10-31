# Accessibility V3 startup and disclosure routing

Date: 2026-10-30. This follow-up investigated the earlier wireless-device report and made
a narrow JavaScript routing correction. No installed app data was cleared, reset or uninstalled.
No device commands, AAB, deployment, Console changes, commit or push were performed in this task.

## Findings and evidence boundaries

The earlier device run was an upgrade, not a fresh install. It had completed onboarding,
accepted an older disclosure, and native health reported disclosureAccepted=false and
 disclosureRenewalRequired=true. This correctly blocked service operation. Home displayed
its intentionally manual permission banner; Allow opened the complete V3 disclosure.

That banner is an intended fallback, but is not the intended automatic renewal for an accepted
older disclosure. The previous FirstLaunchRedirect implementation attempted renewal while the
pathname was '/', immediately marked renewalShown=true, and pushed /disclosure. Meanwhile
app/index.tsx independently renders a Redirect replacing the active route with Home or Welcome.
Expo Router's local Redirect implementation performs router.replace from a focus effect.
Thus a competing startup navigation can displace renewal after the guard has already consumed
its one opportunity. The old component tests mocked router.push and never mounted Index, so
asserting a push did not prove the disclosure became visible.

This is a confirmed source defect (presentation was marked before route activation) and a
source-supported explanation for the reported symptom. No historical navigation trace was
captured, so it is not proven that this exact effect ordering caused that particular device
launch. Development-client task restoration, early native health failure, or another navigation
are alternatives that the earlier evidence does not eliminate. They must not be presented as
confirmed causes. New tests control route transitions; they do not execute Expo Router's actual
native navigator or reproduce historical phone state.

## Complete startup path inspected

- app/_layout.tsx: AppUpdateBoundary → StartupBoundary → AccountBoundary → OnboardingProvider
  → AccountBackupProvider, FirstLaunchRedirect, BattleInviteCoordinator and Stack.
- StartupBoundary prepares SQLite and waits for session restoration. AccountBoundary selects
  verified account scope/allowance before mounting child screens for a signed-in user.
- OnboardingProvider reads first_launch_setup_v1 from SQLite; missing data means no completed
  onboarding. Read errors have a visible retry path at Index rather than granting consent.
- app/index.tsx routes incomplete setup to /onboarding, otherwise /home or /welcome.
- FirstLaunchRedirect prevents unfinished setup bypass and offers old-consent renewal.
- SetupFlow's Android permission step uses PermissionChecklist; Allow/Review and help go to
  /disclosure, not directly to the guide or a permission grant. Skipping setup permissions is
  permitted and leaves tracking stopped.
- CountingPermissionBanner goes to /disclosure; Privacy retains a read-disclosure link.
- disclosure.tsx always renders the complete V3 content before its controls. Agreement records
  consent before showing the guided steps; Not now only goes back.
- The disclosure guide re-checks accepted current consent before opening Android settings.
  The native service independently checks current consent before observations.
- Privacy also exposes a direct Android Accessibility settings link for turning access off.
  It cannot authorize tracking without V3 consent, but is not a universal disclosure-first
  settings-navigation gate. If the requirement is that *every* Settings entry must first show
  disclosure, this existing management link is an additional product decision, not covered by
  the claim about the normal onboarding permission-request flow.
- BattleInviteCoordinator can independently navigate when a pending invitation is present; that
  path must be included in a native integration test because it is another navigation actor.

## Minimal correction implemented

Only FirstLaunchRedirect production source changed in this task:

1. When completed onboarding is at '/', leave the initial destination to Index.
2. Check renewal after the destination changes to Home/Welcome (or another non-privacy route).
3. Set renewalShown only when pathname actually becomes /disclosure, not when push is requested.
4. Preserve the same-launch decline escape, privacy/deletion access and current-V3 bypass.

No timers, persistent renewal flags, native consent changes, account-data changes, authentication,
tracking rules, billing, schemas or sync changes were added. A transient health exception still
fails closed for native tracking; automatic retry is currently dependent on a subsequent route
or onboarding-state change. The permission banner remains available.

## Seven independent scenario assessments

| Scenario | Verification in this task |
| --- | --- |
| Fresh install, no data | Source + controlled test: Index/guard sends it to onboarding. Permission-step Allow opens the full disclosure before guide/grant. Fresh install does not mean disclosure is the first screen; onboarding precedes it. A clean-device end-to-end run remains required. |
| Completed setup, accepted V2 | New tests verify no renewal push from '/', then automatic push on /home and /welcome. Native getter invalidates V2, so tracking cannot resume pending V3. Actual cold-start navigator timing remains a device test. |
| V3 already accepted | New launch/restart test verifies no renewal push. Native acceptance/version check remains unchanged. |
| Decline V3 | New test visits /disclosure then returns repeatedly to Home/Counter without a loop. Existing disclosure test verifies Not now never grants consent or opens the guide. Native gating retains stopped tracking. |
| Accept V3 | New route test verifies returning from disclosure does not reopen it; existing disclosure tests execute the handler and assert consent before guide, including failures. Earlier physical-device test observed actual Settings handoff. No new device test claimed. |
| Restart after decline | New test unmounts/remounts the guard, keeps renewal needed, and verifies another automatic offer after Index settles. This is not an OS process-restart test. Native old consent remains invalid. Fresh users with no prior acceptance retain manual banner access. |
| Restart after acceptance | New remount test retains current acceptance and verifies no renewal. Native preferences are persistent and the service schedules only with current consent; a new physical restart/readiness check remains pending. |

## Executed validation

`npm test -- --runInBand`: 63 suites, 549 tests passed.
`npm run typecheck`: passed.
Prettier for the two changed TypeScript files: passed.
`git diff --check`: passed in app and website.
No native suite rerun: this task changed no Kotlin code.
Log: /private/tmp/scrollsnooze-renewal-routing-jest.log.

Expanded disclosure-renewal tests independently cover Home/Welcome startup settlement,
displaced/failed pushes, decline without loops, restart after decline, current acceptance,
acceptance return from Settings, fresh-install onboarding, manual fallback and privacy access.
These use mocked route state and native health; they are not navigator integration tests.

## Recommended next test: isolated emulator, original phone untouched

Use a dedicated empty Android emulator with the same debug package installed there; a separate
emulator avoids changing package/signing configuration or touching the user's phone. Do not
uninstall or clear the existing physical-device installation.

1. On the empty emulator, cold-launch via launcher (not an /disclosure deep link). Follow guest
   onboarding to the permission step. Before Allow, verify OS access is off and native consent
   false; tap Allow, scroll all five sections, decline, restart, revisit from banner. Then accept
   and verify actual Settings handoff and saved V3 acceptance.
2. On that disposable emulator only, create completed guest onboarding with accepted V2 native
   preference fixture while the app is stopped. Do not write account records or grant V3 through
   the fixture. Cold-launch via launcher and capture the actual route sequence: '/' → /welcome
   → /disclosure. Assert serviceRunning=false until affirmative V3 acceptance.
3. Repeat with a signed-in test account if available: '/' → /home → /disclosure. Include slow
   restoration and a pending invitation to expose competing redirects. Never use the existing
   user's account data for destructive setup.
4. Decline, browse app, force-stop/relaunch emulator app; verify no within-launch loop and a new
   offer on restart. Accept, force-stop/relaunch; verify no renewal and valid tracking readiness.
5. Record the exact modified bundle/build and emulator screenshots. A development result does
   not replace later Play-installed signed-release review evidence.

## Files changed by this task

- src/onboarding/FirstLaunchRedirect.tsx
- test/disclosure-renewal.test.tsx
- docs/release/ACCESSIBILITY_V3_STARTUP_ROUTING.md (this report)

Other V3 edits already present in the workspace were preserved. Website retains its pre-existing
Privacy.jsx edit; backend is clean. No commits or staged changes were created.
