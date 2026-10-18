# Driftless (working name)

Original digital-wellbeing app that helps people understand and reduce short-video scrolling.
Android first (D-015); React Native/Expo + Kotlin, AWS serverless backend.

**Status: Phase 1 (foundations) in progress.** See [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md).

## Layout

| Path | What |
|---|---|
| `apps/mobile` | Expo SDK 57 app (custom dev client), `modules/tracking-android` Kotlin module |
| `packages/contracts` | Shared zod API schemas (v1) + OpenAPI generation |
| `packages/domain` | Pure TS: local dates, goals, streaks, Wick progression, reference view-counting rule |
| `packages/design-tokens` | Colours, spacing, type; WCAG AA contrast enforced by tests |
| `services/api` | Lambda HTTP API (Node 22) |
| `infra` | AWS CDK app — synth only, nothing is deployed |
| `docs` | Product spec, architecture, threat model, decisions, test plan |

## Commands

```sh
pnpm install
pnpm build && pnpm lint && pnpm typecheck
docker run -d -p 8000:8000 amazon/dynamodb-local
DDB_ENDPOINT=http://localhost:8000 pnpm test
pnpm --filter @driftless/infra synth
```

CI publishes step logs for each push to `main` to the `ci-results` branch.
