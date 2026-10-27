# Required Google Play updates

Play-installed, non-debug Android builds check Google Play before opening the app, when returning to the foreground, and once a minute while active. A newer version offered to that user's account/device creates a device-wide persisted version requirement. The app shows its branded, non-dismissable update screen until Android reports that the installed version code reaches that requirement.

The primary action starts Google's immediate in-app update flow. If that flow is unavailable, it opens this app's Google Play listing, with an HTTPS listing fallback. Cancelling, opening the listing, accepting the update dialog, or a network failure never proves installation and never clears a known requirement. Back, deep links, guest mode, and account changes do not bypass the root boundary. Home and Android system navigation remain available.

An initial Play check times out after eight seconds. Without a previously detected requirement, a failed or offline check permits normal use and checks again later. A known requirement remains blocking offline. Debug/sideloaded Android builds, older native builds without the module, and iOS do not use this Android Play gate.

## Releasing

- Publish a build containing this integration first. Previously installed builds without this integration cannot show the new screen retroactively.
- Increase `android.versionCode` in `app.config.ts` for every Play release. It is currently managed locally (`eas.json` uses `appVersionSource: local`); the release script does not increment it.
- Google Play determines availability, including rollout and device/account eligibility. Uploading an unpublished or ineligible build does not trigger the gate.
- The app's intro screen uses a dedicated four-frame ScrollSnooze updating mascot and existing app controls; the mascot pauses in the background and respects reduced motion. Google's download/installation confirmation UI is owned by Google Play.

## Verify before production rollout

Automated tests cover unavailable/current/newer builds, persistence across restarts, monotonic requirements, installation-based clearing, unsupported installs, Back blocking, double taps, cancellation, store fallback result handling, offline checks, foreground refresh, and late responses.

For the real store transaction, use Google Play internal app sharing or a test track with the same application ID and signing identity:

1. Install build N containing this integration through Google Play using an eligible tester account.
2. Make build N+1 available to that account. For internal app sharing, open its sharing link without installing it yet.
3. Open build N. Confirm the branded screen appears and neither Back nor cancelling Google's update allows navigation. Kill/reopen the app and repeat offline after the first successful availability check.
4. Tap Update on Google Play, complete installation, and reopen. Confirm the updated build opens normally and existing data is retained.
5. Check a tester outside a staged rollout: no unavailable-update gate should appear.

References: [Google Play update integration](https://developer.android.com/guide/playcore/in-app-updates/kotlin-java), [Google Play update testing](https://developer.android.com/guide/playcore/in-app-updates/test).
