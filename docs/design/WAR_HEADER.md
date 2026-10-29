# Compact War header

The brown area now contains only the profile, flexible title and Friends action.
Removed row wrapping and the title's 160dp minimum width, which previously pushed
Friends onto a second row. Friends stays at the trailing edge with a 48dp target.
The title remains scalable and can wrap within its available space at large text
sizes. Date navigation is a separate, compact row on the main background.

New header sizing/spacing values live in `src/social/warTheme.ts` and reuse shared
spacing/touch tokens. Ranking, API reads/reuse, dates, invitations and navigation
handlers are unchanged.

Typecheck, lint and all 501 tests pass. Standalone arm64 APK builds and installs.
After setup completion, the compact header was visually verified on the physical
OnePlus CPH2569: profile, title and Friends fit on one line, with a separate date
row below. Tapping Friends opens the existing Google sign-in sheet because this
phone is currently in guest mode. Signed-in Friends-list navigation remains covered
by the existing component tests. Screenshots are in workspace
`output/war-header-20261029/`.

## Count placeholder

Per the user's request, an unavailable/not-started daily count displays `0` in the
count column. Actual zero values continue to display `0`. Ranking still receives
null for unavailable measurements, so a placeholder cannot win a battle or become
a recorded zero. A short helper and accessibility label preserve that distinction.
The left rank column still uses its existing unranked marker. Automated board
coverage checks the placeholder, real zeros, no local-count substitution and no
rank awarded to missing data.
