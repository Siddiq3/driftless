# Social tracker mascot icon

`play-store-icon-512.png` is the Play Console upload: 512 × 512 RGBA PNG,
with an opaque background and no pre-rounded outer corners. The original
supplied artwork is preserved in `original-artwork.png`.

`icon-master.png` was edited with the built-in image generation tool. Prompt:

> Edit the supplied app icon artwork for production use. Preserve the exact purple brain mascot, facial expression, phone, all surrounding social app symbols, crown, '23' bubble, and 'Today 1h 47m' panel, colors and 3D style. Only remove the pre-rounded outer silhouette and white corner margins: extend the existing dark warm brown background naturally to all four square corners, making a full bleed square icon with no external shadow, no border and no white margins. Do not simplify or redesign the supplied artwork. Output a square high resolution image suitable for downsampling to a 512px Google Play icon.

Run `node scripts/generate-brand-icons.cjs` from the app root to regenerate
the store icon, 1024 × 1024 app icon, adaptive foreground, native Android
launcher resources and matching splash assets. The original purple icon
master remains available in the sibling `purple` folder.

The native app needs a new build to display the updated launcher icon.
