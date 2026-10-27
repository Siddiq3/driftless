# Shared contracts snapshot

The app installs `@siddiq3/driftless-contracts` 0.4.0 from the committed archive here.
No GitHub token is required by EAS or CI. Existing package imports and exports are preserved.

Source: https://github.com/Siddiq3/driftless-backend/tree/0231871bea80a61e29d39412b53b3c6a01e86af1/packages/contracts

Built using the package TypeScript configuration, then `npm pack --ignore-scripts`.
SHA-256: `22cf2162b1ca4779ae761a6f80a78316117bfc42d7bfe507cbb070ae214c7735`.

To update: build the intended backend contracts commit, pack it into this directory,
update the dependency path/version and lockfile if present, then run app TypeScript and tests.
Commit the reviewed archive; cloud builds must not rebuild it from a moving backend branch.
