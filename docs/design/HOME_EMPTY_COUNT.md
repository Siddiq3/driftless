# Home count empty states

Home's main count uses short state-specific messages instead of a large dash or
zero: Getting today ready during loading, Let’s reconnect on error, A fresh start
for a real zero, and Ready when you are or Your day starts here for unavailable
activity depending on counting readiness. Positive counts keep the existing large
number and Short videos today label. App breakdowns use Pending for unknown counts
and Not yet for zero, with positive totals unchanged. Accessibility labels retain
the underlying known/unknown distinction.

`src/ui/homeCount.ts` owns the message selection and typography derived from the
shared design tokens. Storage, tracking, goals, ranking, count fallbacks and API
behavior are unchanged. Existing permission setup and retry actions remain.

Typecheck and lint pass. All 502 tests across 60 suites pass, including loading,
error, zero, unknown, permission readiness and positive-count presentation cases.
The standalone Android build succeeds. Phone visual evidence is saved under
workspace `output/home-empty-20261029/`.
