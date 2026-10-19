# UI asset provenance

All character illustrations are original transparent PNG assets produced using the built-in ImageGen tool on 19 October 2026, guided by the user-provided visual references. They are images used inside live React Native layouts; no screen was flattened into an image.

- `assets/illustrations/brain-wave.png`: original coral-pink brain, large expressive eyes, full body waving, transparent. Main generated output `01a15056-38aa-7b10-b5cc-ec6a786fdf7b/exec-457b8c18-9351-45b0-a933-4fab419c8df0.png`. Prompt requested an original Driftless character without text or BrainPal branding.
- `brain-privacy.png`: matching brain holding a gold padlock, transparent. Generated with the main character as the style reference.
- `brain-tired.png`: matching character with drooping eyelids and a concerned expression. Generated from the main character reference; no decay or shaming imagery.
- `challenge-duo.png`: two original young adult friends with brain companions, amber lightning between them; transparent and no labels/numbers. Generated asset-only subtask, visually inspected.
- `modules/tracking-android/android/src/main/res/drawable/brain_wave.png`: 384px derivative of the waving PNG for Android RemoteViews.

Font: `assets/fonts/LilitaOne-Regular.ttf` from https://github.com/google/fonts/tree/main/ofl/lilitaone. SIL Open Font License retained beside the font in `OFL-LilitaOne.txt`. System sans-serif remains the readable body/control font and font-load fallback.

Google mark: https://www.gstatic.com/images/branding/product/1x/googleg_48dp.png. Used only to identify Google sign-in.

Instagram app icon: https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png (resized to 256px). Used only to identify the external installed app; no endorsement is implied.

Existing standard UI SVG icons, data visualizations and gradient/button surfaces remain native code. The source Android status bar, navigation indicator and third-party branding were not baked into app content.

Wrapped adds `brain-wrapped.png` (transparent brain with film reel) and `wrapped-night.png` (portrait night backdrop). These are original generated raster illustrations; story text, data, charts and controls remain native UI.
