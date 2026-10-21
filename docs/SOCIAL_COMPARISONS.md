# Daily friend comparisons

Circle compares synced eligible video counts for the selected local date. Sign in with Google,
enable cloud backup and sharing with friends, then use **Sync and refresh counts**. The existing
Friends controls manage invitations and requests; Scroll Battles remain a separate challenge flow.

The app reads `GET /v1/friends/daily?date=YYYY-MM-DD`. Only accepted friends are included. Friends
with sharing or cloud backup off have a **Sharing off** label; missing or ineligible counts display
a dash, including when a request fails. A real eligible zero displays `0`. Friend rows with eligible
counts appear lowest first. Your own comparison number uses the same cloud eligibility rules;
guests see their local estimate separately.

The backend sums device aggregates for a local date only when every retained, submitted device row
has a non-null video count and at least 80% tracking coverage. It cannot detect a device that has
never submitted data. Counts are device-reported, not independently attested. Dates follow each
phone's local calendar day, so friends in different time zones can be at different points in a day.
Counts refresh on screen focus and every minute while active. Sync uploads the last seven local
days; viewing an older date reads existing cloud history.

Physical-device and staging verification remain pending. Installed app versions still need to pass
the accuracy gate before their video counts become eligible; empty approval lists are preserved.
Facebook, Snapchat, Moj and ShareChat currently support **app minutes only**. Their video counters
remain pending inspection and testing of those apps on an Android device.

Release the backend endpoint and the updated shared contracts together with the app. Local
development uses the sibling contracts package; before a registry-based app release, publish a new
contracts version containing `FriendsDailyQuery` and `FriendsDailyResponse` and update the app's
dependency and lockfile to that version. No deployment or package publication is part of this change.
