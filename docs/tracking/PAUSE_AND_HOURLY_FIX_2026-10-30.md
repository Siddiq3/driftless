# Account pauses and historical hourly activity

The account allowance path previously ran before the App pauses master switch, selected-app check, and per-rule opt-in. Merely signing in and saving a goal could therefore launch the account reconnect activity. Account reservations also used chunks of ten videos or five minutes, even though the JavaScript synchronization worker only runs while ScrollSnooze is foregrounded.

The accessibility service and pause activity now share `AccountUsage.shouldPause`. It requires enabled App pauses, a selected package, feature access, the configured feed scope, and an applicable enabled rule. View allowances require video-goal enforcement; minute allowances require a configured minute limit. Turning pauses off also dismisses an existing account pause on its next refresh. Accounting, backup, deduplication, and usage totals continue independently. Status checks with no applicable limits do not demand credit or a verified clock.

Foreground synchronization requests the entire unallocated day balance instead of a ten-view/five-minute chunk. The backend still atomically caps reservations, including concurrent requests and credit already held by other devices. Frozen request IDs and payloads remain unchanged on retries. This deliberately makes credit available for a whole feed session; the first device can hold the remaining allowance until the account day ends. It does not transfer credit already held by another device or raise the daily goal.

Progress previously compared hourly records from this phone with merged account totals. Additional restored or other-device counts made that comparison fail, hiding otherwise complete local bars. Daily hours now reconcile against supported-app local totals while the summary keeps its existing account measurement. The chart identifies its source as “Hourly activity on this phone.” Missing, malformed, or incomplete local records remain unavailable. Daily totals restored without raw hourly events cannot be redistributed into invented hours. Raw events still expire after 30 days.

Regression coverage includes yesterday's local hours alongside larger account totals, restored-only days without local events, full remaining reservations, partial/exhausted allocations, disabled pauses, unselected apps, view-rule opt-out, feed-only scope, and unlimited metrics after midnight/reboot. Existing accounting and idempotency tests remain in place.

## Validation

- Full app Jest suite: 514 tests passed across 61 suites.
- Full Android tracking unit suite: 218 tests passed, including account status, service recovery, pause activity reuse, and disabling pauses while the account pause is open.
- TypeScript, Expo lint, changed-file Prettier checks, and `git diff --check`: passed.
- Native tracking production and test code compiled successfully.
- A full debug APK build was attempted but stopped when the Mac ran out of disk space after rebuilding a corrupted Gradle transform cache. The disposable cache backup created for that repair was removed, recovering about 4 GB; native tests subsequently passed. No APK was installed and no device data was changed. The native changes require a rebuilt Android app, not a JavaScript reload.
- Native test log: `/private/tmp/scrollsnooze-pause-stats-tests.log`.
