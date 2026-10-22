# ScrollSnooze identity

The active identity uses the [purple ScrollSnooze character set](scrollsnooze/purple/README.md), a brain hugging a paused phone, and a midnight `#10102B` launcher/splash background. The earlier coral and peach assets are retained as design history.

- `scrollsnooze/purple/icon-master.png`: active transparent generated master. `brain-mark.png` is the earlier coral mark.
- `adaptive-foreground.png`: padded transparent foreground, keeping the face inside Android's central mask-safe region.
- `app-icon.png`: opaque 1024px launcher/store image.

`BrandMark` places the same identity in the Get Started and dashboard headers. Android legacy/round/adaptive launchers and startup use generated native densities. Run `node scripts/generate-brand-icons.cjs` to rebuild. The local Expo config plugin repeats this generation during prebuild so changes survive regeneration of the ignored Android project. Source artwork stays in the repository.

Verification: master and opaque icon inspected, native resource build passed, app TypeScript/lint and Jest passed. Launcher mask rendering and splash startup appearance have not been captured through the emulator UI tools.
