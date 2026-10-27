# Local release-preparation validation

- App identity: ScrollSnooze; npm name `scrollsnooze`.
- Version: 1.0.0; Android version code 1.
- Package remains `com.siddiqkolimi.scrollsnooze`. Expo slug is now `scrollsnooze`; primary
  scheme is `scrollsnooze://`, with `driftless://` retained for existing links.
  This naming change follows the unsigned review build; regenerate native projects before
  the final EAS build.
- Generated merged release manifest: minimum SDK 24, target SDK 36.
- All 412 app tests passed (47 suites); TypeScript and changed production-code lint passed.
- Release-signing transform regression test passed; repeated prebuild is idempotent.
- Android prebuild and unsigned release AAB compilation passed.
- Review AAB SHA-256: `fe2d30438a657223c9a5bfdc7025f482d04f80d82bd0079c27907217f9e8843c`.
- Review AAB has no signing block. It cannot be uploaded to Google Play.
- 50 bundled arm64-v8a/x86_64 native libraries passed 16 KB ELF load-segment checks.
  This does not prove generated APK ZIP alignment or physical 16 KB runtime behavior.
- No upload keystore was created. No EAS cloud build, store upload or deployment was started.
- EAS production profile uses remote credentials and an Android app bundle.

The unsigned review build ran before the npm rename/EAS signing adjustment. It has the
release JS/native source and version 1.0.0, but is only a local compilation diagnostic.
The final EAS signed artifact must be built and inspected again after owner-managed keys
and production environment setup. Physical-device accuracy, Play-installed OAuth, privacy
hosting and Console declarations remain release gates; see `../ANDROID_RELEASE.md`.
