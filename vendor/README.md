# Shared contracts snapshot

The app installs `@siddiq3/driftless-contracts` 0.5.0 from the committed archive here.
No GitHub token is required by EAS or CI. Existing package imports and exports are preserved.

Source: `driftless-backend/packages/contracts` working tree (uncommitted 0.5.0, coverage optional)

Built using the package TypeScript configuration, then `npm pack --ignore-scripts`.
SHA-256: `730fde47d4828e62b101a2557f562c3d9e263ba7c88b3b5760e7ad40bbf89ecc`.

To update: build the intended backend contracts commit, pack it into this directory,
update the dependency path/version and lockfile if present, then run app TypeScript and tests.
Commit the reviewed archive; cloud builds must not rebuild it from a moving backend branch.
