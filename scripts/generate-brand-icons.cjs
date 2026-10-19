const fs = require('node:fs/promises');
const path = require('node:path');
const {
  generateImageAsync,
  generateImageBackgroundAsync,
  compositeImagesAsync,
} = require('@expo/image-utils');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'assets/branding/brain-mark.png');
const cream = '#FFE6AD';
async function generate(target, width, backgroundColor = 'transparent', src = source) {
  const result = await generateImageAsync(
    { projectRoot: root },
    {
      src,
      width,
      height: width,
      resizeMode: 'contain',
      backgroundColor,
    },
  );
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, result.source);
}
async function main() {
  await generate(path.join(root, 'assets/branding/app-icon.png'), 1024, cream);
  const foreground = path.join(root, 'assets/branding/adaptive-foreground.png');
  const inner = await generateImageAsync(
    { projectRoot: root },
    { src: source, width: 820, height: 820, resizeMode: 'contain' },
  );
  const background = await generateImageBackgroundAsync({
    width: 1024,
    height: 1024,
    resizeMode: 'contain',
    backgroundColor: 'transparent',
  });
  await fs.writeFile(
    foreground,
    await compositeImagesAsync({ foreground: inner.source, background, x: 102, y: 102 }),
  );
  const res = path.join(root, 'android/app/src/main/res');
  await fs.mkdir(path.join(res, 'mipmap-anydpi-v26'), { recursive: true });
  for (const [density, scale] of [
    ['mdpi', 1],
    ['hdpi', 1.5],
    ['xhdpi', 2],
    ['xxhdpi', 3],
    ['xxxhdpi', 4],
  ]) {
    const folder = path.join(res, `mipmap-${density}`);
    for (const name of ['ic_launcher', 'ic_launcher_round']) {
      await fs.rm(path.join(folder, `${name}.webp`), { force: true });
      await generate(path.join(folder, `${name}.png`), Math.round(48 * scale), cream);
    }
    await generate(
      path.join(folder, 'ic_launcher_foreground.png'),
      Math.round(108 * scale),
      'transparent',
      foreground,
    );
    await generate(
      path.join(res, `drawable-${density}/splashscreen_mark.png`),
      Math.round(180 * scale),
      'transparent',
      foreground,
    );
    await fs.rm(path.join(res, `drawable-${density}/splashscreen_logo.png`), { force: true });
  }
  for (const name of ['ic_launcher', 'ic_launcher_round']) {
    await fs.writeFile(
      path.join(res, 'mipmap-anydpi-v26', `${name}.xml`),
      `<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n  <background android:drawable="@color/brand_icon_background" />\n  <foreground android:drawable="@mipmap/ic_launcher_foreground" />\n</adaptive-icon>\n`,
    );
  }
  await fs.writeFile(
    path.join(res, 'values/brand_colors.xml'),
    `<resources><color name="brand_icon_background">${cream}</color></resources>\n`,
  );
  await fs.writeFile(
    path.join(res, 'drawable/splashscreen_logo.xml'),
    `<?xml version="1.0" encoding="utf-8"?>\n<layer-list xmlns:android="http://schemas.android.com/apk/res/android">\n  <item android:drawable="@color/brand_icon_background" />\n  <item><bitmap android:gravity="center" android:src="@drawable/splashscreen_mark" /></item>\n</layer-list>\n`,
  );
  await fs.mkdir(path.join(res, 'values-v31'), { recursive: true });
  await fs.writeFile(
    path.join(res, 'values-v31/brand_splash.xml'),
    `<resources>\n  <style name="Theme.App.SplashScreen" parent="AppTheme">\n    <item name="android:windowSplashScreenBackground">@color/brand_icon_background</item>\n    <item name="android:windowSplashScreenAnimatedIcon">@drawable/splashscreen_mark</item>\n    <item name="android:windowBackground">@drawable/splashscreen_logo</item>\n  </style>\n</resources>\n`,
  );
  console.log('Generated launcher icons and splash assets.');
}
module.exports = main;
if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
