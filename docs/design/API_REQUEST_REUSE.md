# API request reuse

## Scope

`src/api/client.ts` shares simultaneous identical GET transports across clients using the
same credential getter, API origin, authentication generation, account incarnation and path.
It now also retains successful profile and goal reads for a maximum of two seconds. This
joins sequential startup, backup and screen requests without adding persistent/offline data.
Cached DTOs are copied before returning so callers cannot mutate another reader's response.

`AccountBoundary` primes the verified bound client's profile and allowance only after exact
incarnation verification, storage binding and native allowance installation. The initial
allowance response is reusable once, and only within two seconds of the original startup
read beginning. Slow startup does not renew its age. Normal allowance GETs and lifecycle
GETs are never retained as completed reusable reads.

Every write clears reusable data at its start and finish, including failed/conflicting writes.
GET transport keys include the current write revision. A GET started before or during a write
cannot populate the reusable cache after that write or join a new post-write refresh.
Post-reconciliation usage reads therefore still fetch current credit. Cancellation and the
signed-in generation are checked before any reused result is returned. Different credential
getters/incarnations never reuse each other's data. Errors are not cached.

`AccountBackupProvider` coalesces foreground/interval callbacks arriving within two seconds
of a successful run only when both local revisions are unchanged. Manual Retry clears reused
reads and bypasses this coalescing. Failed work, changed local data, periodic one-minute
account-day/credit checks and later foreground refreshes still run. Concurrent backup work
continues to share one worker task.

## Deliberate remaining requests

This is not a blanket API cache or mutation deduplication layer. Writes still run under their
existing idempotency, revision and queue rules. A profile update, changed goals, allowance
reconciliation/reservation, an expired read, account change, explicit Retry, or failure may
require another request to the same endpoint. Those refreshes must not be removed simply
because their URLs match.

## Validation

API transport tests assert sequential reuse and expiration, response-copy isolation, one-use
startup allowance handoff, wrong-incarnation rejection, original read age, mutation/conflict
invalidation, stale in-flight GET fencing, cancellation/generation checks, manual refresh and
retry after errors. Provider tests assert immediate foreground coalescing while retaining
manual and periodic refresh. The lifecycle test verifies handoff only after initialization.

## War tab return

War previously reset its daily board to null and read `/v1/battles/daily` on every
focus. Daily board results now have a separate 15-second in-memory reuse window,
keyed by the existing credential getter, origin, account generation, incarnation
and selected date. A new route instance can synchronously display a copied recent
snapshot. The focused board preserves an already loaded same-date result while
refreshing; switching dates never shows the prior date's results.

The minute timer, foreground return and a newly completed backup force fresh reads.
An already-saved backup status on mounting the route does not trigger an extra
forced read. Writes invalidate these snapshots along with the other reused reads;
failed forced refreshes do not leave a reusable snapshot. Access-loss responses
still clear displayed counts. This does not cache lifecycle or normal allowance
reads or persist a leaderboard to disk. Friends' changes made elsewhere may be
visible after this short freshness window or the next normal refresh.

Tests cover remount rendering, expiry, forced reads, copied-response isolation,
date separation, cancellation, write invalidation, access loss and account
generation changes. Typecheck, lint and all 501 tests pass after this change.
