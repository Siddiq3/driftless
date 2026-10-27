# ScrollSnooze Android release preparation

Release candidate: **1.0.0 (1)**. Npm package: `scrollsnooze`.
Android package: `com.siddiqkolimi.scrollsnooze`.
Support: **siddiqkolimi.dev@gmail.com**.

The first release is prepared from `main`. War/link-based invitation changes remain on
`feature/war-invite-flow` in both repositories; do not merge them for this release.
Existing generated APKs may include those feature changes. Rebuild from release source.
`android/` is generated and ignored; release configuration must survive Expo prebuild.

## Signing: the owner creates and manages the keys with Expo

No signing keys have been created by the assistant. No EAS cloud build or store submission
has been started. The configured production profile uses **remote EAS credentials** and
builds an **Android App Bundle**, not a development client.

Run the following yourself when ready:

```sh
cd /Users/siddiqkolimi/Documents/wellbeing/driftless
eas login
eas init
```

Link the correct Expo account/project. This app uses dynamic `app.config.ts`, so EAS may
ask you to add the returned `extra.eas.projectId` manually. Preserve that exact real ID;
do not invent a UUID. Create or link the Expo project with slug `scrollsnooze`. If you
already linked an older Expo project, update its slug in Expo before linking it here.
The app name is ScrollSnooze, the npm name is `scrollsnooze`, and the primary link scheme
is `scrollsnooze://`. The old `driftless://` scheme remains a compatibility alias for
existing links. The checkout directory is still named `driftless`, so the path above is correct.

Configure EAS **production environment** variables before building:

| Variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | Production HTTPS API origin, no `/v1` suffix |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | The backend's Google Web OAuth audience |

Public build variables ship in the app. Never place credentials in `EXPO_PUBLIC_*`.
The public build values are configured in `build.production.env` in `eas.json`.
The contracts package is bundled in `vendor/`; no GitHub token is required for installation.
Local ignored `.env` files are not automatically available on EAS workers.

Then create credentials and build **yourself**:

```sh
eas credentials --platform android
# Select the production profile and create/manage the Android upload keystore.
eas build --platform android --profile production
# Equivalent after Expo account/project setup:
pnpm release:android
```

Choose Expo's new-keystore generation when prompted if you do not have a key. Store a
secure backup using `eas credentials`; keep downloaded keystores and `credentials.json`
out of Git. Do not regenerate the key for each update. Enable Google Play App Signing
on the first upload. Download the resulting AAB from your EAS build page.

The release-signing config accepts EAS's injected signing configuration, or explicit
local `SCROLLSNOOZE_UPLOAD_*` variables. It rejects missing signing and the standard debug
keystore/alias for ordinary release tasks. Debug builds still work normally.

## Local compilation check without creating keys

```sh
pnpm release:android:review
```

This regenerates Android, compiles the production JS/native code and produces an
**UNSIGNED-REVIEW** AAB plus SHA-256 under ignored `output/release/`. It is **not uploadable**.
No keystore is generated. Default local release tasks fail without real upload credentials.
If independently using local signing later, see `scripts/release-android.mjs` for the four
environment variable names. The normal supported publication path is EAS.

## Before internal testing

- Confirm clean release source and increment `android.versionCode` for every uploaded replacement.
- Use production backend and OAuth settings; test backend account registration/deletion.
- Register Google Play's **app signing certificate SHA-1** with the Android OAuth client for
  this package; it differs from the upload key. Test Play-installed Google login.
- Inspect the final bundle's target SDK, permissions, certificate and native-library alignment.
- Test 16 KB native-library compatibility and inspect Play Console's bundle warnings.
- Test release startup without Metro, guest tracking, disclosure refusal, access revocation,
  minutes, pauses, reboot, offline operation, account switching, backup and deletion.
- Complete physical-device counting accuracy gate G-2. Empty `validatedVersions` remain empty
  until actual evidence passes; do not manufacture validation from automated tests.
- Host and review the privacy policy and external account-deletion page. These are drafts in
  `docs/release/`; no live URLs have been supplied or published.
- Record the accessibility disclosure/consent/settings demonstration video.
- Complete App access, Accessibility declaration, Data safety, audience, ads and content rating
  based on the release binary, not future features.

## Sources

- https://docs.expo.dev/build/setup/
- https://docs.expo.dev/app-signing/managed-credentials/
- https://docs.expo.dev/build-reference/android-builds/
- https://developer.android.com/studio/publish/app-signing
- https://support.google.com/googleplay/android-developer/answer/13327111
