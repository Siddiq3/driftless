# Daily friend comparisons

Circle compares synced recorded video counts for the selected local date. Sign in with Google,
allow sharing with friends, then use **Sync and refresh counts**. Account backup starts automatically after sign-in and has no separate switch. The existing
Friends controls manage invitations and requests; Scroll Battles remain a separate challenge flow. Google account names become display names automatically (mailbox name is a fallback when Google provides no name). A unique internal handle is allocated through the existing conditional profile API; the user does not choose one before inviting. The War personal row, account header and friends lists prefer display names.

Invite opens a bottom sheet with a copyable installed-app link, WhatsApp, Instagram and More. WhatsApp opens its text-sharing flow or falls back to Android sharing when unavailable. Instagram copies the link and opens the app so the user can paste it into a message; the app does not silently send a DM. More opens the system share sheet. These actions run only after the user taps them. Invites use `driftless://friends?invite=CODE`; there is no configured public web join domain or deferred-install linking. The recipient needs ScrollSnooze installed, or can enter the code in Friends. Opening a link prefills the code; adding/accepting remains explicit. Friend sharing is not enabled by naming a profile or generating an invite.

The app reads `GET /v1/friends/daily?date=YYYY-MM-DD`. Only accepted friends are included. Friends
with sharing or cloud backup off have a **Sharing off** label; missing counts display
a dash, including when a request fails. A real recorded zero displays `0`. Friend rows with recorded
counts appear lowest first. Your own row reads the shared personal-data repository, as Home, History, Stats and Recap do. It never substitutes a competitive server score for the personal count. The account cache can include restored recorded totals from other devices. Friend comparisons and reel-count challenges now prefer these recorded totals after explicit sharing consent. A count still awaiting upload can temporarily differ from its server comparison.

The backend sums device aggregates for a local date only when every retained, submitted device row
has a recorded `personalViews` count, or a legacy `views` count with at least 80% tracking coverage. The recorded field takes precedence rather than being added to the legacy field. Repeated uploads for one source device/date remain one revisioned row. It cannot detect a device that has
never submitted data. Counts are device-reported, not independently attested. Dates follow each
phone's local calendar day, so friends in different time zones can be at different points in a day.
Server comparisons refresh on screen focus and every minute while active; the local count refreshes every ten seconds. The root backup coordinator uploads supported saved history within server retention; viewing an older date reads the corresponding local preview and existing cloud history.

Physical-device and staging verification remain pending. Recorded totals are used as reported by the device; this change does not certify counting accuracy or independently attest the data. Legacy uploads without `personalViews` retain their existing coverage fallback.
Facebook, Snapchat, Moj and ShareChat currently support **app minutes only**. Their video counters
remain pending inspection and testing of those apps on an Android device.

Release the backend endpoint and the updated shared contracts together with the app. Local
development uses the sibling contracts package; before a registry-based app release, publish a new
contracts version containing `FriendsDailyQuery` and `FriendsDailyResponse` and update the app's
dependency and lockfile to that version. No deployment or package publication is part of this change.

## Name and invitation update validation — 24 October 2026

312 app tests pass in 36 suites; TypeScript, targeted source ESLint and changed-file formatting pass. New coverage includes Google display-name selection, automatic unique handles, concurrent initialization, profile conflicts/cancellation, invite copy/share actions, late invite results after sign-out, and suppression of a delayed app-sharing fallback after sign-out. Backend source and authorization are unchanged. Native visual and installed-app sharing verification remain blocked by the emulator storage limitation; see `../design-qa.md`. No commit, merge or deployment was performed.

## Recorded counts in challenges — 24 October 2026

After authorizing personal count backup, the user also requested using those totals in challenges. Video challenge scores now average the shared recorded daily counts, and Circle uses the same source-selection rule. Existing membership/accepted-friend checks and cloud-sync/sharing consent remain mandatory. A missing count on one submitted device makes that day unavailable for video scoring; it is never coerced to zero. Expired aggregate rows are excluded. Minute challenges and minute-goal scoring are unchanged.

The UI labels these as “Recorded videos” and uses “No synced count yet” for unavailable friend counts. The wire status `eligible` remains for older-client compatibility; it means usable for the comparison, not accuracy certification. The prior personal-only-backup restriction is superseded by this user request. This source change is not deployed; API and app updates are required before live verification.
