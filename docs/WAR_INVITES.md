# Link-based War invitations

War now shows one daily ranking of accepted battle friends. The previous Challenges screen
redirects to War. Invite opens explicit score-sharing disclosure, creates a seven-day link,
and opens native sharing only when requested. The recipient previews the invitation and
chooses Accept Battle or Later. Acceptance creates reciprocal friendship and a separate
battle-sharing grant; it does not change global friend sharing. Removing the friend ends
battle visibility. Historical totals before acceptance stay unavailable.

The backend serves `/join/{code}` publicly with an inviter name, app link, download buttons (no visible invite code). Google Play defaults to
`https://play.google.com/store/apps/details?id=com.siddiqkolimi.scrollsnooze&hl=en_IN`.
That listing is not published yet; the link becomes usable after publication. App Store
downloads say coming soon until its URL is configured. All
account APIs remain JWT/incarnation protected. Existing challenge APIs remain compatible.

App build: optional `EXPO_PUBLIC_JOIN_BASE_URL` (HTTPS origin), defaults to `https://scrollsnooze.vercel.app`. Deploy the matching backend before distributing this app. Backend optional
variables: `PLAY_STORE_URL`, `APP_STORE_URL`, `ANDROID_SIGNING_SHA256` (comma-separated
release certificate fingerprints), `APPLE_TEAM_ID`. Association files remain empty until
real signing identities are configured. A custom domain must route `/join/*` and
`/.well-known/*` to this backend and match the app's configured join origin.

Android Play installs receive `battle_invite` via Install Referrer. The pending code is
stored through setup/sign-in, never auto-accepted, and dismissed referrals are fenced
against late attribution replies. The new native module requires rebuilding the app.
Existing installations use the deep link on the webpage or verified HTTPS App Links
once configured. iPhone uses Universal Links when configured; after a new App Store
install, reopen the invitation. No automatic iOS deferred-link guarantee.

Validation: app Jest suite, backend DynamoDB integration suite, shared contract tests,
TypeScript, production-source lint, Serverless packaging/template checks, Android debug
build and iOS JS export. War, Friends list, delete sheet and acceptance were inspected
on an Android emulator with isolated demo data; the landing page was inspected in Chrome.
No live two-account/store install attribution or iOS native build was performed.

## Production domain update

Vercel routes `/join/:code` to the AWS join page. Set its `ANDROID_SIGNING_SHA256` to
the Play app-signing certificate fingerprint and redeploy. `APPLE_TEAM_ID` enables iOS
association. The app build uses `EXPO_PUBLIC_JOIN_BASE_URL=https://scrollsnooze.vercel.app`
and includes a `/join/[code]` route for verified HTTPS app openings. The primary webpage
flow uses Open ScrollSnooze or download, never a visible invitation code.

Local verification: 405 app tests, 225 API integration tests and website association/config
tests passed. Actual installed-app domain verification and Play install attribution require
a signed rebuilt app, the signing association, deployed backend and real Play test install.
The previously live API returned API Gateway Not Found for the join route.
