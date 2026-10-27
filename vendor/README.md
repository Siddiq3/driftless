# Shared contracts snapshot

The app installs `@siddiq3/driftless-contracts` 0.4.0 from the committed archive here.
No GitHub token is required by EAS or CI. Existing package imports and exports are preserved.

Source: https://github.com/Siddiq3/driftless-backend/tree/9a4181d53628f8e4916e40a0386ebba8cef5d3c5/packages/contracts

Built using the package TypeScript configuration, then `npm pack --ignore-scripts`.
SHA-256: `80aa5c5460f854303cefb0d0b69ad07de1426008aa7f1809876c89f4f6ee430e`.

To update: build the intended backend contracts commit, pack it into this directory,
update the dependency path/version and lockfile if present, then run app TypeScript and tests.
Commit the reviewed archive; cloud builds must not rebuild it from a moving backend branch.
