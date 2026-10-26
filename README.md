# Driftless (working name) — app

Original digital-wellbeing app that helps people understand and reduce short-video scrolling.
Android + initial iPhone port. Expo SDK 57 custom dev client with Kotlin tracking and Swift Screen Time controls.
Backend and shared contracts: [Siddiq3/driftless-backend](https://github.com/Siddiq3/driftless-backend) (D-016).

**Status: Phase 1 (foundations) in progress.** See [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md).

| Path | What |
|---|---|
| `app/` | Screens (expo-router) |
| `src/` | API client, auth (direct Google sign-in), local DB, UI kit, design tokens |
| `modules/tracking-android` | Kotlin Expo module (tracking engine lands in Phase 2) |
| `test/` | Jest unit tests |
| `docs/` | Product spec, architecture, threat model, decisions, test plan |

## Develop

The shared contracts package comes from GitHub Packages, so you need a GitHub token with
`read:packages`:

```sh
export NODE_AUTH_TOKEN=<github token with read:packages>
pnpm install
pnpm typecheck && pnpm lint && pnpm test
pnpm android        # builds and runs the Android dev client
pnpm ios            # builds and runs the iOS dev client (requires Xcode)
```

CI publishes step logs for each push to `main` to the `ci-results` branch.

## Account login

Google is the only login provider; local tracking remains available to guests. See [Google sign-in setup](docs/GOOGLE_SIGN_IN.md) for OAuth client IDs, Android signing certificates and the matching backend audience.

Daily/weekly story recaps and build requirements: [Wrapped](docs/WRAPPED.md).

Daily friend counts, consent, eligibility and release requirements:
[Daily friend comparisons](docs/SOCIAL_COMPARISONS.md).

Counting and feed-limit implementation, emulator findings and outstanding release gates:
[Feed limit milestones](docs/tracking/FEED_LIMIT_MILESTONES.md).

For iPhone setup, implemented features and remaining release work, see [iOS](docs/IOS.md).
