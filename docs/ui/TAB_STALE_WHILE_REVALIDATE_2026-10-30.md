# Home and War stale-while-revalidate

## Causes

Home's `useProgress` reset its entire state to loading on every storage notification. Component remounts also discarded the previously derived screen snapshot, even when the local personal-data cache still held activity. A refresh error replaced valid content with the error screen.

War seeded its view only from the 15-second *fresh request* cache. Expired entries were deleted, so a remounted tab had no immediate display result. It also cleared previously fetched results on some failed refreshes. Cancellation of a War tab's first subscriber could fail the shared transport for the next subscriber during rapid navigation.

## Changes

- `src/goals/useProgress.ts`: retain bounded, in-memory display snapshots across Home remounts. Keys include storage scope, authentication generation, native reset generation, date and hook parameters. Initial loading, refreshing and latest error are separate; valid content survives refresh errors. Saved goals still reload. The existing ten-second personal activity cache, historical sample reuse, native limit mirroring and widget refresh remain in place. Concurrent identical local reads join a shared promise. Scope/storage revisions and per-hook generations fence outdated completions. Focus cleanup removes observers, polling and AppState listeners.
- `src/ui/Focus.tsx`: show a small refresh-error notice above retained content instead of replacing it.
- `src/api/client.ts`: retain at most 32 successful War display snapshots separately from the existing freshness cache. Stale display reads do not extend the 15-second TTL, suppress required refreshes, or make new requests. They are keyed by credential getter, URL, credential generation, incarnation and date. Existing write invalidation still invalidates fresh reads; prior display results can remain while revalidation runs. War GET transport survives individual tab blur while each subscriber separately checks cancellation. Identity changes still cancel transport/access, and read revisions prevent an older request from replacing newer results. Non-War network behavior is unchanged.
- `src/social/CircleBoard.tsx`: use the retained War snapshot immediately, keep prior results during failed refreshes, and distinguish initial loading from background work. Existing 60-second focused polling, foreground refresh and successful-backup refresh remain. A date change never displays another date's result. No tab navigation structure or account-specific component keys were changed.

Tests: `test/home-swr.test.tsx` adds hook-level loading, SQLite/cache, remount, expiry, error, retry, overlap, cleanup, scope/reset and persisted-reader startup scenarios. `test/circle-board.test.tsx` adds initial-load and real-client expired-cache/remount/request-sharing/error/recovery cases and updates failed-refresh retention expectations. `test/api-client.test.ts` verifies display-only staleness, unchanged TTL, date/session separation, defensive copies, network-failure retention and out-of-order completion after invalidation. Existing backup-triggered/60-second refresh tests continue to pass.

## Verification

- Full app Jest suite: **534 tests passed in 62 suites**.
- App TypeScript, Expo lint, changed-file formatting and `git diff --check`: passed.
- No native source, tracking/deduplication, authentication lifecycle, migration, backup/restore, goals/history persistence, database schema, backend endpoint or API payload contract was changed by this task. The new API-client display accessor is an in-process helper, not a server contract.
- Display snapshots are memory-only. After process restart there is one initial read from existing SQLite persistence; no durable cache was introduced. War initially fetches from the backend after process restart. Mocked native reads/real request-client fixtures exercise these paths; physical-phone restart/first-install visual testing was not performed for this task.
- The workspace contained earlier migration/count fixes at the start. Those changes were preserved. This task did not commit, push, deploy or install a new native build.

- User-reported validation on 30 October 2026: the user confirmed verification on a physical device before requesting commit and push. Specific first-install/restart scenarios were not separately reported.
