# Direct Google sign-in

Google is the only account login provider. The Android app uses the native Google account picker, and the API accepts Google-issued ID tokens directly. Guest tracking and guest app invitations still work without signing in.

This replaces the earlier Cognito/Hosted UI/federation design in D-003 and older architecture/UI notes. There is no Cognito user pool, hosted login domain, client secret, OAuth browser redirect, email/password login, or Firebase Authentication dependency in the current implementation.

## Configure Google and the app

1. Create a Google Cloud OAuth consent screen and a **Web application OAuth client ID** for the backend audience.
2. In the same project, create an **Android OAuth client** for package `com.siddiqkolimi.scrollsnooze` with the signing certificate SHA-1. Register each certificate actually used: debug, release, and Google Play App Signing where applicable. Use `cd android && ./gradlew signingReport` to inspect local fingerprints.
3. Set these public build variables:

   ```dotenv
   EXPO_PUBLIC_API_URL=https://your-api.execute-api.ap-south-1.amazonaws.com
   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
   ```

   Use the Web client ID here, not the Android client ID. No client secret goes in the app. No Cognito variables or Google enable flag are used.
4. Rebuild the custom Android client after installing dependencies: `pnpm android`. Expo Go and existing binaries without the new native module cannot run Google login; they continue to support guest mode.

The Android-only integration is linked automatically by React Native/Expo autolinking. It does not need a Firebase `google-services.json` or the package's Firebase/iOS config plugin. iOS is not enabled by this app.

## Configure the API infrastructure

The API Gateway JWT authorizer issuer is `https://accounts.google.com`; its sole audience is the same Web OAuth client ID used by the app. Set CDK context `googleWebClientIdDev` / `googleWebClientIdProd`, or supply the required `GoogleWebClientId` stack parameter when deploying. The Lambda receives that value as `GOOGLE_WEB_CLIENT_ID` and rejects missing or mismatched audiences. Only the signed Google Play webhook retains its separate authentication path.

Code, local synth tests and native compilation were changed here. No Google project was created, cloud credentials read, live login performed, or infrastructure deployed.

## Account name and invitations

The app uses the Google account's display name, falling back to the mailbox name before `@` when no name is available. It saves that presentation name through the existing authenticated profile API. A unique handle is allocated internally so new users can invite friends immediately without a handle form. Name/email never establishes account ownership. Invites use the existing authenticated endpoint; no automatic friend-sharing consent or unsolicited message is sent. See `SOCIAL_COMPARISONS.md` for share targets and installed-app link limitations.

## Sessions and data ownership

The native SDK handles Google credentials and silent renewal. JavaScript asks for a current **ID token**, never a Google API access token, when calling Driftless. SecureStore holds only a stay-signed-in marker; prior Cognito tokens under `driftless.tokens.v1` are removed. A sign-out invalidates pending token results and disables automatic restoration. Missing credentials, cancellation and unavailable Google Play Services never create a signed-in session.

API Gateway verifies signature, issuer, audience and expiry before forwarding claims. The API also checks the configured audience, issuer, subject and token times. A stable, app-namespaced UUIDv5 derived from Google's opaque `sub` preserves the existing UUID-based friend/billing contracts; email is never an ownership key. Keep this namespace unchanged.

Existing Cognito account IDs differ from these Google-derived IDs. This change does not automatically link accounts or migrate cloud history by email. If existing Cognito users have production data, migrate their verified identities/data before changing production authentication. Local guest data is retained. Sign-in includes automatic account backup of saved goals and supported daily history; the sign-in UI explains this before login. Friend sharing remains a separate choice. See `PERSONAL_DATA_ARCHITECTURE.md` for scoped storage, restoration, retention and validation limits.

Deleting an account deletes Driftless cloud data and relationships. The app then revokes its Google grant and signs out; it does not delete the person's Google account. The delete endpoint requires a Google credential issued within five minutes using verified `iat`. Google ID tokens do not provide Cognito `auth_time`; this gate proves credential freshness, not a password/MFA challenge or recent interactive presence. If it rejects an older cached credential, sign out and sign in again.

## Validation

- App TypeScript and lint passed; 116 Jest tests passed, including interactive/silent Google identity handling, cancellation, missing ID token, unavailable Play Services, guest restoration, sign-out races, concurrent renewal and disconnect.
- Android prebuild and Google sign-in module compilation passed; native autolinking includes `RNGoogleSigninPackage`.
- Android Hermes export passed with the direct Google SDK included.
- API TypeScript and all 100 tests passed against isolated in-memory DynamoDB Local, including account deletion, ownership isolation, sync, billing, friends and Google claim/UUID validation.
- Infrastructure TypeScript and all 11 synth tests passed, including the Google-only authorizer and absence of Cognito resources/IAM grants.
- A real Google account-picker/login round trip still needs configured OAuth client IDs, signing certificates and a rebuilt device app connected to the updated backend.

References: [Expo Google authentication](https://docs.expo.dev/guides/google-authentication/), [native Google sign-in SDK API](https://react-native-google-signin.github.io/docs/original), [Google backend authentication](https://developers.google.com/identity/sign-in/android/backend-auth), [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect).

## ScrollSnooze package identity

The Android application ID is now `com.siddiqkolimi.scrollsnooze`. Register an Android OAuth client for this package and each signing SHA-1 before testing sign-in; an OAuth client registered only for the former package will not authorize the new app. The Web client ID and backend token audience can remain the same when using the same Google Cloud project.

Android treats this as a separate application from the former `com.siddiqkolimi.driftless`. Existing installs cannot be upgraded in place under the new ID, and their private local database, permissions and sign-in state do not transfer automatically. Do not uninstall the old app if its local data is still needed. Use the new package for the Play Console listing and any future Play API configuration; the backend `PLAY_PACKAGE_NAME` default and deployment environment have been updated accordingly. Rebuild the native Android app after this change.
